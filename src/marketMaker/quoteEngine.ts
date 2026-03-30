import type { Settings } from "../config.js";
import type { InventoryManager } from "../inventory/inventoryManager.js";

export interface Quote {
  side: string;
  price: number;
  size: number;
  market: string;
  tokenId: string;
}

export class QuoteEngine {
  constructor(
    private readonly settings: Settings,
    private readonly inventoryManager: InventoryManager,
  ) {}

  calculateBidPrice(midPrice: number, spreadBps: number): number {
    return midPrice * (1 - spreadBps / 10000);
  }

  calculateAskPrice(midPrice: number, spreadBps: number): number {
    return midPrice * (1 + spreadBps / 10000);
  }

  calculateMidPrice(bestBid: number, bestAsk: number): number {
    if (bestBid <= 0 || bestAsk <= 0) return 0;
    return (bestBid + bestAsk) / 2;
  }

  generateQuotes(
    marketId: string,
    bestBid: number,
    bestAsk: number,
    yesTokenId: string,
    noTokenId: string,
  ): [Quote | undefined, Quote | undefined] {
    const midPrice = this.calculateMidPrice(bestBid, bestAsk);
    if (midPrice === 0) return [undefined, undefined];

    const spreadBps = this.settings.minSpreadBps;
    const bidPrice = this.calculateBidPrice(midPrice, spreadBps);
    const askPrice = this.calculateAskPrice(midPrice, spreadBps);
    const baseSize = this.settings.defaultSize;

    const yesSize = this.inventoryManager.getQuoteSizeYes(baseSize, midPrice);
    const noSize = this.inventoryManager.getQuoteSizeNo(baseSize, midPrice);

    let yesQuote: Quote | undefined;
    let noQuote: Quote | undefined;

    if (this.inventoryManager.canQuoteYes(yesSize)) {
      yesQuote = {
        side: "BUY",
        price: bidPrice,
        size: yesSize,
        market: marketId,
        tokenId: yesTokenId,
      };
    }

    if (this.inventoryManager.canQuoteNo(noSize)) {
      noQuote = {
        side: "BUY",
        price: 1.0 - askPrice,
        size: noSize,
        market: marketId,
        tokenId: noTokenId,
      };
    }

    return [yesQuote, noQuote];
  }
}
