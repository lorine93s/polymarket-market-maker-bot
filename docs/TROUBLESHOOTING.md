# TROUBLESHOOTING

## Startup fails (`Invalid CONFIG`)

The bot validates environment variables at startup with **Zod**.

Check:

- `.env` exists in the project root
- `PRIVATE_KEY` is present (hex, with or without `0x`)
- `MARKET_ID` is present

## Bot runs but places no quotes

Check:

- Market is active (`MARKET_ID` correct)
- REST `/book` returns usable `best_bid` / `best_ask`
- WebSocket connects (if `MARKET_DISCOVERY_ENABLED=true`)
- Logs for `invalid_orderbook` or HTTP errors

## WebSocket disconnects

The client reconnects after a short delay. If it loops forever:

- Confirm network access to `POLYMARKET_WS_URL`
- Try a different network (VPN/firewall)

## Risk rejections

Search logs for `quote_rejected`.

Common causes:

- `MAX_EXPOSURE_USD` / `MIN_EXPOSURE_USD` too tight
- `MAX_POSITION_SIZE_USD` too small
- `INVENTORY_SKEW_LIMIT` too strict
