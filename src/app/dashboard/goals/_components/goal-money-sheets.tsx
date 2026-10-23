'use client';

import { useMemo, useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ResponsiveSheet } from '@/components/app/sheet';
import { Segmented } from '@/components/app/ui';
import { useAccounts, useCategories } from '@/hooks/use-finance';
import { useMoney } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import { IconBubble } from '@/lib/icons';
import { addTransaction, contributeToGoal, deleteTransaction, saveGoal } from '@/lib/actions';
import { DEBT_EXPENSE_CATEGORY_ID } from '@/lib/defaults';
import { useData } from '@/stores/data-store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Goal } from '@/lib/types';
import { AccountChips, AmountInput, QuickChips, findCreatedTx, parseAmount } from './money-fields';

export type MoneyMode = 'add' | 'withdraw';

// ─── Contribute / withdraw ───────────────────────────────────────────────────

/** Mount with a fresh `key` per opening. Calls `onReached` when the goal hits 100%. */
export function ContributeSheet({ open, onOpenChange, goal, initialMode = 'add', onReached }: {
  open: boolean; onOpenChange: (v: boolean) => void; goal: Goal; initialMode?: MoneyMode;
  onReached: (g: Goal) => void;
}) {
  const t = useT();
  const fmt = useMoney();
  const [mode, setMode] = useState<MoneyMode>(goal.saved > 0 ? initialMode : 'add');
  const [expr, setExpr] = useState('');
  const [accountId, setAccountId] = useState<string | undefined>();

  const left = Math.max(0, goal.target - goal.saved);
  const amount = parseAmount(expr);
  const chips = mode === 'add'
    ? [
      { key: '1k', label: fmt(1000), value: 1000 },
      { key: '5k', label: fmt(5000), value: 5000 },
      { key: '10k', label: fmt(10000), value: 10000 },
      { key: 'rest', label: `${t('goals.chipRemaining')} · ${fmt(left, { compact: true })}`, value: left },
    ]
    : [
      { key: '1k', label: fmt(1000), value: goal.saved >= 1000 ? 1000 : 0 },
      { key: '5k', label: fmt(5000), value: goal.saved >= 5000 ? 5000 : 0 },
      { key: 'all', label: `${t('goals.chipAll')} · ${fmt(goal.saved, { compact: true })}`, value: goal.saved },
    ];

  function submit() {
    if (!Number.isFinite(amount) || amount <= 0) return toast.error(t('common.invalidAmount'));
    if (mode === 'withdraw' && amount > goal.saved) return toast.error(t('goals.withdrawTooMuch'));

    const since = new Date().toISOString();
    const prev = goal;
    contributeToGoal(goal, mode === 'add' ? amount : -amount, accountId);

    const undo = () => {
      saveGoal(prev);
      if (accountId) {
        const tx = findCreatedTx((x) => x.goalId === prev.id, since);
        if (tx) deleteTransaction(tx);
      }
    };
    const reached = mode === 'add' && goal.saved < goal.target && goal.saved + amount >= goal.target;
    if (reached) {
      onReached(goal);
      toast.success(t('goals.celebrate', { title: goal.title }), {
        description: t('goals.celebrateText'),
        action: { label: t('common.undo'), onClick: undo },
      });
    } else {
      const key = mode === 'add' ? 'goals.contributed' : 'goals.withdrawn';
      toast.success(t(key, { amount: fmt(amount), title: goal.title }), { action: { label: t('common.undo'), onClick: undo } });
    }
    onOpenChange(false);
  }

  const hint = !accountId ? t('goals.noAccountHint') : mode === 'add' ? t('goals.fromAccountHint') : t('goals.toAccountHint');

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t(mode === 'add' ? 'goals.contributeTitle' : 'goals.withdrawTitle', { title: goal.title })}
      description={mode === 'add' ? t('goals.remaining', { amount: fmt(left) }) : t('goals.savedNow', { amount: fmt(goal.saved) })}
      footer={
        <Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={submit}>
          <Check className="h-5 w-5" /> {mode === 'add' ? t('goals.contribute') : t('goals.withdraw')}
        </Button>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {goal.saved > 0 && (
          <Segmented
            value={mode} onChange={setMode} className="w-full"
            options={[
              { value: 'add', label: t('goals.contribute'), className: 'text-income' },
              { value: 'withdraw', label: t('goals.withdraw'), className: 'text-expense' },
            ]}
          />
        )}
        <AmountInput
          value={expr} onChange={setExpr} tone={mode === 'add' ? 'income' : 'expense'}
          ariaLabel={t('common.amount')}
        />
        <QuickChips chips={chips} current={amount} onPick={(v) => setExpr(String(v))} />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            {mode === 'add' ? t('goals.fromAccount') : t('goals.toAccount')}
          </p>
          <AccountChips value={accountId} onChange={setAccountId} noneLabel={t('goals.noAccount')} />
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </form>
    </ResponsiveSheet>
  );
}

// ─── "Bought it" ─────────────────────────────────────────────────────────────

/** Marks a goal done and optionally records the purchase as an expense. Mount with a fresh `key`. */
export function PurchaseSheet({ open, onOpenChange, goal, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void; goal: Goal; onDone: (g: Goal) => void;
}) {
  const t = useT();
  const transactions = useData((s) => s.transactions);
  const { active: accounts } = useAccounts();
  const { byKind, label } = useCategories();
  const expenseCats = byKind('expense');

  // If money was already moved out of accounts for this goal, recording the purchase would double-count it.
  const alreadyDebited = useMemo(() => transactions.some((x) => x.goalId === goal.id), [transactions, goal.id]);
  const [record, setRecord] = useState(!alreadyDebited && accounts.length > 0);
  const [expr, setExpr] = useState(String(goal.target));
  const [accountId, setAccountId] = useState<string | undefined>(accounts[0]?.id);
  const [categoryId, setCategoryId] = useState(
    expenseCats.find((c) => c.id === DEBT_EXPENSE_CATEGORY_ID)?.id ?? expenseCats[0]?.id,
  );

  function submit() {
    const amount = parseAmount(expr);
    if (record && (!Number.isFinite(amount) || amount <= 0)) return toast.error(t('common.invalidAmount'));
    if (record && !accountId) return toast.error(t('tx.pickAccount'));

    const prev = goal;
    saveGoal({ ...goal, status: 'done', completedAt: new Date().toISOString() });
    const tx = record && accountId
      ? addTransaction({
        kind: 'expense', amount, accountId, categoryId, note: goal.title, date: todayISO(), goalId: goal.id,
      })
      : undefined;

    onDone(goal);
    toast.success(t('goals.purchased', { title: goal.title }), {
      action: {
        label: t('common.undo'),
        onClick: () => { saveGoal(prev); if (tx) deleteTransaction(tx); },
      },
    });
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('goals.purchaseTitle', { title: goal.title })}
      description={t('goals.purchaseText')}
      footer={
        <Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={submit}>
          <ShoppingBag className="h-5 w-5" /> {t('goals.purchaseConfirm')}
        </Button>
      }
    >
      <div className="space-y-4">
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
          <span className="text-sm font-semibold">{t('goals.recordExpense')}</span>
          <Switch checked={record} onCheckedChange={setRecord} disabled={accounts.length === 0} />
        </label>
        {alreadyDebited && <p className="text-xs text-muted-foreground">{t('goals.recordExpenseHint')}</p>}

        {record && (
          <>
            <AmountInput value={expr} onChange={setExpr} tone="expense" ariaLabel={t('common.amount')} />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">{t('common.account')}</p>
              <AccountChips value={accountId} onChange={setAccountId} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">{t('goals.pickCategory')}</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
                {expenseCats.map((c) => {
                  const on = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCategoryId(c.id)}
                      className={cn(
                        'flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border py-1.5 pr-3 pl-1.5 text-xs font-semibold transition-colors',
                        on ? 'border-transparent' : 'border-border hover:bg-muted',
                      )}
                      style={on ? { backgroundColor: `${c.color}1F`, borderColor: c.color } : undefined}
                    >
                      <IconBubble icon={c.icon} color={c.color} size="sm" className="h-7 w-7" />
                      {label(c)}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </ResponsiveSheet>
  );
}
