import type { Logger } from "../logger.js";

export class Inventory {
  yesPosition = 0;
  noPosition = 0;
  netExposureUsd = 0;
  totalValueUsd = 0;

  update(yesDelta: number, noDelta: number, price: number): void {
    this.yesPosition += yesDelta;
    this.noPosition += noDelta;

    const yesValue = this.yesPosition * price;
    const noValue = this.noPosition * (1.0 - price);

    this.netExposureUsd = yesValue - noValue;
    this.totalValueUsd = yesValue + noValue;
  }

  getSkew(): number {
    const total = Math.abs(this.yesPosition) + Math.abs(this.noPosition);
    if (total === 0) return 0;
    return this.totalValueUsd > 0
      ? Math.abs(this.netExposureUsd) / this.totalValueUsd
      : 0;
  }

  isBalanced(maxSkew = 0.3): boolean {
    return this.getSkew() <= maxSkew;
  }
}

export class InventoryManager {
  readonly inventory: Inventory;

  constructor(
    readonly maxExposureUsd: number,
    readonly minExposureUsd: number,
    readonly targetBalance: number,
    private readonly log: Logger,
  ) {
    this.inventory = new Inventory();
  }

  updateInventory(yesDelta: number, noDelta: number, price: number): void {
    this.inventory.update(yesDelta, noDelta, price);
    this.log.debug(
      {
        yes_position: this.inventory.yesPosition,
        no_position: this.inventory.noPosition,
        net_exposure: this.inventory.netExposureUsd,
        skew: this.inventory.getSkew(),
      },
      "inventory_updated",
    );
  }

  canQuoteYes(sizeUsd: number): boolean {
    const potentialExposure = this.inventory.netExposureUsd + sizeUsd;
    return potentialExposure <= this.maxExposureUsd;
  }

  canQuoteNo(sizeUsd: number): boolean {
    const potentialExposure = this.inventory.netExposureUsd - sizeUsd;
    return potentialExposure >= this.minExposureUsd;
  }

  getQuoteSizeYes(baseSize: number, price: number): number {
    if (!this.canQuoteYes(baseSize)) {
      const maxSize = Math.max(0, this.maxExposureUsd - this.inventory.netExposureUsd);
      return Math.min(baseSize, maxSize / price);
    }
    if (this.inventory.netExposureUsd > this.targetBalance) {
      return baseSize * 0.5;
    }
    return baseSize;
  }

  getQuoteSizeNo(baseSize: number, price: number): number {
    if (!this.canQuoteNo(baseSize)) {
      const maxSize = Math.max(0, Math.abs(this.minExposureUsd - this.inventory.netExposureUsd));
      return Math.min(baseSize, maxSize / (1.0 - price));
    }
    if (this.inventory.netExposureUsd < this.targetBalance) {
      return baseSize * 0.5;
    }
    return baseSize;
  }

  shouldRebalance(skewLimit = 0.3): boolean {
    return !this.inventory.isBalanced(skewLimit);
  }

  getRebalanceTarget(): [number, number] {
    const currentSkew = this.inventory.getSkew();
    if (currentSkew < 0.1) return [0, 0];
    const rebalanceYes = -this.inventory.yesPosition * 0.5;
    const rebalanceNo = -this.inventory.noPosition * 0.5;
    return [rebalanceYes, rebalanceNo];
  }
}
