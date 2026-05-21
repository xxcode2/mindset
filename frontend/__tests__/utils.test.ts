import { describe, it, expect } from "vitest";
import { fmtCountdown, fmtAddr, fmtToken, fmtCompactUsd, parseToken, bpsToPct, classNames } from "../lib/utils";

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
    expect(parseToken("1.1234567")).toBe(1_123_456n);
  });

  it("handles leading dot", () => {
    expect(parseToken(".5")).toBe(500_000n);
  });

  it("handles trailing dot", () => {
    expect(parseToken("5.")).toBe(5_000_000n);
  });

  it("handles custom decimals", () => {
    expect(parseToken("1.5", 8)).toBe(150_000_000n);
  });

  it("handles very large amounts", () => {
    expect(parseToken("1000000")).toBe(1_000_000_000_000n);
  });

  it("handles whitespace", () => {
    expect(parseToken("  100  ")).toBe(100_000_000n);
  });
});

describe("fmtToken", () => {
  it("formats zero", () => {
    expect(fmtToken(0n)).toBe("0 USDC");
  });

  it("formats whole amounts", () => {
    const result = fmtToken(100_000_000n);
    expect(result).toContain("100");
    expect(result).toContain("USDC");
  });

  it("formats fractional amounts", () => {
    const result = fmtToken(1_500_000n);
    expect(result).toContain("1.5");
  });

  it("respects withSymbol=false", () => {
    expect(fmtToken(100_000_000n, 6, false)).not.toContain("USDC");
  });

  it("formats negative amounts", () => {
    const result = fmtToken(-5_000_000n);
    expect(result).toContain("-");
    expect(result).toContain("5");
  });

  it("strips trailing zeros from fraction", () => {
    // 1.100000 should become 1.1
    const result = fmtToken(1_100_000n, 6, false);
    expect(result).toBe("1.1");
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

  it("formats negative amounts", () => {
    expect(fmtCompactUsd(-5_000_000_000n)).toBe("-$5.0K");
  });

  it("formats amounts between 1 and 1000", () => {
    expect(fmtCompactUsd(50_000_000n)).toBe("$50");
  });
});

describe("fmtAddr", () => {
  it("truncates address with default params", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(fmtAddr(addr)).toBe("0x1234…5678");
  });

  it("handles null/undefined", () => {
    expect(fmtAddr(null)).toBe("—");
    expect(fmtAddr(undefined)).toBe("—");
    expect(fmtAddr("")).toBe("—");
  });

  it("respects custom head/tail", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const result = fmtAddr(addr, 6, 6);
    expect(result).toBe("0x123456…345678");
  });
});

describe("fmtCountdown", () => {
  it("returns 'Closed' for past deadlines", () => {
    expect(fmtCountdown(0)).toBe("Closed");
    expect(fmtCountdown(Math.floor(Date.now() / 1000) - 100)).toBe("Closed");
  });

  it("shows days for large values", () => {
    const future = Math.floor(Date.now() / 1000) + 90000;
    expect(fmtCountdown(future)).toMatch(/\d+d/);
  });

  it("shows hours when less than a day", () => {
    const future = Math.floor(Date.now() / 1000) + 7200; // 2 hours
    expect(fmtCountdown(future)).toMatch(/\d+h/);
  });

  it("shows only minutes when less than an hour", () => {
    const future = Math.floor(Date.now() / 1000) + 300; // 5 min
    const result = fmtCountdown(future);
    expect(result).toMatch(/\d+m$/);
    expect(result).not.toMatch(/d/);
    expect(result).not.toMatch(/h/);
  });
});

describe("bpsToPct", () => {
  it("converts bps to percentage", () => {
    expect(bpsToPct(500)).toBe(5);
    expect(bpsToPct(10000)).toBe(100);
    expect(bpsToPct(0)).toBe(0);
  });

  it("handles bigint input", () => {
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

  it("returns empty string for all falsy", () => {
    expect(classNames(false, null, undefined)).toBe("");
  });

  it("handles single class", () => {
    expect(classNames("only")).toBe("only");
  });
});
