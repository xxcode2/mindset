import { describe, it, expect } from "vitest";
import { fmtCountdown, fmtAddr, fmtToken, fmtCompactUsd, parseToken, bpsToPct, classNames } from "../lib/utils";

// Override TOKEN_DECIMALS/TOKEN_SYMBOL used by utils — vitest will resolve the import.
// Default TOKEN_DECIMALS=6, TOKEN_SYMBOL="USDC" from contract.ts (via env fallbacks).

describe("parseToken", () => {
  it("parses whole numbers", () => {
    expect(parseToken("100")).toBe(100_000_000n);
  });

  it("parses decimals", () => {
    expect(parseToken("1.5")).toBe(1_500_000n);
  });

  it("parses zero", () => {
    expect(parseToken("0")).toBe(0n);
  });

  it("returns 0n for empty input", () => {
    expect(parseToken("")).toBe(0n);
  });

  it("returns 0n for invalid input", () => {
    expect(parseToken("abc")).toBe(0n);
    expect(parseToken("-5")).toBe(0n);
  });

  it("truncates extra decimal places", () => {
    // 6 decimals, so 1.1234567 -> 1.123456 (truncated)
    expect(parseToken("1.1234567")).toBe(1_123_456n);
  });

  it("handles leading dot", () => {
    expect(parseToken(".5")).toBe(500_000n);
  });
});

describe("fmtToken", () => {
  it("formats zero", () => {
    expect(fmtToken(0n)).toBe("0 USDC");
  });

  it("formats whole amounts", () => {
    expect(fmtToken(100_000_000n)).toContain("100");
    expect(fmtToken(100_000_000n)).toContain("USDC");
  });

  it("formats fractional amounts", () => {
    const result = fmtToken(1_500_000n);
    expect(result).toContain("1.5");
  });

  it("respects withSymbol=false", () => {
    expect(fmtToken(100_000_000n, 6, false)).not.toContain("USDC");
  });
});

describe("fmtCompactUsd", () => {
  it("formats millions", () => {
    expect(fmtCompactUsd(1_500_000_000_000n)).toBe("$1.5M");
  });

  it("formats thousands", () => {
    expect(fmtCompactUsd(5_000_000_000n)).toBe("$5.0K");
  });

  it("formats small amounts", () => {
    expect(fmtCompactUsd(500_000n)).toBe("$0.50");
  });

  it("formats zero", () => {
    expect(fmtCompactUsd(0n)).toBe("$0");
  });
});

describe("fmtAddr", () => {
  it("truncates address", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const result = fmtAddr(addr);
    expect(result).toBe("0x1234…5678");
  });

  it("handles null/undefined", () => {
    expect(fmtAddr(null)).toBe("—");
    expect(fmtAddr(undefined)).toBe("—");
  });
});

describe("fmtCountdown", () => {
  it("returns 'Closed' for past deadlines", () => {
    expect(fmtCountdown(0)).toBe("Closed");
    expect(fmtCountdown(Math.floor(Date.now() / 1000) - 100)).toBe("Closed");
  });

  it("shows days for large values", () => {
    const future = Math.floor(Date.now() / 1000) + 90000; // ~1 day
    const result = fmtCountdown(future);
    expect(result).toMatch(/\d+d/);
  });
});

describe("bpsToPct", () => {
  it("converts bps to percentage", () => {
    expect(bpsToPct(500)).toBe(5);
    expect(bpsToPct(10000)).toBe(100);
    expect(bpsToPct(250n)).toBe(2.5);
  });
});

describe("classNames", () => {
  it("joins truthy class names", () => {
    expect(classNames("a", "b", "c")).toBe("a b c");
  });

  it("filters falsy values", () => {
    expect(classNames("a", false, null, undefined, "b")).toBe("a b");
  });
});
