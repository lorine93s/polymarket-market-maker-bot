# QUICK START

## 1) Install

Requires **Node.js 20+**.

```bash
npm install
npm run build
```

## 2) Configure `.env`

```powershell
copy .env.example .env
```

Minimum:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
MARKET_ID=0xYOUR_MARKET_ID
```

## 3) Run

```bash
npm start
```

Dev (no separate build):

```bash
npm run dev
```

## What “healthy” looks like

- Process starts without `Invalid CONFIG` errors
- JSON logs show websocket connect and market discovery (if enabled)
- Order placement logs when quotes succeed
