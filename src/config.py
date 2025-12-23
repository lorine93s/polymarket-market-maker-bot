from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"

    # Polymarket API
    polymarket_api_url: str = Field(
        default="https://clob.polymarket.com", description="Polymarket CLOB API base URL"
    )
    polymarket_ws_url: str = Field(
        default="wss://clob-ws.polymarket.com", description="Polymarket WebSocket URL"
    )
    
    # Authentication
    private_key: str = Field(description="Ethereum private key for signing orders")
    public_address: str = Field(description="Ethereum public address")
    
    # Market configuration
    market_id: str = Field(description="Polymarket market ID to trade")
    conditional_token_address: str | None = None
    
    # Market discovery
    market_discovery_enabled: bool = Field(default=True, description="Enable market discovery")
    discovery_window_minutes: int = Field(default=15, description="Market discovery window (15m or 60m)")
    
    # Quoting parameters
    default_size: float = Field(default=100.0, description="Default order size in USD")
    min_spread_bps: int = Field(default=10, description="Minimum spread in basis points")
    quote_step_bps: int = Field(default=5, description="Quote stepping in basis points")
    oversize_threshold: float = Field(default=1.5, description="Oversize multiplier threshold")
    
    # Inventory management
    max_exposure_usd: float = Field(default=10000.0, description="Maximum net exposure in USD")
    min_exposure_usd: float = Field(default=-10000.0, description="Minimum net exposure in USD")
    target_inventory_balance: float = Field(default=0.0, description="Target inventory balance")
    inventory_skew_limit: float = Field(default=0.3, description="Maximum inventory skew (0-1)")
    
    # Cancel/replace logic
    cancel_replace_interval_ms: int = Field(default=500, description="Cancel/replace cycle interval (ms)")
    taker_delay_ms: int = Field(default=500, description="Taker delay in milliseconds")
    batch_cancellations: bool = Field(default=True, description="Batch cancellation requests")
    
    # Risk management
    max_position_size_usd: float = Field(default=5000.0, description="Maximum single position size")
    stop_loss_pct: float = Field(default=10.0, description="Stop loss percentage")
    
    # Auto-redeem
    auto_redeem_enabled: bool = Field(default=True, description="Enable auto-redeem")
    redeem_threshold_usd: float = Field(default=1.0, description="Minimum redeem amount in USD")
    
    # Gas optimization
    gas_batching_enabled: bool = Field(default=True, description="Enable gas batching")
    gas_price_gwei: float = Field(default=20.0, description="Gas price in Gwei")
    
    # Auto-close
    auto_close_enabled: bool = Field(default=False, description="Enable auto-close logic")
    close_spread_threshold_bps: int = Field(default=50, description="Minimum spread to close position (bps)")
    
    # Performance tuning
    quote_refresh_rate_ms: int = Field(default=1000, description="Quote refresh rate in milliseconds")
    order_lifetime_ms: int = Field(default=3000, description="Order lifetime before refresh (ms)")
    
    # Metrics and logging
    metrics_host: str = "0.0.0.0"
    metrics_port: int = 9305
    
    # RPC endpoint for on-chain operations
    rpc_url: str = Field(default="https://polygon-rpc.com", description="Polygon RPC endpoint")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

