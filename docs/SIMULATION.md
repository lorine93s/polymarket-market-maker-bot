# SIMULATION / DRY RUN

There is no separate “paper trading” switch in this repo.

Practical safe-start flow:

1. Keep `DEFAULT_SIZE`, `MAX_EXPOSURE_USD`, and `MAX_POSITION_SIZE_USD` small in `.env`.
2. Run `npm run dev` and watch logs for REST / websocket errors.
3. Confirm the process can read an orderbook (`best_bid` / `best_ask`) for your `MARKET_ID`.
4. Scale up slowly after you trust the stack.
