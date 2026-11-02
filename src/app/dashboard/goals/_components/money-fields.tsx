'use client';

/**
 * Small form building blocks shared by the Goals and Debts pages:
 * a big amount input (supports "1500+300" math), quick-amount chips and
 * optional account chips. Candidates for moving into src/components/app.
 */

import { evalAmount, useMoney } from '@/lib/format';
import { useData } from '@/stores/data-store';
import type { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Parses an amount expression; returns NaN for invalid input. */
export function parseAmount(expr: string): number {
  return evalAmount(expr.replace(/−/g, '-'));
}

export function AmountInput({ id, value, onChange, tone, autoFocus, ariaLabel }: {
  id?: string; value: string; onChange: (v: string) => void; tone?: 'income' | 'expense';
  autoFocus?: boolean; ariaLabel?: string;
}) {
  const fmt = useMoney();
  const amount = parseAmount(value);
  const isExpression = /[+\-−*/]/.test(value.replace(/^-/, ''));
  return (
    <div className="rounded-3xl bg-muted/60 px-4 py-3 text-center">
      <input
        id={id}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,+\-*/ ]/g, ''))}
        inputMode="decimal"
        placeholder="0"
        aria-label={ariaLabel}
        className={cn(
          'w-full bg-transparent text-center font-display text-4xl font-semibold tracking-tight tabular outline-none placeholder:opacity-30',
          tone === 'income' && 'text-income',
          tone === 'expense' && 'text-expense',
        )}
      />
      <p className="h-4 text-xs text-muted-foreground tabular">
        {isExpression && Number.isFinite(amount) ? `= ${fmt(amount)}` : ''}
      </p>
    </div>
  );
}

/** Row of pill buttons that set a preset amount. */
export function QuickChips({ chips, onPick, current }: {
  chips: { key: string; label: React.ReactNode; value: number }[];
  onPick: (v: number) => void;
  current?: number;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
      {chips.filter((c) => c.value > 0).map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onPick(c.value)}
          className={cn(
            'min-h-10 shrink-0 rounded-full border px-3.5 text-xs font-semibold tabular transition-colors',
            current === c.value ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted',
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Shared account chooser (bank logos, balances). Re-exported under the old name. */
export { AccountPicker as AccountChips } from '@/components/app/account-picker';

/**
 * Finds a transaction created by an action helper that doesn't return it
 * (contributeToGoal / repayDebt). Used by undo toasts.
 */
export function findCreatedTx(match: (tx: Transaction) => boolean, sinceISO: string): Transaction | undefined {
  return useData.getState().transactions.find((tx) => tx.createdAt >= sinceISO && match(tx));
}

/** Adds https:// to bare links like "kaspi.kz/…". Returns undefined for empty input. */
export function normalizeUrl(input: string): string | undefined {
  const s = input.trim();
  if (!s) return undefined;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}
