"use client";

export type ToastType = "info" | "success" | "error";
export type Toast = { id: number; message: string; type: ToastType };

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function notify() {
  for (const l of listeners) l([...toasts]);
}

export function pushToast(message: string, type: ToastType = "info", durationMs = 3000) {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, durationMs);
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}
