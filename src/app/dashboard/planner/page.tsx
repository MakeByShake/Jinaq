'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, differenceInCalendarMonths, format, startOfMonth } from 'date-fns';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, CalendarClock, Calculator, HandCoins, Plus, RotateCcw, Scale, SplitSquareHorizontal, Target, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Field, PageContainer, PageHeader, Panel, Segmented } from '@/components/app/ui';
import { useData } from '@/stores/data-store';
import { useBalances } from '@/hooks/use-finance';
import { evalAmount, useMoney } from '@/lib/format';
import { daysUntil, monthRange } from '@/lib/dates';
import { goalPerMonth, monthlySeries, periodStats } from '@/lib/finance';
import { newId, savePlan } from '@/lib/actions';
import { PALETTE } from '@/lib/icons';
import { DATE_FNS_LOCALE, useLocale, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Category, PlanItem } from '@/lib/types';

type Tab = 'split' | 'rule' | 'savings';

const inputCls = 'h-11 rounded-xl tabular';

/** Parses an amount field; empty or invalid → null. */
function parseAmount(s: string): number | null {
  if (!s.trim()) return null;
  const v = evalAmount(s);
  return Number.isFinite(v) ? v : null;
}

// ═══ 1. Distribution ═════════════════════════════════════════════════════════

function PlanRow({ item, base, color, onChange, onRemove }: {
  item: PlanItem; base: number; color: string; onChange: (i: PlanItem) => void; onRemove: () => void;
}) {
  const t = useT();
  const [amountExpr, setAmountExpr] = useState(String(item.amount));
  const commitAmount = () => {
    const v = parseAmount(amountExpr);
    if (v === null || v < 0) { setAmountExpr(String(item.amount)); return; }
    setAmountExpr(String(v));
    if (v !== item.amount) onChange({ ...item, amount: v });
  };
  const pct = base > 0 ? Math.round((item.amount / base) * 100) : 0;
  return (
    <li className="flex items-center gap-2 py-1.5">
      <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <Input
        value={item.label}
        onChange={(e) => onChange({ ...item, label: e.target.value })}
        aria-label={t('common.name')}
        className="h-10 min-w-0 flex-1 rounded-xl border-transparent bg-muted/50 shadow-none"
        maxLength={60}
      />
      <Input
        value={amountExpr}
        onChange={(e) => setAmountExpr(e.target.value)}
        onBlur={commitAmount}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        inputMode="decimal"
        aria-label={t('plan.lineAmount')}
        className="h-10 w-24 shrink-0 rounded-xl border-transparent bg-muted/50 text-right shadow-none tabular sm:w-32"
      />
      <span className="hidden w-11 shrink-0 text-right text-xs font-semibold text-muted-foreground tabular sm:block">{pct}%</span>
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground" onClick={onRemove} aria-label={t('plan.removeLine')}>
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

const SUGGEST_ICON = {
  bill: <CalendarClock className="h-3.5 w-3.5 shrink-0" />,
  debt: <HandCoins className="h-3.5 w-3.5 shrink-0" />,
  goal: <Target className="h-3.5 w-3.5 shrink-0" />,
};

interface Suggestion { key: string; label: string; amount: number; kind: 'bill' | 'debt' | 'goal' }

function SplitTool() {
  const t = useT();
  const fmt = useMoney();
  const { spendable } = useBalances();
  const plan = useData((s) => s.plan);
  const recurring = useData((s) => s.recurring);
  const debts = useData((s) => s.debts);
  const goals = useData((s) => s.goals);

  const [baseExpr, setBaseExpr] = useState('');
  const [items, setItems] = useState<PlanItem[]>(() => plan?.items ?? []);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const pending = useRef<{ timer?: ReturnType<typeof setTimeout>; items?: PlanItem[] }>({});

  const flush = () => {
    const p = pending.current;
    if (p.timer) clearTimeout(p.timer);
    if (p.items) savePlan({ id: 'plan', items: p.items, updatedAt: new Date().toISOString() });
    pending.current = {};
  };
  // Save whatever is pending when leaving the page.
  useEffect(() => () => flush(), []);

  const commit = (next: PlanItem[], immediate = false) => {
    setItems(next);
    if (pending.current.timer) clearTimeout(pending.current.timer);
    pending.current.items = next;
    if (immediate) flush();
    else pending.current.timer = setTimeout(flush, 600);
  };

  const parsedBase = parseAmount(baseExpr);
  const base = parsedBase ?? Math.max(0, spendable);
  const allocated = items.reduce((s, i) => s + i.amount, 0);
  const remaining = base - allocated;
  const over = remaining < 0;
  const scale = Math.max(base, allocated) || 1;

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    for (const r of recurring) {
      if (r.active && r.kind === 'expense' && daysUntil(r.nextDate) <= 31) out.push({ key: `r-${r.id}`, label: r.name, amount: r.amount, kind: 'bill' });
    }
    for (const d of debts) {
      if (d.direction === 'i_owe' && !d.settled && d.amount > d.paid) {
        out.push({ key: `d-${d.id}`, label: t('plan.debtLabel', { name: d.personName }), amount: d.amount - d.paid, kind: 'debt' });
      }
    }
    for (const g of goals) {
      if (g.status === 'done' || g.saved >= g.target) continue;
      const amount = Math.round(goalPerMonth(g) ?? g.target - g.saved);
      if (amount > 0) out.push({ key: `g-${g.id}`, label: g.title, amount, kind: 'goal' });
    }
    const used = new Set(items.map((i) => i.label.trim().toLowerCase()));
    return out.filter((s) => !used.has(s.label.trim().toLowerCase()));
  }, [recurring, debts, goals, items, t]);

  const addLine = (label: string, amount: number) => commit([...items, { id: newId('pl'), label, amount }], true);

  const submitNew = () => {
    const amount = parseAmount(newAmount);
    if (!newLabel.trim() || amount === null || amount <= 0) return toast.error(t('plan.lineInvalid'));
    addLine(newLabel.trim(), amount);
    setNewLabel('');
    setNewAmount('');
  };

  const clearAll = () => {
    const prev = items;
    commit([], true);
    toast(t('plan.cleared'), { action: { label: t('common.undo'), onClick: () => commit(prev, true) } });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:gap-5">
      <div className="space-y-4 lg:space-y-5">
        <Panel>
          <Field label={t('plan.splitAmount')} hint={t('plan.splitAmountHint')}>
            <div className="flex gap-2">
              <Input
                value={baseExpr}
                onChange={(e) => setBaseExpr(e.target.value)}
                inputMode="decimal"
                placeholder={String(Math.round(Math.max(0, spendable)))}
                className="h-12 rounded-xl font-display text-xl tabular"
              />
              {baseExpr && (
                <Button variant="outline" className="h-12 shrink-0 rounded-xl" onClick={() => setBaseExpr('')}>
                  <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">{t('plan.useBalance')}</span>
                </Button>
              )}
            </div>
          </Field>

          {/* Stacked bar */}
          <div className="mt-4">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${t('plan.allocated')}: ${fmt(allocated)}`}>
              {items.map((it, i) => (
                <div
                  key={it.id}
                  className="h-full border-r-2 border-card transition-[width] duration-500 last:border-r-0"
                  style={{ width: `${(it.amount / scale) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">{t('plan.allocated')}: <b className="text-foreground tabular">{fmt(allocated)}</b></span>
              <span className={cn('font-semibold tabular', over ? 'text-expense' : 'text-income')}>
                {over ? t('plan.overBy', { amount: fmt(-remaining) }) : `${t('plan.remaining')}: ${fmt(remaining)}`}
              </span>
            </div>
          </div>
          {over && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-warning/15 px-3 py-2.5 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('plan.overWarning')}
            </p>
          )}
        </Panel>

        <Panel
          title={t('plan.tabSplit')}
          icon={SplitSquareHorizontal}
          action={items.length > 0 ? (
            <Button variant="ghost" size="sm" className="h-9 rounded-xl text-muted-foreground" onClick={clearAll}>
              <Trash2 className="h-4 w-4" /> {t('plan.clearAll')}
            </Button>
          ) : undefined}
        >
          {items.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 px-4 py-5 text-center text-sm text-muted-foreground">{t('plan.emptyLines')}</p>
          ) : (
            <ul className="-my-1.5">
              {items.map((it, i) => (
                <PlanRow
                  key={it.id}
                  item={it}
                  base={base}
                  color={PALETTE[i % PALETTE.length]}
                  onChange={(n) => commit(items.map((x) => (x.id === n.id ? n : x)))}
                  onRemove={() => commit(items.filter((x) => x.id !== it.id), true)}
                />
              ))}
              <li className="flex items-center gap-2 border-t border-dashed border-border py-2.5 pl-3.5 text-sm">
                <span className="flex-1 font-semibold text-muted-foreground">{t('plan.leftover')}</span>
                <span className={cn('font-bold tabular', over ? 'text-expense' : 'text-income')}>{fmt(remaining)}</span>
                <span className="hidden w-11 text-right text-xs font-semibold text-muted-foreground tabular sm:block">
                  {base > 0 ? Math.round((remaining / base) * 100) : 0}%
                </span>
                <span className="w-10" aria-hidden />
              </li>
            </ul>
          )}

          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => { e.preventDefault(); submitNew(); }}
          >
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t('plan.linePlaceholder')} aria-label={t('common.name')} className="h-11 flex-1 rounded-xl" maxLength={60} />
            <div className="flex gap-2">
              <Input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder={t('plan.lineAmount')} aria-label={t('plan.lineAmount')} inputMode="decimal" className="h-11 min-w-0 flex-1 rounded-xl tabular sm:w-32" />
              <Button type="submit" className="h-11 shrink-0 rounded-xl"><Plus className="h-4 w-4" /> {t('common.add')}</Button>
            </div>
          </form>
        </Panel>
      </div>

      {suggestions.length > 0 && (
        <Panel title={t('plan.suggestions')} icon={Plus} className="self-start">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => {
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => addLine(s.label, s.amount)}
                  className="flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-accent/50 px-3 py-1.5 text-left text-xs font-semibold text-accent-foreground hover:bg-accent"
                  aria-label={`${t(`plan.suggest${s.kind === 'bill' ? 'Bill' : s.kind === 'debt' ? 'Debt' : 'Goal'}`)}: ${s.label}`}
                >
                  {SUGGEST_ICON[s.kind]}
                  <span className="truncate">{s.label}</span>
                  <span className="shrink-0 tabular opacity-75">· {fmt(s.amount, { compact: true })}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ═══ 2. 50/30/20 ═════════════════════════════════════════════════════════════

type Bucket = 'needs' | 'wants' | 'savings';
const BUCKETS: Bucket[] = ['needs', 'wants', 'savings'];
const BUCKET_COLOR: Record<Bucket, string> = { needs: 'var(--chart-2)', wants: 'var(--chart-3)', savings: 'var(--chart-1)' };
const NEEDS_KEYS = new Set(['housing', 'groceries', 'transport', 'mobile', 'health', 'education', 'subscriptions']);

function bucketOf(c: Category | undefined): Bucket {
  if (c?.key === 'savings') return 'savings';
  if (c?.key && NEEDS_KEYS.has(c.key)) return 'needs';
  return 'wants';
}

/** Changes one share and compensates in the others so the total stays 100. */
function rebalance(p: number[], i: number, v: number): number[] {
  const next = [...p];
  next[i] = v;
  const comp = i === 1 ? 2 : 1; // needs → wants, wants → savings, savings → wants
  const fixed = 3 - i - comp;
  let rest = 100 - v - next[fixed];
  if (rest < 0) { next[fixed] = 100 - v; rest = 0; }
  next[comp] = rest;
  return next;
}

function RuleTool() {
  const t = useT();
  const fmt = useMoney();
  const transactions = useData((s) => s.transactions);
  const recurring = useData((s) => s.recurring);
  const categories = useData((s) => s.categories);
  const [incomeExpr, setIncomeExpr] = useState('');
  const [pct, setPct] = useState([50, 30, 20]);

  const { suggested, source } = useMemo(() => {
    const months = monthlySeries(transactions, 4).slice(0, 3).filter((m) => m.income > 0);
    const avg = months.length ? months.reduce((s, m) => s + m.income, 0) / months.length : 0;
    if (avg > 0) return { suggested: Math.round(avg), source: 'avg' as const };
    const rec = recurring
      .filter((r) => r.active && r.kind === 'income')
      .reduce((s, r) => s + (r.frequency === 'weekly' ? (r.amount * 52) / 12 : r.frequency === 'yearly' ? r.amount / 12 : r.amount), 0);
    return { suggested: Math.round(rec), source: rec > 0 ? ('rec' as const) : null };
  }, [transactions, recurring]);

  const actual = useMemo(() => {
    const s = periodStats(transactions, monthRange(-1));
    if (s.count === 0) return null;
    const map = new Map(categories.map((c) => [c.id, c]));
    const sums: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 };
    for (const c of s.byCategory) sums[bucketOf(map.get(c.categoryId))] += c.amount;
    sums.savings += Math.max(0, s.income - s.expense);
    const denom = s.income > 0 ? s.income : sums.needs + sums.wants + sums.savings;
    return { sums, denom, hasIncome: s.income > 0 };
  }, [transactions, categories]);

  const income = parseAmount(incomeExpr) ?? suggested;
  const amounts = BUCKETS.map((_, i) => (income * pct[i]) / 100);
  const pieData = BUCKETS.map((b, i) => ({ id: b, value: Math.max(0.0001, pct[i]) }));
  const isDefault = pct[0] === 50 && pct[1] === 30 && pct[2] === 20;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <Panel>
        <p className="mb-4 text-sm text-muted-foreground">{t('plan.ruleIntro')}</p>
        <Field
          label={t('plan.monthlyIncome')}
          hint={incomeExpr ? undefined : source === 'avg' ? t('plan.incomeFromAvg') : source === 'rec' ? t('plan.incomeFromRecurring') : t('plan.incomeNone')}
        >
          <Input
            value={incomeExpr}
            onChange={(e) => setIncomeExpr(e.target.value)}
            inputMode="decimal"
            placeholder={suggested ? String(suggested) : '0'}
            className="h-12 rounded-xl font-display text-xl tabular"
          />
        </Field>

        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[160px_1fr]">
          <div className="relative mx-auto h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={2} cornerRadius={6} stroke="none" isAnimationActive={false}>
                  {pieData.map((d) => <Cell key={d.id} fill={BUCKET_COLOR[d.id]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-muted-foreground">{t('plan.monthlyIncome')}</span>
              <span className="max-w-[7rem] truncate text-sm font-extrabold tabular">{fmt(income, { compact: true })}</span>
            </div>
          </div>

          <ul className="space-y-4">
            {BUCKETS.map((b, i) => (
              <li key={b}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: BUCKET_COLOR[b] }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(`plan.${b}`)}</span>
                  <span className="text-xs font-bold text-muted-foreground tabular">{pct[i]}%</span>
                  <span className="text-sm font-bold tabular">{fmt(Math.round(amounts[i]))}</span>
                </div>
                <Slider
                  value={[pct[i]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => setPct((p) => rebalance(p, i, v))}
                  aria-label={t(`plan.${b}`)}
                  className="py-2"
                />
                <p className="mt-0.5 text-xs text-muted-foreground">{t(`plan.${b}Hint`)}</p>
              </li>
            ))}
          </ul>
        </div>
        {!isDefault && (
          <Button variant="ghost" size="sm" className="mt-3 h-9 rounded-xl" onClick={() => setPct([50, 30, 20])}>
            <RotateCcw className="h-4 w-4" /> {t('plan.resetPct')}
          </Button>
        )}
      </Panel>

      <Panel title={t('plan.actualTitle')} icon={Scale} className="self-start">
        {!actual ? (
          <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">{t('plan.actualEmpty')}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{t('plan.actualText')}</p>
            <ul className="space-y-4">
              {BUCKETS.map((b, i) => {
                const fact = actual.denom > 0 ? Math.round((actual.sums[b] / actual.denom) * 100) : 0;
                const off = b === 'savings' ? fact < pct[i] - 5 : fact > pct[i] + 5;
                return (
                  <li key={b}>
                    <div className="mb-1.5 flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t(`plan.${b}`)}</span>
                      <span className="text-sm font-bold tabular">{fmt(Math.round(actual.sums[b]))}</span>
                    </div>
                    <div className="space-y-1">
                      <BarLine label={t('plan.plan')} pct={pct[i]} color={BUCKET_COLOR[b]} muted />
                      <BarLine label={t('plan.actual')} pct={fact} color={BUCKET_COLOR[b]} warn={off} />
                    </div>
                    {actual.hasIncome && (
                      <p className={cn('mt-1 text-xs', off ? 'font-semibold text-warning' : 'text-muted-foreground')}>
                        {t('plan.ofIncome', { pct: fact })}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}

function BarLine({ label, pct, color, muted, warn }: { label: string; pct: number; color: string; muted?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-[width] duration-500', muted && 'opacity-45')} style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
      <span className={cn('w-10 shrink-0 text-right text-[11px] font-bold tabular', warn ? 'text-warning' : 'text-muted-foreground')}>{pct}%</span>
    </div>
  );
}

// ═══ 3. Savings calculator ═══════════════════════════════════════════════════

interface Point { i: number; balance: number; contrib: number }

/** Month-by-month growth with monthly capitalisation; contribution at month end. */
function simulate(start: number, monthly: number, monthlyRate: number, months: number): Point[] {
  const pts: Point[] = [{ i: 0, balance: start, contrib: start }];
  let bal = start;
  let contrib = start;
  for (let m = 1; m <= months; m++) {
    bal = bal * (1 + monthlyRate) + monthly;
    contrib += monthly;
    pts.push({ i: m, balance: bal, contrib });
  }
  return pts;
}

const MAX_MONTHS = 600;

function SavingsTool() {
  const t = useT();
  const fmt = useMoney();
  const locale = useLocale();
  const [mode, setMode] = useState<'time' | 'date'>('time');
  const [targetExpr, setTargetExpr] = useState('');
  const [startExpr, setStartExpr] = useState('');
  const [monthlyExpr, setMonthlyExpr] = useState('');
  const [date, setDate] = useState(() => format(addMonths(new Date(), 12), 'yyyy-MM'));
  const [withInterest, setWithInterest] = useState(true);
  const [rateExpr, setRateExpr] = useState('14');

  const target = parseAmount(targetExpr) ?? 0;
  const start = Math.max(0, parseAmount(startExpr) ?? 0);
  const rate = withInterest ? Math.max(0, parseAmount(rateExpr) ?? 0) : 0;
  const r = rate / 100 / 12;

  type Result =
    | { state: 'empty' } | { state: 'reached' } | { state: 'never' } | { state: 'past' }
    | { state: 'ok'; months: number; monthly: number; points: Point[] };

  const result = useMemo<Result>(() => {
    if (target <= 0) return { state: 'empty' };
    if (start >= target) return { state: 'reached' };
    if (mode === 'time') {
      const monthly = parseAmount(monthlyExpr) ?? 0;
      if (monthly <= 0 && (r === 0 || start === 0)) return monthlyExpr ? { state: 'never' } : { state: 'empty' };
      let bal = start;
      let n = 0;
      while (bal < target && n < MAX_MONTHS) { bal = bal * (1 + r) + monthly; n++; }
      if (bal < target) return { state: 'never' };
      return { state: 'ok', months: n, monthly, points: simulate(start, monthly, r, n) };
    }
    const n = differenceInCalendarMonths(new Date(`${date}-01T00:00:00`), startOfMonth(new Date()));
    if (!Number.isFinite(n) || n < 1) return { state: 'past' };
    const growth = Math.pow(1 + r, n);
    const need = target - start * growth;
    const monthly = need <= 0 ? 0 : r === 0 ? need / n : (need * r) / (growth - 1);
    const rounded = Math.ceil(monthly);
    return { state: 'ok', months: n, monthly: rounded, points: simulate(start, rounded, r, n) };
  }, [target, start, r, mode, monthlyExpr, date]);

  const now = new Date();
  const dfLocale = DATE_FNS_LOCALE[locale];
  const duration = (m: number) => {
    const y = Math.floor(m / 12);
    const mm = m % 12;
    return [y ? t('plan.years', { count: y }) : '', mm || !y ? t('plan.months', { count: mm }) : ''].filter(Boolean).join(' ');
  };

  const chart = useMemo(() => {
    if (result.state !== 'ok') return [];
    const step = Math.max(1, Math.ceil(result.points.length / 60));
    return result.points
      .filter((p, idx) => idx % step === 0 || idx === result.points.length - 1)
      .map((p) => ({ ...p, label: format(addMonths(now, p.i), 'LLL yy', { locale: dfLocale }) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, dfLocale]);

  const last = result.state === 'ok' ? result.points[result.points.length - 1] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-5">
      <Panel className="self-start">
        <Segmented
          value={mode}
          onChange={setMode}
          className="mb-4 w-full"
          options={[{ value: 'time', label: t('plan.modeTime') }, { value: 'date', label: t('plan.modeDate') }]}
        />
        <div className="space-y-3.5">
          <Field label={t('plan.target')}>
            <Input value={targetExpr} onChange={(e) => setTargetExpr(e.target.value)} inputMode="decimal" placeholder="500000" className={cn(inputCls, 'h-12 font-display text-lg')} />
          </Field>
          <Field label={`${t('plan.startAmount')} (${t('common.optional')})`}>
            <Input value={startExpr} onChange={(e) => setStartExpr(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
          </Field>
          {mode === 'time' ? (
            <Field label={t('plan.monthly')}>
              <Input value={monthlyExpr} onChange={(e) => setMonthlyExpr(e.target.value)} inputMode="decimal" placeholder="30000" className={inputCls} />
            </Field>
          ) : (
            <Field label={t('plan.targetDate')}>
              <Input type="month" value={date} min={format(addMonths(now, 1), 'yyyy-MM')} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
          )}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3">
            <span className="text-sm font-semibold">{t('plan.withInterest')}</span>
            <Switch checked={withInterest} onCheckedChange={setWithInterest} aria-label={t('plan.withInterest')} />
          </label>
          {withInterest && (
            <Field label={t('plan.rate')} hint={t('plan.rateHint')}>
              <Input value={rateExpr} onChange={(e) => setRateExpr(e.target.value)} inputMode="decimal" className={inputCls} />
            </Field>
          )}
        </div>
      </Panel>

      <Panel>
        {result.state !== 'ok' ? (
          <div className="flex min-h-60 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl', result.state === 'never' || result.state === 'past' ? 'bg-warning/15 text-warning' : 'bg-accent text-accent-foreground')}>
              {result.state === 'never' || result.state === 'past' ? <AlertTriangle className="h-6 w-6" /> : <Calculator className="h-6 w-6" />}
            </span>
            <p className="max-w-xs text-sm font-semibold">
              {t(result.state === 'reached' ? 'plan.resultReached' : result.state === 'never' ? 'plan.resultNever' : result.state === 'past' ? 'plan.dateInPast' : 'plan.fillFields')}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-brand-gradient p-4 text-white">
              <p className="text-sm text-white/80">{mode === 'time' ? t('plan.resultMonths') : t('plan.requiredMonthly')}</p>
              <p className="mt-0.5 font-display text-2xl font-semibold tabular sm:text-3xl">
                {mode === 'time' ? duration(result.months) : fmt(result.monthly)}
              </p>
              <p className="mt-1 text-sm text-white/80">
                {t('plan.resultDate', { date: format(addMonths(now, result.months), 'LLLL yyyy', { locale: dfLocale }) })}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { l: t('plan.totalContributed'), v: last!.contrib, cls: '' },
                { l: t('plan.interestEarned'), v: last!.balance - last!.contrib, cls: 'text-income' },
                { l: t('plan.finalBalance'), v: last!.balance, cls: '' },
              ].map((x) => (
                <div key={x.l} className="min-w-0 rounded-2xl bg-muted/60 p-2.5">
                  <p className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">{x.l}</p>
                  <p className={cn('mt-1 truncate text-sm font-extrabold tabular', x.cls)}>{fmt(Math.round(x.v), { compact: true })}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="plan-bal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} minTickGap={24} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    cursor={{ stroke: 'var(--border)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as Point & { label: string };
                      return (
                        <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold capitalize">{p.label}</p>
                          <p className="tabular">{t('plan.chartBalance')}: <b>{fmt(Math.round(p.balance))}</b></p>
                          <p className="tabular text-muted-foreground">{t('plan.chartContrib')}: {fmt(Math.round(p.contrib))}</p>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="contrib" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} fill="transparent" isAnimationActive={false} />
                  <Area type="monotone" dataKey="balance" stroke="var(--primary)" strokeWidth={2.5} fill="url(#plan-bal)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> {t('plan.chartBalance')}</span>
              <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> {t('plan.chartContrib')}</span>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

// ═══ Page ════════════════════════════════════════════════════════════════════

export default function PlannerPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('split');
  return (
    <PageContainer>
      <PageHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-4 w-full sm:w-auto lg:mb-5"
        options={[
          { value: 'split', label: t('plan.tabSplit') },
          { value: 'rule', label: t('plan.tabRule') },
          { value: 'savings', label: t('plan.tabSavings') },
        ]}
      />
      {tab === 'split' && <SplitTool />}
      {tab === 'rule' && <RuleTool />}
      {tab === 'savings' && <SavingsTool />}
    </PageContainer>
  );
}
