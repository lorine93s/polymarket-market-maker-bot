from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, Callable

import structlog
import websockets
from websockets.client import WebSocketClientProtocol

from src.config import Settings

logger = structlog.get_logger(__name__)


class PolymarketWebSocketClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.ws_url = settings.polymarket_ws_url
        self.websocket: WebSocketClientProtocol | None = None
        self.message_handlers: dict[str, Callable] = {}
        self.running = False
        self._subscriptions: list[dict[str, Any]] = []

    def register_handler(self, message_type: str, handler: Callable):
        self.message_handlers[message_type] = handler

    async def connect(self):
        try:
            self.websocket = await websockets.connect(self.ws_url)
            logger.info("websocket_connected", url=self.ws_url)
            self.running = True
        except Exception as e:
            logger.error("websocket_connection_failed", error=str(e))
            raise

    async def subscribe_orderbook(self, market_id: str):
        if not self.websocket:
            await self.connect()

        message = {
            "type": "subscribe",
            "channel": "l2_book",
            "market": market_id,
        }
        await self.websocket.send(json.dumps(message))
        self._subscriptions.append(message)
        logger.info("orderbook_subscribed", market_id=market_id)

    async def subscribe_trades(self, market_id: str):
        if not self.websocket:
            await self.connect()

        message = {
            "type": "subscribe",
            "channel": "trades",
            "market": market_id,
        }
        await self.websocket.send(json.dumps(message))
        self._subscriptions.append(message)
        logger.info("trades_subscribed", market_id=market_id)

    async def _resubscribe_all(self):
        """Resubscribe to all channels after reconnection."""
        for message in self._subscriptions:
            try:
                await self.websocket.send(json.dumps(message))
                logger.info("resubscribed", channel=message.get("channel"), market=message.get("market"))
            except Exception as e:
                logger.error("resubscription_failed", error=str(e))

    async def listen(self):
        if not self.websocket:
            await self.connect()

        while self.running:
            try:
                message = await self.websocket.recv()
                data = json.loads(message)

                message_type = data.get("type")
                if message_type and message_type in self.message_handlers:
                    handler = self.message_handlers[message_type]
                    if inspect.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)

            except websockets.exceptions.ConnectionClosed:
                logger.warning("websocket_connection_closed")
                await asyncio.sleep(5)
                await self.connect()
                await self._resubscribe_all()
            except Exception as e:
                logger.error("websocket_listen_error", error=str(e))
                await asyncio.sleep(1)

    async def close(self):
        self.running = False
        if self.websocket:
            await self.websocket.close()

