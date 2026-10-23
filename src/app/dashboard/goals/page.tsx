'use client';

import { useCallback, useMemo, useState } from 'react';
import { Columns3, List, PiggyBank, Plus, Target, TrendingUp, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog, EmptyState, PageContainer, PageHeader, Panel, ProgressBar, Segmented, useConfirm,
} from '@/components/app/ui';
import { useData } from '@/stores/data-store';
import { useBalances } from '@/hooks/use-finance';
import { useCurrency, useMoney } from '@/lib/format';
import { avgMonthlySavings, safeToSpend } from '@/lib/finance';
import { deleteGoal, saveGoal } from '@/lib/actions';
import { IconBubble } from '@/lib/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Goal, GoalPriority, GoalStatus } from '@/lib/types';
import { GoalCard, GoalRow, type GoalHandlers } from './_components/goal-card';
import { GoalFormSheet, STATUSES } from './_components/goal-form-sheet';
import { ContributeSheet, PurchaseSheet, type MoneyMode } from './_components/goal-money-sheets';
import { Celebration } from './_components/celebration';

type View = 'board' | 'list';

/** Starter ideas shown in the empty state; they prefill the create sheet. */
const IDEAS: { key: string; icon: string; color: string; target: number; priority: GoalPriority }[] = [
  { key: 'phone', icon: 'phone', color: '#3B82F6', target: 250_000, priority: 'want' },
  { key: 'vacation', icon: 'plane', color: '#F59E0B', target: 400_000, priority: 'dream' },
  { key: 'safety', icon: 'shield', color: '#10B981', target: 300_000, priority: 'need' },
];

// Sheets are re-mounted with a new key on every opening so their forms start fresh.
interface FormState { key: number; open: boolean; goal?: Goal; preset?: Partial<Goal> }
interface MoneyState { key: number; open: boolean; goal: Goal; mode: MoneyMode }
interface BuyState { key: number; open: boolean; goal: Goal }

export default function GoalsPage() {
  const t = useT();
  const fmt = useMoney();
  const currency = useCurrency();
  const goals = useData((s) => s.goals);
  const transactions = useData((s) => s.transactions);
  const recurring = useData((s) => s.recurring);
  const { spendable } = useBalances();
  const confirm = useConfirm();

  const [view, setView] = useState<View>('board');
  const [mobileTab, setMobileTab] = useState<GoalStatus>(() =>
    useData.getState().goals.some((g) => g.status === 'saving') ? 'saving' : 'wish');
  const [listFilter, setListFilter] = useState<'all' | GoalStatus>('all');
  const [form, setForm] = useState<FormState>({ key: 0, open: false });
  const [money, setMoney] = useState<MoneyState | null>(null);
  const [buy, setBuy] = useState<BuyState | null>(null);
  const [burst, setBurst] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Goal | null>(null);

  const { available, avgSavings, summary, byStatus } = useMemo(() => {
    const active = goals.filter((g) => g.status !== 'done');
    const byStatus: Record<GoalStatus, Goal[]> = { wish: [], saving: [], done: [] };
    for (const g of goals) byStatus[g.status]?.push(g);
    // Most recently completed first in "done".
    byStatus.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return {
      available: safeToSpend(spendable, transactions, recurring).available,
      avgSavings: avgMonthlySavings(transactions),
      byStatus,
      summary: {
        saved: active.reduce((s, g) => s + g.saved, 0),
        target: active.reduce((s, g) => s + g.target, 0),
        left: active.reduce((s, g) => s + Math.max(0, g.target - g.saved), 0),
        activeCount: active.length,
        doneCount: goals.length - active.length,
      },
    };
  }, [goals, transactions, recurring, spendable]);

  // Always hand sheets the live version of a goal (it may have changed since opening).
  const live = useCallback((g: Goal) => goals.find((x) => x.id === g.id) ?? g, [goals]);

  const openCreate = (preset?: Partial<Goal>) => setForm((f) => ({ key: f.key + 1, open: true, preset }));
  const celebrate = useCallback(() => setBurst((b) => b + 1), []);
  const stopCelebrate = useCallback(() => setBurst(0), []);

  const handlers: GoalHandlers = {
    onContribute: (goal) => setMoney((m) => ({ key: (m?.key ?? 0) + 1, open: true, goal, mode: 'add' })),
    onWithdraw: (goal) => setMoney((m) => ({ key: (m?.key ?? 0) + 1, open: true, goal, mode: 'withdraw' })),
    onBuy: (goal) => setBuy((b) => ({ key: (b?.key ?? 0) + 1, open: true, goal })),
    onEdit: (goal) => setForm((f) => ({ key: f.key + 1, open: true, goal })),
    onDelete: (goal) => { setPendingDelete(goal); confirm.ask(() => {
      deleteGoal(goal.id);
      setForm((f) => ({ ...f, open: false }));
      toast(t('goals.deleted'), { action: { label: t('common.undo'), onClick: () => saveGoal(goal) } });
    }); },
    onMove: (goal, status) => {
      saveGoal({
        ...goal, status,
        completedAt: status === 'done' ? (goal.completedAt ?? new Date().toISOString()) : undefined,
      });
      if (status === 'done') celebrate();
      toast.success(t('goals.moved', { status: t(`goals.status_${status}`) }), {
        action: { label: t('common.undo'), onClick: () => saveGoal(goal) },
      });
    },
  };

  const cardProps = { available, avgSavings, ...handlers };
  
  return (
    <PageContainer>
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        actions={goals.length > 0 && (
          <Button className="h-10 rounded-xl font-bold" onClick={() => openCreate()}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('goals.add')}</span>
            <span className="sr-only sm:hidden">{t('goals.add')}</span>
          </Button>
        )}
      />

      {goals.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Target}
            title={t('goals.emptyTitle')}
            text={t('goals.emptyText')}
            action={
              <div className="flex flex-col items-center gap-4">
                <Button className="h-11 rounded-xl font-bold" onClick={() => openCreate()}>
                  <Plus className="h-4 w-4" /> {t('goals.add')}
                </Button>
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">{t('goals.ideas')}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {IDEAS.map((idea) => (
                      <button
                        key={idea.key}
                        type="button"
                        onClick={() => openCreate({
                          title: t(`goals.idea_${idea.key}`), icon: idea.icon, color: idea.color,
                          priority: idea.priority,
                          // Example targets are in tenge; other currencies start blank.
                          target: currency === 'KZT' ? idea.target : undefined,
                        })}
                        className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-card py-1 pr-3.5 pl-1 text-sm font-semibold transition-colors hover:bg-muted"
                      >
                        <IconBubble icon={idea.icon} color={idea.color} size="sm" className="rounded-full" />
                        {t(`goals.idea_${idea.key}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            }
          />
        </Panel>
      ) : (
        <>
          {/* ─── Summary ─── */}
          <section className="@container relative mb-4 overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6 md:mb-6">
            <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-end">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/75">{t('goals.totalSaved')}</p>
                <p className="mt-1 truncate font-display fit-hero leading-tight font-semibold tabular">{fmt(summary.saved)}</p>
                {summary.target > 0 && (
                  <div className="mt-3 max-w-sm">
                    <ProgressBar value={summary.saved / summary.target} color="#fde68a" className="bg-white/20" />
                  </div>
                )}
                <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-white/80">
                  <span className="flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> {t('goals.activeCount', { count: summary.activeCount })}</span>
                  {summary.doneCount > 0 && <span>{t('goals.doneCount', { count: summary.doneCount })}</span>}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2 @xl:min-w-80">
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/75"><PiggyBank className="h-3.5 w-3.5" /> {t('goals.totalLeft')}</p>
                  <p className="mt-1 truncate font-display fit-md font-semibold tabular">{fmt(summary.left)}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-white/75"><TrendingUp className="h-3.5 w-3.5" /> {t('goals.avgSavings')}</p>
                  <p className="mt-1 truncate font-display fit-md font-semibold tabular">
                    {avgSavings !== 0 ? fmt(Math.round(avgSavings)) : '—'}
                  </p>
                  <p className="truncate text-[11px] text-white/70">{avgSavings !== 0 ? t('goals.avgSavingsHint') : t('goals.avgSavingsNone')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Toolbar ─── */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'board', label: <span className="flex items-center gap-1.5"><Columns3 className="h-4 w-4" /> {t('goals.viewBoard')}</span> },
                { value: 'list', label: <span className="flex items-center gap-1.5"><List className="h-4 w-4" /> {t('goals.viewList')}</span> },
              ]}
            />
          </div>

          {view === 'board' ? (
            <>
              {/* Phones: one column at a time */}
              <Segmented
                value={mobileTab}
                onChange={setMobileTab}
                className="mb-3 flex w-full md:hidden"
                options={STATUSES.map((s) => ({
                  value: s,
                  label: <>{t(`goals.status_${s}`)} <span className="ml-0.5 text-xs opacity-60 tabular">{byStatus[s].length}</span></>,
                }))}
              />
              <div className="grid gap-4 md:grid-cols-3 md:gap-4">
                {STATUSES.map((s) => (
                  <section
                    key={s}
                    aria-label={t(`goals.status_${s}`)}
                    className={cn('md:rounded-3xl md:bg-muted/50 md:p-2.5', s !== mobileTab && 'hidden md:block')}
                  >
                    <header className="mb-2.5 hidden items-center justify-between px-1.5 md:flex">
                      <h2 className="flex items-center gap-2 text-sm font-bold">
                        {t(`goals.status_${s}`)}
                        <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground tabular">{byStatus[s].length}</span>
                      </h2>
                      {s !== 'done' && (
                        <Button
                          variant="ghost" size="icon" className="h-9 w-9 rounded-xl"
                          onClick={() => openCreate({ status: s })} aria-label={t('goals.add')}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </header>
                    <div className="space-y-3">
                      {byStatus[s].length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-border px-4 py-8 text-center">
                          <p className="text-sm text-muted-foreground">{t(`goals.columnEmpty_${s}`)}</p>
                          {s !== 'done' && (
                            <Button variant="outline" size="sm" className="mt-3 h-10 rounded-xl" onClick={() => openCreate({ status: s })}>
                              <Plus className="h-4 w-4" /> {t('goals.add')}
                            </Button>
                          )}
                        </div>
                      ) : (
                        byStatus[s].map((g) => <GoalCard key={g.id} goal={g} {...cardProps} />)
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <Panel className="p-2 sm:p-3">
              <div className="-mx-1 mb-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
                <Segmented
                  value={listFilter}
                  onChange={setListFilter}
                  size="sm"
                  options={[
                    { value: 'all' as const, label: t('goals.filterAll') },
                    ...STATUSES.map((s) => ({ value: s, label: `${t(`goals.status_${s}`)} · ${byStatus[s].length}` })),
                  ]}
                />
              </div>
              {(() => {
                const rows = listFilter === 'all'
                  ? [...byStatus.saving, ...byStatus.wish, ...byStatus.done]
                  : byStatus[listFilter];
                if (rows.length === 0) {
                  return <p className="py-10 text-center text-sm text-muted-foreground">{t(`goals.columnEmpty_${listFilter === 'all' ? 'wish' : listFilter}`)}</p>;
                }
                return (
                  <ul className="divide-y divide-border">
                    {rows.map((g) => <GoalRow key={g.id} goal={g} {...cardProps} />)}
                  </ul>
                );
              })()}
            </Panel>
          )}
        </>
      )}

      {/* ─── Sheets & overlays ─── */}
      {form.key > 0 && (
        <GoalFormSheet
          key={form.key}
          open={form.open}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
          goal={form.goal && live(form.goal)}
          preset={form.preset}
          onDelete={handlers.onDelete}
        />
      )}
      {money && (
        <ContributeSheet
          key={money.key}
          open={money.open}
          onOpenChange={(open) => setMoney((m) => m && { ...m, open })}
          goal={live(money.goal)}
          initialMode={money.mode}
          onReached={celebrate}
        />
      )}
      {buy && (
        <PurchaseSheet
          key={buy.key}
          open={buy.open}
          onOpenChange={(open) => setBuy((b) => b && { ...b, open })}
          goal={live(buy.goal)}
          onDone={celebrate}
        />
      )}
      <Celebration burstKey={burst} onDone={stopCelebrate} />
      <ConfirmDialog
        {...confirm.props}
        title={t('goals.deleteTitle')}
        text={t('goals.deleteText', { title: pendingDelete?.title ?? '' })}
      />
    </PageContainer>
  );
}
