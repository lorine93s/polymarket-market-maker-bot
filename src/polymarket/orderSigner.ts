import { Wallet } from "ethers";
import type { Logger } from "../logger.js";

function normalizePrivateKey(key: string): `0x${string}` {
  const t = key.trim();
  if (t.startsWith("0x")) return t as `0x${string}`;
  return `0x${t}` as `0x${string}`;
}

export class OrderSigner {
  private wallet: Wallet;

  constructor(
    privateKey: string,
    private readonly log: Logger,
  ) {
    this.wallet = new Wallet(normalizePrivateKey(privateKey));
  }

  signOrder(order: Record<string, unknown>): string {
    try {
      const orderHash = this.hashOrder(order);
      const sig = this.wallet.signMessageSync(orderHash);
      return sig.startsWith("0x") ? sig.slice(2) : sig;
    } catch (e) {
      this.log.error({ err: e }, "order_signing_failed");
      throw e;
    }
  }

  private hashOrder(order: Record<string, unknown>): string {
    const parts = [
      String(order.market ?? ""),
      String(order.side ?? ""),
      String(order.size ?? ""),
      String(order.price ?? ""),
      String(order.time ?? ""),
      String(order.salt ?? ""),
    ];
    return parts.join(":");
  }

  getAddress(): string {
    return this.wallet.address;
  }
}
