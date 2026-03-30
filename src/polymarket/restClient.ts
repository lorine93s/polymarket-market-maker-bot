import type { Settings } from "../config.js";
import type { Logger } from "../logger.js";

export class PolymarketRestClient {
  private readonly baseUrl: string;

  constructor(
    private readonly settings: Settings,
    private readonly log: Logger,
  ) {
    this.baseUrl = settings.polymarketApiUrl.replace(/\/$/, "");
  }

  async getMarkets(active = true, closed = false): Promise<Record<string, unknown>[]> {
    try {
      const params = new URLSearchParams({
        active: String(active).toLowerCase(),
        closed: String(closed).toLowerCase(),
      });
      const res = await fetch(`${this.baseUrl}/markets?${params}`);
      if (!res.ok) throw new Error(`markets ${res.status}`);
      const body: unknown = await res.json();
      if (Array.isArray(body)) return body as Record<string, unknown>[];
      if (body && typeof body === "object" && "data" in body && Array.isArray((body as { data: unknown }).data)) {
        return (body as { data: Record<string, unknown>[] }).data;
      }
      if (body && typeof body === "object" && "markets" in body && Array.isArray((body as { markets: unknown }).markets)) {
        return (body as { markets: Record<string, unknown>[] }).markets;
      }
      this.log.warn({ body_type: typeof body }, "markets_unexpected_shape");
      return [];
    } catch (e) {
      this.log.error({ err: e }, "markets_fetch_failed");
      throw e;
    }
  }

  async getOrderbook(marketId: string): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams({ market: marketId });
      const res = await fetch(`${this.baseUrl}/book?${params}`);
      if (!res.ok) throw new Error(`orderbook ${res.status}`);
      return (await res.json()) as Record<string, unknown>;
    } catch (e) {
      this.log.error({ err: e, market_id: marketId }, "orderbook_fetch_failed");
      throw e;
    }
  }

  async getMarketInfo(marketId: string): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${this.baseUrl}/markets/${marketId}`);
      if (!res.ok) throw new Error(`market_info ${res.status}`);
      return (await res.json()) as Record<string, unknown>;
    } catch (e) {
      this.log.error({ err: e, market_id: marketId }, "market_info_fetch_failed");
      throw e;
    }
  }

  async getBalances(address: string): Promise<Record<string, unknown>> {
    try {
      const params = new URLSearchParams({ user: address });
      const res = await fetch(`${this.baseUrl}/balances?${params}`);
      if (!res.ok) throw new Error(`balances ${res.status}`);
      return (await res.json()) as Record<string, unknown>;
    } catch (e) {
      this.log.error({ err: e, address }, "balances_fetch_failed");
      throw e;
    }
  }

  async getOpenOrders(address: string, marketId?: string): Promise<Record<string, unknown>[]> {
    try {
      const params = new URLSearchParams({ user: address });
      if (marketId) params.set("market", marketId);
      const res = await fetch(`${this.baseUrl}/open-orders?${params}`);
      if (!res.ok) throw new Error(`open_orders ${res.status}`);
      return (await res.json()) as Record<string, unknown>[];
    } catch (e) {
      this.log.error({ err: e, address }, "open_orders_fetch_failed");
      throw e;
    }
  }
}
