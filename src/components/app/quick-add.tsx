'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Delete, Trash2, CalendarDays, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveSheet } from './sheet';
import { Segmented } from './ui';
import { IconBubble, getIcon } from '@/lib/icons';
import { useQuickAdd } from '@/stores/ui-store';
import { useData } from '@/stores/data-store';
import { useAccounts, useBalances, useCategories } from '@/hooks/use-finance';
import { useIsMobile } from '@/hooks/use-mobile';
import { evalAmount, useMoney } from '@/lib/format';
import { toDay, todayISO } from '@/lib/dates';
import {
  addTransaction, applyTemplate, deleteTransaction, newId, saveTemplate, updateTransaction,
} from '@/lib/actions';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { TransactionKind } from '@/lib/types';

const KEYS = ['1', '2', '3', '+', '4', '5', '6', '−', '7', '8', '9', '⌫', '.', '0', '000', '✓'];

export function QuickAddSheet() {
  const { open, kind: initialKind, editing, close } = useQuickAdd();
  const t = useT();
  const fmt = useMoney();
  const isMobile = useIsMobile();
  const { byKind, label } = useCategories();
  const { active: accounts } = useAccounts();
  const { balances } = useBalances();
  const transactions = useData((s) => s.transactions);
  const templates = useData((s) => s.templates);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [expr, setExpr] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [accountId, setAccountId] = useState<string | undefined>();
  const [toAccountId, setToAccountId] = useState<string | undefined>();
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [asTemplate, setAsTemplate] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    const lastAccount = transactions[0]?.accountId;
    const defaultAcc = accounts.find((a) => a.id === lastAccount)?.id ?? accounts[0]?.id;
    if (editing) {
      setKind(editing.kind);
      setExpr(String(editing.amount));
      setCategoryId(editing.categoryId);
      setAccountId(editing.accountId);
      setToAccountId(editing.toAccountId);
      setDate(editing.date.slice(0, 10));
      setNote(editing.note ?? '');
    } else {
      setKind(initialKind);
      setExpr('');
      setCategoryId(undefined);
      setAccountId(defaultAcc);
      setToAccountId(accounts.find((a) => a.id !== defaultAcc)?.id);
      setDate(todayISO());
      setNote('');
    }
    setAsTemplate(false);
    setShowAllCats(false);
    if (!isMobile) setTimeout(() => amountRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, initialKind]);

  // Categories ordered by how often they are used (most used first).
  const cats = useMemo(() => {
    if (kind === 'transfer') return [];
    const usage = new Map<string, number>();
    for (const tx of transactions.slice(0, 300)) {
      if (tx.categoryId) usage.set(tx.categoryId, (usage.get(tx.categoryId) ?? 0) + 1);
    }
    return [...byKind(kind)].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.order - b.order);
  }, [kind, byKind, transactions]);

  const visibleCats = showAllCats ? cats : cats.slice(0, 8);
  const kindTemplates = useMemo(
    () => templates.filter((tp) => tp.kind === kind).sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0)).slice(0, 8),
    [templates, kind],
  );

  const amount = evalAmount(expr.replace(/−/g, '-'));
  const isExpression = /[+\-−*/]/.test(expr.replace(/^-/, ''));

  const press = (k: string) => {
    if (k === '⌫') return setExpr((e) => e.slice(0, -1));
    if (k === '✓') return submit();
    if (k === '+' || k === '−') {
      setExpr((e) => (e === '' || /[+−]$/.test(e) ? e : e + k));
      return;
    }
    if (k === '.' && /\.\d*$/.test(expr.split(/[+−]/).pop() ?? '')) return;
    setExpr((e) => (e.length > 18 ? e : e + k));
  };

  function submit() {
    if (!Number.isFinite(amount) || amount <= 0) return toast.error(t('common.invalidAmount'));
    if (!accountId) return toast.error(t('tx.pickAccount'));
    if (kind !== 'transfer' && !categoryId) return toast.error(t('tx.pickCategory'));
    if (kind === 'transfer' && (!toAccountId || toAccountId === accountId)) return toast.error(t('tx.sameAccount'));

    const data = {
      kind, amount, accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined,
      categoryId: kind === 'transfer' ? undefined : categoryId,
      note: note.trim() || undefined,
      date,
    };

    if (editing) {
      updateTransaction({ ...editing, ...data });
      toast.success(t('tx.updated'));
    } else {
      const created = addTransaction(data);
      if (asTemplate && kind !== 'transfer' && categoryId) {
        saveTemplate({
          id: newId('tpl'), kind, name: note.trim() || label(categoryId), amount, categoryId, accountId,
          uses: 1, createdAt: new Date().toISOString(),
        });
      }
      toast.success(t('tx.added', { amount: fmt(amount) }), {
        action: { label: t('common.undo'), onClick: () => deleteTransaction(created) },
      });
    }
    close();
  }

  const handleDelete = () => {
    if (!editing) return;
    const restore = deleteTransaction(editing);
    toast(t('tx.deleted'), { action: { label: t('common.undo'), onClick: restore } });
    close();
  };

  const title = editing ? t('tx.editTitle') : kind === 'income' ? t('tx.newIncome') : kind === 'transfer' ? t('tx.newTransfer') : t('tx.newExpense');
  const yesterday = toDay(addDays(new Date(), -1));
  const accentText = kind === 'income' ? 'text-income' : kind === 'expense' ? 'text-expense' : 'text-foreground';

  const AccountChips = ({ value, onChange, exclude }: { value?: string; onChange: (id: string) => void; exclude?: string }) => (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
      {accounts.filter((a) => a.id !== exclude).map((a) => {
        const Icon = getIcon(a.icon);
        const active = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors',
              active ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
            )}
          >
            <Icon className="h-4 w-4" style={{ color: a.color }} />
            <span className="text-xs leading-tight">
              <span className="block font-semibold">{a.name}</span>
              <span className="block text-muted-foreground tabular">{fmt(balances[a.id] ?? 0, { compact: true })}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(v) => !v && close()}
      title={title}
      footer={
        <div className="flex gap-2">
          {editing && (
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-2xl text-destructive" onClick={handleDelete} aria-label={t('common.delete')}>
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button className="h-12 flex-1 rounded-2xl text-base font-bold" onClick={submit}>
            <Check className="h-5 w-5" /> {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!editing && (
          <Segmented
            value={kind}
            onChange={(k) => { setKind(k); setCategoryId(undefined); }}
            className="w-full"
            options={[
              { value: 'expense', label: t('common.expense'), className: 'text-expense' },
              { value: 'income', label: t('common.income'), className: 'text-income' },
              { value: 'transfer', label: t('common.transfer') },
            ]}
          />
        )}

        {/* Templates: one tap logs a frequent transaction */}
        {!editing && kind !== 'transfer' && kindTemplates.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 scrollbar-hide">
            {kindTemplates.map((tp) => (
              <button
                key={tp.id}
                type="button"
                onClick={() => {
                  const created = applyTemplate(tp, accountId ?? accounts[0]?.id ?? '');
                  toast.success(t('tx.added', { amount: fmt(tp.amount) }), {
                    action: { label: t('common.undo'), onClick: () => deleteTransaction(created) },
                  });
                  close();
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-accent/50 px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent"
              >
                <Bookmark className="h-3 w-3" />
                {tp.name} · <span className="tabular">{fmt(tp.amount, { compact: true })}</span>
              </button>
            ))}
          </div>
        )}

        {/* Amount */}
        <div className="rounded-3xl bg-muted/60 px-4 py-3 text-center">
          {isMobile ? (
            <div className={cn('min-h-[3.25rem] font-display text-4xl font-semibold tracking-tight tabular break-all', accentText, !expr && 'opacity-30')}>
              {expr || '0'}
            </div>
          ) : (
            <input
              ref={amountRef}
              value={expr}
              onChange={(e) => setExpr(e.target.value.replace(/[^\d.,+\-*/ ]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              inputMode="decimal"
              placeholder="0"
              aria-label={t('common.amount')}
              className={cn('w-full bg-transparent text-center font-display text-4xl font-semibold tracking-tight tabular outline-none placeholder:opacity-30', accentText)}
            />
          )}
          <p className="h-4 text-xs text-muted-foreground tabular">
            {isExpression && Number.isFinite(amount) ? `= ${fmt(amount)}` : ''}
          </p>
        </div>

        {/* Categories */}
        {kind !== 'transfer' && (
          <div>
            <div className="grid grid-cols-4 gap-1.5">
              {visibleCats.map((c) => {
                const active = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-all',
                      active ? 'scale-[1.02] border-transparent' : 'border-transparent hover:bg-muted',
                    )}
                    style={active ? { backgroundColor: `${c.color}1F`, borderColor: c.color } : undefined}
                  >
                    <IconBubble icon={c.icon} color={c.color} size="sm" />
                    <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight">{label(c)}</span>
                  </button>
                );
              })}
            </div>
            {cats.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllCats((v) => !v)}
                className="mx-auto mt-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary"
              >
                {showAllCats ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showAllCats ? t('tx.showLess') : t('tx.showAll')}
              </button>
            )}
          </div>
        )}

        {/* Number pad (phones) */}
        {isMobile && (
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={k === '⌫' ? 'backspace' : k === '✓' ? t('common.save') : k}
                className={cn(
                  'flex h-12 items-center justify-center rounded-2xl text-lg font-semibold transition-colors active:scale-95',
                  k === '✓' ? 'bg-primary text-primary-foreground' : /[+−⌫]/.test(k) ? 'bg-muted text-muted-foreground' : 'bg-muted/50 hover:bg-muted',
                )}
              >
                {k === '⌫' ? <Delete className="h-5 w-5" /> : k === '✓' ? <Check className="h-5 w-5" /> : k}
              </button>
            ))}
          </div>
        )}
        {/* Accounts */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">{kind === 'transfer' ? t('tx.from') : t('common.account')}</p>
          <AccountChips value={accountId} onChange={setAccountId} />
        </div>
        {kind === 'transfer' && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">{t('tx.to')}</p>
            <AccountChips value={toAccountId} onChange={setToAccountId} exclude={accountId} />
          </div>
        )}

        {/* Date */}
        <div className="flex flex-wrap items-center gap-2">
          {[{ v: todayISO(), l: t('common.today') }, { v: yesterday, l: t('common.yesterday') }].map((d) => (
            <button
              key={d.v}
              type="button"
              onClick={() => setDate(d.v)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold',
                date === d.v ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {d.l}
            </button>
          ))}
          <label className={cn(
            'relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
            date !== todayISO() && date !== yesterday ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground',
          )}>
            <CalendarDays className="h-3.5 w-3.5" />
            {date !== todayISO() && date !== yesterday ? date.split('-').reverse().join('.') : t('tx.otherDate')}
            <input
              type="date"
              value={date}
              max={toDay(addDays(new Date(), 366))}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={t('common.date')}
            />
          </label>
        </div>

        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('common.notePlaceholder')}
          className="h-11 rounded-2xl text-base md:text-sm"
          maxLength={120}
        />

        {!editing && kind !== 'transfer' && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={asTemplate} onChange={(e) => setAsTemplate(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            {t('tx.saveAsTemplate')}
          </label>
        )}

      </div>
    </ResponsiveSheet>
  );
}
