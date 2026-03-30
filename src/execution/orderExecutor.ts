import type { Settings } from "../config.js";
import type { Logger } from "../logger.js";
import { OrderSigner } from "../polymarket/orderSigner.js";

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

export class OrderExecutor {
  private readonly pendingCancellations = new Set<string>();

  constructor(
    private readonly settings: Settings,
    private readonly orderSigner: OrderSigner,
    private readonly log: Logger,
  ) {}

  async placeOrder(order: Record<string, unknown>): Promise<Record<string, unknown>> {
    const timestamp = Date.now();
    order.time = timestamp;
    order.salt = String(Math.floor(Date.now() / 1000));

    const signature = this.orderSigner.signOrder(order);
    order.signature = signature;
    order.maker = this.orderSigner.getAddress();

    const url = `${this.settings.polymarketApiUrl.replace(/\/$/, "")}/order`;
    const res = await fetch(url, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`place_order ${res.status}: ${body}`);
    }

    const result = (await res.json()) as Record<string, unknown>;
    this.log.info(
      { order_id: result.id, side: order.side, price: order.price },
      "order_placed",
    );
    return result;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      if (this.settings.batchCancellations && this.pendingCancellations.has(orderId)) {
        return true;
      }
      this.pendingCancellations.add(orderId);

      const url = `${this.settings.polymarketApiUrl.replace(/\/$/, "")}/order/${orderId}`;
      const res = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(String(res.status));

      this.log.info({ order_id: orderId }, "order_cancelled");
      return true;
    } catch (e) {
      this.log.error({ err: e, order_id: orderId }, "order_cancellation_failed");
      return false;
    }
  }

  async cancelAllOrders(marketId: string): Promise<number> {
    try {
      const base = this.settings.polymarketApiUrl.replace(/\/$/, "");
      const params = new URLSearchParams({ market: marketId });
      const res = await fetch(`${base}/orders?${params}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { cancelled?: number };
      const cancelled = body.cancelled ?? 0;
      this.log.info({ market_id: marketId, count: cancelled }, "orders_cancelled");
      this.pendingCancellations.clear();
      return cancelled;
    } catch (e) {
      this.log.error({ err: e, market_id: marketId }, "cancel_all_orders_failed");
      return 0;
    }
  }

  async batchCancelOrders(orderIds: (string | undefined)[]): Promise<number> {
    const ids = orderIds.filter((x): x is string => Boolean(x));
    if (ids.length === 0) return 0;

    if (!this.settings.batchCancellations) {
      let cancelled = 0;
      for (const id of ids) {
        if (await this.cancelOrder(id)) cancelled += 1;
      }
      return cancelled;
    }

    try {
      const base = this.settings.polymarketApiUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/orders/cancel`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ orderIds: ids }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(String(res.status));

      const cancelled = ids.filter((oid) => !this.pendingCancellations.has(oid)).length;
      this.pendingCancellations.clear();
      this.log.info({ count: cancelled }, "batch_orders_cancelled");
      return cancelled;
    } catch (e) {
      this.log.error({ err: e }, "batch_cancel_failed");
      return 0;
    }
  }
}
