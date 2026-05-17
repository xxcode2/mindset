"use client";

import { useEffect, useState } from "react";
import { subscribeToasts, type Toast } from "@/lib/toast";

const COLOR: Record<Toast["type"], { bg: string; border: string; text: string }> = {
  success: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", text: "#34d399" },
  error: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.3)", text: "#f87171" },
  info: { bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.3)", text: "#818cf8" },
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex flex-col gap-2">
      {toasts.map((t) => {
        const c = COLOR[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium backdrop-blur-md animate-fade-up"
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.text,
              maxWidth: "min(90vw, 420px)",
            }}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
