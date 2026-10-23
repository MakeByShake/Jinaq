'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Download, Hash, Plus, Receipt, Scale, Search, SearchX, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState, Money, PageContainer, PageHeader, Panel, Segmented, StatTile } from '@/components/app/ui';
import { TransactionGroups } from '@/components/app/transaction-list';
import { useData } from '@/stores/data-store';
import { useQuickAdd } from '@/stores/ui-store';
import { useAccounts, useCategories } from '@/hooks/use-finance';
import { useCurrency } from '@/lib/format';
import { inRange, lastNDays, monthRange, type DayRange } from '@/lib/dates';
import { exportTransactionsCsv } from '@/lib/export';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { TransactionKind } from '@/lib/types';

type PeriodKey = 'month' | 'prev' | '30' | 'year' | 'all';
type KindFilter = 'all' | TransactionKind;

const PERIODS: PeriodKey[] = ['month', 'prev', '30', 'year', 'all'];
/** Rows rendered per "page" — keeps big ledgers responsive. */
const PAGE = 60;

function periodRange(p: PeriodKey): DayRange | null {
  const now = new Date();
  switch (p) {
    case 'month': return monthRange(0, now);
    case 'prev': return monthRange(-1, now);
    case '30': return lastNDays(30, now);
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
    default: return null;
  }
}

export default function TransactionsPage() {
  const t = useT();
  const currency = useCurrency();
  const openAdd = useQuickAdd((s) => s.openAdd);
  const transactions = useData((s) => s.transactions);
  const { map: catMap, label, byKind } = useCategories();
  const { accounts, map: accMap } = useAccounts();

  const [period, setPeriod] = useState<PeriodKey>('month');
  const [kind, setKind] = useState<KindFilter>('all');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');

  const accountName = (id?: string) => (id ? accMap.get(id)?.name ?? '—' : '—');

  const filtered = useMemo(() => {
    const range = periodRange(period);
    const q = query.trim().toLowerCase();
    // Digits-only version of the query so "1 500" matches 1500.
    const qDigits = q.replace(/[\s ]/g, '').replace(',', '.');
    return transactions.filter((tx) => {
      if (range && !inRange(tx.date, range)) return false;
      if (kind !== 'all' && tx.kind !== kind) return false;
      if (accountId !== 'all' && tx.accountId !== accountId && tx.toAccountId !== accountId) return false;
      if (categoryId !== 'all' && tx.categoryId !== categoryId) return false;
      if (!q) return true;
      const hay = [
        tx.note ?? '',
        tx.kind === 'transfer' ? t('common.transfer') : label(tx.categoryId ? catMap.get(tx.categoryId) : undefined),
        accMap.get(tx.accountId)?.name ?? '',
        tx.toAccountId ? accMap.get(tx.toAccountId)?.name ?? '' : '',
      ].join(' ').toLowerCase();
      if (hay.includes(q)) return true;
      return /^\d+(\.\d+)?$/.test(qDigits) && String(tx.amount).includes(qDigits);
    });
  }, [transactions, period, kind, accountId, categoryId, query, label, catMap, accMap, t]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of filtered) {
      if (tx.kind === 'income') income += tx.amount;
      else if (tx.kind === 'expense') expense += tx.amount;
    }
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  // Incremental rendering: the visible count resets whenever the filters change.
  const signature = [period, kind, accountId, categoryId, query].join('|');
  const [paging, setPaging] = useState({ signature, limit: PAGE });
  const limit = paging.signature === signature ? paging.limit : PAGE;
  const visible = filtered.slice(0, limit);

  const hasFilters = kind !== 'all' || accountId !== 'all' || categoryId !== 'all' || query.trim() !== '';

  const resetFilters = () => {
    setKind('all');
    setAccountId('all');
    setCategoryId('all');
    setQuery('');
  };

  const changeKind = (k: KindFilter) => {
    setKind(k);
    // Drop a category filter that no longer fits the selected kind.
    const c = catMap.get(categoryId);
    if (k === 'transfer' || (c && k !== 'all' && c.kind !== k)) setCategoryId('all');
  };

  const onExport = () => {
    if (filtered.length === 0) {
      toast.error(t('tx.exportEmpty'));
      return;
    }
    exportTransactionsCsv(filtered, {
      currency,
      categoryLabel: (id) => label(id ? catMap.get(id) : undefined),
      accountName,
      kindLabel: (k) => t(`common.${k}`),
      headers: [
        t('tx.csvDate'), t('tx.csvType'), t('tx.csvCategory'), t('tx.csvAccount'),
        t('tx.csvAmount', { currency }), t('tx.csvNote'),
      ],
    });
    toast.success(t('tx.exported'));
  };

  const expenseCats = byKind('expense');
  const incomeCats = byKind('income');
  const showExpenseCats = kind === 'all' || kind === 'expense';
  const showIncomeCats = kind === 'all' || kind === 'income';
  const activeAccounts = accounts.filter((a) => !a.archived || a.id === accountId);

  return (
    <PageContainer>
      <PageHeader
        title={t('tx.title')}
        subtitle={t('tx.subtitle')}
        actions={
          transactions.length > 0 && (
            <Button variant="outline" className="h-10 rounded-xl" onClick={onExport} aria-label={t('tx.exportCsv')}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{t('tx.exportCsv')}</span>
            </Button>
          )
        }
      />

      {transactions.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Receipt}
            title={t('tx.emptyTitle')}
            text={t('tx.emptyText')}
            action={
              <Button className="rounded-xl" onClick={() => openAdd('expense')}>
                <Plus className="h-4 w-4" /> {t('dash.welcomeAction')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:gap-5">
          {/* ─── Filters + list ─── */}
          <div className="min-w-0 space-y-4 lg:order-1">
            {/* Period chips — horizontally scrollable on narrow phones */}
            <div
              role="radiogroup"
              aria-label={t('tx.periodLabel')}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
            >
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
                    period === p
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(`tx.range_${p}`)}
                </button>
              ))}
            </div>

            <div className="space-y-3 rounded-3xl border border-border bg-card p-3 card-shadow sm:p-4">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('tx.searchPlaceholder')}
                  aria-label={t('common.search')}
                  className="h-11 rounded-xl pr-10 pl-9"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('common.close')}
                    className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Segmented<KindFilter>
                value={kind}
                onChange={changeKind}
                className="flex w-full"
                options={[
                  { value: 'all', label: t('tx.filterAll') },
                  { value: 'expense', label: t('common.expenses') },
                  { value: 'income', label: t('common.incomes') },
                  { value: 'transfer', label: t('common.transfer') },
                ]}
                size="sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="h-10! w-full rounded-xl" aria-label={t('common.account')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tx.filterAccount')}</SelectItem>
                    {activeAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={categoryId} onValueChange={setCategoryId} disabled={kind === 'transfer'}>
                  <SelectTrigger className="h-10! w-full rounded-xl" aria-label={t('common.category')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('tx.filterCategory')}</SelectItem>
                    {showExpenseCats && expenseCats.length > 0 && (
                      <SelectGroup>
                        {kind === 'all' && <SelectLabel>{t('common.expenses')}</SelectLabel>}
                        {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{label(c)}</SelectItem>)}
                      </SelectGroup>
                    )}
                    {showIncomeCats && incomeCats.length > 0 && (
                      <SelectGroup>
                        {kind === 'all' && <SelectLabel>{t('common.incomes')}</SelectLabel>}
                        {incomeCats.map((c) => <SelectItem key={c.id} value={c.id}>{label(c)}</SelectItem>)}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5" /> {t('tx.resetFilters')}
                </button>
              )}
            </div>

            {/* Summary tiles — shown inline on mobile, in the side column on desktop */}
            <SummaryTiles summary={summary} className="lg:hidden" />

            {filtered.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={SearchX}
                  title={t('tx.notFound')}
                  text={t('tx.notFoundText')}
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      {hasFilters && (
                        <Button variant="outline" className="rounded-xl" onClick={resetFilters}>{t('tx.resetFilters')}</Button>
                      )}
                      {period !== 'all' && (
                        <Button variant="outline" className="rounded-xl" onClick={() => setPeriod('all')}>{t('tx.range_all')}</Button>
                      )}
                    </div>
                  }
                />
              </Panel>
            ) : (
              <>
                <TransactionGroups transactions={visible} />
                {filtered.length > limit && (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <p className="text-xs text-muted-foreground tabular">
                      {t('tx.shownOf', { shown: visible.length, total: filtered.length })}
                    </p>
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl"
                      onClick={() => setPaging({ signature, limit: limit + PAGE })}
                    >
                      {t('tx.showMore')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─── Desktop side column ─── */}
          <aside className="hidden lg:order-2 lg:block">
            <div className="sticky top-6">
              <SummaryTiles summary={summary} vertical />
            </div>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}

function SummaryTiles({ summary, className, vertical = false }: {
  summary: { income: number; expense: number; net: number; count: number }; className?: string; vertical?: boolean;
}) {
  const t = useT();
  return (
    <div className={cn('grid gap-2 sm:gap-3', vertical ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4', className)}>
      <StatTile icon={ArrowDownLeft} tone="income" label={t('tx.periodIncome')} value={<Money value={summary.income} kind="income" />} />
      <StatTile icon={ArrowUpRight} tone="expense" label={t('tx.periodExpense')} value={<Money value={summary.expense} kind="expense" />} />
      <StatTile icon={Scale} label={t('tx.net')} value={<Money value={summary.net} kind="auto" />} />
      <StatTile icon={Hash} label={t('tx.countLabel')} value={<span className="tabular">{summary.count}</span>} />
    </div>
  );
}
