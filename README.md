# Polymarket Market Maker Bot (TypeScript)

Node.js **20+** market-making bot for Polymarket CLOB: quotes, cancel/replace, basic risk limits, optional auto-redeem, and a Prometheus `/metrics` endpoint.

## Quick start

1. Install Node.js 20 or newer.

2. Install dependencies and build:

```bash
npm install
npm run build
```

3. Copy env and set secrets:

```bash
copy .env.example .env
```

At minimum set `PRIVATE_KEY` and `MARKET_ID`.

4. Run:

```bash
npm start
```

For development without a build step:

```bash
npm run dev
```

## Configuration

Environment variables match the Python version: see `.env.example`. Names are **UPPER_SNAKE_CASE** (e.g. `POLYMARKET_API_URL`, `QUOTE_REFRESH_RATE_MS`).

## Metrics

Default scrape URL: `http://localhost:9305/metrics`

## Docs

More guides: [`docs/README.md`](docs/README.md).

## Legacy Python

The previous Python implementation was replaced by this TypeScript codebase. If you still need the old tree, recover it from git history.
