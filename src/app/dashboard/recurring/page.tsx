'use client';

import { useMemo, useState } from 'react';
import {
  addDays, addMonths, addWeeks, addYears, endOfMonth, getDay, startOfMonth,
} from 'date-fns';
import {
  ArrowDownLeft, ArrowUpRight, CalendarClock, CalendarDays, Check, EyeOff, MoreVertical, Pause,
  Pencil, Play, Plus, Repeat, SkipForward, Sparkles, Trash2, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ConfirmDialog, EmptyState, Money, PageContainer, PageHeader, Panel, Segmented, useConfirm,
} from '@/components/app/ui';
import { ResponsiveSheet } from '@/components/app/sheet';
import { useData } from '@/stores/data-store';
import { useAccounts, useCategories } from '@/hooks/use-finance';
import { evalAmount, useDateFormat, useDayLabel, useMoney } from '@/lib/format';
import { daysUntil, nextOccurrence, parseDay, toDay, todayISO } from '@/lib/dates';
import {
  deleteRecurring, deleteTransaction, newId, payRecurring, saveRecurring, skipRecurring,
} from '@/lib/actions';
import { DynamicIcon, IconBubble } from '@/lib/icons';
import { useT, type TFunction } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Category, CategoryKind, Frequency, Recurring, Transaction } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalises any frequency to a monthly amount. */
function monthlyAmount(r: Recurring): number {
  if (r.frequency === 'weekly') return (r.amount * 52) / 12;
  if (r.frequency === 'yearly') return r.amount / 12;
  return r.amount;
}

function stepDate(d: Date, f: Frequency, n: number): Date {
  return f === 'weekly' ? addWeeks(d, n) : f === 'yearly' ? addYears(d, n) : addMonths(d, n);
}

/** All dates of `r` that fall inside [from, to], projected backwards and forwards from nextDate. */
function occurrencesIn(r: Recurring, from: Date, to: Date): Date[] {
  let d = parseDay(r.nextDate);
  let guard = 0;
  while (d > from && guard++ < 600) {
    const prev = stepDate(d, r.frequency, -1);
    if (prev < from) break;
    d = prev;
  }
  const out: Date[] = [];
  guard = 0;
  while (d <= to && guard++ < 600) {
    if (d >= from) out.push(d);
    d = stepDate(d, r.frequency, 1);
  }
  return out;
}

/** "через 3 дня" / "завтра" / "просрочено на 2 дня". */
function dueLabel(days: number, t: TFunction): string {
  if (days < 0) return t('rec.overdueBy', { days: t('common.days', { count: -days }) });
  if (days === 0) return t('rec.dueToday');
  if (days === 1) return t('rec.dueTomorrow');
  return t('rec.dueIn', { days: t('common.days', { count: days }) });
}

// Popular presets for the create form (name comes from i18n, category by built-in key).
const SUGGESTIONS: { id: string; kind: CategoryKind; catKey: string }[] = [
  { id: 'rent', kind: 'expense', catKey: 'housing' },
  { id: 'internet', kind: 'expense', catKey: 'mobile' },
  { id: 'mobile', kind: 'expense', catKey: 'mobile' },
  { id: 'spotify', kind: 'expense', catKey: 'subscriptions' },
  { id: 'yandex', kind: 'expense', catKey: 'subscriptions' },
  { id: 'scholarship', kind: 'income', catKey: 'scholarship' },
  { id: 'salary', kind: 'income', catKey: 'salary' },
];

// ─── Subscription detector ───────────────────────────────────────────────────

interface Detected {
  key: string;
  name: string;
  amount: number;
  categoryId: string;
  accountId: string;
  lastDate: string;
  count: number;
}

const DISMISSED_KEY = 'jinaq-dismissed-subscriptions';

function readDismissed(): string[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DISMISSED_KEY) : null;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissed(keys: string[]) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(keys)); } catch { /* storage blocked */ }
}

/**
 * Finds expenses that repeat about once a month over the last ~120 days:
 * same note (case-insensitive) or same category + amount, in ≥2 different months,
 * every gap 25–35 days, not already linked to (or duplicating) a recurring item.
 */
function detectSubscriptions(
  txs: Transaction[], recurring: Recurring[], dismissed: Set<string>, catLabel: (id: string) => string,
): Detected[] {
  const today = new Date();
  const since = toDay(addDays(today, -120));
  const recentCutoff = toDay(addDays(today, -45)); // the last charge must be recent enough to still be "live"
  const groups = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (tx.kind !== 'expense' || tx.recurringId || tx.goalId || tx.debtId || !tx.categoryId) continue;
    if (tx.date.slice(0, 10) < since) continue;
    const note = tx.note?.trim().toLowerCase();
    const keys = [`c:${tx.categoryId}:${tx.amount}`];
    if (note) keys.unshift(`n:${note}`);
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), tx]);
  }

  const knownNames = new Set(recurring.map((r) => r.name.trim().toLowerCase()));
  const knownCatAmount = new Set(recurring.map((r) => `${r.categoryId}:${r.amount}`));
  const usedTx = new Set<string>();
  const out: Detected[] = [];

  // Note groups first: they give nicer names, and their transactions then block the category duplicate.
  const ordered = [...groups.entries()].sort(([a], [b]) => (a[0] === b[0] ? 0 : a[0] === 'n' ? -1 : 1));
  for (const [key, list] of ordered) {
    if (dismissed.has(key)) continue;
    // One charge per day at most, oldest first.
    const byDay = new Map<string, Transaction>();
    for (const tx of list) byDay.set(tx.date.slice(0, 10), tx);
    const sorted = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    if (sorted.some((tx) => usedTx.has(tx.id))) continue;
    const months = new Set(sorted.map((tx) => tx.date.slice(0, 7)));
    if (months.size < 2) continue;
    const monthly = sorted.every((tx, i) => {
      if (i === 0) return true;
      const gap = daysUntil(tx.date.slice(0, 10), parseDay(sorted[i - 1].date.slice(0, 10)));
      return gap >= 25 && gap <= 35;
    });
    if (!monthly) continue;
    const last = sorted[sorted.length - 1];
    if (last.date.slice(0, 10) < recentCutoff) continue;
    const amounts = sorted.map((tx) => tx.amount);
    if (Math.max(...amounts) > Math.min(...amounts) * 1.25) continue; // price must be stable
    const categoryId = last.categoryId!;
    const isNote = key.startsWith('n:');
    const name = isNote ? last.note!.trim() : catLabel(categoryId);
    if (knownNames.has(name.toLowerCase()) || knownCatAmount.has(`${categoryId}:${last.amount}`)) continue;

    sorted.forEach((tx) => usedTx.add(tx.id));
    out.push({
      key, name, amount: last.amount, categoryId, accountId: last.accountId,
      lastDate: last.date.slice(0, 10), count: sorted.length,
    });
  }
  return out.slice(0, 3);
}

// ─── Page ────────────────────────────────────────────────────────────────────

type SheetState = { mode: 'new' } | { mode: 'edit'; item: Recurring } | null;

export default function RecurringPage() {
  const t = useT();
  const fmt = useMoney();
  const dateFmt = useDateFormat();
  const recurring = useData((s) => s.recurring);
  const transactions = useData((s) => s.transactions);
  const { map, label } = useCategories();
  const [sheet, setSheet] = useState<SheetState>(null);
  // The page only renders on the client after data loads, so reading storage here is safe.
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const confirm = useConfirm();
  const [confirmName, setConfirmName] = useState('');

  const data = useMemo(() => {
    const active = recurring.filter((r) => r.active);
    const withDays = active
      .map((r) => ({ r, days: daysUntil(r.nextDate) }))
      .sort((a, b) => a.r.nextDate.localeCompare(b.r.nextDate));
    const fixedIncome = active.filter((r) => r.kind === 'income').reduce((s, r) => s + monthlyAmount(r), 0);
    const fixedExpense = active.filter((r) => r.kind === 'expense').reduce((s, r) => s + monthlyAmount(r), 0);
    const subs = active.filter((r) => r.kind === 'expense' && map.get(r.categoryId)?.key === 'subscriptions');
    return {
      overdue: withDays.filter((x) => x.days < 0),
      next7: withDays.filter((x) => x.days >= 0 && x.days <= 7),
      later: withDays.filter((x) => x.days > 7),
      paused: recurring.filter((r) => !r.active).sort((a, b) => a.name.localeCompare(b.name)),
      fixedIncome,
      fixedExpense,
      subsTotal: subs.reduce((s, r) => s + monthlyAmount(r), 0),
      subsCount: subs.length,
    };
  }, [recurring, map]);

  const detected = useMemo(
    () => detectSubscriptions(transactions, recurring, new Set(dismissed), (id) => label(id)),
    [transactions, recurring, dismissed, label],
  );

  // ─── Row actions ───
  const markPaid = (r: Recurring) => {
    const prev = { ...r };
    const tx = payRecurring(r);
    toast.success(t('rec.paidToast', { name: r.name }), {
      action: { label: t('common.undo'), onClick: () => { deleteTransaction(tx); saveRecurring(prev); } },
    });
  };
  const skip = (r: Recurring) => {
    const prev = { ...r };
    skipRecurring(r);
    toast(t('rec.skippedToast', { name: r.name, date: dateFmt(nextOccurrence(r.nextDate, r.frequency), 'd MMMM') }), {
      action: { label: t('common.undo'), onClick: () => saveRecurring(prev) },
    });
  };
  const togglePause = (r: Recurring) => {
    const prev = { ...r };
    if (r.active) {
      saveRecurring({ ...r, active: false });
      toast(t('rec.pausedToast', { name: r.name }), { action: { label: t('common.undo'), onClick: () => saveRecurring(prev) } });
    } else {
      // Resuming: roll a stale date forward so it doesn't show up as long overdue.
      let next = r.nextDate;
      const today = todayISO();
      for (let i = 0; next < today && i < 600; i++) next = nextOccurrence(next, r.frequency);
      saveRecurring({ ...r, active: true, nextDate: next });
      toast(t('rec.resumedToast', { name: r.name }), { action: { label: t('common.undo'), onClick: () => saveRecurring(prev) } });
    }
  };
  const askDelete = (r: Recurring) => {
    setConfirmName(r.name);
    confirm.ask(() => {
      deleteRecurring(r.id);
      toast(t('rec.deleted'));
    });
  };
  const rowActions: RowActions = {
    pay: markPaid, skip, togglePause, remove: askDelete, edit: (r) => setSheet({ mode: 'edit', item: r }),
  };

  // ─── Detector actions ───
  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    writeDismissed(next);
  };
  const adopt = (d: Detected) => {
    const r: Recurring = {
      id: newId('rec'), name: d.name, kind: 'expense', amount: d.amount, categoryId: d.categoryId,
      accountId: d.accountId, frequency: 'monthly', nextDate: toDay(addMonths(parseDay(d.lastDate), 1)),
      active: true, createdAt: new Date().toISOString(),
    };
    saveRecurring(r);
    toast.success(t('rec.createdToast', { name: d.name }), {
      action: { label: t('common.undo'), onClick: () => deleteRecurring(r.id) },
    });
  };

  const { fixedIncome, fixedExpense, subsTotal, subsCount } = data;
  const free = fixedIncome - fixedExpense;
  const isEmpty = recurring.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title={t('rec.title')}
        subtitle={t('rec.subtitle')}
        actions={!isEmpty && (
          <Button className="h-10 rounded-xl" onClick={() => setSheet({ mode: 'new' })}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('rec.addFull')}</span>
            <span className="sm:hidden">{t('rec.add')}</span>
          </Button>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        {!isEmpty && (
          <section className="relative overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6 lg:col-span-3">
            <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/75">{fixedIncome > 0 ? t('rec.freeAfter') : t('rec.fixedPerMonth')}</p>
                <p className="mt-1 truncate font-display text-[2.1rem] leading-tight font-semibold tabular sm:text-5xl">
                  {fmt(Math.round(fixedIncome > 0 ? free : fixedExpense))}
                </p>
                {fixedIncome === 0 && <p className="mt-2 max-w-md text-xs text-white/80">{t('rec.noIncomeHint')}</p>}
              </div>
              <div className="grid grid-cols-3 gap-2 md:min-w-96">
                {[
                  { icon: ArrowDownLeft, label: t('rec.fixedIncome'), value: fixedIncome, cls: 'text-emerald-200' },
                  { icon: ArrowUpRight, label: t('rec.fixedExpense'), value: fixedExpense, cls: 'text-rose-200' },
                  { icon: Repeat, label: subsCount > 0 ? `${t('rec.subscriptions')} · ${subsCount}` : t('rec.subscriptions'), value: subsTotal, cls: 'text-amber-200' },
                ].map((s) => (
                  <div key={s.label} className="min-w-0 rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
                    <s.icon className={cn('h-4 w-4', s.cls)} />
                    <p className="mt-1.5 truncate text-[11px] font-medium text-white/75">{s.label}</p>
                    <p className="truncate text-sm font-bold tabular sm:text-base">{t('rec.perMonthShort', { amount: fmt(Math.round(s.value), { compact: true }) })}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          {/* Subscription detector */}
          {detected.map((d) => (
            <DetectedCard key={d.key} d={d} onAdopt={() => adopt(d)} onDismiss={() => dismiss(d.key)} />
          ))}

          {isEmpty ? (
            <Panel>
              <EmptyState
                icon={CalendarClock}
                title={t('rec.emptyTitle')}
                text={t('rec.emptyText')}
                action={
                  <Button className="h-11 rounded-xl" onClick={() => setSheet({ mode: 'new' })}>
                    <Plus className="h-4 w-4" /> {t('rec.addFull')}
                  </Button>
                }
              />
            </Panel>
          ) : (
            <>
              <Section title={t('rec.overdue')} tone="text-expense" items={data.overdue} actions={rowActions} />
              <Section title={t('rec.next7')} items={data.next7} actions={rowActions} />
              <Section title={t('rec.later')} items={data.later} actions={rowActions} />
              {data.paused.length > 0 && (
                <Section
                  title={t('rec.paused')}
                  tone="text-muted-foreground"
                  items={data.paused.map((r) => ({ r, days: daysUntil(r.nextDate) }))}
                  actions={rowActions}
                />
              )}
            </>
          )}
        </div>

        {!isEmpty && (
          <div className="space-y-4 lg:space-y-5">
            <MonthCalendar recurring={recurring.filter((r) => r.active)} categories={map} />
          </div>
        )}
      </div>

      <RecurringSheet state={sheet} onClose={() => setSheet(null)} />
      <ConfirmDialog
        {...confirm.props}
        title={t('rec.deleteTitle', { name: confirmName })}
        text={t('rec.deleteText')}
      />
    </PageContainer>
  );
}

// ─── Detector card ───────────────────────────────────────────────────────────

function DetectedCard({ d, onAdopt, onDismiss }: { d: Detected; onAdopt: () => void; onDismiss: () => void }) {
  const t = useT();
  const fmt = useMoney();
  const { map } = useCategories();
  const c = map.get(d.categoryId);
  return (
    <section className="rounded-3xl border border-dashed border-primary/40 bg-accent/40 p-4 card-shadow">
      <div className="flex items-start gap-3">
        <IconBubble icon={c?.icon} color={c?.color} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" /> {t('rec.detectTitle')}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">{t('rec.detectText', { name: d.name, amount: fmt(d.amount) })}</p>
          <p className="text-xs text-muted-foreground">{t('rec.detectHint', { count: d.count })}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" className="h-10 flex-1 rounded-xl sm:flex-none" onClick={onAdopt}>
          <Repeat className="h-4 w-4" /> {t('rec.makeRecurring')}
        </Button>
        <Button size="sm" variant="ghost" className="h-10 rounded-xl text-muted-foreground" onClick={onDismiss}>
          <EyeOff className="h-4 w-4" /> {t('rec.hide')}
        </Button>
      </div>
    </section>
  );
}

// ─── Sections & rows ─────────────────────────────────────────────────────────

interface RowActions {
  pay: (r: Recurring) => void;
  skip: (r: Recurring) => void;
  togglePause: (r: Recurring) => void;
  remove: (r: Recurring) => void;
  edit: (r: Recurring) => void;
}

function Section({ title, tone, items, actions }: {
  title: string; tone?: string; items: { r: Recurring; days: number }[]; actions: RowActions;
}) {
  const fmt = useMoney();
  if (items.length === 0) return null;
  const total = items.reduce((s, x) => s + (x.r.kind === 'expense' ? -x.r.amount : x.r.amount), 0);
  return (
    <Panel
      className="p-2 sm:p-3"
      title={<span className={tone}>{title} <span className="font-semibold text-muted-foreground">· {items.length}</span></span>}
      action={<span className="pr-2 text-xs font-semibold text-muted-foreground tabular">{fmt(total, { sign: true, compact: true })}</span>}
    >
      <ul>
        {items.map((x) => <RecurringRow key={x.r.id} r={x.r} days={x.days} actions={actions} />)}
      </ul>
    </Panel>
  );
}

function RecurringRow({ r, days, actions }: { r: Recurring; days: number; actions: RowActions }) {
  const t = useT();
  const dayLabel = useDayLabel();
  const { map, label } = useCategories();
  const c = map.get(r.categoryId);
  const overdue = r.active && days < 0;
  const soon = r.active && days >= 0 && days <= 1;
  const payLabel = r.kind === 'income' ? t('rec.receive') : t('rec.pay');

  return (
    <li className={cn('flex items-center gap-3 rounded-2xl px-2 py-2', !r.active && 'opacity-60')}>
      <button
        type="button"
        onClick={() => actions.edit(r)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
        aria-label={`${t('rec.edit')}: ${r.name}`}
      >
        <IconBubble icon={c?.icon} color={c?.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className={cn(overdue && 'font-semibold text-expense', soon && 'font-semibold text-warning')}>
              {r.active ? dueLabel(days, t) : t('rec.pausedLabel')}
            </span>
            {' · '}
            {r.active && days > 1 ? `${dayLabel(r.nextDate)} · ` : ''}
            {label(c)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Money value={r.amount} kind={r.kind} className="block text-sm font-bold" />
          <span className="text-[11px] text-muted-foreground">{t(`rec.per_${r.frequency}`)}</span>
        </div>
      </button>

      {r.active && (
        <button
          type="button"
          onClick={() => actions.pay(r)}
          aria-label={`${payLabel}: ${r.name}`}
          title={payLabel}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-primary hover:bg-accent hover:text-primary',
            overdue || soon ? 'border-primary/50 text-primary' : 'border-border text-muted-foreground',
          )}
        >
          <Check className="h-4 w-4" />
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${t('rec.actions')}: ${r.name}`}
            className="-ml-1 flex h-10 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl">
          {r.active && (
            <>
              <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={() => actions.pay(r)}>
                <Check /> {payLabel}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={() => actions.skip(r)}>
                <SkipForward /> {t('rec.skip')}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={() => actions.edit(r)}>
            <Pencil /> {t('rec.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={() => actions.togglePause(r)}>
            {r.active ? <Pause /> : <Play />} {r.active ? t('rec.pause') : t('rec.resume')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="min-h-10 rounded-xl" onSelect={() => actions.remove(r)}>
            <Trash2 /> {t('rec.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// ─── Month calendar ──────────────────────────────────────────────────────────

interface CalEntry { r: Recurring; date: string; done: boolean }

function MonthCalendar({ recurring, categories }: { recurring: Recurring[]; categories: Map<string, Category> }) {
  const t = useT();
  const fmt = useMoney();
  const dateFmt = useDateFormat();
  const today = todayISO();
  const [selected, setSelected] = useState<string>(today);

  const { cells, byDay, monthTotal } = useMemo(() => {
    const now = new Date();
    const from = startOfMonth(now);
    const to = endOfMonth(now);
    const byDay = new Map<string, CalEntry[]>();
    let monthTotal = 0;
    for (const r of recurring) {
      for (const d of occurrencesIn(r, from, to)) {
        const day = toDay(d);
        // Dates before the item's nextDate have already been paid/skipped.
        byDay.set(day, [...(byDay.get(day) ?? []), { r, date: day, done: day < r.nextDate }]);
        if (r.kind === 'expense') monthTotal += r.amount;
      }
    }
    // Monday-first grid with leading blanks.
    const lead = (getDay(from) + 6) % 7;
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = from; d <= to; d = addDays(d, 1)) cells.push(toDay(d));
    return { cells, byDay, monthTotal };
  }, [recurring]);

  // Weekday initials from a known Monday (2024-01-01).
  const weekdays = Array.from({ length: 7 }, (_, i) => dateFmt(addDays(new Date(2024, 0, 1), i), 'EEEEEE'));
  const selectedEntries = byDay.get(selected) ?? [];

  return (
    <Panel
      title={<span className="first-letter:uppercase">{t('rec.calendar', { month: dateFmt(new Date(), 'LLLL') })}</span>}
      icon={CalendarDays}
    >
      {byDay.size === 0 ? (
        <p className="text-sm text-muted-foreground">{t('rec.calendarEmpty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((w, i) => (
              <span key={i} className="pb-1 text-[11px] font-semibold text-muted-foreground uppercase">{w}</span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={`b${i}`} />;
              const entries = byDay.get(day) ?? [];
              const isToday = day === today;
              const isSel = day === selected;
              const overdue = entries.some((e) => !e.done && day < today);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={isSel}
                  aria-label={`${dateFmt(day, 'd MMMM')}${entries.length ? `: ${entries.map((e) => e.r.name).join(', ')}` : ''}`}
                  className={cn(
                    'flex aspect-square min-h-10 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold tabular transition-colors',
                    isSel ? 'bg-primary text-primary-foreground' : isToday ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    !entries.length && !isSel && !isToday && 'text-muted-foreground',
                  )}
                >
                  {parseDay(day).getDate()}
                  <span className="flex h-1.5 gap-0.5">
                    {entries.slice(0, 3).map((e, j) => (
                      <span
                        key={j}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isSel ? 'bg-primary-foreground' : e.done ? 'bg-muted-foreground/40' : overdue ? 'bg-expense' : e.r.kind === 'income' ? 'bg-income' : 'bg-warning',
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> {t('rec.legendDue')}</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-income" /> {t('rec.legendIncome')}</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /> {t('rec.legendDone')}</span>
          </div>

          {/* Selected day details */}
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground first-letter:uppercase">{dateFmt(selected, 'EEEE, d MMMM')}</p>
            {selectedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('rec.dayEmpty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {selectedEntries.map((e) => {
                  const c = categories.get(e.r.categoryId);
                  return (
                    <li key={e.r.id} className={cn('flex items-center gap-2', e.done && 'opacity-60')}>
                      <IconBubble icon={c?.icon} color={c?.color} size="sm" />
                      <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', e.done && 'line-through')}>{e.r.name}</span>
                      <Money value={e.r.amount} kind={e.r.kind} className="text-sm font-bold" />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-muted/60 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="h-4 w-4" /> {t('rec.monthTotal')}</span>
            <span className="font-bold tabular">{fmt(monthTotal)}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

// ─── Create / edit sheet ─────────────────────────────────────────────────────

function RecurringSheet({ state, onClose }: { state: SheetState; onClose: () => void }) {
  const t = useT();
  const key = state ? (state.mode === 'edit' ? state.item.id : 'new') : 'closed';
  return (
    <ResponsiveSheet
      open={state !== null}
      onOpenChange={(v) => !v && onClose()}
      title={state?.mode === 'edit' ? t('rec.editTitle') : t('rec.newTitle')}
    >
      {/* Remount on every open so the form starts from fresh state. */}
      {state && <RecurringForm key={key} editing={state.mode === 'edit' ? state.item : undefined} onClose={onClose} />}
    </ResponsiveSheet>
  );
}

function RecurringForm({ editing, onClose }: { editing?: Recurring; onClose: () => void }) {
  const t = useT();
  const { byKind, label, categories } = useCategories();
  const { active: accounts } = useAccounts();
  const transactions = useData((s) => s.transactions);
  const confirm = useConfirm();

  const defaultAccount = accounts.find((a) => a.id === transactions[0]?.accountId)?.id ?? accounts[0]?.id;
  const [kind, setKind] = useState<CategoryKind>(editing?.kind ?? 'expense');
  const [name, setName] = useState(editing?.name ?? '');
  const [expr, setExpr] = useState(editing ? String(editing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | undefined>(editing?.categoryId);
  const [accountId, setAccountId] = useState<string | undefined>(editing?.accountId ?? defaultAccount);
  const [frequency, setFrequency] = useState<Frequency>(editing?.frequency ?? 'monthly');
  const [nextDate, setNextDate] = useState(editing?.nextDate ?? todayISO());

  const cats = byKind(kind);
  const amount = evalAmount(expr);
  const suggestions = SUGGESTIONS.filter((s) => s.kind === kind);

  const applySuggestion = (s: (typeof SUGGESTIONS)[number]) => {
    setName(t(`rec.sug_${s.id}`));
    const c = categories.find((x) => x.key === s.catKey && x.kind === s.kind && !x.archived);
    if (c) setCategoryId(c.id);
  };

  const save = () => {
    if (!name.trim()) return toast.error(t('rec.nameRequired'));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error(t('common.invalidAmount'));
    if (!categoryId) return toast.error(t('rec.pickCategory'));
    if (!accountId) return toast.error(t('rec.pickAccount'));
    saveRecurring({
      id: editing?.id ?? newId('rec'),
      name: name.trim(), kind, amount, categoryId, accountId, frequency, nextDate,
      active: editing?.active ?? true,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
    toast.success(t('rec.saved'));
    onClose();
  };

  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={(k) => { setKind(k); setCategoryId(undefined); }}
        className="w-full"
        options={[
          { value: 'expense', label: t('common.expense'), className: 'text-expense' },
          { value: 'income', label: t('common.income'), className: 'text-income' },
        ]}
      />

      {!editing && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('rec.suggestions')}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => {
              const c = categories.find((x) => x.key === s.catKey);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-accent/50 px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent"
                >
                  <DynamicIcon name={c?.icon} className="h-3.5 w-3.5" style={{ color: c?.color }} />
                  {t(`rec.sug_${s.id}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-foreground/80">{t('rec.name')}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('rec.namePlaceholder')}
            maxLength={60}
            className="h-11 rounded-2xl text-base md:text-sm"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-foreground/80">{t('rec.amount')}</span>
          <Input
            value={expr}
            onChange={(e) => setExpr(e.target.value.replace(/[^\d.,+\-*/ ]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            inputMode="decimal"
            placeholder="0"
            className={cn('h-11 rounded-2xl text-base font-bold tabular md:text-sm', kind === 'income' ? 'text-income' : 'text-expense')}
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-foreground/80">{t('rec.category')}</p>
        <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-5" role="radiogroup" aria-label={t('rec.category')}>
          {cats.map((c) => {
            const active = c.id === categoryId;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategoryId(c.id)}
                className={cn('flex flex-col items-center gap-1 rounded-2xl border border-transparent px-1 py-2 transition-all', !active && 'hover:bg-muted')}
                style={active ? { backgroundColor: `${c.color}1F`, borderColor: c.color } : undefined}
              >
                <IconBubble icon={c.icon} color={c.color} size="sm" />
                <span className="line-clamp-2 text-center text-[11px] leading-tight font-medium">{label(c)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-foreground/80">{t('rec.account')}</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccountId(a.id)}
              aria-pressed={accountId === a.id}
              className={cn(
                'flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors',
                accountId === a.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
              )}
            >
              <DynamicIcon name={a.icon} className="h-4 w-4" style={{ color: a.color }} />
              {a.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('rec.frequency')}</p>
          <Segmented
            value={frequency}
            onChange={setFrequency}
            className="w-full"
            size="sm"
            options={[
              { value: 'weekly', label: t('common.week') },
              { value: 'monthly', label: t('common.month') },
              { value: 'yearly', label: t('common.year') },
            ]}
          />
        </div>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-semibold text-foreground/80">{t('rec.nextDate')}</span>
          <Input
            type="date"
            value={nextDate}
            onChange={(e) => e.target.value && setNextDate(e.target.value)}
            className="h-11 rounded-2xl text-base md:text-sm"
          />
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        {editing && (
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 shrink-0 rounded-2xl text-destructive"
            aria-label={t('rec.delete')}
            onClick={() => confirm.ask(() => { deleteRecurring(editing.id); toast(t('rec.deleted')); onClose(); })}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
        <Button className="h-12 flex-1 rounded-2xl text-base font-bold" onClick={save}>
          <Check className="h-5 w-5" /> {t('common.save')}
        </Button>
      </div>

      {editing && (
        <ConfirmDialog {...confirm.props} title={t('rec.deleteTitle', { name: editing.name })} text={t('rec.deleteText')} />
      )}
    </div>
  );
}
