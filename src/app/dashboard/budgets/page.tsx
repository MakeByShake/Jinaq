'use client';

import { useMemo, useState } from 'react';
import { getDaysInMonth } from 'date-fns';
import {
  CalendarDays, Check, ChevronDown, Gauge, Plus, Sparkles, Trash2, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageContainer, PageHeader, Panel, ProgressBar } from '@/components/app/ui';
import { ResponsiveSheet } from '@/components/app/sheet';
import { useData } from '@/stores/data-store';
import { useCategories } from '@/hooks/use-finance';
import { evalAmount, useDateFormat, useMoney } from '@/lib/format';
import { daysLeftInMonth, monthRange } from '@/lib/dates';
import { budgetStatuses, periodStats, type BudgetStatus } from '@/lib/finance';
import { setBudget } from '@/lib/actions';
import { IconBubble } from '@/lib/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Category, Transaction } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Rounds up to a "nice" number so suggested limits look human (12 340 → 12 500). */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const step = v < 1_000 ? 100 : v < 10_000 ? 500 : v < 50_000 ? 1_000 : v < 200_000 ? 5_000 : 10_000;
  return Math.ceil(v / step) * step;
}

interface CategoryHistory {
  last: number; // spent last calendar month
  avg: number; // average over the last 3 full months (months with any spending)
}

/** Per-category spending history over the 3 previous full months. */
function spendHistory(txs: Transaction[]): Map<string, CategoryHistory> {
  const months = [-1, -2, -3].map((o) => periodStats(txs, monthRange(o)));
  // Divide by the number of months the user actually tracked, so new users aren't penalised.
  const tracked = Math.max(1, months.filter((m) => m.expense > 0).length);
  const out = new Map<string, CategoryHistory>();
  months.forEach((m, i) => {
    for (const c of m.byCategory) {
      const cur = out.get(c.categoryId) ?? { last: 0, avg: 0 };
      if (i === 0) cur.last = c.amount;
      cur.avg += c.amount / tracked;
      out.set(c.categoryId, cur);
    }
  });
  return out;
}

const STATE_TEXT = { ok: 'text-income', warn: 'text-warning', over: 'text-expense' } as const;
const STATE_BADGE = { ok: 'bg-income/12 text-income', warn: 'bg-warning/15 text-warning', over: 'bg-expense/12 text-expense' } as const;
const STATE_LABEL = { ok: 'bud.stateOk', warn: 'bud.stateWarn', over: 'bud.stateOver' } as const;

// ─── Page ────────────────────────────────────────────────────────────────────

/** Which sheet is open: edit an existing budget / create (optionally preselected) / quick setup. */
type SheetState =
  | { mode: 'edit'; categoryId: string }
  | { mode: 'new'; categoryId?: string }
  | { mode: 'quick' }
  | null;

export default function BudgetsPage() {
  const t = useT();
  const fmt = useMoney();
  const dateFmt = useDateFormat();
  const transactions = useData((s) => s.transactions);
  const budgets = useData((s) => s.budgets);
  const { categories, byKind, label, map } = useCategories();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [showUnbudgeted, setShowUnbudgeted] = useState(false);

  const data = useMemo(() => {
    const statuses = budgetStatuses(budgets, categories, transactions);
    const history = spendHistory(transactions);
    const month = periodStats(transactions, monthRange(0));
    const budgeted = new Set(budgets.map((b) => b.categoryId));
    const unbudgeted = month.byCategory.filter((c) => !budgeted.has(c.categoryId));

    const now = new Date();
    const daysLeft = daysLeftInMonth(now);
    const pace = now.getDate() / getDaysInMonth(now);
    const totalLimit = statuses.reduce((s, b) => s + b.budget.limit, 0);
    const totalSpent = statuses.reduce((s, b) => s + b.spent, 0);
    const totalLeft = statuses.reduce((s, b) => s + Math.max(0, b.remaining), 0);

    // Quick-setup proposals: top expense categories without a budget, by 3-month average.
    const proposals = [...history.entries()]
      .filter(([id, h]) => !budgeted.has(id) && h.avg > 0 && map.get(id)?.kind === 'expense' && !map.get(id)?.archived)
      .sort((a, b) => b[1].avg - a[1].avg)
      .slice(0, 8)
      .map(([categoryId, h]) => ({ categoryId, avg: h.avg, limit: niceCeil(h.avg) }));

    return {
      statuses, history, unbudgeted, daysLeft, pace, totalLimit, totalSpent, totalLeft, proposals,
      overCount: statuses.filter((s) => s.state === 'over').length,
    };
  }, [budgets, categories, transactions, map]);

  const { statuses, history, unbudgeted, daysLeft, pace, totalLimit, totalSpent, totalLeft, proposals, overCount } = data;
  const paceAmount = totalLimit * pace;
  const paceDiff = totalSpent - paceAmount;
  const overall = totalLimit > 0 ? totalSpent / totalLimit : 0;
  const unbudgetedTotal = unbudgeted.reduce((s, c) => s + c.amount, 0);
  const freeCategories = byKind('expense').filter((c) => !budgets.some((b) => b.categoryId === c.id));

  const actions = (
    <>
      {proposals.length > 0 && (
        <Button variant="outline" className="h-10 rounded-xl" onClick={() => setSheet({ mode: 'quick' })}>
          <Wand2 className="h-4 w-4" /> <span className="hidden sm:inline">{t('bud.quickSetup')}</span>
          <span className="sr-only sm:hidden">{t('bud.quickSetup')}</span>
        </Button>
      )}
      {freeCategories.length > 0 && budgets.length > 0 && (
        <Button className="h-10 rounded-xl" onClick={() => setSheet({ mode: 'new' })}>
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('bud.add')}</span>
          <span className="sm:hidden">{t('bud.addShort')}</span>
        </Button>
      )}
    </>
  );

  return (
    <PageContainer>
      <PageHeader title={t('bud.title')} subtitle={t('bud.subtitle')} actions={budgets.length > 0 ? actions : undefined} />

      {budgets.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Gauge}
            title={t('bud.emptyTitle')}
            text={
              <>
                {t('bud.emptyText')}
                {proposals.length === 0 && <span className="mt-2 block">{t('bud.emptyNoHistory')}</span>}
              </>
            }
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                {proposals.length > 0 && (
                  <Button className="h-11 rounded-xl" onClick={() => setSheet({ mode: 'quick' })}>
                    <Wand2 className="h-4 w-4" /> {t('bud.quickSetup')}
                  </Button>
                )}
                <Button
                  variant={proposals.length > 0 ? 'outline' : 'default'}
                  className="h-11 rounded-xl"
                  onClick={() => setSheet({ mode: 'new' })}
                >
                  <Plus className="h-4 w-4" /> {t('bud.add')}
                </Button>
              </div>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          {/* ─── Hero ─── */}
          <section className="@container relative overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6 lg:col-span-3">
            <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative grid grid-cols-1 gap-5 @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-end">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/75">{t('bud.heroLabel')}</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display fit-hero leading-tight font-semibold tabular">{fmt(totalSpent)}</span>
                  <span className="text-sm font-medium text-white/75 tabular">{t('bud.ofLimit', { amount: fmt(totalLimit) })}</span>
                </p>

                {/* Overall progress with today's pace marker */}
                <div className="relative mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={Math.round(overall * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500', overall > 1 ? 'bg-rose-200' : 'bg-white')}
                    style={{ width: `${Math.min(1, overall) * 100}%` }}
                  />
                  {pace < 1 && <div className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: `${pace * 100}%` }} aria-hidden />}
                </div>
                <p className="mt-2 text-xs text-white/80">{t('bud.paceToday', { amount: fmt(Math.round(paceAmount)) })}</p>
                <p className="mt-0.5 text-xs font-semibold text-white">
                  {paceDiff > 0
                    ? t('bud.aheadOfPace', { amount: fmt(Math.round(paceDiff)) })
                    : t('bud.belowPace', { amount: fmt(Math.round(-paceDiff)) })}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2 @xl:min-w-80">
                <div className="rounded-2xl bg-white/12 p-3.5 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                    <Sparkles className="h-3.5 w-3.5" /> {t('bud.perDayAll')}
                  </p>
                  <p className="mt-1 truncate font-display fit-md font-semibold tabular">{fmt(Math.round(totalLeft / daysLeft))}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3.5 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                    <CalendarDays className="h-3.5 w-3.5" /> {t('bud.daysLeft')}
                  </p>
                  <p className="mt-1 truncate font-display fit-md font-semibold tabular">{t('common.days', { count: daysLeft })}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Budget cards ─── */}
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <h2 className="text-[15px] font-bold first-letter:uppercase">
                {t('bud.listTitle', { month: dateFmt(new Date(), 'LLLL') })}
              </h2>
              {overCount > 0 && (
                <span className="rounded-full bg-expense/12 px-2.5 py-1 text-xs font-bold text-expense">
                  {t('bud.overCount', { count: overCount })}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {statuses.map((s) => (
                <BudgetCard key={s.budget.id} status={s} daysLeft={daysLeft} onOpen={() => setSheet({ mode: 'edit', categoryId: s.budget.categoryId })} />
              ))}
            </div>
          </div>

          {/* ─── Side column: categories without a budget ─── */}
          <div className="space-y-4 lg:space-y-5">
            {unbudgeted.length > 0 && (
              <Panel className="p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => setShowUnbudgeted((v) => !v)}
                  aria-expanded={showUnbudgeted}
                  className="flex min-h-10 w-full items-center gap-2 rounded-xl px-1 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">
                      {t('bud.unbudgeted')} <span className="text-muted-foreground">· {unbudgeted.length}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{t('bud.unbudgetedHint')}</p>
                  </div>
                  <span className="text-sm font-bold tabular">{fmt(unbudgetedTotal, { compact: true })}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', showUnbudgeted && 'rotate-180')} />
                </button>
                {showUnbudgeted && (
                  <ul className="mt-2 space-y-1">
                    {unbudgeted.map((c) => {
                      const cat = map.get(c.categoryId);
                      return (
                        <li key={c.categoryId} className="flex items-center gap-3 rounded-2xl px-1 py-1.5">
                          <IconBubble icon={cat?.icon} color={cat?.color} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{label(c.categoryId)}</p>
                            <p className="text-xs text-muted-foreground tabular">{fmt(c.amount)}</p>
                          </div>
                          {cat && cat.kind === 'expense' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-xl text-xs"
                              onClick={() => setSheet({ mode: 'new', categoryId: c.categoryId })}
                            >
                              <Plus className="h-3.5 w-3.5" /> {t('bud.setLimit')}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            )}

            {proposals.length > 0 && (
              <Panel className="border-dashed">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Wand2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{t('bud.quickTitle')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('bud.quickText')}</p>
                    <Button size="sm" className="mt-3 h-9 rounded-xl" onClick={() => setSheet({ mode: 'quick' })}>
                      {t('bud.quickSetup')}
                    </Button>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        </div>
      )}

      <BudgetSheet
        state={sheet?.mode === 'quick' ? null : sheet}
        onClose={() => setSheet(null)}
        history={history}
        freeCategories={freeCategories}
      />
      <QuickSetupSheet
        open={sheet?.mode === 'quick'}
        onClose={() => setSheet(null)}
        proposals={proposals}
      />
    </PageContainer>
  );
}

// ─── Budget card ─────────────────────────────────────────────────────────────

function BudgetCard({ status: s, daysLeft, onOpen }: { status: BudgetStatus; daysLeft: number; onOpen: () => void }) {
  const t = useT();
  const fmt = useMoney();
  const { label } = useCategories();
  const perDay = Math.max(0, s.remaining) / daysLeft;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-3xl border border-border bg-card p-4 text-left card-shadow transition-transform hover:bg-muted/30 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <IconBubble icon={s.category?.icon} color={s.category?.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{label(s.category)}</p>
          <p className="text-xs text-muted-foreground tabular">
            {fmt(s.spent)} {t('common.of')} {fmt(s.budget.limit)}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold', STATE_BADGE[s.state])}>
          {Math.round(s.pct * 100)}%
        </span>
      </div>
      <ProgressBar value={s.pct} pace={s.pacePct} tone={s.state} className="mt-3" />
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={cn('font-semibold tabular', STATE_TEXT[s.state])}>
          {s.remaining >= 0 ? t('bud.remaining', { amount: fmt(s.remaining) }) : t('bud.over', { amount: fmt(-s.remaining) })}
        </span>
        <span className="truncate text-muted-foreground tabular">
          {s.remaining > 0 ? t('bud.perDay', { amount: fmt(Math.round(perDay), { compact: true }) }) : t(STATE_LABEL[s.state])}
        </span>
      </div>
    </button>
  );
}

// ─── Create / edit sheet ─────────────────────────────────────────────────────

function BudgetSheet({ state, onClose, history, freeCategories }: {
  state: Exclude<SheetState, { mode: 'quick' }>;
  onClose: () => void;
  history: Map<string, CategoryHistory>;
  freeCategories: Category[];
}) {
  const open = state !== null;
  // Remount the form on every open so its state starts fresh (no reset effects needed).
  const formKey = state ? `${state.mode}-${state.categoryId ?? ''}` : 'closed';
  const t = useT();
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={state?.mode === 'edit' ? t('bud.editTitle') : t('bud.newTitle')}
    >
      {state && <BudgetForm key={formKey} state={state} onClose={onClose} history={history} freeCategories={freeCategories} />}
    </ResponsiveSheet>
  );
}

function BudgetForm({ state, onClose, history, freeCategories }: {
  state: NonNullable<Exclude<SheetState, { mode: 'quick' }>>;
  onClose: () => void;
  history: Map<string, CategoryHistory>;
  freeCategories: Category[];
}) {
  const t = useT();
  const fmt = useMoney();
  const { map, label } = useCategories();
  const budgets = useData((s) => s.budgets);
  const transactions = useData((s) => s.transactions);
  const existing = state.mode === 'edit' ? budgets.find((b) => b.categoryId === state.categoryId) : undefined;

  const [categoryId, setCategoryId] = useState<string | undefined>(state.categoryId ?? freeCategories[0]?.id);
  const [expr, setExpr] = useState(existing ? String(existing.limit) : '');

  const cat = categoryId ? map.get(categoryId) : undefined;
  const h = categoryId ? history.get(categoryId) : undefined;
  const spentNow = useMemo(() => {
    if (!categoryId) return 0;
    return periodStats(transactions, monthRange(0)).byCategory.find((c) => c.categoryId === categoryId)?.amount ?? 0;
  }, [transactions, categoryId]);

  // Suggestion chips: last month, 3-month average, and rounded values around the typical spend.
  const chips = useMemo(() => {
    const out: { value: number; label?: string }[] = [];
    if (h?.last) out.push({ value: niceCeil(h.last), label: t('bud.chipLast') });
    if (h?.avg) out.push({ value: niceCeil(h.avg), label: t('bud.chipAvg') });
    const base = h?.avg || h?.last || existing?.limit || spentNow;
    if (base > 0) [0.8, 1.2, 1.5].forEach((k) => out.push({ value: niceCeil(base * k) }));
    const seen = new Set<number>();
    return out.filter((c) => c.value > 0 && !seen.has(c.value) && seen.add(c.value));
  }, [h, existing, spentNow, t]);

  const amount = evalAmount(expr);

  const save = () => {
    if (!categoryId) return toast.error(t('common.required'));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error(t('common.invalidAmount'));
    setBudget(categoryId, amount);
    toast.success(t('bud.saved'));
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    const prev = existing.limit;
    const id = existing.categoryId;
    setBudget(id, 0);
    toast(t('bud.removed'), { action: { label: t('common.undo'), onClick: () => setBudget(id, prev) } });
    onClose();
  };

  // Categories offered in "new" mode: the free ones, plus the preselected one.
  const pickable = state.mode === 'new' ? freeCategories : [];

  return (
    <div className="space-y-4">
      {state.mode === 'edit' && cat && (
        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
          <IconBubble icon={cat.icon} color={cat.color} />
          <div className="min-w-0">
            <p className="truncate font-bold">{label(cat)}</p>
            <p className="text-xs text-muted-foreground tabular">{t('bud.spentNow', { amount: fmt(spentNow) })}</p>
          </div>
        </div>
      )}

      {state.mode === 'new' && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('bud.pickCategory')}</p>
          {pickable.length === 0 ? (
            <p className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">{t('bud.allBudgeted')}</p>
          ) : (
            <div className="grid max-h-60 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-5" role="radiogroup" aria-label={t('bud.pickCategory')}>
              {pickable.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { setCategoryId(c.id); setExpr(''); }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-all',
                      active ? 'border-transparent' : 'border-transparent hover:bg-muted',
                    )}
                    style={active ? { backgroundColor: `${c.color}1F`, borderColor: c.color } : undefined}
                  >
                    <IconBubble icon={c.icon} color={c.color} size="sm" />
                    <span className="line-clamp-2 text-center text-[11px] leading-tight font-medium">{label(c)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {categoryId && (
        <>
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-foreground/80">{t('bud.limitLabel')}</span>
            <Input
              value={expr}
              onChange={(e) => setExpr(e.target.value.replace(/[^\d.,+\-*/ ]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              inputMode="decimal"
              placeholder="0"
              className="h-14 rounded-2xl text-center font-display text-3xl font-semibold tabular md:text-3xl"
            />
            <span className="block text-xs text-muted-foreground">
              {h?.avg ? t('bud.avgHint', { amount: fmt(Math.round(h.avg)) }) : t('bud.noHistory')}
              {state.mode === 'new' && spentNow > 0 && <> · {t('bud.spentNow', { amount: fmt(spentNow) })}</>}
            </span>
          </label>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setExpr(String(c.value))}
                  className={cn(
                    'min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    amount === c.value ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {c.label && <span className="mr-1 font-medium opacity-80">{c.label}:</span>}
                  <span className="tabular">{fmt(c.value)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 pt-1">
        {existing && (
          <Button variant="outline" className="h-12 rounded-2xl text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">{t('bud.remove')}</span>
            <span className="sr-only sm:hidden">{t('bud.remove')}</span>
          </Button>
        )}
        <Button className="h-12 flex-1 rounded-2xl text-base font-bold" onClick={save} disabled={!categoryId}>
          <Check className="h-5 w-5" /> {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

// ─── Quick setup ─────────────────────────────────────────────────────────────

interface Proposal { categoryId: string; avg: number; limit: number }

function QuickSetupSheet({ open, onClose, proposals }: { open: boolean; onClose: () => void; proposals: Proposal[] }) {
  const t = useT();
  return (
    <ResponsiveSheet open={open} onOpenChange={(v) => !v && onClose()} title={t('bud.quickTitle')} description={t('bud.quickText')}>
      {open && <QuickSetupForm key={proposals.map((p) => p.categoryId).join()} proposals={proposals} onClose={onClose} />}
    </ResponsiveSheet>
  );
}

function QuickSetupForm({ proposals, onClose }: { proposals: Proposal[]; onClose: () => void }) {
  const t = useT();
  const fmt = useMoney();
  const { map, label } = useCategories();
  // Editable rows: selected flag + amount text per category.
  const [rows, setRows] = useState(() =>
    proposals.map((p) => ({ ...p, selected: true, text: String(p.limit) })),
  );

  const chosen = rows.filter((r) => r.selected && evalAmount(r.text) > 0);

  const apply = () => {
    chosen.forEach((r) => setBudget(r.categoryId, evalAmount(r.text)));
    toast.success(t('bud.quickApplied', { count: chosen.length }), {
      action: { label: t('common.undo'), onClick: () => chosen.forEach((r) => setBudget(r.categoryId, 0)) },
    });
    onClose();
  };

  if (rows.length === 0) return <p className="py-4 text-sm text-muted-foreground">{t('bud.quickEmpty')}</p>;

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const c = map.get(r.categoryId);
          const update = (patch: Partial<typeof r>) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <li key={r.categoryId} className={cn('flex items-center gap-3 rounded-2xl border p-2 transition-opacity', r.selected ? 'border-border' : 'border-transparent opacity-50')}>
              <input
                type="checkbox"
                checked={r.selected}
                onChange={(e) => update({ selected: e.target.checked })}
                aria-label={label(c)}
                className="ml-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              <IconBubble icon={c?.icon} color={c?.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{label(c)}</p>
                <p className="text-xs text-muted-foreground tabular">{t('bud.quickAvg', { amount: fmt(Math.round(r.avg)) })}</p>
              </div>
              <Input
                value={r.text}
                onChange={(e) => update({ text: e.target.value.replace(/[^\d.,+\-*/ ]/g, ''), selected: true })}
                inputMode="decimal"
                aria-label={`${t('bud.limitLabel')}: ${label(c)}`}
                className="h-10 w-28 shrink-0 rounded-xl text-right font-semibold tabular"
              />
            </li>
          );
        })}
      </ul>
      <Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={apply} disabled={chosen.length === 0}>
        <Check className="h-5 w-5" /> {t('bud.quickApply', { count: chosen.length })}
      </Button>
    </div>
  );
}
