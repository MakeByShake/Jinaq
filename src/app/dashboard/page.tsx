'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CalendarClock, Flame, Gauge, Lightbulb, PieChart,
  Plus, Sparkles, Target, TrendingUp, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer, Panel, ProgressBar, EmptyState, Ring, Money } from '@/components/app/ui';
import { CategoryBreakdown, CategoryDonut } from '@/components/app/charts';
import { TransactionRow } from '@/components/app/transaction-list';
import { UpcomingRow } from '@/components/app/upcoming';
import { useData } from '@/stores/data-store';
import { useAuthStore } from '@/stores/auth-store';
import { useQuickAdd } from '@/stores/ui-store';
import { useBalances, useCategories } from '@/hooks/use-finance';
import { useMoney } from '@/lib/format';
import { monthRange } from '@/lib/dates';
import {
  budgetStatuses, loggingStreak, monthForecast, periodStats, safeToSpend, upcomingRecurring,
} from '@/lib/finance';
import { IconBubble } from '@/lib/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

function greetingKey(h: number) {
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

export default function OverviewPage() {
  const t = useT();
  const fmt = useMoney();
  const user = useAuthStore((s) => s.currentUser);
  const openAdd = useQuickAdd((s) => s.openAdd);
  const transactions = useData((s) => s.transactions);
  const recurring = useData((s) => s.recurring);
  const budgets = useData((s) => s.budgets);
  const goals = useData((s) => s.goals);
  const { categories, label } = useCategories();
  const { total, spendable } = useBalances();

  const data = useMemo(() => {
    const month = periodStats(transactions, monthRange(0));
    const prev = periodStats(transactions, monthRange(-1));
    const sts = safeToSpend(spendable, transactions, recurring);
    const upcoming = upcomingRecurring(recurring, 14).slice(0, 5);
    const budget = budgetStatuses(budgets, categories, transactions).slice(0, 4);
    const forecast = monthForecast(transactions);
    const streak = loggingStreak(transactions);

    // Insights — only the ones backed by enough data.
    const insights: { icon: typeof Lightbulb; text: string; tone: string }[] = [];
    if (streak >= 2) insights.push({ icon: Flame, text: t('dash.streak', { count: streak }), tone: 'text-gold bg-gold/15' });
    if (forecast.dayOfMonth >= 5 && forecast.spent > 0) {
      let text = t('dash.forecast', { amount: fmt(Math.round(forecast.projected)) });
      if (prev.expense > 0) {
        const diff = Math.round(((forecast.projected - prev.expense) / prev.expense) * 100);
        if (Math.abs(diff) >= 5) text += '. ' + (diff > 0 ? t('dash.forecastMore', { pct: diff }) : t('dash.forecastLess', { pct: -diff }));
      }
      insights.push({ icon: TrendingUp, text, tone: 'text-primary bg-accent' });
    }
    const prevBy = new Map(prev.byCategory.map((c) => [c.categoryId, c.amount]));
    const growth = month.byCategory
      .filter((c) => (prevBy.get(c.categoryId) ?? 0) > 0 && c.amount > 1000)
      .map((c) => ({ ...c, pct: Math.round(((c.amount - prevBy.get(c.categoryId)!) / prevBy.get(c.categoryId)!) * 100) }))
      .sort((a, b) => b.pct - a.pct)[0];
    if (growth && growth.pct >= 20) {
      insights.push({ icon: Lightbulb, text: t('dash.topGrowth', { cat: label(growth.categoryId), pct: growth.pct }), tone: 'text-warning bg-warning/15' });
    }
    if (month.income > 0 && month.net > 0) {
      insights.push({ icon: Sparkles, text: t('dash.savingsRate', { pct: Math.round((month.net / month.income) * 100) }), tone: 'text-income bg-income/12' });
    }

    return { month, sts, upcoming, budget, insights };
  }, [transactions, recurring, budgets, categories, spendable, t, fmt, label]);

  const { month, sts, upcoming, budget, insights } = data;
  const activeGoals = goals.filter((g) => g.status !== 'done').slice(0, 3);
  const hour = new Date().getHours();
  const todayPct = sts.daily > 0 ? Math.max(0, sts.leftToday) / sts.daily : 0;
  const overspent = sts.leftToday < 0;

  return (
    <PageContainer>
      <div className="mb-5 md:mb-7">
        <p className="text-sm font-medium text-muted-foreground">{t(`dash.${greetingKey(hour)}`)},</p>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{user?.name.split(' ')[0]}</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        {/* ─── Left / main column ─── */}
        <div className="space-y-4 lg:col-span-2 lg:space-y-5">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6">
            <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/75">{t('dash.totalBalance')}</p>
                <p className="mt-1 truncate font-display text-[2.1rem] leading-tight font-semibold tabular sm:text-5xl">{fmt(total)}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="flex items-center gap-1.5 text-white/85">
                    <ArrowDownLeft className="h-4 w-4 text-emerald-200" /> {fmt(month.income, { sign: true })}
                  </span>
                  <span className="flex items-center gap-1.5 text-white/85">
                    <ArrowUpRight className="h-4 w-4 text-rose-200" /> {fmt(-month.expense)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white/12 p-3.5 backdrop-blur-sm sm:min-w-64">
                <Ring value={overspent ? 1 : todayPct} size={60} stroke={7} color={overspent ? '#fda4af' : '#fde68a'}>
                  <Clock className="h-5 w-5 text-white/80" />
                </Ring>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/75">{overspent ? t('dash.overspentToday') : t('dash.canSpendToday')}</p>
                  <p className="truncate font-display text-xl font-semibold tabular">{fmt(Math.round(Math.abs(sts.leftToday)))}</p>
                  <p className="truncate text-[11px] text-white/70">
                    {t(sts.horizonLabel === 'income' ? 'dash.untilIncome' : 'dash.untilMonthEnd', { days: t('common.days', { count: sts.horizonDays }) })}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {([
              { k: 'expense', icon: ArrowUpRight, cls: 'text-expense bg-expense/12', label: t('dash.quickExpense') },
              { k: 'income', icon: ArrowDownLeft, cls: 'text-income bg-income/12', label: t('dash.quickIncome') },
              { k: 'transfer', icon: ArrowLeftRight, cls: 'text-chart-2 bg-chart-2/12', label: t('dash.quickTransfer') },
            ] as const).map((a) => (
              <button
                key={a.k}
                type="button"
                onClick={() => openAdd(a.k)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-2 py-3 text-sm font-bold card-shadow transition-transform active:scale-[0.97] hover:bg-muted/50"
              >
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', a.cls)}>
                  <a.icon className="h-4 w-4" />
                </span>
                {a.label}
              </button>
            ))}
          </div>

          {transactions.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Sparkles}
                title={t('dash.welcomeTitle')}
                text={t('dash.welcomeText')}
                action={<Button className="rounded-xl" onClick={() => openAdd('expense')}><Plus className="h-4 w-4" /> {t('dash.welcomeAction')}</Button>}
              />
            </Panel>
          ) : (
            <>
              {/* Spending by category */}
              <Panel title={t('dash.spending')} icon={PieChart} href="/dashboard/analytics">
                {month.byCategory.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t('dash.spendingEmpty')}</p>
                ) : (
                  <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
                    <CategoryDonut data={month.byCategory} total={month.expense} label={t('common.expenses')} />
                    <CategoryBreakdown data={month.byCategory} total={month.expense} limit={5} />
                  </div>
                )}
              </Panel>

              {/* Recent */}
              <Panel title={t('dash.recent')} icon={Clock} href="/dashboard/transactions" className="p-2 sm:p-3 [&>div:first-child]:px-2 [&>div:first-child]:pt-2">
                <div>
                  {transactions.slice(0, 7).map((tx) => <TransactionRow key={tx.id} tx={tx} showDate />)}
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* ─── Right column ─── */}
        <div className="space-y-4 lg:space-y-5">
          {insights.length > 0 && (
            <Panel title={t('dash.insights')} icon={Lightbulb}>
              <ul className="space-y-2.5">
                {insights.map((ins, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', ins.tone)}>
                      <ins.icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm leading-snug">{ins.text}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title={t('dash.upcoming')} icon={CalendarClock} href="/dashboard/recurring" className="p-3 sm:p-4">
            {upcoming.length === 0 ? (
              <div className="px-1 pb-1">
                <p className="text-sm text-muted-foreground">{t('dash.upcomingEmpty')}</p>
                <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
                  <Link href="/dashboard/recurring"><Plus className="h-4 w-4" /> {t('dash.addRecurring')}</Link>
                </Button>
              </div>
            ) : (
              <div className="-mx-1">{upcoming.map((u) => <UpcomingRow key={u.recurring.id} item={u} />)}</div>
            )}
          </Panel>

          <Panel title={t('dash.budgets')} icon={Gauge} href="/dashboard/budgets">
            {budget.length === 0 ? (
              <div>
                <p className="text-sm text-muted-foreground">{t('dash.budgetsEmpty')}</p>
                <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
                  <Link href="/dashboard/budgets">{t('dash.setBudgets')}</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3.5">
                {budget.map((b) => (
                  <li key={b.budget.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <IconBubble icon={b.category?.icon} color={b.category?.color} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label(b.category)}</span>
                      <span className={cn('text-xs font-bold tabular', b.state === 'over' ? 'text-expense' : b.state === 'warn' ? 'text-warning' : 'text-muted-foreground')}>
                        {fmt(b.spent, { compact: true })} / {fmt(b.budget.limit, { compact: true })}
                      </span>
                    </div>
                    <ProgressBar value={b.pct} pace={b.pacePct} tone={b.state} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('dash.goals')} icon={Target} href="/dashboard/goals">
            {activeGoals.length === 0 ? (
              <div>
                <p className="text-sm text-muted-foreground">{t('dash.goalsEmpty')}</p>
                <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
                  <Link href="/dashboard/goals"><Plus className="h-4 w-4" /> {t('dash.createGoal')}</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {activeGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-3">
                    <Ring value={g.target > 0 ? g.saved / g.target : 0} size={44} stroke={5} color={g.color}>
                      <IconBubble icon={g.icon} color={g.color} size="sm" className="h-6 w-6 bg-transparent!" />
                    </Ring>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{g.title}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        <Money value={g.saved} compact /> {t('common.of')} <Money value={g.target} compact />
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular">{g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}
