from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
import structlog

from src.config import Settings
from src.polymarket.order_signer import OrderSigner

logger = structlog.get_logger(__name__)


class OrderExecutor:
    def __init__(self, settings: Settings, order_signer: OrderSigner):
        self.settings = settings
        self.order_signer = order_signer
        self.client = httpx.AsyncClient(timeout=30.0)
        self.pending_cancellations: set[str] = set()

    async def place_order(self, order: dict[str, Any]) -> dict[str, Any]:
        try:
            timestamp = int(time.time() * 1000)
            order["time"] = timestamp
            order["salt"] = str(int(time.time()))
            
            signature = self.order_signer.sign_order(order)
            order["signature"] = signature
            order["maker"] = self.order_signer.get_address()
            
            response = await self.client.post(
                f"{self.settings.polymarket_api_url}/order",
                json=order,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            
            result = response.json()
            logger.info("order_placed", order_id=result.get("id"), side=order.get("side"), price=order.get("price"))
            return result
        except Exception as e:
            logger.error("order_placement_failed", error=str(e), order=order)
            raise

    async def cancel_order(self, order_id: str) -> bool:
        try:
            if self.settings.batch_cancellations and order_id in self.pending_cancellations:
                return True

            self.pending_cancellations.add(order_id)

            response = await self.client.delete(
                f"{self.settings.polymarket_api_url}/order/{order_id}",
            )
            response.raise_for_status()

            self.pending_cancellations.discard(order_id)
            logger.info("order_cancelled", order_id=order_id)
            return True
        except Exception as e:
            self.pending_cancellations.discard(order_id)
            logger.error("order_cancellation_failed", order_id=order_id, error=str(e))
            return False

    async def cancel_all_orders(self, market_id: str) -> int:
        try:
            response = await self.client.delete(
                f"{self.settings.polymarket_api_url}/orders",
                params={"market": market_id},
            )
            response.raise_for_status()
            
            cancelled = response.json().get("cancelled", 0)
            logger.info("orders_cancelled", market_id=market_id, count=cancelled)
            self.pending_cancellations.clear()
            return cancelled
        except Exception as e:
            logger.error("cancel_all_orders_failed", market_id=market_id, error=str(e))
            return 0

    async def batch_cancel_orders(self, order_ids: list[str]) -> int:
        if not self.settings.batch_cancellations:
            cancelled = 0
            for order_id in order_ids:
                if await self.cancel_order(order_id):
                    cancelled += 1
            return cancelled

        try:
            response = await self.client.post(
                f"{self.settings.polymarket_api_url}/orders/cancel",
                json={"orderIds": order_ids},
            )
            response.raise_for_status()

            result = response.json()
            cancelled = result.get("cancelled", len(order_ids))
            self.pending_cancellations.clear()
            logger.info("batch_orders_cancelled", count=cancelled)
            return cancelled
        except Exception as e:
            logger.error("batch_cancel_failed", error=str(e))
            return 0

    async def close(self):
        await self.client.aclose()

