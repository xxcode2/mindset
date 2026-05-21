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
  OUTCOME_LABEL,
  type Market,
  type FeedInfo,
} from "../lib/contract";

describe("contract constants", () => {
  it("exports valid hex addresses", () => {
    expect(CONTRACT_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(TOKEN_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("has correct env-fallback defaults", () => {
    expect(TOKEN_SYMBOL).toBe("USDC");
    expect(TOKEN_DECIMALS).toBe(6);
    expect(CHAIN_ID).toBe(84532);
  });

  it("has all 6 categories", () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(CATEGORIES[0]).toBe("Custom");
    expect(CATEGORIES[1]).toBe("Price");
    expect(CATEGORIES[5]).toBe("Crypto");
  });

  it("has all 4 comparators", () => {
    expect(COMPARATORS).toHaveLength(4);
    expect(COMPARATORS[0]).toBe("Greater than");
    expect(COMPARATORS[3]).toBe("Less or equal");
  });

  it("has outcome labels", () => {
    expect(OUTCOME_LABEL[0]).toBe("open");
    expect(OUTCOME_LABEL[1]).toBe("resolved");
  });
});

describe("PRICE_FEEDS", () => {
  it("has at least BTC, ETH, SOL, LINK", () => {
    const symbols = PRICE_FEEDS.map((f) => f.symbol);
    expect(symbols).toContain("BTC");
    expect(symbols).toContain("ETH");
    expect(symbols).toContain("SOL");
    expect(symbols).toContain("LINK");
  });

  it("all feeds have valid decimals", () => {
    PRICE_FEEDS.forEach((f) => {
      expect(f.decimals).toBeGreaterThan(0);
      expect(f.decimals).toBeLessThanOrEqual(18);
    });
  });

  it("all feeds have mainnet addresses", () => {
    PRICE_FEEDS.forEach((f) => {
      expect(f.base.mainnet).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});

describe("getFeedAddress", () => {
  it("returns sepolia address for default chain (84532)", () => {
    const btc = PRICE_FEEDS.find((f) => f.symbol === "BTC")!;
    expect(getFeedAddress(btc)).toBe(btc.base.sepolia);
  });

  it("returns null for feeds without sepolia address", () => {
    const sol = PRICE_FEEDS.find((f) => f.symbol === "SOL")!;
    expect(getFeedAddress(sol)).toBeNull();
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

  it("returns 'pending' when proposal exists", () => {
    expect(statusFromMarket({ ...base, proposedOutcome: 1 })).toBe("pending");
  });

  it("returns 'pending' for NO proposal too", () => {
    expect(statusFromMarket({ ...base, proposedOutcome: 2 })).toBe("pending");
  });

  it("returns 'closed' for past closeTime without resolution", () => {
    const past = { ...base, closeTime: BigInt(Math.floor(Date.now() / 1000) - 1000) };
    expect(statusFromMarket(past)).toBe("closed");
  });

  it("proposal takes priority over closed time", () => {
    const past = {
      ...base,
      closeTime: BigInt(Math.floor(Date.now() / 1000) - 1000),
      proposedOutcome: 1 as const,
    };
    expect(statusFromMarket(past)).toBe("pending");
  });

  it("resolved outcome takes priority over everything", () => {
    expect(statusFromMarket({ ...base, outcome: 1, proposedOutcome: 2 })).toBe("resolved");
  });
});
