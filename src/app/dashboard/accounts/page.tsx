'use client';

import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import {
  Archive, ArchiveRestore, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, Pencil, Plus, Scale,
  Trash2, Wallet,
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
import { DynamicIcon, PALETTE } from '@/lib/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Account, AccountType, Transaction } from '@/lib/types';

const TYPES: AccountType[] = ['card', 'cash', 'savings', 'deposit', 'other'];
const TYPE_ICON: Record<AccountType, string> = { card: 'card', cash: 'cash', savings: 'piggy', deposit: 'bank', other: 'wallet' };

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

function cardBackground(color: string) {
  return {
    backgroundImage: `radial-gradient(120% 140% at 100% 0%, rgb(255 255 255 / 0.22) 0%, transparent 50%), linear-gradient(135deg, ${color} 0%, color-mix(in oklab, ${color} 55%, #0b1f17) 100%)`,
  };
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
      style={cardBackground(a.color)}
    >
      <div className="pointer-events-none absolute -right-8 -bottom-12 h-36 w-36 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <DynamicIcon name={a.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{a.name}</p>
          <p className="truncate text-xs text-white/75">{t(`enums.acc_${a.type}`)}</p>
        </div>
        {a.excludeFromTotal && (
          <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold">{t('acc.excludedBadge')}</span>
        )}
      </div>
      <div className="relative mt-auto pt-5">
        <p className="truncate font-display text-[1.7rem] leading-tight font-semibold tabular">{fmt(balance)}</p>
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

function AccountForm({ open, onOpenChange, account, nextOrder }: {
  open: boolean; onOpenChange: (v: boolean) => void; account: Account | null; nextOrder: number;
}) {
  const t = useT();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'card');
  const [icon, setIcon] = useState(account?.icon ?? 'card');
  const [color, setColor] = useState(account?.color ?? PALETTE[2]);
  const [initial, setInitial] = useState(account ? String(account.initialBalance ?? 0) : '');
  const [exclude, setExclude] = useState(account?.excludeFromTotal ?? false);

  const pickType = (v: AccountType) => {
    // Follow the type with a matching icon / flag unless the user changed them.
    if (icon === TYPE_ICON[type]) setIcon(TYPE_ICON[v]);
    if (!account) setExclude(v === 'deposit');
    setType(v);
  };

  const submit = () => {
    if (!name.trim()) return toast.error(t('acc.nameRequired'));
    const initialBalance = initial.trim() ? evalAmount(initial) : 0;
    if (!Number.isFinite(initialBalance)) return toast.error(t('acc.invalidNumber'));
    const data: Account = {
      id: account?.id ?? newId('acc'),
      name: name.trim(),
      type, icon, color, initialBalance,
      order: account?.order ?? nextOrder,
      archived: account?.archived,
      excludeFromTotal: exclude || undefined,
      createdAt: account?.createdAt ?? new Date().toISOString(),
    };
    saveAccount(data);
    toast.success(account ? t('common.saved') : t('acc.created'));
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={account ? t('acc.editTitle') : t('acc.newTitle')}
      footer={<Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={submit}>{t('common.save')}</Button>}
    >
      <div className="space-y-4">
        {/* Live preview */}
        <div className="flex items-center gap-3 rounded-2xl p-3 text-white" style={cardBackground(color)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><DynamicIcon name={icon} className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="truncate font-bold">{name || t('acc.namePlaceholder')}</p>
            <p className="text-xs text-white/75">{t(`enums.acc_${type}`)}</p>
          </div>
        </div>

        <Field label={t('acc.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('acc.namePlaceholder')} className="h-11 rounded-xl" maxLength={40} />
        </Field>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('acc.type')}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('acc.type')}>
            {TYPES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={type === v}
                onClick={() => pickType(v)}
                className={cn(
                  'h-10 rounded-full border px-4 text-sm font-semibold transition-colors',
                  type === v ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {t(`enums.acc_${v}`)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('acc.initialBalance')} hint={t('acc.initialBalanceHint')}>
          <Input value={initial} onChange={(e) => setInitial(e.target.value)} inputMode="decimal" placeholder="0" className="h-11 rounded-xl tabular" />
        </Field>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t('acc.exclude')}</span>
            <span className="block text-xs text-muted-foreground">{t('acc.excludeHint')}</span>
          </span>
          <Switch checked={exclude} onCheckedChange={setExclude} aria-label={t('acc.exclude')} />
        </label>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.icon')}</p>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.color')}</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
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
          <div className="relative overflow-hidden rounded-3xl p-4 text-white" style={cardBackground(a.color)}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20"><DynamicIcon name={a.icon} className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-xs text-white/75">{t('acc.balance')}</p>
                <p className="truncate font-display text-2xl font-semibold tabular">{fmt(balance)}</p>
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
                {txs.slice(0, 20).map((tx) => <TransactionRow key={tx.id} tx={tx} showDate />)}
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
      <section className="relative mb-5 overflow-hidden rounded-[28px] bg-brand-gradient p-5 text-white shadow-xl shadow-emerald-900/20 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/75">{t('acc.netWorth')}</p>
            <p className="mt-1 truncate font-display text-[2.1rem] leading-tight font-semibold tabular sm:text-5xl">{fmt(total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
              <p className="truncate text-xs font-medium text-white/75">{t('acc.spendable')}</p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold tabular">{fmt(spendable)}</p>
            </div>
            <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
              <p className="truncate text-xs font-medium text-white/75">{t('acc.reserved')}</p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold tabular">{fmt(total - spendable)}</p>
            </div>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {active.map((info) => <AccountCard key={info.account.id} info={info} onOpen={() => setDetailId(info.account.id)} />)}
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent/40 hover:text-foreground"
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
