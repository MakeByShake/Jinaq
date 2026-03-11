import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Compact number formatter for displaying balances in tight spaces.
 *  < 10 000        → full locale string: "9 999"
 *  10 000–999 999  → K notation:         "150K"
 *  1 000 000+      → M notation:         "1.5M"
 *  1 000 000 000+  → B notation:         "2.3B"
 */
export function formatMoneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (abs >= 10_000)        return sign + (abs / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('ru-RU');
}
