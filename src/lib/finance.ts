import { addDays, differenceInCalendarDays, endOfMonth, format, getDaysInMonth, startOfMonth, subMonths } from 'date-fns';
import type { Account, Budget, Category, Goal, Recurring, Transaction } from './types';
import { daysUntil, inRange, monthRange, parseDay, toDay, todayISO, type DayRange } from './dates';
import type { TFunction } from '@/i18n';

// ─── Labels ──────────────────────────────────────────────────────────────────

export function categoryLabel(c: Category | undefined, t: TFunction): string {
  if (!c) return t('cat.uncategorized');
  return c.name?.trim() || (c.key ? t(`cat.${c.key}`) : t('cat.uncategorized'));
}

// ─── Balances ────────────────────────────────────────────────────────────────

export function accountBalances(accounts: Account[], txs: Transaction[]): Record<string, number> {
  const bal: Record<string, number> = {};
  for (const a of accounts) bal[a.id] = a.initialBalance || 0;
  for (const tx of txs) {
    if (tx.kind === 'income') bal[tx.accountId] = (bal[tx.accountId] ?? 0) + tx.amount;
    else if (tx.kind === 'expense') bal[tx.accountId] = (bal[tx.accountId] ?? 0) - tx.amount;
    else if (tx.kind === 'transfer') {
      bal[tx.accountId] = (bal[tx.accountId] ?? 0) - tx.amount;
      if (tx.toAccountId) bal[tx.toAccountId] = (bal[tx.toAccountId] ?? 0) + tx.amount;
    }
  }
  return bal;
}

export function totalBalance(accounts: Account[], balances: Record<string, number>, spendableOnly = false) {
  return accounts
    .filter((a) => !a.archived && (!spendableOnly || !a.excludeFromTotal))
    .reduce((s, a) => s + (balances[a.id] ?? 0), 0);
}

// ─── Period stats ────────────────────────────────────────────────────────────

export interface PeriodStats {
  income: number;
  expense: number;
  net: number;
  count: number;
  byCategory: { categoryId: string; amount: number; count: number }[];
  incomeByCategory: { categoryId: string; amount: number; count: number }[];
}

export function periodStats(txs: Transaction[], range: DayRange): PeriodStats {
  let income = 0;
  let expense = 0;
  let count = 0;
  const exp = new Map<string, { amount: number; count: number }>();
  const inc = new Map<string, { amount: number; count: number }>();
  for (const tx of txs) {
    if (tx.kind === 'transfer' || !inRange(tx.date, range)) continue;
    count++;
    const key = tx.categoryId ?? '';
    const map = tx.kind === 'income' ? inc : exp;
    const cur = map.get(key) ?? { amount: 0, count: 0 };
    cur.amount += tx.amount;
    cur.count++;
    map.set(key, cur);
    if (tx.kind === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  const toList = (m: typeof exp) =>
    [...m.entries()].map(([categoryId, v]) => ({ categoryId, ...v })).sort((a, b) => b.amount - a.amount);
  return { income, expense, net: income - expense, count, byCategory: toList(exp), incomeByCategory: toList(inc) };
}

/** Expense per day for every day in the range (zeros included). */
export function dailySeries(txs: Transaction[], range: DayRange, kind: 'expense' | 'income' = 'expense') {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.kind !== kind || !inRange(tx.date, range)) continue;
    const d = tx.date.slice(0, 10);
    map.set(d, (map.get(d) ?? 0) + tx.amount);
  }
  const out: { day: string; amount: number }[] = [];
  const end = parseDay(range.to);
  for (let d = parseDay(range.from); d <= end; d = addDays(d, 1)) {
    const key = toDay(d);
    out.push({ day: key, amount: map.get(key) ?? 0 });
  }
  return out;
}

/** Income vs expense for the last `months` calendar months (oldest first). */
export function monthlySeries(txs: Transaction[], months = 6, base: Date = new Date()) {
  const out: { month: string; start: Date; income: number; expense: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(subMonths(base, i));
    const s = periodStats(txs, { from: toDay(start), to: toDay(endOfMonth(start)) });
    out.push({ month: format(start, 'yyyy-MM'), start, income: s.income, expense: s.expense });
  }
  return out;
}

// ─── Budgets ─────────────────────────────────────────────────────────────────

export type BudgetState = 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  budget: Budget;
  category?: Category;
  spent: number;
  pct: number; // spent / limit, 0..∞
  pacePct: number; // where spending "should" be today, 0..1
  remaining: number;
  state: BudgetState;
}

export function budgetStatuses(budgets: Budget[], categories: Category[], txs: Transaction[], base = new Date()): BudgetStatus[] {
  const range = monthRange(0, base);
  const stats = periodStats(txs, range);
  const spentBy = new Map(stats.byCategory.map((c) => [c.categoryId, c.amount]));
  const pacePct = base.getDate() / getDaysInMonth(base);
  return budgets
    .map((budget) => {
      const spent = spentBy.get(budget.categoryId) ?? 0;
      const pct = budget.limit > 0 ? spent / budget.limit : 0;
      const state: BudgetState = pct > 1 ? 'over' : pct > Math.max(0.85, pacePct + 0.1) ? 'warn' : 'ok';
      return {
        budget, category: categories.find((c) => c.id === budget.categoryId), spent, pct, pacePct,
        remaining: budget.limit - spent, state,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

// ─── Upcoming bills / income ─────────────────────────────────────────────────

export interface UpcomingItem {
  recurring: Recurring;
  days: number; // negative = overdue
}

export function upcomingRecurring(recurring: Recurring[], horizonDays = 14): UpcomingItem[] {
  return recurring
    .filter((r) => r.active)
    .map((r) => ({ recurring: r, days: daysUntil(r.nextDate) }))
    .filter((x) => x.days <= horizonDays)
    .sort((a, b) => a.days - b.days);
}

// ─── Safe to spend ───────────────────────────────────────────────────────────

export interface SafeToSpend {
  daily: number; // allowance per day until the horizon
  leftToday: number; // what is left of today's allowance
  spentToday: number;
  horizonDays: number;
  horizonLabel: 'income' | 'monthEnd';
  reserved: number; // upcoming bills inside the horizon
  available: number;
}

export function safeToSpend(spendable: number, txs: Transaction[], recurring: Recurring[], base = new Date()): SafeToSpend {
  const today = toDay(base);
  const spentToday = txs
    .filter((t) => t.kind === 'expense' && t.date.slice(0, 10) === today)
    .reduce((s, t) => s + t.amount, 0);

  const nextIncome = recurring
    .filter((r) => r.active && r.kind === 'income')
    .map((r) => daysUntil(r.nextDate, base))
    .filter((d) => d > 0 && d <= 35)
    .sort((a, b) => a - b)[0];

  const toMonthEnd = differenceInCalendarDays(endOfMonth(base), base) + 1;
  const horizonDays = nextIncome ?? toMonthEnd;
  const reserved = recurring
    .filter((r) => r.active && r.kind === 'expense' && daysUntil(r.nextDate, base) < horizonDays)
    .reduce((s, r) => s + r.amount, 0);

  // Start-of-day money so today's spending is measured against today's allowance.
  const available = spendable + spentToday - reserved;
  const daily = Math.max(0, available) / Math.max(1, horizonDays);
  return {
    daily, leftToday: daily - spentToday, spentToday, horizonDays,
    horizonLabel: nextIncome ? 'income' : 'monthEnd', reserved, available,
  };
}

// ─── Streak ──────────────────────────────────────────────────────────────────

/** Consecutive days (ending today or yesterday) with at least one logged transaction. */
export function loggingStreak(txs: Transaction[], base = new Date()): number {
  const days = new Set(txs.map((t) => t.createdAt.slice(0, 10)).concat(txs.map((t) => t.date.slice(0, 10))));
  let d = base;
  if (!days.has(toDay(d))) d = addDays(d, -1);
  let n = 0;
  while (days.has(toDay(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export function goalPerMonth(goal: Goal, base = new Date()): number | null {
  if (!goal.deadline) return null;
  const left = goal.target - goal.saved;
  if (left <= 0) return 0;
  const months = Math.max(1, differenceInCalendarDays(parseDay(goal.deadline), base) / 30.4);
  return left / months;
}

/** Days needed to afford something at the current average monthly savings. */
export function daysToAfford(amountLeft: number, monthlySavings: number): number | null {
  if (amountLeft <= 0) return 0;
  if (monthlySavings <= 0) return null;
  return Math.ceil((amountLeft / monthlySavings) * 30.4);
}

/** Average net (income − expense) per month over the last 3 full months. */
export function avgMonthlySavings(txs: Transaction[], base = new Date()): number {
  const s = monthlySeries(txs, 4, base).slice(0, 3);
  const withData = s.filter((m) => m.income || m.expense);
  if (withData.length === 0) return 0;
  return withData.reduce((acc, m) => acc + (m.income - m.expense), 0) / withData.length;
}

// ─── Forecast ────────────────────────────────────────────────────────────────

/** Projected spending by month end at the current daily pace. */
export function monthForecast(txs: Transaction[], base = new Date()) {
  const r = monthRange(0, base);
  const spent = periodStats(txs, { from: r.from, to: todayISO() }).expense;
  const dayOfMonth = base.getDate();
  const daysInMonth = getDaysInMonth(base);
  return { spent, projected: (spent / dayOfMonth) * daysInMonth, dayOfMonth, daysInMonth };
}
