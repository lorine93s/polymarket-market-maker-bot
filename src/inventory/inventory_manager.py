from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


@dataclass
class Inventory:
    yes_position: float = 0.0
    no_position: float = 0.0
    net_exposure_usd: float = 0.0
    total_value_usd: float = 0.0

    def update(self, yes_delta: float, no_delta: float, price: float):
        self.yes_position += yes_delta
        self.no_position += no_delta
        
        yes_value = self.yes_position * price
        no_value = self.no_position * (1.0 - price)
        
        self.net_exposure_usd = yes_value - no_value
        self.total_value_usd = yes_value + no_value

    def get_skew(self) -> float:
        total = abs(self.yes_position) + abs(self.no_position)
        if total == 0:
            return 0.0
        return abs(self.net_exposure_usd) / self.total_value_usd if self.total_value_usd > 0 else 0.0

    def is_balanced(self, max_skew: float = 0.3) -> bool:
        return self.get_skew() <= max_skew


class InventoryManager:
    def __init__(self, max_exposure_usd: float, min_exposure_usd: float, target_balance: float = 0.0):
        self.max_exposure_usd = max_exposure_usd
        self.min_exposure_usd = min_exposure_usd
        self.target_balance = target_balance
        self.inventory = Inventory()

    def update_inventory(self, yes_delta: float, no_delta: float, price: float):
        self.inventory.update(yes_delta, no_delta, price)
        logger.debug(
            "inventory_updated",
            yes_position=self.inventory.yes_position,
            no_position=self.inventory.no_position,
            net_exposure=self.inventory.net_exposure_usd,
            skew=self.inventory.get_skew(),
        )

    def can_quote_yes(self, size_usd: float) -> bool:
        potential_exposure = self.inventory.net_exposure_usd + size_usd
        return potential_exposure <= self.max_exposure_usd

    def can_quote_no(self, size_usd: float) -> bool:
        potential_exposure = self.inventory.net_exposure_usd - size_usd
        return potential_exposure >= self.min_exposure_usd

    def get_quote_size_yes(self, base_size: float, price: float) -> float:
        if not self.can_quote_yes(base_size):
            max_size = max(0, self.max_exposure_usd - self.inventory.net_exposure_usd)
            return min(base_size, max_size / price)
        
        if self.inventory.net_exposure_usd > self.target_balance:
            return base_size * 0.5
        
        return base_size

    def get_quote_size_no(self, base_size: float, price: float) -> float:
        if price >= 1.0:
            return 0.0
        if not self.can_quote_no(base_size):
            max_size = max(0, abs(self.min_exposure_usd - self.inventory.net_exposure_usd))
            return min(base_size, max_size / (1.0 - price))
        
        if self.inventory.net_exposure_usd < self.target_balance:
            return base_size * 0.5
        
        return base_size

    def should_rebalance(self, skew_limit: float = 0.3) -> bool:
        return not self.inventory.is_balanced(skew_limit)

    def get_rebalance_target(self) -> tuple[float, float]:
        current_skew = self.inventory.get_skew()
        if current_skew < 0.1:
            return (0.0, 0.0)
        
        rebalance_yes = -self.inventory.yes_position * 0.5
        rebalance_no = -self.inventory.no_position * 0.5
        
        return (rebalance_yes, rebalance_no)

