import type { Settings } from "../config.js";
import type { Logger } from "../logger.js";
import type { InventoryManager } from "../inventory/inventoryManager.js";

export class RiskManager {
  constructor(
    private readonly settings: Settings,
    private readonly inventoryManager: InventoryManager,
    private readonly log: Logger,
  ) {}

  checkExposureLimits(proposedSizeUsd: number, side: string): boolean {
    const currentExposure = this.inventoryManager.inventory.netExposureUsd;

    if (side === "BUY") {
      const newExposure = currentExposure + proposedSizeUsd;
      if (newExposure > this.settings.maxExposureUsd) {
        this.log.warn(
          { current: currentExposure, proposed: newExposure, limit: this.settings.maxExposureUsd },
          "exposure_limit_exceeded",
        );
        return false;
      }
    } else if (side === "SELL") {
      const newExposure = currentExposure - proposedSizeUsd;
      if (newExposure < this.settings.minExposureUsd) {
        this.log.warn(
          { current: currentExposure, proposed: newExposure, limit: this.settings.minExposureUsd },
          "exposure_limit_exceeded",
        );
        return false;
      }
    }

    return true;
  }

  checkPositionSize(sizeUsd: number): boolean {
    if (sizeUsd > this.settings.maxPositionSizeUsd) {
      this.log.warn(
        { size: sizeUsd, max: this.settings.maxPositionSizeUsd },
        "position_size_exceeded",
      );
      return false;
    }
    return true;
  }

  checkInventorySkew(): boolean {
    const skew = this.inventoryManager.inventory.getSkew();
    if (skew > this.settings.inventorySkewLimit) {
      this.log.warn(
        { skew, limit: this.settings.inventorySkewLimit },
        "inventory_skew_exceeded",
      );
      return false;
    }
    return true;
  }

  validateOrder(side: string, sizeUsd: number): [boolean, string] {
    if (!this.checkPositionSize(sizeUsd)) {
      return [false, "Position size exceeds limit"];
    }
    if (!this.checkExposureLimits(sizeUsd, side)) {
      return [false, "Exposure limit exceeded"];
    }
    if (!this.checkInventorySkew()) {
      return [false, "Inventory skew too high"];
    }
    return [true, "OK"];
  }

  shouldStopTrading(): boolean {
    const exposure = Math.abs(this.inventoryManager.inventory.netExposureUsd);
    const maxExposure = Math.abs(this.settings.maxExposureUsd);
    if (exposure > maxExposure * 0.9) {
      this.log.warn({ exposure, max: maxExposure }, "near_exposure_limit");
      return true;
    }
    return false;
  }
}
