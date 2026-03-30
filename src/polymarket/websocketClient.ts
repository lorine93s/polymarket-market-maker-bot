import { on } from "node:events";
import WebSocket from "ws";
import type { Settings } from "../config.js";
import type { Logger } from "../logger.js";

type MessageHandler = (data: Record<string, unknown>) => void | Promise<void>;

export class PolymarketWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly messageHandlers = new Map<string, MessageHandler>();
  running = false;

  constructor(
    private readonly settings: Settings,
    private readonly log: Logger,
  ) {}

  registerHandler(messageType: string, handler: MessageHandler): void {
    this.messageHandlers.set(messageType, handler);
  }

  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.settings.polymarketWsUrl);
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error("no ws"));
        this.ws.once("open", () => resolve());
        this.ws.once("error", reject);
      });
      this.log.info({ url: this.settings.polymarketWsUrl }, "websocket_connected");
      this.running = true;
    } catch (e) {
      this.log.error({ err: e }, "websocket_connection_failed");
      throw e;
    }
  }

  async subscribeOrderbook(marketId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) await this.connect();
    const message = { type: "subscribe", channel: "l2_book", market: marketId };
    this.ws!.send(JSON.stringify(message));
    this.log.info({ market_id: marketId }, "orderbook_subscribed");
  }

  async subscribeTrades(marketId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) await this.connect();
    const message = { type: "subscribe", channel: "trades", market: marketId };
    this.ws!.send(JSON.stringify(message));
    this.log.info({ market_id: marketId }, "trades_subscribed");
  }

  async listen(): Promise<void> {
    while (this.running) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        try {
          await this.connect();
        } catch {
          await sleep(5000);
          continue;
        }
      }

      const ws = this.ws!;
      try {
        for await (const rawEvent of on(ws, "message") as AsyncIterableIterator<
          [WebSocket.RawData, boolean]
        >) {
          if (!this.running) return;

          const rawData = rawEvent[0];
          const raw = typeof rawData === "string" ? rawData : rawData.toString();

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            continue;
          }

          const messageType = data.type;
          if (typeof messageType !== "string") continue;
          const handler = this.messageHandlers.get(messageType);
          if (handler) await handler(data);
        }
      } catch (e) {
        this.log.error({ err: e }, "websocket_listen_error");
      }

      if (!this.running) return;

      this.log.warn("websocket_connection_closed");
      await sleep(5000);
      try {
        await this.connect();
      } catch {
        /* next loop */
      }
    }
  }

  async close(): Promise<void> {
    this.running = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
