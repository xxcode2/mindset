import { describe, it, expect } from "vitest";
import {
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
  TOKEN_DECIMALS,
  CHAIN_ID,
  CATEGORIES,
  COMPARATORS,
  PRICE_FEEDS,
  getFeedAddress,
  statusFromMarket,
  type Market,
} from "../lib/contract";

describe("contract constants", () => {
  it("exports valid addresses", () => {
    expect(CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(TOKEN_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("has correct defaults", () => {
    expect(TOKEN_SYMBOL).toBe("USDC");
    expect(TOKEN_DECIMALS).toBe(6);
    expect(CHAIN_ID).toBe(84532);
  });

  it("has all categories", () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(CATEGORIES[0]).toBe("Custom");
    expect(CATEGORIES[1]).toBe("Price");
  });

  it("has all comparators", () => {
    expect(COMPARATORS).toHaveLength(4);
  });
});

describe("PRICE_FEEDS", () => {
  it("has at least BTC and ETH", () => {
    const symbols = PRICE_FEEDS.map((f) => f.symbol);
    expect(symbols).toContain("BTC");
    expect(symbols).toContain("ETH");
  });

  it("all feeds have valid decimals", () => {
    PRICE_FEEDS.forEach((f) => {
      expect(f.decimals).toBeGreaterThan(0);
    });
  });
});

describe("getFeedAddress", () => {
  it("returns sepolia address for default chain (84532)", () => {
    const btc = PRICE_FEEDS.find((f) => f.symbol === "BTC")!;
    const addr = getFeedAddress(btc);
    // Default CHAIN_ID is 84532 (sepolia), so should return sepolia address
    expect(addr).toBe(btc.base.sepolia);
  });

  it("returns null for feeds without sepolia address", () => {
    const sol = PRICE_FEEDS.find((f) => f.symbol === "SOL")!;
    const addr = getFeedAddress(sol);
    expect(addr).toBeNull();
  });
});

describe("statusFromMarket", () => {
  const base: Market = {
    creator: "0x0000000000000000000000000000000000000001",
    resolver: "0x0000000000000000000000000000000000000002",
    question: "test",
    description: "",
    createdAt: 0n,
    closeTime: BigInt(Math.floor(Date.now() / 1000) + 86400),
    yesPool: 0n,
    noPool: 0n,
    yesBettors: 0,
    noBettors: 0,
    outcome: 0,
    category: 0,
    proposedOutcome: 0,
    proposedAt: 0n,
    resolverBondLocked: 0n,
  };

  it("returns 'open' for unresolved future market", () => {
    expect(statusFromMarket(base)).toBe("open");
  });

  it("returns 'resolved' for Yes outcome", () => {
    expect(statusFromMarket({ ...base, outcome: 1 })).toBe("resolved");
  });

  it("returns 'resolved' for No outcome", () => {
    expect(statusFromMarket({ ...base, outcome: 2 })).toBe("resolved");
  });

  it("returns 'invalid' for Invalid outcome", () => {
    expect(statusFromMarket({ ...base, outcome: 3 })).toBe("invalid");
  });

  it("returns 'pending' for unresolved with proposal", () => {
    expect(statusFromMarket({ ...base, proposedOutcome: 1 })).toBe("pending");
  });

  it("returns 'closed' for past closeTime without resolution", () => {
    expect(
      statusFromMarket({ ...base, closeTime: BigInt(Math.floor(Date.now() / 1000) - 1000) })
    ).toBe("closed");
  });
});
