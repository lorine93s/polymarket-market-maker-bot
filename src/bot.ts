import type { Settings } from "./config.js";
import type { Logger } from "./logger.js";
import { OrderExecutor } from "./execution/orderExecutor.js";
import { InventoryManager } from "./inventory/inventoryManager.js";
import { QuoteEngine, type Quote } from "./marketMaker/quoteEngine.js";
import { OrderSigner } from "./polymarket/orderSigner.js";
import { PolymarketRestClient } from "./polymarket/restClient.js";
import { PolymarketWebSocketClient } from "./polymarket/websocketClient.js";
import { RiskManager } from "./risk/riskManager.js";
import { AutoRedeem } from "./services/autoRedeem.js";

export class MarketMakerBot {
  running = false;
  private readonly restClient: PolymarketRestClient;
  private readonly wsClient: PolymarketWebSocketClient;
  private readonly orderSigner: OrderSigner;
  private readonly orderExecutor: OrderExecutor;
  private readonly inventoryManager: InventoryManager;
  private readonly riskManager: RiskManager;
  private readonly quoteEngine: QuoteEngine;
  private readonly autoRedeem: AutoRedeem;

  private currentOrderbook: Record<string, unknown> = {};
  private lastQuoteTime = 0;

  constructor(
    private readonly settings: Settings,
    private readonly log: Logger,
  ) {
    this.restClient = new PolymarketRestClient(settings, log);
    this.wsClient = new PolymarketWebSocketClient(settings, log);
    this.orderSigner = new OrderSigner(settings.privateKey, log);
    this.orderExecutor = new OrderExecutor(settings, this.orderSigner, log);
    this.inventoryManager = new InventoryManager(
      settings.maxExposureUsd,
      settings.minExposureUsd,
      settings.targetInventoryBalance,
      log,
    );
    this.riskManager = new RiskManager(settings, this.inventoryManager, log);
    this.quoteEngine = new QuoteEngine(settings, this.inventoryManager);
    this.autoRedeem = new AutoRedeem(settings, log);
  }

  /** Stop quote loops and close the websocket (e.g. SIGINT / SIGTERM). */
  interrupt(): void {
    this.running = false;
    void this.wsClient.close();
  }

  async discoverMarket(): Promise<Record<string, unknown> | undefined> {
    if (!this.settings.marketDiscoveryEnabled) {
      return this.restClient.getMarketInfo(this.settings.marketId);
    }

    try {
      const markets = await this.restClient.getMarkets(true, false);
      for (const market of markets) {
        if (String(market.id ?? "") === this.settings.marketId) {
          this.log.info(
            { market_id: market.id, question: market.question },
            "market_discovered",
          );
          return market;
        }
      }
      this.log.warn({ market_id: this.settings.marketId }, "market_not_found");
      return undefined;
    } catch (e) {
      this.log.error({ err: e }, "market_discovery_failed");
      return undefined;
    }
  }

  async updateOrderbook(): Promise<void> {
    try {
      const orderbook = await this.restClient.getOrderbook(this.settings.marketId);
      this.currentOrderbook = orderbook;
    } catch (e) {
      this.log.error({ err: e }, "orderbook_update_failed");
    }
  }

  private async handleOrderbookUpdate(data: Record<string, unknown>): Promise<void> {
    if (data.market === this.settings.marketId) {
      const book = data.book;
      if (book && typeof book === "object") {
        this.currentOrderbook = book as Record<string, unknown>;
      }
    }
  }

  async refreshQuotes(marketInfo: Record<string, unknown>): Promise<void> {
    const currentTime = Date.now();
    const elapsed = currentTime - this.lastQuoteTime;
    if (elapsed < this.settings.quoteRefreshRateMs) return;

    this.lastQuoteTime = currentTime;

    let orderbook = this.currentOrderbook;
    if (!orderbook || Object.keys(orderbook).length === 0) {
      await this.updateOrderbook();
      orderbook = this.currentOrderbook;
    }

    const bestBid = Number(orderbook.best_bid ?? 0);
    const bestAsk = Number(orderbook.best_ask ?? 1);

    if (bestBid <= 0 || bestAsk <= 1) {
      this.log.warn({ best_bid: bestBid, best_ask: bestAsk }, "invalid_orderbook");
      return;
    }

    const yesTokenId = String(marketInfo.yes_token_id ?? "");
    const noTokenId = String(marketInfo.no_token_id ?? "");

    const [yesQuote, noQuote] = this.quoteEngine.generateQuotes(
      this.settings.marketId,
      bestBid,
      bestAsk,
      yesTokenId,
      noTokenId,
    );

    await this.cancelStaleOrders();

    if (yesQuote) await this.placeQuote(yesQuote, "YES");
    if (noQuote) await this.placeQuote(noQuote, "NO");
  }

  private async cancelStaleOrders(): Promise<void> {
    try {
      const openOrders = await this.restClient.getOpenOrders(
        this.orderSigner.getAddress(),
        this.settings.marketId,
      );

      const currentTime = Date.now();
      const orderIdsToCancel: string[] = [];

      for (const order of openOrders) {
        const orderTime = Number(order.timestamp ?? 0);
        const age = currentTime - orderTime;
        if (age > this.settings.orderLifetimeMs) {
          const id = order.id;
          if (typeof id === "string") orderIdsToCancel.push(id);
        }
      }

      if (orderIdsToCancel.length > 0) {
        await this.orderExecutor.batchCancelOrders(orderIdsToCancel);
      }
    } catch (e) {
      this.log.error({ err: e }, "stale_order_cancellation_failed");
    }
  }

  private async placeQuote(quote: Quote, outcome: string): Promise<void> {
    const [isValid, reason] = this.riskManager.validateOrder(quote.side, quote.size * quote.price);
    if (!isValid) {
      this.log.warn({ reason, outcome }, "quote_rejected");
      return;
    }

    try {
      const order: Record<string, unknown> = {
        market: quote.market,
        side: quote.side,
        size: String(quote.size),
        price: String(quote.price),
        token_id: quote.tokenId,
      };

      const result = await this.orderExecutor.placeOrder(order);
      this.log.info(
        {
          outcome,
          side: quote.side,
          price: quote.price,
          size: quote.size,
          order_id: result.id,
        },
        "quote_placed",
      );
    } catch (e) {
      this.log.error({ err: e, outcome }, "quote_placement_failed");
    }
  }

  async runCancelReplaceCycle(marketInfo: Record<string, unknown>): Promise<void> {
    while (this.running) {
      try {
        await this.refreshQuotes(marketInfo);
        await sleep(this.settings.cancelReplaceIntervalMs / 1000);
      } catch (e) {
        this.log.error({ err: e }, "cancel_replace_cycle_error");
        await sleep(1);
      }
    }
  }

  async runAutoRedeemLoop(): Promise<void> {
    while (this.running) {
      try {
        if (this.settings.autoRedeemEnabled) {
          await this.autoRedeem.autoRedeemAll(this.orderSigner.getAddress());
        }
        await sleep(300);
      } catch (e) {
        this.log.error({ err: e }, "auto_redeem_error");
        await sleep(60);
      }
    }
  }

  async run(): Promise<void> {
    this.running = true;
    this.log.info({ market_id: this.settings.marketId }, "market_maker_starting");

    const marketInfo = await this.discoverMarket();
    if (!marketInfo) {
      this.log.error("market_not_available");
      return;
    }

    await this.updateOrderbook();

    if (this.settings.marketDiscoveryEnabled) {
      await this.wsClient.connect();
      await this.wsClient.subscribeOrderbook(this.settings.marketId);
      this.wsClient.registerHandler("l2_book_update", (data) => this.handleOrderbookUpdate(data));
    }

    const tasks: Promise<void>[] = [
      this.runCancelReplaceCycle(marketInfo),
      this.runAutoRedeemLoop(),
    ];

    if (this.wsClient.running) {
      tasks.push(this.wsClient.listen());
    }

    try {
      await Promise.all(tasks);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup(): Promise<void> {
    this.running = false;
    await this.orderExecutor.cancelAllOrders(this.settings.marketId);
    await this.wsClient.close();
    this.log.info("market_maker_shutdown_complete");
  }
}

function sleep(seconds: number): Promise<void> {
  return new Promise((r) => setTimeout(r, seconds * 1000));
}
