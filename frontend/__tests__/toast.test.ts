import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushToast, subscribeToasts, type Toast } from "../lib/toast";

describe("toast system", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("pushToast notifies subscribers", () => {
    const received: Toast[][] = [];
    const unsub = subscribeToasts((toasts) => received.push(toasts));

    pushToast("hello", "info");

    // First call is the initial subscription snapshot (empty or with the toast)
    // The push should have added a toast
    const latest = received[received.length - 1];
    expect(latest.length).toBeGreaterThan(0);
    expect(latest[latest.length - 1].message).toBe("hello");
    expect(latest[latest.length - 1].type).toBe("info");

    unsub();
  });

  it("toast auto-removes after duration", () => {
    const received: Toast[][] = [];
    const unsub = subscribeToasts((toasts) => received.push(toasts));

    pushToast("temp", "success", 1000);

    // Should exist right now
    const afterPush = received[received.length - 1];
    expect(afterPush.some((t) => t.message === "temp")).toBe(true);

    // Advance time past duration
    vi.advanceTimersByTime(1500);

    const afterExpire = received[received.length - 1];
    expect(afterExpire.some((t) => t.message === "temp")).toBe(false);

    unsub();
    vi.useRealTimers();
  });

  it("unsubscribe stops notifications", () => {
    let callCount = 0;
    const unsub = subscribeToasts(() => {
      callCount++;
    });

    const countAfterSub = callCount;
    unsub();

    pushToast("ignored", "error");
    // Should not have received the new toast notification
    expect(callCount).toBe(countAfterSub);
  });

  it("pushToast assigns incrementing IDs", () => {
    const received: Toast[][] = [];
    const unsub = subscribeToasts((toasts) => received.push(toasts));

    pushToast("a", "info");
    pushToast("b", "info");

    const latest = received[received.length - 1];
    const ids = latest.map((t) => t.id);
    // IDs should be unique and increasing
    expect(new Set(ids).size).toBe(ids.length);
    if (ids.length >= 2) {
      expect(ids[ids.length - 1]).toBeGreaterThan(ids[ids.length - 2]);
    }

    unsub();
    vi.useRealTimers();
  });
});
