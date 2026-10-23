'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, HandCoins, MessageCircle, Send, Share2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/app/sheet';
import { Field, Segmented } from '@/components/app/ui';
import { useAccounts } from '@/hooks/use-finance';
import { useMoney } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import {
  addTransaction, deleteDebt, deleteTransaction, newId, repayDebt, saveDebt,
} from '@/lib/actions';
import { DEBT_EXPENSE_CATEGORY_ID, DEBT_INCOME_CATEGORY_ID } from '@/lib/defaults';
import { useAuthStore } from '@/stores/auth-store';
import { useData } from '@/stores/data-store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Debt, DebtDirection } from '@/lib/types';
import {
  AccountChips, AmountInput, QuickChips, findCreatedTx, parseAmount,
} from '@/app/dashboard/goals/_components/money-fields';
import { PersonAvatar, personKey, remainingOf } from './person-card';

interface SheetBase {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Create / edit ───────────────────────────────────────────────────────────

/** Mount with a fresh `key` per opening. */
export function DebtFormSheet({ open, onOpenChange, debt, direction: initialDirection = 'owed_to_me', onDelete }: SheetBase & {
  debt?: Debt; direction?: DebtDirection; onDelete?: (d: Debt) => void;
}) {
  const t = useT();
  const fmt = useMoney();
  const allDebts = useData((s) => s.debts);
  const { active: accounts } = useAccounts();

  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? initialDirection);
  const [person, setPerson] = useState(debt?.personName ?? '');
  const [expr, setExpr] = useState(debt ? String(debt.amount) : '');
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? '');
  const [note, setNote] = useState(debt?.note ?? '');
  const [viaAccount, setViaAccount] = useState(false);
  const [accountId, setAccountId] = useState<string | undefined>(accounts[0]?.id);

  // Names used before, most recent first; filtered by what is typed.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const d of [...allDebts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const k = personKey(d.personName);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      names.push(d.personName.trim());
    }
    const q = personKey(person);
    return names.filter((n) => personKey(n) !== q && (!q || personKey(n).includes(q))).slice(0, 8);
  }, [allDebts, person]);

  function submit() {
    const amount = parseAmount(expr);
    const name = person.trim();
    if (!name) return toast.error(t('debts.personRequired'));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error(t('common.invalidAmount'));

    if (debt) {
      if (amount < (debt.paid ?? 0)) return toast.error(t('debts.amountBelowPaid', { amount: fmt(debt.paid) }));
      const prev = debt;
      saveDebt({
        ...debt, direction, personName: name, amount, dueDate: dueDate || undefined, note: note.trim() || undefined,
        settled: (debt.paid ?? 0) >= amount,
      });
      toast.success(t('debts.updated'), { action: { label: t('common.undo'), onClick: () => saveDebt(prev) } });
      onOpenChange(false);
      return;
    }

    if (viaAccount && !accountId) return toast.error(t('tx.pickAccount'));
    const created: Debt = {
      id: newId('debt'), personName: name, direction, amount, paid: 0, payments: [],
      dueDate: dueDate || undefined, note: note.trim() || undefined, settled: false,
      createdAt: new Date().toISOString(),
    };
    saveDebt(created);
    // Lending money out = expense from the account; borrowing = income.
    const tx = viaAccount && accountId
      ? addTransaction({
        kind: direction === 'owed_to_me' ? 'expense' : 'income',
        amount,
        accountId,
        categoryId: direction === 'owed_to_me' ? DEBT_EXPENSE_CATEGORY_ID : DEBT_INCOME_CATEGORY_ID,
        note: name,
        date: todayISO(),
        debtId: created.id,
      })
      : undefined;
    toast.success(t('debts.created'), {
      action: { label: t('common.undo'), onClick: () => { deleteDebt(created.id); if (tx) deleteTransaction(tx); } },
    });
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={debt ? t('debts.editTitle') : t('debts.newTitle')}
      footer={
        <div className="flex gap-2">
          {debt && onDelete && (
            <Button
              variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-2xl text-destructive"
              onClick={() => onDelete(debt)} aria-label={t('common.delete')}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button className="h-12 flex-1 rounded-2xl text-base font-bold" onClick={submit}>
            <Check className="h-5 w-5" /> {t('common.save')}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Segmented
          value={direction} onChange={setDirection} className="w-full"
          options={[
            { value: 'owed_to_me', label: t('debts.dirLent'), className: 'text-income' },
            { value: 'i_owe', label: t('debts.dirBorrowed'), className: 'text-expense' },
          ]}
        />

        <AmountInput
          value={expr} onChange={setExpr} tone={direction === 'owed_to_me' ? 'income' : 'expense'}
          ariaLabel={t('common.amount')}
        />

        <div className="space-y-2">
          <Field label={t('debts.person')}>
            <Input
              value={person} onChange={(e) => setPerson(e.target.value)} placeholder={t('debts.personPlaceholder')}
              className="h-11 rounded-xl" maxLength={40} autoComplete="off"
            />
          </Field>
          {suggestions.length > 0 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {suggestions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPerson(n)}
                  className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-xs font-semibold hover:bg-muted"
                >
                  <PersonAvatar name={n} className="h-7 w-7 text-[10px]" /> {n}
                </button>
              ))}
            </div>
          )}
        </div>

        <Field label={t('debts.dueDate')}>
          <div className="flex gap-2">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 flex-1 rounded-xl" />
            {dueDate && (
              <Button
                type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl"
                onClick={() => setDueDate('')} aria-label={t('debts.clearDate')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Field>

        <Field label={t('common.note')}>
          <Textarea
            value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('common.notePlaceholder')}
            className="min-h-16 rounded-xl" maxLength={200}
          />
        </Field>

        {!debt && accounts.length > 0 && (
          <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
            <label className="flex min-h-10 items-center justify-between gap-3">
              <span className="text-sm font-semibold">{t('debts.viaAccount')}</span>
              <Switch checked={viaAccount} onCheckedChange={setViaAccount} />
            </label>
            {viaAccount && (
              <>
                <AccountChips value={accountId} onChange={setAccountId} />
                <p className="text-xs text-muted-foreground">
                  {direction === 'owed_to_me' ? t('debts.viaAccountLend') : t('debts.viaAccountBorrow')}
                </p>
              </>
            )}
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </ResponsiveSheet>
  );
}

// ─── Repay ───────────────────────────────────────────────────────────────────

/** Partial or full repayment. Mount with a fresh `key` per opening. */
export function RepaySheet({ open, onOpenChange, debt }: SheetBase & { debt: Debt }) {
  const t = useT();
  const fmt = useMoney();
  const remaining = remainingOf(debt);
  const [expr, setExpr] = useState('');
  const [accountId, setAccountId] = useState<string | undefined>();
  const amount = parseAmount(expr);
  const owedToMe = debt.direction === 'owed_to_me';

  function pay(value: number) {
    if (!Number.isFinite(value) || value <= 0) return toast.error(t('common.invalidAmount'));
    if (value > remaining + 0.001) return toast.error(t('debts.repayTooMuch'));

    const since = new Date().toISOString();
    const prev = debt;
    repayDebt(debt, value, accountId);
    const undo = () => {
      saveDebt(prev);
      if (accountId) {
        const tx = findCreatedTx((x) => x.debtId === prev.id, since);
        if (tx) deleteTransaction(tx);
      }
    };
    const settled = value >= remaining;
    toast.success(settled ? t('debts.settled', { name: debt.personName }) : t('debts.repaid', { amount: fmt(value) }), {
      action: { label: t('common.undo'), onClick: undo },
    });
    onOpenChange(false);
  }

  const half = Math.round(remaining / 2);
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('debts.repayTitle', { name: debt.personName })}
      description={t('debts.remaining', { amount: fmt(remaining) })}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="h-12 rounded-2xl font-semibold sm:flex-1" onClick={() => pay(remaining)}>
            <Check className="h-5 w-5" /> {t('debts.repayFull')}
          </Button>
          <Button className="h-12 rounded-2xl text-base font-bold sm:flex-1" onClick={() => pay(amount)}>
            <HandCoins className="h-5 w-5" /> {t('debts.repay')}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay(amount); }}>
        <AmountInput value={expr} onChange={setExpr} tone={owedToMe ? 'income' : 'expense'} ariaLabel={t('common.amount')} />
        <QuickChips
          current={amount}
          onPick={(v) => setExpr(String(v))}
          chips={[
            { key: 'q', label: `25% · ${fmt(Math.round(remaining / 4), { compact: true })}`, value: remaining >= 4 ? Math.round(remaining / 4) : 0 },
            { key: 'h', label: `50% · ${fmt(half, { compact: true })}`, value: remaining >= 2 ? half : 0 },
            { key: 'f', label: `100% · ${fmt(remaining, { compact: true })}`, value: remaining },
          ]}
        />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">{owedToMe ? t('debts.accountReceive') : t('debts.accountPay')}</p>
          <AccountChips value={accountId} onChange={setAccountId} noneLabel={t('debts.noAccount')} />
          <p className="text-xs text-muted-foreground">{accountId ? t('debts.accountHint') : t('debts.noAccountHint')}</p>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </ResponsiveSheet>
  );
}

// ─── Remind ──────────────────────────────────────────────────────────────────

/** Polite pre-filled reminder; share, WhatsApp, Telegram or copy. Mount with a fresh `key`. */
export function RemindSheet({ open, onOpenChange, name, amount }: SheetBase & { name: string; amount: number }) {
  const t = useT();
  const fmt = useMoney();
  const kaspi = useAuthStore((s) => s.currentUser?.kaspiNumber?.trim());
  const firstName = name.split(/\s+/)[0] || name;
  const [text, setText] = useState(() => {
    const base = t('debts.remindMsg', { name: firstName, amount: fmt(amount) });
    return kaspi ? `${base}\n${t('debts.remindKaspi', { kaspi })}` : base;
  });
  const [canShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  const encoded = encodeURIComponent(text);

  async function share() {
    try {
      await navigator.share({ text });
    } catch {
      /* user cancelled — nothing to do */
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('debts.copied'));
    } catch {
      toast.error(t('debts.copyFailed'));
    }
  }

  const linkCls = 'flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90';

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('debts.remindTitle', { name })}
      description={t('debts.remindHint')}
    >
      <div className="space-y-3">
        <Textarea
          value={text} onChange={(e) => setText(e.target.value)} aria-label={t('debts.remind')}
          className="min-h-28 rounded-2xl text-[15px]"
        />
        {!kaspi && <p className="text-xs text-muted-foreground">{t('debts.remindKaspiTip')}</p>}
        <div className="grid grid-cols-2 gap-2">
          {canShare && (
            <Button className="col-span-2 h-11 rounded-2xl font-bold" onClick={share}>
              <Share2 className="h-4 w-4" /> {t('debts.share')}
            </Button>
          )}
          {/* Brand colours of the messengers are intentional here. */}
          <a href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer" className={cn(linkCls, 'bg-[#25D366]')}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <a href={`https://t.me/share/url?url=&text=${encoded}`} target="_blank" rel="noopener noreferrer" className={cn(linkCls, 'bg-[#229ED9]')}>
            <Send className="h-4 w-4" /> Telegram
          </a>
          <Button variant="outline" className="col-span-2 h-11 rounded-2xl font-semibold" onClick={copy}>
            <Copy className="h-4 w-4" /> {t('debts.copy')}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
