import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names without Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stable, dependency-free id for client-side keys. */
export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** Group an array by a derived key, preserving insertion order. */
export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Simulates network latency so loading and skeleton states are reachable. */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
