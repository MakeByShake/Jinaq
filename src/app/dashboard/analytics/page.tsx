'use client';

import { useMemo, useState } from 'react';
import {
  addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, differenceInCalendarMonths, endOfMonth,
  endOfWeek, endOfYear, getDay, getDaysInMonth, isSameMonth, min as minDate, startOfMonth,
  startOfWeek, startOfYear,
} from 'date-fns';
import {
  ArrowDown, ArrowUp, BarChart3, CalendarDays, ChevronLeft, ChevronRight, Crown, Hash, PiggyBank,
  PieChart as PieIcon, Plus, Receipt, Sigma, Sparkles, X,
} from 'lucide-react';
import {
  Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader, Panel, Ring, Segmented, StatTile } from '@/components/app/ui';
import { CategoryBreakdown, CategoryDonut } from '@/components/app/charts';
import { TransactionRow } from '@/components/app/transaction-list';
import { useData } from '@/stores/data-store';
import { useQuickAdd } from '@/stores/ui-store';
import { useCategories } from '@/hooks/use-finance';
import { useDateFormat, useDayLabel, useMoney } from '@/lib/format';
import { inRange, monthRange, parseDay, toDay, todayISO, type DayRange } from '@/lib/dates';
import { dailySeries, monthlySeries, periodStats } from '@/lib/finance';
import { IconBubble } from '@/lib/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { CategoryKind, Transaction } from '@/lib/types';

type Period = 'week' | 'month' | 'year';

interface Bounds {
  start: Date;
  end: Date;
  range: DayRange;
}

/** Calendar bounds of the period `offset` steps back from today (0 = current). */
function periodBounds(period: Period, offset: number, now = new Date()): Bounds {
  let start: Date;
  let end: Date;
  if (period === 'week') {
    start = startOfWeek(addWeeks(now, offset), { weekStartsOn: 1 });
    end = endOfWeek(start, { weekStartsOn: 1 });
  } else if (period === 'month') {
    start = startOfMonth(addMonths(now, offset));
    end = endOfMonth(start);
  } else {
    start = startOfYear(addYears(now, offset));
    end = endOfYear(start);
  }
  return { start, end, range: { from: toDay(start), to: toDay(end) } };
}

/** Sum of `kind` transactions in a range, optionally limited to one category. */
function sumIn(txs: Transaction[], range: DayRange, kind: CategoryKind, categoryId?: string | null) {
  let s = 0;
  for (const tx of txs) {
    if (tx.kind !== kind || !inRange(tx.date, range)) continue;
    if (categoryId && tx.categoryId !== categoryId) continue;
    s += tx.amount;
  }
  return s;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface ChartPoint {
  key: string; // YYYY-MM-DD for days, YYYY-MM for months
  label: string; // axis tick
  title: string; // tooltip heading
  amount: number;
}

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 11 };

export default function AnalyticsPage() {
  const t = useT();
  const fmt = useMoney();
  const fmtDate = useDateFormat();
  const dayLabel = useDayLabel();
  const openAdd = useQuickAdd((s) => s.openAdd);
  const transactions = useData((s) => s.transactions);
  const { map: catMap, label } = useCategories();

  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [catLimit, setCatLimit] = useState(20);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setOffset(0);
    setSelectedDay(null);
  };
  const changeKind = (k: CategoryKind) => {
    setKind(k);
    setSelectedCat(null);
  };
  const selectCategory = (id: string) => {
    setSelectedCat((cur) => (cur === id ? null : id));
    setCatLimit(20);
  };

  const now = useMemo(() => new Date(), []);
  const today = todayISO();
  const bounds = useMemo(() => periodBounds(period, offset, now), [period, offset, now]);
  const { start, end, range } = bounds;
  const kindWord = t(kind === 'expense' ? 'an.kindExpense' : 'an.kindIncome');
  const barColor = kind === 'expense' ? 'var(--expense)' : 'var(--income)';

  // ─── Period label ──────────────────────────────────────────────────────────
  const periodTitle =
    period === 'year' ? fmtDate(start, 'yyyy')
      : period === 'month' ? capitalize(fmtDate(start, 'LLLL yyyy'))
        : `${fmtDate(start, isSameMonth(start, end) ? 'd' : 'd MMM')} – ${fmtDate(end, 'd MMM yyyy')}`;

  // ─── Totals, comparison and stat tiles ─────────────────────────────────────
  const summary = useMemo(() => {
    const stats = periodStats(transactions, range);
    const total = kind === 'expense' ? stats.expense : stats.income;
    const slices = kind === 'expense' ? stats.byCategory : stats.incomeByCategory;

    // For the running period compare against the same number of elapsed days.
    const isCurrent = inRange(today, range);
    const elapsed = differenceInCalendarDays(minDate([end, now]), start) + 1;
    const prev = periodBounds(period, offset - 1, now);
    const cmpRange: DayRange = isCurrent ? { from: range.from, to: today } : range;
    const prevCmp: DayRange = isCurrent
      ? { from: prev.range.from, to: toDay(minDate([addDays(prev.start, elapsed - 1), prev.end])) }
      : prev.range;
    const cur = sumIn(transactions, cmpRange, kind);
    const before = sumIn(transactions, prevCmp, kind);
    const pct = before > 0 ? Math.round(((cur - before) / before) * 100) : null;

    let biggest: Transaction | undefined;
    let count = 0;
    for (const tx of transactions) {
      if (tx.kind !== kind || !inRange(tx.date, range)) continue;
      count++;
      if (!biggest || tx.amount > biggest.amount) biggest = tx;
    }
    return {
      total, slices, pct, before, isCurrent, count, biggest,
      avgPerDay: total / Math.max(1, elapsed),
      top: slices[0],
    };
  }, [transactions, range, kind, today, end, now, start, period, offset]);

  // ─── Bar chart series (filtered by the selected category) ──────────────────
  const series = useMemo<ChartPoint[]>(() => {
    const txs = selectedCat ? transactions.filter((tx) => tx.categoryId === selectedCat) : transactions;
    if (period === 'year') {
      const byMonth = new Map<string, number>();
      for (const tx of txs) {
        if (tx.kind !== kind || !inRange(tx.date, range)) continue;
        const m = tx.date.slice(0, 7);
        byMonth.set(m, (byMonth.get(m) ?? 0) + tx.amount);
      }
      return Array.from({ length: 12 }, (_, i) => {
        const m = addMonths(start, i);
        const key = toDay(m).slice(0, 7);
        return { key, label: fmtDate(m, 'LLL'), title: capitalize(fmtDate(m, 'LLLL yyyy')), amount: byMonth.get(key) ?? 0 };
      });
    }
    return dailySeries(txs, range, kind).map((d) => ({
      key: d.day,
      label: fmtDate(d.day, period === 'week' ? 'EEEEEE' : 'd'),
      title: dayLabel(d.day, true),
      amount: d.amount,
    }));
  }, [transactions, selectedCat, period, kind, range, start, fmtDate, dayLabel]);

  const seriesStats = useMemo(() => {
    const withData = series.filter((p) => p.amount > 0);
    const peak = series.reduce<ChartPoint | null>((m, p) => (!m || p.amount > m.amount ? p : m), null);
    const total = series.reduce((s, p) => s + p.amount, 0);
    return { peak, total, avg: withData.length ? total / withData.length : 0 };
  }, [series]);

  const onBarClick = (p?: ChartPoint) => {
    if (!p) return;
    if (period === 'year') {
      // Drill down from a month bar into the month view.
      setPeriod('month');
      setOffset(differenceInCalendarMonths(parseDay(`${p.key}-01`), startOfMonth(now)));
      setSelectedDay(null);
    } else {
      setSelectedDay((cur) => (cur === p.key ? null : p.key));
    }
  };

  // ─── Selected category detail ──────────────────────────────────────────────
  const catDetail = useMemo(() => {
    if (!selectedCat) return null;
    const txs = transactions.filter((tx) => tx.kind === kind && tx.categoryId === selectedCat && inRange(tx.date, range));
    const amount = txs.reduce((s, tx) => s + tx.amount, 0);
    const trend = Array.from({ length: 6 }, (_, i) => {
      const b = periodBounds(period, offset - 5 + i, now);
      const lbl = period === 'year' ? fmtDate(b.start, 'yyyy') : period === 'month' ? fmtDate(b.start, 'LLL') : fmtDate(b.start, 'd MMM');
      return { key: b.range.from, label: lbl, amount: sumIn(transactions, b.range, kind, selectedCat), current: i === 5 };
    });
    return { txs, amount, trend };
  }, [selectedCat, transactions, kind, range, period, offset, now, fmtDate]);

  // ─── Six months income vs expenses ─────────────────────────────────────────
  const monthly = useMemo(() => {
    const base = minDate([end, now]);
    const rows = monthlySeries(transactions, 6, base).map((m) => ({
      ...m, label: fmtDate(m.start, 'LLL'), title: capitalize(fmtDate(m.start, 'LLLL yyyy')),
    }));
    const income = rows.reduce((s, m) => s + m.income, 0);
    const expense = rows.reduce((s, m) => s + m.expense, 0);
    return { rows, income, expense, saved: income - expense, rate: income > 0 ? (income - expense) / income : null };
  }, [transactions, end, now, fmtDate]);

  // ─── Calendar heat-map month ───────────────────────────────────────────────
  const heat = useMemo(() => {
    const monthStart = startOfMonth(minDate([end, now]));
    const r = monthRange(0, monthStart);
    const days = dailySeries(transactions, r, kind);
    const max = Math.max(0, ...days.map((d) => d.amount));
    return {
      monthStart, range: r, days, max,
      leading: (getDay(monthStart) + 6) % 7, // Monday-first grid
      count: getDaysInMonth(monthStart),
    };
  }, [transactions, end, now, kind]);

  const weekdayNames = useMemo(() => {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => fmtDate(addDays(monday, i), 'EEEEEE'));
  }, [now, fmtDate]);

  const dayTxs = useMemo(
    () => (selectedDay ? transactions.filter((tx) => tx.kind === kind && tx.date.slice(0, 10) === selectedDay) : []),
    [selectedDay, transactions, kind],
  );

  // ─── Empty app state ───────────────────────────────────────────────────────
  if (transactions.length === 0) {
    return (
      <PageContainer>
        <PageHeader title={t('an.title')} subtitle={t('an.subtitle')} />
        <Panel>
          <EmptyState
            icon={BarChart3}
            title={t('an.noTxTitle')}
            text={t('an.noTxText')}
            action={
              <Button className="rounded-xl" onClick={() => openAdd('expense')}>
                <Plus className="h-4 w-4" /> {t('dash.welcomeAction')}
              </Button>
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  const good = summary.pct !== null && (kind === 'expense' ? summary.pct < 0 : summary.pct > 0);
  const selectedCategory = selectedCat ? catMap.get(selectedCat) : undefined;
  const heatTitle = capitalize(fmtDate(heat.monthStart, 'LLLL yyyy'));
  const selectedDayInHeat = selectedDay && inRange(selectedDay, heat.range);

  const chartAria = seriesStats.total > 0 && seriesStats.peak
    ? t('an.chartAria', { kind: kindWord, total: fmt(seriesStats.total), max: fmt(seriesStats.peak.amount), when: seriesStats.peak.title })
    : t('an.chartAriaEmpty', { kind: kindWord });

  return (
    <PageContainer>
      <PageHeader title={t('an.title')} subtitle={t('an.subtitle')} />

      {/* ─── Controls ─── */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Period>
          value={period}
          onChange={changePeriod}
          className="w-full sm:w-auto"
          options={[
            { value: 'week', label: t('common.week') },
            { value: 'month', label: t('common.month') },
            { value: 'year', label: t('common.year') },
          ]}
        />
        <Segmented<CategoryKind>
          value={kind}
          onChange={changeKind}
          className="w-full sm:w-auto"
          options={[
            { value: 'expense', label: t('common.expenses'), className: 'text-expense' },
            { value: 'income', label: t('common.incomes'), className: 'text-income' },
          ]}
        />
      </div>

      {/* ─── Hero ─── */}
      <section className="relative mb-4 overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6 lg:mb-5">
        <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2" role="group" aria-label={t('an.periodLabel')}>
            <button
              type="button"
              onClick={() => { setOffset((o) => o - 1); setSelectedDay(null); }}
              aria-label={t('an.prevPeriod')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="min-w-0 truncate text-center text-sm font-bold" aria-live="polite">{periodTitle}</p>
            <button
              type="button"
              onClick={() => { setOffset((o) => Math.min(0, o + 1)); setSelectedDay(null); }}
              disabled={offset >= 0}
              aria-label={t('an.nextPeriod')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/12"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 text-center sm:mt-5">
            <p className="text-sm font-medium text-white/75">{t(kind === 'expense' ? 'an.totalExpense' : 'an.totalIncome')}</p>
            <p className="mt-1 truncate font-display text-[2.1rem] leading-tight font-semibold tabular sm:text-5xl">{fmt(summary.total)}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
              {summary.pct === null ? (
                <span className="text-white/75">{t('an.noPrev')}</span>
              ) : (
                <>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold tabular',
                      summary.pct === 0 ? 'bg-white/15' : good ? 'bg-emerald-300/30 text-emerald-50' : 'bg-rose-300/35 text-rose-50',
                    )}
                  >
                    {summary.pct > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : summary.pct < 0 ? <ArrowDown className="h-3.5 w-3.5" /> : null}
                    {summary.pct === 0 ? t('an.noChange') : `${Math.abs(summary.pct)}%`}
                  </span>
                  <span className="text-white/75">
                    {t(summary.isCurrent ? 'an.vsPrevSame' : 'an.vsPrev')} · {t('an.prevWas', { amount: fmt(summary.before) })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stat tiles ─── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:mb-5 lg:grid-cols-4">
        <StatTile icon={Sigma} label={t('an.avgPerDay')} value={<span className="tabular">{fmt(Math.round(summary.avgPerDay))}</span>} />
        <StatTile
          icon={Receipt}
          tone={kind}
          label={t(kind === 'expense' ? 'an.biggestExpense' : 'an.biggestIncome')}
          value={<span className="tabular">{summary.biggest ? fmt(summary.biggest.amount) : '—'}</span>}
          hint={summary.biggest ? [label(summary.biggest.categoryId ? catMap.get(summary.biggest.categoryId) : undefined), dayLabel(summary.biggest.date)].join(' · ') : undefined}
        />
        <StatTile icon={Hash} label={t('an.txCount')} value={<span className="tabular">{summary.count}</span>} />
        <StatTile
          icon={Crown}
          tone="gold"
          label={t('an.topCategory')}
          value={summary.top ? label(catMap.get(summary.top.categoryId)) : '—'}
          hint={summary.top && summary.total > 0 ? t('an.shareOf', { pct: Math.round((summary.top.amount / summary.total) * 100) }) : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {/* ─── Left column: categories + selected category ─── */}
        <div className="min-w-0 space-y-4 lg:space-y-5">
          <Panel
            title={t('an.byCategory')}
            icon={PieIcon}
            action={selectedCat && (
              <button
                type="button"
                onClick={() => setSelectedCat(null)}
                className="-mr-1 flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" /> {t('an.clearCategory')}
              </button>
            )}
          >
            {summary.slices.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t('an.emptyTitle')}
                text={t(kind === 'expense' ? 'an.emptyExpense' : 'an.emptyIncome')}
                className="py-6"
                action={
                  <Button variant="outline" className="rounded-xl" onClick={() => openAdd(kind)}>
                    <Plus className="h-4 w-4" /> {t('common.add')}
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <div
                  role="img"
                  aria-label={t('an.donutAria', {
                    list: summary.slices.slice(0, 6).map((s) =>
                      `${label(catMap.get(s.categoryId))} ${fmt(s.amount)} (${Math.round((s.amount / summary.total) * 100)}%)`).join(', '),
                  })}
                >
                  <CategoryDonut
                    data={summary.slices}
                    total={summary.total}
                    label={t(kind === 'expense' ? 'common.expenses' : 'common.incomes')}
                  />
                </div>
                <CategoryBreakdown data={summary.slices} total={summary.total} onSelect={selectCategory} selected={selectedCat} />
              </div>
            )}
          </Panel>

          {selectedCat && catDetail && (
            <Panel
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <IconBubble icon={selectedCategory?.icon} color={selectedCategory?.color} size="sm" />
                  <span className="truncate">{label(selectedCategory)}</span>
                </span>
              }
              action={<span className="text-sm font-bold tabular">{fmt(catDetail.amount)}</span>}
            >
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('an.categoryTrend')}</p>
              <div
                role="img"
                aria-label={t('an.trendAria', {
                  name: label(selectedCategory),
                  list: catDetail.trend.map((p) => `${p.label} ${fmt(p.amount)}`).join(', '),
                })}
                className="h-28"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={catDetail.trend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as { label: string; amount: number };
                        return <ChartTip title={p.label} value={fmt(p.amount)} />;
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 6, 6]} maxBarSize={36} isAnimationActive={false}>
                      {catDetail.trend.map((p) => (
                        <Cell key={p.key} fill={selectedCategory?.color ?? barColor} fillOpacity={p.current ? 1 : 0.45} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="mt-4 mb-1 text-xs font-semibold text-muted-foreground">
                {t('an.categoryTxs')} · <span className="tabular">{catDetail.txs.length}</span>
              </p>
              {catDetail.txs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('an.emptyTitle')}</p>
              ) : (
                <div className="-mx-2">
                  {catDetail.txs.slice(0, catLimit).map((tx) => <TransactionRow key={tx.id} tx={tx} showDate compact />)}
                  {catDetail.txs.length > catLimit && (
                    <div className="flex justify-center pt-2">
                      <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => setCatLimit((n) => n + 20)}>
                        {t('tx.showMore')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* ─── Right column: dynamics + calendar ─── */}
        <div className="min-w-0 space-y-4 lg:space-y-5">
          <Panel
            title={t(period === 'year' ? 'an.perMonth' : 'an.perDay')}
            icon={BarChart3}
            action={selectedCategory && (
              <span className="max-w-[55%] truncate rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {t('an.filteredBy', { name: label(selectedCategory) })}
              </span>
            )}
          >
            <div role="img" aria-label={chartAria} className="h-52 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={series}
                  margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                  barCategoryGap={period === 'month' ? '18%' : '24%'}
                  onClick={(state) => onBarClick(state?.activePayload?.[0]?.payload as ChartPoint | undefined)}
                >
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={4} />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as ChartPoint;
                      return <ChartTip title={p.title} value={fmt(p.amount)} />;
                    }}
                  />
                  {seriesStats.avg > 0 && (
                    <ReferenceLine y={seriesStats.avg} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  )}
                  <Bar dataKey="amount" radius={[6, 6, 2, 2]} maxBarSize={40} className="cursor-pointer">
                    {series.map((p) => (
                      <Cell
                        key={p.key}
                        fill={selectedCategory?.color ?? barColor}
                        fillOpacity={selectedDay && period !== 'year' && p.key !== selectedDay ? 0.35 : p.key === today ? 1 : 0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Calendar heat-map */}
          <Panel title={t(kind === 'expense' ? 'an.calendarExpense' : 'an.calendarIncome')} icon={CalendarDays} className="p-3 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <p className="text-sm font-semibold">{heatTitle}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
                {t('an.less')}
                {[0.12, 0.35, 0.6, 0.9].map((o) => (
                  <span
                    key={o}
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: `color-mix(in oklch, ${barColor} ${o * 100}%, transparent)` }}
                  />
                ))}
                {t('an.more')}
              </div>
            </div>

            <div aria-label={t('an.heatAria', { kind: kindWord, month: heatTitle })} role="group">
              <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden>
                {weekdayNames.map((w) => (
                  <span key={w} className="text-center text-[10px] font-semibold text-muted-foreground uppercase">{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: heat.leading }, (_, i) => <span key={`pad-${i}`} aria-hidden />)}
                {heat.days.map((d) => {
                  const future = d.day > today;
                  // Square-root scale so small days are still visible next to one big purchase.
                  const intensity = heat.max > 0 && d.amount > 0 ? 0.12 + 0.88 * Math.sqrt(d.amount / heat.max) : 0;
                  const isSelected = selectedDay === d.day;
                  return (
                    <button
                      key={d.day}
                      type="button"
                      disabled={future}
                      onClick={() => setSelectedDay(isSelected ? null : d.day)}
                      aria-pressed={isSelected}
                      aria-label={t('an.dayAria', { day: dayLabel(d.day), amount: fmt(d.amount) })}
                      className={cn(
                        'relative flex aspect-square min-h-9 items-center justify-center rounded-lg text-[11px] font-semibold tabular transition-transform',
                        intensity === 0 && 'bg-muted/60',
                        intensity > 0.55 ? 'text-white' : 'text-foreground/80',
                        future ? 'opacity-35' : 'hover:scale-105 active:scale-95',
                        d.day === today && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                        isSelected && 'ring-2 ring-foreground ring-offset-1 ring-offset-card',
                      )}
                      style={intensity > 0 ? { backgroundColor: `color-mix(in oklch, ${barColor} ${Math.round(intensity * 100)}%, transparent)` } : undefined}
                    >
                      {parseDay(d.day).getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDayInHeat ? (
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1 flex items-center justify-between px-1">
                  <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {t('an.dayTxs', { day: dayLabel(selectedDay, true) })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    aria-label={t('common.close')}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {dayTxs.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">{t('an.dayEmpty')}</p>
                ) : (
                  <div className="-mx-1">{dayTxs.map((tx) => <TransactionRow key={tx.id} tx={tx} compact />)}</div>
                )}
              </div>
            ) : (
              <p className="mt-3 px-1 text-xs text-muted-foreground">{t('an.calendarHint')}</p>
            )}
          </Panel>
        </div>

        {/* ─── Full width: income vs expenses, 6 months ─── */}
        <Panel title={t('an.incomeVsExpense')} icon={PiggyBank} className="lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-[1fr_240px] md:items-center">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                <span>{t('an.last6')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-income" />{t('common.incomes')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-expense" />{t('common.expenses')}</span>
              </div>
              <div
                role="img"
                aria-label={t('an.monthlyAria', {
                  list: monthly.rows.map((m) => t('an.monthlyItem', { month: m.title, income: fmt(m.income), expense: fmt(m.expense) })).join('; '),
                })}
                className="h-52 sm:h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly.rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={3} barCategoryGap="22%">
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as (typeof monthly.rows)[number];
                        return (
                          <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                            <p className="mb-1 font-semibold">{p.title}</p>
                            <p className="flex items-center gap-1.5 tabular"><span className="h-2 w-2 rounded-full bg-income" />{fmt(p.income)}</p>
                            <p className="flex items-center gap-1.5 tabular"><span className="h-2 w-2 rounded-full bg-expense" />{fmt(p.expense)}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="income" fill="var(--income)" radius={[6, 6, 2, 2]} maxBarSize={28} />
                    <Bar dataKey="expense" fill="var(--expense)" radius={[6, 6, 2, 2]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl bg-muted/60 p-4">
              <Ring
                value={monthly.rate !== null ? Math.max(0, monthly.rate) : 0}
                size={72}
                stroke={8}
                color={monthly.rate !== null && monthly.rate < 0 ? 'var(--expense)' : 'var(--income)'}
              >
                <span className="text-sm font-extrabold tabular">
                  {monthly.rate !== null ? `${Math.round(monthly.rate * 100)}%` : '—'}
                </span>
              </Ring>
              <div className="min-w-0">
                <p className="text-sm font-bold">{t('an.savingsRate')}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {monthly.rate === null
                    ? t('an.savingsNoIncome')
                    : monthly.saved >= 0
                      ? t('an.savingsRateHint', { pct: Math.round(monthly.rate * 100), amount: fmt(monthly.saved) })
                      : t('an.savingsNegative', { amount: fmt(-monthly.saved) })}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}

/** Shared tooltip bubble for bar charts. */
function ChartTip({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{title}</p>
      <p className="font-bold tabular">{value}</p>
    </div>
  );
}
