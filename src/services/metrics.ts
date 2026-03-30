import http from "node:http";
import { Counter, Gauge, Histogram, Registry } from "prom-client";

export const registry = new Registry();

export const ordersPlacedCounter = new Counter({
  name: "pm_mm_orders_placed_total",
  help: "Total orders placed by side and outcome",
  labelNames: ["side", "outcome"],
  registers: [registry],
});

export const ordersFilledCounter = new Counter({
  name: "pm_mm_orders_filled_total",
  help: "Total orders filled (passive fills)",
  labelNames: ["side", "outcome"],
  registers: [registry],
});

export const ordersCancelledCounter = new Counter({
  name: "pm_mm_orders_cancelled_total",
  help: "Total orders cancelled",
  registers: [registry],
});

export const inventoryGauge = new Gauge({
  name: "pm_mm_inventory",
  help: "Current inventory positions",
  labelNames: ["type"],
  registers: [registry],
});

export const exposureGauge = new Gauge({
  name: "pm_mm_exposure_usd",
  help: "Current net exposure in USD",
  registers: [registry],
});

export const spreadGauge = new Gauge({
  name: "pm_mm_spread_bps",
  help: "Current spread in basis points",
  registers: [registry],
});

export const profitGauge = new Gauge({
  name: "pm_mm_profit_usd",
  help: "Cumulative profit in USD",
  registers: [registry],
});

export const quoteLatencyHistogram = new Histogram({
  name: "pm_mm_quote_latency_ms",
  help: "Quote generation and placement latency in milliseconds",
  buckets: [10, 50, 100, 250, 500, 1000],
  registers: [registry],
});

/** Minimal /metrics HTTP server (Prometheus scrape endpoint). */
export function startMetricsServer(host: string, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.setHeader("Content-Type", registry.contentType);
      res.end(await registry.metrics());
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  server.listen(port, host);
  return server;
}
