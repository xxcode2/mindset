export function fmtCountdown(deadlineSec: number): string {
  const diff = deadlineSec - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Closed";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function fmtAddr(a?: string | null): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function bpsToPct(bps: number | bigint): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(n / 100).toFixed(1)}%`;
}
