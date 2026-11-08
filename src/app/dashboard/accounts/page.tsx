'use client';

import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import {
  Archive, ArchiveRestore, ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Banknote, ChevronDown, ChevronRight,
  CreditCard, Landmark, Pencil, PiggyBank, Plus, Receipt, Scale, Search, Trash2, Wallet,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog, EmptyState, Field, Money, PageContainer, PageHeader, Panel, useConfirm } from '@/components/app/ui';
import { ResponsiveSheet } from '@/components/app/sheet';
import { ColorPicker, IconPicker } from '@/components/app/pickers';
import { TransactionRow } from '@/components/app/transaction-list';
import { useData } from '@/stores/data-store';
import { useQuickAdd } from '@/stores/ui-store';
import { useBalances } from '@/hooks/use-finance';
import { evalAmount, useMoney } from '@/lib/format';
import { monthRange, inRange, toDay, todayISO } from '@/lib/dates';
import { addTransaction, deleteAccount, deleteTransaction, newId, saveAccount } from '@/lib/actions';
import { DEBT_EXPENSE_CATEGORY_ID, DEBT_INCOME_CATEGORY_ID } from '@/lib/defaults';
import { PALETTE } from '@/lib/icons';
import { BANKS, getBank, suggestName, type Bank } from '@/lib/banks';
import { AccountAvatar, accountBackground } from '@/components/app/account-picker';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Account, AccountType, Transaction } from '@/lib/types';

const TYPES: AccountType[] = ['card', 'cash', 'deposit', 'savings', 'credit', 'other'];
const TYPE_ICON: Record<AccountType, string> = { card: 'card', cash: 'cash', savings: 'piggy', deposit: 'bank', credit: 'receipt', other: 'wallet' };
const TYPE_LUCIDE: Record<AccountType, LucideIcon> = { card: CreditCard, cash: Banknote, savings: PiggyBank, deposit: Landmark, credit: Receipt, other: Wallet };
/** Types that belong to a bank (show the bank picker). */
const BANK_TYPES: AccountType[] = ['card', 'savings', 'deposit', 'credit'];
/** Page sections, in display order. */
const SECTIONS: { key: string; types: AccountType[] }[] = [
  { key: 'card', types: ['card'] },
  { key: 'cash', types: ['cash'] },
  { key: 'savings', types: ['savings', 'deposit'] },
  { key: 'credit', types: ['credit'] },
  { key: 'other', types: ['other'] },
];

/** Signed effect of a transaction on one account. */
function delta(tx: Transaction, accountId: string): number {
  if (tx.kind === 'income') return tx.accountId === accountId ? tx.amount : 0;
  if (tx.kind === 'expense') return tx.accountId === accountId ? -tx.amount : 0;
  let d = 0;
  if (tx.accountId === accountId) d -= tx.amount;
  if (tx.toAccountId === accountId) d += tx.amount;
  return d;
}

const touches = (tx: Transaction, id: string) => tx.accountId === id || tx.toAccountId === id;

interface AccountInfo {
  account: Account;
  balance: number;
  monthIn: number;
  monthOut: number;
  spark: number[];
  txs: Transaction[];
}

/** Balance at the end of each of the last `days` days (oldest first). */
function balanceSpark(balance: number, txs: Transaction[], accountId: string, days = 30): number[] {
  const today = new Date();
  const byDay = new Map<string, number>();
  for (const tx of txs) {
    const d = tx.date.slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + delta(tx, accountId));
  }
  const out: number[] = [];
  let bal = balance;
  for (let i = 0; i < days; i++) {
    const day = toDay(addDays(today, -i));
    out.push(bal);
    bal -= byDay.get(day) ?? 0;
  }
  return out.reverse();
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─── Account card ────────────────────────────────────────────────────────────

function AccountCard({ info, onOpen }: { info: AccountInfo; onOpen: () => void }) {
  const t = useT();
  const fmt = useMoney();
  const { account: a, balance, monthIn, monthOut, spark } = info;
  const hasMovement = spark.some((v) => v !== spark[0]);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'relative flex min-h-44 w-full flex-col overflow-hidden rounded-3xl p-4 text-left text-white shadow-lg shadow-black/10 transition-transform active:scale-[0.98] sm:p-5',
        a.archived && 'opacity-60 grayscale-[40%]',
      )}
      style={accountBackground(a)}
    >
      <div className="pointer-events-none absolute -right-8 -bottom-12 h-36 w-36 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex items-start gap-3">
        <AccountAvatar account={a} size="md" onDark />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{a.name}</p>
          <p className="truncate text-xs text-white/75">
            {[getBank(a.bankId)?.name, t(`enums.acc_${a.type}`)].filter(Boolean).join(' · ')}
            {a.rate ? ` · ${a.rate}%` : ''}
          </p>
        </div>
        {a.type === 'credit' ? (
          <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-semibold">{t('acc.creditBadge')}</span>
        ) : a.excludeFromTotal && (
          <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold">{t('acc.excludedBadge')}</span>
        )}
      </div>
      <div className="relative mt-auto pt-5">
        <p className="truncate font-display fit-lg leading-tight font-semibold tabular">{fmt(balance)}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-white/80 tabular">
            {t('acc.monthFlow')}: {fmt(monthIn, { sign: true, compact: true })} / {fmt(-monthOut, { compact: true })}
          </p>
          {hasMovement && <Sparkline values={spark} className="h-7 w-20 shrink-0 text-white/85" />}
        </div>
      </div>
    </button>
  );
}

// ─── Create / edit sheet ─────────────────────────────────────────────────────

type Step = 'type' | 'bank' | 'details';

function TypeStep({ onPick }: { onPick: (t: AccountType) => void }) {
  const t = useT();
  return (
    <div className="grid gap-2">
      {TYPES.map((v) => {
        const Icon = TYPE_LUCIDE[v];
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t(`acc.t_${v}`)}</span>
              <span className="block truncate text-xs text-muted-foreground">{t(`acc.t_${v}_d`)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

function BankStep({ onPick }: { onPick: (b: Bank | null) => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const list = BANKS.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('acc.searchBank')} className="h-11 rounded-xl pl-9" />
      </div>
      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
        {list.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-border px-1 py-3 text-center transition-colors hover:bg-muted active:scale-[0.98]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logo} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-0.5 shadow-sm" />
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{b.short ?? b.name}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPick(null)}
          className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border px-1 py-3 text-center transition-colors hover:bg-muted"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><Landmark className="h-5 w-5 text-muted-foreground" /></span>
          <span className="text-[11px] font-semibold leading-tight">{t('acc.otherBank')}</span>
        </button>
      </div>
    </div>
  );
}

function AccountForm({ open, onOpenChange, account, nextOrder }: {
  open: boolean; onOpenChange: (v: boolean) => void; account: Account | null; nextOrder: number;
}) {
  const t = useT();
  const fmt = useMoney();
  const isCredit0 = account?.type === 'credit';
  const [step, setStep] = useState<Step>(account ? 'details' : 'type');
  const [type, setType] = useState<AccountType>(account?.type ?? 'card');
  const [bankId, setBankId] = useState<string | undefined>(account?.bankId);
  const [name, setName] = useState(account?.name ?? '');
  const [icon, setIcon] = useState(account?.icon ?? 'card');
  const [color, setColor] = useState(account?.color ?? PALETTE[2]);
  // Credits are entered as a positive "amount owed" and stored as a negative balance.
  const [initial, setInitial] = useState(account ? String(Math.abs(account.initialBalance ?? 0) * (isCredit0 ? 1 : Math.sign(account.initialBalance || 1))) : '');
  const [rate, setRate] = useState(account?.rate ? String(account.rate) : '');
  const [exclude, setExclude] = useState(account?.excludeFromTotal ?? false);
  const bank = getBank(bankId);

  const pickType = (v: AccountType) => {
    setType(v);
    setIcon(TYPE_ICON[v]);
    setExclude(v === 'deposit' || v === 'savings' || v === 'credit');
    if (BANK_TYPES.includes(v)) setStep('bank');
    else {
      setBankId(undefined);
      setName(v === 'cash' ? t('enums.defaultCash') : '');
      setStep('details');
    }
  };

  const pickBank = (b: Bank | null) => {
    setBankId(b?.id);
    if (b) {
      // Keep a name the user typed; otherwise suggest the bank's product name.
      if (!name.trim() || BANKS.some((x) => Object.values(x.products).flat().includes(name))) setName(suggestName(b, type));
      setColor(b.colors[0]);
    }
    setStep('details');
  };

  const submit = () => {
    if (!name.trim()) return toast.error(t('acc.nameRequired'));
    let initialBalance = initial.trim() ? evalAmount(initial) : 0;
    if (!Number.isFinite(initialBalance)) return toast.error(t('acc.invalidNumber'));
    if (type === 'credit') initialBalance = -Math.abs(initialBalance);
    const r = rate.trim() ? Number(rate.replace(',', '.')) : undefined;
    const data: Account = {
      id: account?.id ?? newId('acc'),
      name: name.trim(),
      type, icon, color, initialBalance,
      bankId,
      rate: r && Number.isFinite(r) && r > 0 ? r : undefined,
      order: account?.order ?? nextOrder,
      archived: account?.archived,
      excludeFromTotal: exclude || undefined,
      createdAt: account?.createdAt ?? new Date().toISOString(),
    };
    saveAccount(data);
    toast.success(account ? t('common.saved') : t('acc.created'));
    onOpenChange(false);
  };

  const back = step === 'details' && !account ? (BANK_TYPES.includes(type) ? 'bank' : 'type') : step === 'bank' ? (account ? 'details' : 'type') : null;
  const title = step === 'type' ? t('acc.whatAdd') : step === 'bank' ? t('acc.chooseBank') : account ? t('acc.editTitle') : t(`acc.t_${type}`);
  const amount = initial.trim() ? evalAmount(initial) : 0;
  const yearly = Number(rate.replace(',', '.')) > 0 && Number.isFinite(amount) ? (Math.abs(amount) * Number(rate.replace(',', '.'))) / 100 : 0;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          {back && (
            <button type="button" onClick={() => setStep(back)} aria-label={t('common.back')} className="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {title}
        </span>
      }
      footer={step === 'details' ? <Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={submit}>{t('common.save')}</Button> : undefined}
    >
      {step === 'type' && <TypeStep onPick={pickType} />}
      {step === 'bank' && <BankStep onPick={pickBank} />}
      {step === 'details' && (
        <div className="space-y-4">
          {/* Live preview */}
          <div className="flex items-center gap-3 rounded-2xl p-3 text-white" style={accountBackground({ color, bankId })}>
            <AccountAvatar account={{ icon, color, bankId }} size="md" onDark />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{name || t('acc.namePlaceholder')}</p>
              <p className="truncate text-xs text-white/75">{[bank?.name, t(`enums.acc_${type}`)].filter(Boolean).join(' · ')}</p>
            </div>
            {BANK_TYPES.includes(type) && (
              <button type="button" onClick={() => setStep('bank')} className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30">
                {t('acc.changeBank')}
              </button>
            )}
          </div>

          <Field label={t('acc.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('acc.namePlaceholder')} className="h-11 rounded-xl" maxLength={40} />
          </Field>

          <Field
            label={type === 'credit' ? t('acc.creditDebt') : t('acc.initialBalance')}
            hint={type === 'credit' ? t('acc.creditDebtHint') : t('acc.initialBalanceHint')}
          >
            <Input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" placeholder="0" className="h-11 rounded-xl tabular" />
          </Field>

          {(type === 'deposit' || type === 'savings' || type === 'credit') && (
            <Field label={t('acc.rate')} hint={yearly > 0 ? t('acc.perYear', { amount: fmt(Math.round(yearly)) }) : t('acc.rateHint')}>
              <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="14" className="h-11 rounded-xl tabular" />
            </Field>
          )}

          {type !== 'credit' && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t('acc.exclude')}</span>
                <span className="block text-xs text-muted-foreground">{t('acc.excludeHint')}</span>
              </span>
              <Switch checked={exclude} onCheckedChange={setExclude} aria-label={t('acc.exclude')} />
            </label>
          )}

          {!bank && (
            <>
              <div className="space-y-1.5">
                <p className="text-[13px] font-semibold text-foreground/80">{t('common.icon')}</p>
                <IconPicker value={icon} onChange={setIcon} color={color} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[13px] font-semibold text-foreground/80">{t('common.color')}</p>
                <ColorPicker value={color} onChange={setColor} />
              </div>
            </>
          )}
        </div>
      )}
    </ResponsiveSheet>
  );
}

// ─── Balance adjustment ──────────────────────────────────────────────────────

function AdjustSheet({ account, current, open, onOpenChange }: {
  account: Account; current: number; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const t = useT();
  const fmt = useMoney();
  const [expr, setExpr] = useState('');
  const real = expr.trim() ? evalAmount(expr) : NaN;
  const diff = Number.isFinite(real) ? Math.round((real - current) * 100) / 100 : 0;

  const apply = () => {
    if (!Number.isFinite(real)) return toast.error(t('acc.invalidNumber'));
    if (diff === 0) {
      toast(t('acc.adjustNoChange'));
      return onOpenChange(false);
    }
    const tx = addTransaction({
      kind: diff > 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      categoryId: diff > 0 ? DEBT_INCOME_CATEGORY_ID : DEBT_EXPENSE_CATEGORY_ID,
      accountId: account.id,
      note: t('acc.adjustNote'),
      date: todayISO(),
      adjustment: true,
    });
    toast.success(t('acc.adjustDone'), { action: { label: t('common.undo'), onClick: () => deleteTransaction(tx) } });
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('acc.adjustTitle')}
      description={t('acc.adjustText')}
      footer={<Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={apply}>{t('acc.adjustApply')}</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
          <span className="text-sm text-muted-foreground">{t('acc.adjustCurrent')}</span>
          <span className="font-bold tabular">{fmt(current)}</span>
        </div>
        <Field label={t('acc.adjustReal')}>
          <Input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
            inputMode="decimal"
            placeholder={String(Math.round(current))}
            className="h-12 rounded-xl font-display text-xl tabular"
            autoFocus
          />
        </Field>
        {Number.isFinite(real) && (
          <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
            <span className="text-sm text-muted-foreground">{t('acc.adjustDiff')}</span>
            <Money value={diff} kind={diff === 0 ? undefined : 'auto'} className="font-bold" />
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}

// ─── Detail sheet ────────────────────────────────────────────────────────────

function AccountDetail({ info, onClose, onEdit }: { info: AccountInfo; onClose: () => void; onEdit: () => void }) {
  const t = useT();
  const fmt = useMoney();
  const openAdd = useQuickAdd((s) => s.openAdd);
  const confirm = useConfirm();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { account: a, balance, monthIn, monthOut, txs } = info;

  const toggleArchive = () => {
    const next = { ...a, archived: !a.archived || undefined };
    saveAccount(next);
    toast.success(a.archived ? t('acc.unarchivedToast') : t('acc.archivedToast'), {
      action: { label: t('common.undo'), onClick: () => saveAccount(a) },
    });
    onClose();
  };

  const askDelete = () => {
    if (txs.length > 0) {
      toast.error(t('acc.cantDelete'), a.archived ? undefined : { action: { label: t('acc.archive'), onClick: toggleArchive } });
      return;
    }
    confirm.ask(() => {
      deleteAccount(a.id);
      toast(t('acc.deletedToast'), { action: { label: t('common.undo'), onClick: () => saveAccount(a) } });
      onClose();
    });
  };

  const actions = [
    { key: 'edit', icon: Pencil, label: t('common.edit'), onClick: onEdit },
    { key: 'adjust', icon: Scale, label: t('acc.adjust'), onClick: () => setAdjustOpen(true) },
    { key: 'transfer', icon: ArrowLeftRight, label: t('acc.transfer'), onClick: () => { onClose(); openAdd('transfer'); } },
    { key: 'archive', icon: a.archived ? ArchiveRestore : Archive, label: a.archived ? t('acc.unarchive') : t('acc.archive'), onClick: toggleArchive },
  ];

  return (
    <>
      <ResponsiveSheet open onOpenChange={(v) => !v && onClose()} title={a.name} description={t(`enums.acc_${a.type}`)}>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl p-4 text-white" style={accountBackground(a)}>
            <div className="flex items-center gap-3">
              <AccountAvatar account={a} size="md" onDark />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/75">{t('acc.balance')}</p>
                <p className="truncate font-display fit-lg font-semibold tabular">{fmt(balance)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/15 px-3 py-2">
                <p className="flex items-center gap-1 text-white/75"><ArrowDownLeft className="h-3.5 w-3.5" /> {t('acc.incomeMonth')}</p>
                <p className="mt-0.5 truncate text-sm font-bold tabular">{fmt(monthIn, { sign: true })}</p>
              </div>
              <div className="rounded-xl bg-white/15 px-3 py-2">
                <p className="flex items-center gap-1 text-white/75"><ArrowUpRight className="h-3.5 w-3.5" /> {t('acc.expenseMonth')}</p>
                <p className="mt-0.5 truncate text-sm font-bold tabular">{fmt(-monthOut)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2" aria-label={t('acc.actions')}>
            {actions.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={x.onClick}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border px-1 py-2.5 text-[11px] font-semibold leading-tight hover:bg-muted"
              >
                <x.icon className="h-4.5 w-4.5 text-primary" />
                <span className="line-clamp-2 text-center">{x.label}</span>
              </button>
            ))}
          </div>

          <div>
            <p className="mb-1 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('acc.recent')}</p>
            {txs.length === 0 ? (
              <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">{t('acc.noTransactions')}</p>
            ) : (
              // Opening a transaction hands over to the quick-add sheet.
              <div className="-mx-2" onClick={onClose}>
                {txs.slice(0, 20).map((tx) => <TransactionRow key={tx.id} tx={tx} showDate accountId={a.id} />)}
              </div>
            )}
          </div>

          <Button variant="ghost" className="h-11 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={askDelete}>
            <Trash2 className="h-4 w-4" /> {t('common.delete')}
          </Button>
        </div>
      </ResponsiveSheet>
      {adjustOpen && <AdjustSheet account={a} current={balance} open={adjustOpen} onOpenChange={setAdjustOpen} />}
      <ConfirmDialog {...confirm.props} title={t('acc.deleteTitle')} text={t('acc.deleteText', { name: a.name })} />
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const t = useT();
  const fmt = useMoney();
  const accounts = useData((s) => s.accounts);
  const transactions = useData((s) => s.transactions);
  const openAdd = useQuickAdd((s) => s.openAdd);
  const { balances, total, spendable } = useBalances();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; account: Account | null; key: number }>({ open: false, account: null, key: 0 });
  const [showArchived, setShowArchived] = useState(false);

  const infos = useMemo(() => {
    const range = monthRange(0);
    return accounts.map<AccountInfo>((a) => {
      const txs = transactions.filter((tx) => touches(tx, a.id));
      let monthIn = 0;
      let monthOut = 0;
      for (const tx of txs) {
        if (!inRange(tx.date, range)) continue;
        const d = delta(tx, a.id);
        if (d > 0) monthIn += d;
        else monthOut -= d;
      }
      const balance = balances[a.id] ?? 0;
      return { account: a, balance, monthIn, monthOut, txs, spark: balanceSpark(balance, txs, a.id) };
    });
  }, [accounts, transactions, balances]);

  const active = infos.filter((i) => !i.account.archived);
  const savingsSum = active.filter((i) => i.account.excludeFromTotal && i.account.type !== 'credit').reduce((a, i) => a + i.balance, 0);
  const creditSum = active.filter((i) => i.account.type === 'credit').reduce((a, i) => a + i.balance, 0);
  const archived = infos.filter((i) => i.account.archived);
  const detail = infos.find((i) => i.account.id === detailId) ?? null;
  const nextOrder = accounts.reduce((m, a) => Math.max(m, a.order), -1) + 1;

  const openForm = (account: Account | null) => setForm((f) => ({ open: true, account, key: f.key + 1 }));

  return (
    <PageContainer>
      <PageHeader
        title={t('acc.title')}
        subtitle={t('acc.subtitle')}
        actions={
          <>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl sm:w-auto sm:px-3" onClick={() => openAdd('transfer')} aria-label={t('acc.transfer')}>
              <ArrowLeftRight className="h-4 w-4" /> <span className="hidden sm:inline">{t('acc.transfer')}</span>
            </Button>
            <Button className="h-10 rounded-xl" onClick={() => openForm(null)}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('acc.add')}</span><span className="sm:hidden">{t('acc.addShort')}</span>
            </Button>
          </>
        }
      />

      {/* Hero */}
      <section className="@container relative mb-5 overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid grid-cols-1 gap-4 @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-end">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/75">{t('acc.netWorth')}</p>
            <p className="mt-1 truncate font-display fit-hero leading-tight font-semibold tabular">{fmt(total)}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2 @xl:min-w-72">
            <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
              <p className="truncate text-xs font-medium text-white/75">{t('acc.spendable')}</p>
              <p className="mt-0.5 truncate font-display fit-md font-semibold tabular">{fmt(spendable)}</p>
            </div>
            <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
              <p className="truncate text-xs font-medium text-white/75">{t('acc.reserved')}</p>
              <p className="mt-0.5 truncate font-display fit-md font-semibold tabular">{fmt(savingsSum)}</p>
            </div>
            {creditSum < 0 && (
              <div className="rounded-2xl bg-black/20 p-3 backdrop-blur-sm min-[340px]:col-span-2">
                <p className="truncate text-xs font-medium text-white/75">{t('acc.debtsTotal')}</p>
                <p className="mt-0.5 truncate font-display fit-md font-semibold tabular text-rose-100">{fmt(creditSum)}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {active.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Wallet}
            title={t('acc.emptyTitle')}
            text={t('acc.emptyText')}
            action={<Button className="rounded-xl" onClick={() => openForm(null)}><Plus className="h-4 w-4" /> {t('acc.add')}</Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((sec) => {
            const items = active.filter((i) => sec.types.includes(i.account.type));
            if (items.length === 0) return null;
            const sum = items.reduce((acc, i) => acc + i.balance, 0);
            return (
              <section key={sec.key}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{t(`acc.sec_${sec.key}`)}</h2>
                  <Money value={sum} kind={sum < 0 ? 'auto' : undefined} className="text-sm font-bold" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                  {items.map((info) => <AccountCard key={info.account.id} info={info} onOpen={() => setDetailId(info.account.id)} />)}
                </div>
              </section>
            );
          })}
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex min-h-24 w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-foreground"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted"><Plus className="h-5 w-5" /></span>
            {t('acc.add')}
          </button>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            <Archive className="h-4 w-4" />
            {t('acc.archivedCount', { count: archived.length })}
            <ChevronDown className={cn('h-4 w-4 transition-transform', showArchived && 'rotate-180')} />
          </button>
          {showArchived && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {archived.map((info) => <AccountCard key={info.account.id} info={info} onOpen={() => setDetailId(info.account.id)} />)}
            </div>
          )}
        </div>
      )}

      {detail && (
        <AccountDetail
          key={detail.account.id}
          info={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => { const a = detail.account; setDetailId(null); openForm(a); }}
        />
      )}
      <AccountForm
        key={form.key}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        account={form.account}
        nextOrder={nextOrder}
      />
    </PageContainer>
  );
}
