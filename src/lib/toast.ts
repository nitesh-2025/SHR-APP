// Drop-in replacement for the `sonner` toast API the web portal uses, so
// ported screens keep working unchanged: toast.success/error/info/warning(msg).
//
// Deliberately not ToastAndroid/Alert: those are platform-inconsistent and
// Alert is modal (it blocks interaction and, on a webview-driven flow, can
// stall the JS bridge). This is a tiny pub-sub the <Toaster/> renders from.
//
// NOTE: the auto-dismiss timer lives in the component, not here. Owning it in
// the store would make "pause while pressed" impossible — the store has no idea
// a finger is down, and a setTimeout cannot be rewound.
import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  description?: string;
  /** Auto-dismiss duration in ms. Pass 0 to require a manual dismiss. */
  duration?: number;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
  duration: number;
}

export const DEFAULT_DURATION_MS = 4000;

/** Newest-first, capped — a burst of failures should not bury the screen. */
const MAX_VISIBLE = 3;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

// Callers historically passed a bare description string; objects are the richer
// form. Accepting both keeps every existing `toast.error(msg, 'detail')` valid.
function normalise(options?: string | ToastOptions): ToastOptions {
  if (typeof options === 'string') return { description: options };
  return options ?? {};
}

function push(kind: ToastKind, message: string, options?: string | ToastOptions) {
  const { description, duration = DEFAULT_DURATION_MS } = normalise(options);
  const id = nextId++;
  items = [...items, { id, kind, message, description, duration }].slice(
    -MAX_VISIBLE,
  );
  emit();
  return id;
}

export function dismiss(id: number) {
  const next = items.filter((t) => t.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function dismissAll() {
  if (!items.length) return;
  items = [];
  emit();
}

export const toast = {
  success: (message: string, options?: string | ToastOptions) =>
    push('success', message, options),
  error: (message: string, options?: string | ToastOptions) =>
    push('error', message, options),
  info: (message: string, options?: string | ToastOptions) =>
    push('info', message, options),
  warning: (message: string, options?: string | ToastOptions) =>
    push('warning', message, options),
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => items;

/** Subscribes a component to the live toast stack. */
export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
