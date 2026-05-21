import { TOKEN_DECIMALS, TOKEN_SYMBOL } from "./contract";

export function fmtCountdown(deadlineSec: number): string {
  const diff = deadlineSec - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Closed";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtAddr(a?: string | null, head = 4, tail = 4): string {
  if (!a) return "—";
  return `${a.slice(0, 2 + head)}…${a.slice(-tail)}`;
}

/** Formats a token amount (bigint, raw units) to a human-readable string with locale separators. */
export function fmtToken(amount: bigint, decimals = TOKEN_DECIMALS, withSymbol = true): string {
  if (amount === 0n) return withSymbol ? `0 ${TOKEN_SYMBOL}` : "0";
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  const out = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
  return `${negative ? "-" : ""}${out}${withSymbol ? ` ${TOKEN_SYMBOL}` : ""}`;
}

/** Compact form for big numbers in stat cards: 1234567 -> $1.2M, -500000 -> -$500 */
export function fmtCompactUsd(amount: bigint, decimals = TOKEN_DECIMALS): string {
  const n = Number(amount) / 10 ** decimals;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(0)}`;
  if (abs === 0) return "$0";
  return `${sign}$${abs.toFixed(2)}`;
}

/** Parse a user-entered string into raw token units. Returns 0n on bad input. */
export function parseToken(input: string, decimals = TOKEN_DECIMALS): bigint {
  if (!input) return 0n;
  const trimmed = input.trim();
  if (!/^\d*(?:\.\d*)?$/.test(trimmed)) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const wholeBig = whole ? BigInt(whole) : 0n;
  const fracBig = fracPadded ? BigInt(fracPadded) : 0n;
  return wholeBig * 10n ** BigInt(decimals) + fracBig;
}

export function bpsToPct(bps: number | bigint): number {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return n / 100;
}

export function classNames(...cn: Array<string | false | null | undefined>): string {
  return cn.filter(Boolean).join(" ");
}
