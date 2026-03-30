from __future__ import annotations

import asyncio
import signal
import time
from typing import Any

import structlog
from dotenv import load_dotenv


from src.config import Settings, get_settings
from src.execution.order_executor import OrderExecutor
from src.inventory.inventory_manager import InventoryManager
from src.logging_config import configure_logging
from src.market_maker.quote_engine import QuoteEngine
from src.polymarket.order_signer import OrderSigner
from src.polymarket.rest_client import PolymarketRestClient
from src.polymarket.websocket_client import PolymarketWebSocketClient
from src.risk.risk_manager import RiskManager
from src.services import AutoRedeem, start_metrics_server

logger = structlog.get_logger(__name__)


class MarketMakerBot:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.running = False
        self.rest_client = PolymarketRestClient(settings)
        self.ws_client = PolymarketWebSocketClient(settings)
        self.order_signer = OrderSigner(settings.private_key)
        self.order_executor = OrderExecutor(settings, self.order_signer)
        
        self.inventory_manager = InventoryManager(
            settings.max_exposure_usd,
            settings.min_exposure_usd,
            settings.target_inventory_balance,
        )
        self.risk_manager = RiskManager(settings, self.inventory_manager)
        self.quote_engine = QuoteEngine(settings, self.inventory_manager)
        
        self.auto_redeem = AutoRedeem(settings)
        
        self.current_orderbook: dict[str, Any] = {}
        self.open_orders: dict[str, dict[str, Any]] = {}
        self.last_quote_time = 0.0

    async def discover_market(self) -> dict[str, Any] | None:
        if not self.settings.market_discovery_enabled:
            return await self.rest_client.get_market_info(self.settings.market_id)
        
        try:
            markets = await self.rest_client.get_markets(active=True, closed=False)
            
            for market in markets:
                if market.get("id") == self.settings.market_id:
                    logger.info("market_discovered", market_id=market.get("id"), question=market.get("question"))
                    return market
            
            logger.warning("market_not_found", market_id=self.settings.market_id)
            return None
        except Exception as e:
            logger.error("market_discovery_failed", error=str(e))
            return None

    async def update_orderbook(self):
        try:
            orderbook = await self.rest_client.get_orderbook(self.settings.market_id)
            self.current_orderbook = orderbook
            
            if self.ws_client.websocket:
                self.ws_client.register_handler("l2_book_update", self._handle_orderbook_update)
        except Exception as e:
            logger.error("orderbook_update_failed", error=str(e))

    async def _handle_orderbook_update(self, data: dict[str, Any]):
        if data.get("market") == self.settings.market_id:
            self.current_orderbook = data.get("book", self.current_orderbook)

    async def refresh_quotes(self, market_info: dict[str, Any]):
        current_time = time.time() * 1000
        elapsed = current_time - self.last_quote_time
        
        if elapsed < self.settings.quote_refresh_rate_ms:
            return
        
        self.last_quote_time = current_time
        
        orderbook = self.current_orderbook
        if not orderbook:
            await self.update_orderbook()
            orderbook = self.current_orderbook
        
        best_bid = float(orderbook.get("best_bid", 0))
        best_ask = float(orderbook.get("best_ask", 1))
        
        if best_bid <= 0 or best_ask <= 1:
            logger.warning("invalid_orderbook", best_bid=best_bid, best_ask=best_ask)
            return
        
        yes_token_id = market_info.get("yes_token_id", "")
        no_token_id = market_info.get("no_token_id", "")
        
        yes_quote, no_quote = self.quote_engine.generate_quotes(
            self.settings.market_id, best_bid, best_ask, yes_token_id, no_token_id
        )
        
        await self._cancel_stale_orders()
        
        if yes_quote:
            await self._place_quote(yes_quote, "YES")
        
        if no_quote:
            await self._place_quote(no_quote, "NO")

    async def _cancel_stale_orders(self):
        try:
            open_orders = await self.rest_client.get_open_orders(
                self.order_signer.get_address(), self.settings.market_id
            )
            
            current_time = time.time() * 1000
            order_ids_to_cancel = []
            
            for order in open_orders:
                order_time = order.get("timestamp", 0)
                age = current_time - order_time
                
                if age > self.settings.order_lifetime_ms:
                    order_ids_to_cancel.append(order.get("id"))
            
            if order_ids_to_cancel:
                await self.order_executor.batch_cancel_orders(order_ids_to_cancel)
        except Exception as e:
            logger.error("stale_order_cancellation_failed", error=str(e))

    async def _place_quote(self, quote: Any, outcome: str):
        is_valid, reason = self.risk_manager.validate_order(quote.side, quote.size * quote.price)
        
        if not is_valid:
            logger.warning("quote_rejected", reason=reason, outcome=outcome)
            return
        
        try:
            order = {
                "market": quote.market,
                "side": quote.side,
                "size": str(quote.size),
                "price": str(quote.price),
                "token_id": quote.token_id,
            }
            
            result = await self.order_executor.place_order(order)
            logger.info(
                "quote_placed",
                outcome=outcome,
                side=quote.side,
                price=quote.price,
                size=quote.size,
                order_id=result.get("id"),
            )
        except Exception as e:
            logger.error("quote_placement_failed", outcome=outcome, error=str(e))

    async def run_cancel_replace_cycle(self, market_info: dict[str, Any]):
        while self.running:
            try:
                await self.refresh_quotes(market_info)
                await asyncio.sleep(self.settings.cancel_replace_interval_ms / 1000.0)
            except Exception as e:
                logger.error("cancel_replace_cycle_error", error=str(e))
                await asyncio.sleep(1)

    async def run_auto_redeem(self):
        while self.running:
            try:
                if self.settings.auto_redeem_enabled:
                    await self.auto_redeem.auto_redeem_all(self.order_signer.get_address())
                await asyncio.sleep(300)
            except Exception as e:
                logger.error("auto_redeem_error", error=str(e))
                await asyncio.sleep(60)

    async def run(self):
        self.running = True
        
        logger.info("market_maker_starting", market_id=self.settings.market_id)
        
        market_info = await self.discover_market()
        if not market_info:
            logger.error("market_not_available")
            return
        
        await self.update_orderbook()
        
        if self.settings.market_discovery_enabled:
            await self.ws_client.connect()
            await self.ws_client.subscribe_orderbook(self.settings.market_id)
        
        tasks = [
            self.run_cancel_replace_cycle(market_info),
            self.run_auto_redeem(),
        ]
        
        if self.ws_client.running:
            tasks.append(self.ws_client.listen())
        
        try:
            await asyncio.gather(*tasks)
        finally:
            await self.cleanup()

    async def cleanup(self):
        self.running = False
        await self.order_executor.cancel_all_orders(self.settings.market_id)
        await self.rest_client.close()
        await self.ws_client.close()
        await self.order_executor.close()
        await self.auto_redeem.close()
        logger.info("market_maker_shutdown_complete")


async def bootstrap(settings: Settings):
    load_dotenv()
    configure_logging(settings.log_level)
    start_metrics_server(settings.metrics_host, settings.metrics_port)

    bot = MarketMakerBot(settings)

    loop = asyncio.get_event_loop()
    stop_event = asyncio.Event()

    def _handle_signal():
        logger.info("shutdown_signal_received")
        bot.running = False
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal)
        except NotImplementedError:
            pass

    try:
        await bot.run()
    finally:
        logger.info("bot_shutdown_complete")


def main():
    settings = get_settings()
    asyncio.run(bootstrap(settings))


if __name__ == "__main__":
    main()

