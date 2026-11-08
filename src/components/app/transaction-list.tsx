'use client';

import { useMemo } from 'react';
import { ArrowLeftRight, Repeat, Target, HandCoins } from 'lucide-react';
import { IconBubble } from '@/lib/icons';
import { format } from 'date-fns';
import { useAccounts, useBalanceAfter, useCategories } from '@/hooks/use-finance';
import { useDayLabel, useMoney } from '@/lib/format';
import { useQuickAdd } from '@/stores/ui-store';
import { useT } from '@/i18n';
import type { Transaction } from '@/lib/types';
import { Money } from './ui';
import { cn } from '@/lib/utils';

/** `accountId` — the account whose balance to show (for a transfer into it, its own balance). */
export function TransactionRow({ tx, showDate = false, compact = false, accountId }: { tx: Transaction; showDate?: boolean; compact?: boolean; accountId?: string }) {
  const { map: catMap, label } = useCategories();
  const { map: accMap } = useAccounts();
  const openEdit = useQuickAdd((s) => s.openEdit);
  const dayLabel = useDayLabel();
  const t = useT();
  const fmt = useMoney();
  const after = useBalanceAfter().get(tx.id);

  const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined;
  const account = accMap.get(tx.accountId);
  const toAccount = tx.toAccountId ? accMap.get(tx.toAccountId) : undefined;

  const isTransfer = tx.kind === 'transfer';
  const title = isTransfer ? t('common.transfer') : label(cat);
  const subtitle = isTransfer
    ? `${account?.name ?? '—'} → ${toAccount?.name ?? '—'}`
    : [tx.note, account?.name].filter(Boolean).join(' · ');
  // Time of the operation, when it was entered on the same day (imports have no time).
  const created = new Date(tx.createdAt);
  const time = !Number.isNaN(created.getTime()) && format(created, 'yyyy-MM-dd') === tx.date.slice(0, 10) ? format(created, 'HH:mm') : '';
  const when = showDate ? [dayLabel(tx.date), time].filter(Boolean).join(', ') : time;
  const LinkIcon = tx.recurringId ? Repeat : tx.goalId ? Target : tx.debtId ? HandCoins : null;

  return (
    <button
      type="button"
      onClick={() => openEdit(tx)}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-muted/70 active:bg-muted',
        compact ? 'py-2' : 'py-2.5',
      )}
    >
      {isTransfer ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ArrowLeftRight className="h-[18px] w-[18px]" />
        </span>
      ) : (
        <IconBubble icon={cat?.icon} color={cat?.color} />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{title}</span>
          {LinkIcon && <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[when, subtitle].filter(Boolean).join(' · ') || ' '}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <Money value={tx.amount} kind={tx.kind} className="text-sm font-bold" />
        {after && (
          <span className="tabular whitespace-nowrap text-[11px] text-muted-foreground">
            {t('common.balanceAfter')} {fmt(accountId && accountId === tx.toAccountId && after.to !== undefined ? after.to : after.from)}
          </span>
        )}
      </div>
    </button>
  );
}

/** Transactions grouped by day with a daily net total. */
export function TransactionGroups({ transactions }: { transactions: Transaction[] }) {
  const dayLabel = useDayLabel();
  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const d = tx.date.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(tx);
    }
    return [...m.entries()];
  }, [transactions]);

  return (
    <div className="space-y-4">
      {groups.map(([day, txs]) => {
        const net = txs.reduce((s, t) => s + (t.kind === 'income' ? t.amount : t.kind === 'expense' ? -t.amount : 0), 0);
        return (
          <div key={day}>
            <div className="mb-1 flex items-center justify-between px-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{dayLabel(day, true)}</p>
              {net !== 0 && <Money value={net} kind="auto" className="text-xs font-semibold opacity-80" />}
            </div>
            <div className="rounded-3xl border border-border bg-card p-1.5 card-shadow">
              {txs.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
