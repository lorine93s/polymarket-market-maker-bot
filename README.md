# Polymarket Market Maker Bot (TypeScript)

Node.js **20+** market-making bot for Polymarket CLOB: quotes, cancel/replace, basic risk limits, optional auto-redeem, and a Prometheus `/metrics` endpoint.

<<<<<<< HEAD
## Quick start
=======
<p>
  <a href="mailto:milosk920125@gmail.com">
    <img src="https://img.shields.io/badge/Email-milosk920125@gmail.com-ef4444?style=flat&logo=gmail&logoColor=white" />
  </a>
  <a href="https://t.me/lorine93s">
    <img src="https://img.shields.io/badge/Telegram-@lorine93s-2AABEE?style=flat&logo=telegram&logoColor=white" />
  </a>
  <a href="https://twitter.com/kakamajo_btc">
    <img src="https://img.shields.io/badge/Twitter-@kakamajo__btc-1DA1F2?style=flat&logo=twitter&logoColor=white" />
  </a>
</p>
>>>>>>> eb87b2a0308eb2f38f96ff75c6f2048d1fe6c0bf

1. Install Node.js 20 or newer.

<<<<<<< HEAD
2. Install dependencies and build:

```bash
npm install
npm run build
```

3. Copy env and set secrets:
=======
The Polymarket Market Maker Bot provides:

- **Real-time market making** on Polymarket CLOB (Central Limit Order Book)
- **Balanced inventory management** with mirrored YES/NO exposure control
- **Intelligent quote placement** at top-of-book for maximum spread capture
- **Optimized cancel/replace cycles** tuned for 500ms taker delay
- **Passive order execution** to earn maker rebates and avoid crossing
- **Risk management** with exposure limits, position size caps, and inventory skew checks
- **Auto-redeem** for settled markets and profitable positions
- **Gas batching** to minimize on-chain transaction costs
- **Real-time orderbook tracking** via WebSocket for low-latency updates

## Core Features

### Inventory Balance & Exposure Control

- **Mirrored YES/NO positioning** – Maintains balanced exposure across both sides
- **Net exposure limits** – Configurable min/max exposure in USD
- **Inventory skew detection** – Automatically adjusts quote sizes when inventory becomes unbalanced
- **Automatic rebalancing** – Smart quote sizing to reduce runaway inventory
- **Target inventory balance** – Maintains desired net exposure level

### Spread Farming Efficiency

- **Top-of-book quoting** – Places orders at best bid/ask for maximum fill probability
- **Passive order execution** – All orders are maker orders to earn rebates
- **Queue positioning** – Optimized order placement for better queue position
- **Missed fill reduction** – Fast cancel/replace cycles to capture spread opportunities
- **Anti-crossing logic** – Prevents accidental taker orders

### Cancel/Replace Cadence

- **Low-latency refresh cycles** – Configurable quote refresh rate (default: 1000ms)
- **500ms taker delay optimization** – Timing logic tuned for Polymarket's 500ms delay
- **Batch cancellations** – Groups cancel requests to reduce API calls and gas costs
- **Stale order detection** – Automatically cancels orders exceeding lifetime threshold
- **Smooth quote transitions** – No gaps or overlaps during refresh cycles

### Market Discovery & Real-Time Updates

- **15m/1h window discovery** – Automatically discovers markets within discovery windows
- **WebSocket orderbook feeds** – Real-time L2 orderbook updates for instant quote adjustments
- **Trade feed monitoring** – Tracks fills and adjusts inventory automatically
- **Market info caching** – Efficient market metadata retrieval

### Risk Management

- **Exposure limits** – Hard caps on net exposure in USD
- **Position size limits** – Maximum single order size
- **Inventory skew limits** – Prevents excessive position concentration
- **Stop-loss protection** – Optional percentage-based stop-loss
- **Pre-trade validation** – All orders validated before placement

### Auto-Redeem & Gas Optimization

- **Automatic redemption** – Redeems settled positions above threshold
- **Gas batching** – Groups multiple operations to reduce gas costs
- **Configurable gas price** – Customizable gas price in Gwei
- **Efficient order lifecycle** – Minimizes on-chain operations

### Performance Monitoring

- **Prometheus metrics** – Real-time metrics for orders, inventory, exposure, and profit
- **Structured JSON logging** – Full audit trail of all operations
- **Fill rate tracking** – Monitors passive fill rates
- **Latency metrics** – Quote generation and placement latency tracking

## Technical Architecture

```
┌─────────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│ Polymarket CLOB API │      │ Market Maker Bot     │      │ Inventory Mgr    │
│ (REST + WebSocket)  │ <--> │ (Quote Engine)       │ <--> │ (Balance Ctrl)   │
└─────────────────────┘      └──────────────────────┘      └──────────────────┘
         │                           │                            │
         │                           v                            │
         │                  ┌──────────────────┐                 │
         │                  │ Order Executor   │                 │
         │                  │ (Cancel/Replace) │                 │
         │                  └──────────────────┘                 │
         │                           │                            │
         v                           v                            v
┌─────────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ WebSocket Feed      │      │ Risk Manager     │      │ Auto Redeem      │
│ (Orderbook/Trades)  │      │ (Validations)    │      │ (Settlements)    │
└─────────────────────┘      └──────────────────┘      └──────────────────┘
```

### Key Modules

- `src/config.py` – Pydantic settings for all bot parameters (exposure, spreads, timing, etc.)
- `src/polymarket/rest_client.py` – REST API client for market data, orders, balances
- `src/polymarket/websocket_client.py` – WebSocket client for real-time orderbook/trade feeds
- `src/polymarket/order_signer.py` – Ethereum order signing for authenticated requests
- `src/inventory/inventory_manager.py` – Inventory tracking and balanced exposure management
- `src/market_maker/quote_engine.py` – Quote generation with spread calculation and sizing
- `src/execution/order_executor.py` – Order placement, cancellation, and batching
- `src/risk/risk_manager.py` – Pre-trade validations and risk checks
- `src/services/auto_redeem.py` – Automatic position redemption for settled markets
- `src/main.py` – Main orchestrator for market-making loop and lifecycle

## Quick start

### 1) Setup

```bash
git clone https://github.com/your-org/polymarket-market-maker-bot.git
cd polymarket-market-maker-bot
python -m venv .venv
```

Activate venv:

- Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

- macOS/Linux:

```bash
source .venv/bin/activate
```

Install deps:

```bash
pip install -r requirements.txt
```

### 2) Configure `.env`

```powershell
copy .env.example .env
```

Set these two values:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
MARKET_ID=0xYOUR_MARKET_ID
```

`.env.example` also includes a small set of recommended settings (size/spread/risk/timing). You can leave them as-is for the first run.

### 3) Run
>>>>>>> eb87b2a0308eb2f38f96ff75c6f2048d1fe6c0bf

```bash
copy .env.example .env
```

<<<<<<< HEAD
At minimum set `PRIVATE_KEY` and `MARKET_ID`.

4. Run:

```bash
npm start
```

For development without a build step:

```bash
npm run dev
```
=======
## Common setup errors

- Startup `ValidationError`:
  - Check `.env` exists in the project root
  - Check `PRIVATE_KEY` and `MARKET_ID` are set
- No quotes placed:
  - Confirm the market is active and your `MARKET_ID` is correct
  - Check logs for API or websocket errors

## Safety notes

- Start small and watch exposure/inventory.
- Never commit real private keys to git.
- Test with small funds first.
>>>>>>> eb87b2a0308eb2f38f96ff75c6f2048d1fe6c0bf

## Configuration

Environment variables match the Python version: see `.env.example`. Names are **UPPER_SNAKE_CASE** (e.g. `POLYMARKET_API_URL`, `QUOTE_REFRESH_RATE_MS`).

## Metrics

Default scrape URL: `http://localhost:9305/metrics`

## Docs

More guides: [`docs/README.md`](docs/README.md).

## Legacy Python

The previous Python implementation was replaced by this TypeScript codebase. If you still need the old tree, recover it from git history.
