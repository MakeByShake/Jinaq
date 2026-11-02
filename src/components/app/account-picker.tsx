'use client';

import { Ban } from 'lucide-react';
import { useAccounts, useBalances } from '@/hooks/use-finance';
import { useMoney } from '@/lib/format';
import { DynamicIcon } from '@/lib/icons';
import { getBank } from '@/lib/banks';
import type { Account } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Card gradient for an account: bank brand colors, or the account's own color. */
export function accountBackground(a: Pick<Account, 'color' | 'bankId'>) {
  const bank = getBank(a.bankId);
  const [from, to] = bank ? bank.colors : [a.color, `color-mix(in oklab, ${a.color} 55%, #0b1f17)`];
  return {
    backgroundImage: `radial-gradient(120% 140% at 100% 0%, rgb(255 255 255 / 0.22) 0%, transparent 50%), linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
  };
}

const SIZES = {
  xs: 'h-6 w-6 rounded-lg',
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-10 w-10 rounded-2xl',
  lg: 'h-12 w-12 rounded-2xl',
};

/** Bank logo on a white tile, or the account icon in a tinted tile. */
export function AccountAvatar({ account, size = 'sm', className, onDark }: {
  account: Pick<Account, 'icon' | 'color' | 'bankId'>; size?: keyof typeof SIZES; className?: string;
  /** Use a translucent white tile (for icons placed on colored cards). */
  onDark?: boolean;
}) {
  const bank = getBank(account.bankId);
  if (bank) {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden bg-white p-[3px] shadow-sm', SIZES[size], className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bank.logo} alt={bank.name} className="h-full w-full rounded-[inherit] object-contain" />
      </span>
    );
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', SIZES[size], className)}
      style={onDark ? { backgroundColor: 'rgb(255 255 255 / 0.2)', color: '#fff' } : { backgroundColor: `${account.color}1F`, color: account.color }}
      aria-hidden
    >
      <DynamicIcon name={account.icon} className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  );
}

/**
 * Horizontal account chooser used in every form that moves money.
 * With `noneLabel`, "don't record on an account" is the first choice (value = undefined).
 */
export function AccountPicker({ value, onChange, noneLabel, exclude, className }: {
  value?: string; onChange: (id: string | undefined) => void; noneLabel?: string; exclude?: string; className?: string;
}) {
  const fmt = useMoney();
  const { active } = useAccounts();
  const { balances } = useBalances();
  return (
    <div className={cn('-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide', className)} role="radiogroup">
      {noneLabel && (
        <button
          type="button"
          role="radio"
          onClick={() => onChange(undefined)}
          aria-checked={!value}
          className={cn(
            'flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors',
            !value ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <Ban className="h-4 w-4" /> {noneLabel}
        </button>
      )}
      {active.filter((a) => a.id !== exclude).map((a) => {
        const on = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            onClick={() => onChange(a.id)}
            aria-checked={on}
            className={cn(
              'flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition-colors',
              on ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
            )}
          >
            <AccountAvatar account={a} size="sm" />
            <span className="text-xs leading-tight">
              <span className="block max-w-32 truncate font-semibold">{a.name}</span>
              <span className="block text-muted-foreground tabular">{fmt(balances[a.id] ?? 0, { compact: true })}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
