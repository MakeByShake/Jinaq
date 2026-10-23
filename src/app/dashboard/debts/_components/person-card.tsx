'use client';

import {
  BellRing, CalendarClock, ChevronDown, HandCoins, History, Pencil, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Money, ProgressBar } from '@/components/app/ui';
import { initials } from '@/components/app/user-avatar';
import { PALETTE } from '@/lib/icons';
import { useDayLabel, useMoney } from '@/lib/format';
import { daysUntil } from '@/lib/dates';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Debt, DebtDirection } from '@/lib/types';

export type DebtTab = DebtDirection | 'closed';

export interface PersonGroup {
  key: string;
  name: string;
  debts: Debt[];
  /** Open: remaining to be repaid. Closed tab: total of settled amounts. */
  total: number;
  /** Remaining in the opposite direction with the same person (open debts only). */
  counter: number;
  nearestDue?: string;
}

export const remainingOf = (d: Debt) => Math.max(0, d.amount - (d.paid ?? 0));
export const personKey = (name: string) => name.trim().toLocaleLowerCase();

/** Groups debts by person for a tab, Splitwise-style. Overdue / soonest first. */
export function groupByPerson(all: Debt[], tab: DebtTab): PersonGroup[] {
  const inTab = all.filter((d) => (tab === 'closed' ? d.settled : !d.settled && d.direction === tab));
  const map = new Map<string, PersonGroup>();
  for (const d of inTab) {
    const key = personKey(d.personName);
    const g = map.get(key) ?? { key, name: d.personName.trim(), debts: [], total: 0, counter: 0 };
    g.debts.push(d);
    g.total += tab === 'closed' ? d.amount : remainingOf(d);
    if (!d.settled && d.dueDate && (!g.nearestDue || d.dueDate < g.nearestDue)) g.nearestDue = d.dueDate;
    map.set(key, g);
  }
  if (tab !== 'closed') {
    for (const d of all) {
      if (d.settled || d.direction === tab) continue;
      const g = map.get(personKey(d.personName));
      if (g) g.counter += remainingOf(d);
    }
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.debts.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.createdAt.localeCompare(a.createdAt));
  }
  return groups.sort((a, b) =>
    tab === 'closed'
      ? latest(b).localeCompare(latest(a))
      : (a.nearestDue ?? '9999').localeCompare(b.nearestDue ?? '9999') || b.total - a.total);
}

function latest(g: PersonGroup) {
  return g.debts.reduce((m, d) => {
    const last = d.payments?.[d.payments.length - 1]?.date ?? d.createdAt;
    return last > m ? last : m;
  }, '');
}

/** Deterministic colour per name so a person keeps the same avatar everywhere. */
export function colorFor(name: string) {
  let h = 0;
  for (const ch of personKey(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  const color = colorFor(name);
  return (
    <span
      className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold', className)}
      style={{ backgroundColor: `${color}24`, color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** "Due 12 March" / "Overdue by 3 days" with matching colour. */
function DueLabel({ day, className }: { day: string; className?: string }) {
  const t = useT();
  const dayLabel = useDayLabel();
  const n = daysUntil(day);
  const text = n < 0 ? t('debts.overdue', { days: t('common.days', { count: -n }) })
    : n === 0 ? t('debts.dueToday')
      : t('debts.due', { date: dayLabel(day) });
  return (
    <span className={cn('inline-flex items-center gap-1', n < 0 ? 'font-semibold text-expense' : n <= 3 ? 'font-semibold text-warning' : '', className)}>
      <CalendarClock className="h-3.5 w-3.5 shrink-0" /> {text}
    </span>
  );
}

export interface PersonCardHandlers {
  onRepay: (d: Debt) => void;
  onEdit: (d: Debt) => void;
  onDelete: (d: Debt) => void;
  onRemind: (g: PersonGroup) => void;
}

export function PersonCard({ group, tab, expanded, onToggle, ...h }: PersonCardHandlers & {
  group: PersonGroup; tab: DebtTab; expanded: boolean; onToggle: () => void;
}) {
  const t = useT();
  const fmt = useMoney();
  const closed = tab === 'closed';
  const panelId = `debts-${group.key.replace(/\W+/g, '-')}-${tab}`;
  const overdue = !!group.nearestDue && daysUntil(group.nearestDue) < 0;

  return (
    <article className={cn('overflow-hidden rounded-3xl border bg-card card-shadow', overdue ? 'border-expense/40' : 'border-border')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={t('debts.toggle', { name: group.name })}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <PersonAvatar name={group.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{group.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{t(closed ? 'debts.closedCount' : 'debts.openCount', { count: group.debts.length })}</span>
            {!closed && group.nearestDue && <DueLabel day={group.nearestDue} />}
          </p>
          {group.counter > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(tab === 'owed_to_me' ? 'debts.mutualIOwe' : 'debts.mutualOwedToMe', { amount: fmt(group.counter) })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Money
            value={group.total}
            className={cn('font-display text-base font-semibold sm:text-lg', closed ? 'text-muted-foreground' : tab === 'owed_to_me' ? 'text-income' : 'text-expense')}
          />
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-border bg-muted/25 p-3 sm:p-4">
          {tab === 'owed_to_me' && (
            <Button variant="outline" className="mb-3 h-10 w-full rounded-xl font-semibold sm:w-auto" onClick={() => h.onRemind(group)}>
              <BellRing className="h-4 w-4" /> {t('debts.remind')}
            </Button>
          )}
          <ul className="space-y-2.5">
            {group.debts.map((d) => <DebtItem key={d.id} debt={d} showDirection={closed} {...h} />)}
          </ul>
        </div>
      )}
    </article>
  );
}

function DebtItem({ debt, showDirection, onRepay, onEdit, onDelete }: Omit<PersonCardHandlers, 'onRemind'> & {
  debt: Debt; showDirection: boolean;
}) {
  const t = useT();
  const fmt = useMoney();
  const dayLabel = useDayLabel();
  const pct = debt.amount > 0 ? (debt.paid ?? 0) / debt.amount : 0;
  const payments = [...(debt.payments ?? [])].reverse();

  return (
    <li className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Money value={debt.settled ? debt.amount : remainingOf(debt)} className="text-base font-extrabold" />
            {!debt.settled && (debt.paid ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground">{t('common.of')} <Money value={debt.amount} /></span>
            )}
            {showDirection && (
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-bold',
                debt.direction === 'owed_to_me' ? 'bg-income/12 text-income' : 'bg-expense/12 text-expense',
              )}>
                {t(debt.direction === 'owed_to_me' ? 'debts.lent' : 'debts.borrowed')}
              </span>
            )}
          </div>
          {debt.note && <p className="mt-0.5 text-sm break-words">{debt.note}</p>}
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{t('debts.createdOn', { date: dayLabel(debt.createdAt.slice(0, 10)) })}</span>
            {!debt.settled && (debt.dueDate ? <DueLabel day={debt.dueDate} /> : <span>{t('debts.noDue')}</span>)}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground" onClick={() => onEdit(debt)} aria-label={t('common.edit')}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive" onClick={() => onDelete(debt)} aria-label={t('common.delete')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-2.5">
        <ProgressBar value={debt.settled ? 1 : pct} color={debt.direction === 'owed_to_me' ? 'var(--income)' : 'var(--expense)'} />
        <p className="mt-1 text-xs text-muted-foreground tabular">
          {t('debts.paidOf', { paid: fmt(debt.paid ?? 0), amount: fmt(debt.amount) })}
        </p>
      </div>

      {payments.length > 0 && (
        <details className="group mt-2">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-primary">
            <History className="h-3.5 w-3.5" /> {t('debts.payments')} · {payments.length}
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-1 space-y-1 border-l-2 border-border pl-3">
            {payments.map((p, i) => (
              <li key={i} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{dayLabel(p.date)}</span>
                <Money value={p.amount} className="font-semibold" />
              </li>
            ))}
          </ul>
        </details>
      )}

      {!debt.settled && (
        <Button className="mt-3 h-10 w-full rounded-xl font-bold" onClick={() => onRepay(debt)}>
          <HandCoins className="h-4 w-4" /> {t('debts.repay')}
        </Button>
      )}
    </li>
  );
}
