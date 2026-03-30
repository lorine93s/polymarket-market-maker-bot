import type { Settings } from "../config.js";
import type { Logger } from "../logger.js";

export class AutoRedeem {
  constructor(
    private readonly settings: Settings,
    private readonly log: Logger,
  ) {}

  async checkRedeemablePositions(address: string): Promise<Record<string, unknown>[]> {
    try {
      const base = this.settings.polymarketApiUrl.replace(/\/$/, "");
      const params = new URLSearchParams({ user: address, redeemable: "true" });
      const res = await fetch(`${base}/positions?${params}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Record<string, unknown>[];
    } catch (e) {
      this.log.error({ err: e }, "redeemable_positions_check_failed");
      return [];
    }
  }

  async redeemPosition(positionId: string | undefined): Promise<boolean> {
    if (!positionId) return false;
    try {
      const base = this.settings.polymarketApiUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/redeem/${positionId}`, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      this.log.info({ position_id: positionId }, "position_redeemed");
      return true;
    } catch (e) {
      this.log.error({ err: e, position_id: positionId }, "position_redeem_failed");
      return false;
    }
  }

  async autoRedeemAll(address: string): Promise<number> {
    if (!this.settings.autoRedeemEnabled) return 0;

    const redeemable = await this.checkRedeemablePositions(address);
    let redeemed = 0;

    for (const position of redeemable) {
      const valueUsd = Number(position.value ?? 0);
      if (valueUsd >= this.settings.redeemThresholdUsd) {
        if (await this.redeemPosition(position.id as string | undefined)) {
          redeemed += 1;
        }
      }
    }

    this.log.info({ redeemed, total: redeemable.length }, "auto_redeem_completed");
    return redeemed;
  }
}
