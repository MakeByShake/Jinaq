'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CheckCheck, FileUp, Loader2, ShieldCheck, Sparkles, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, Money, PageContainer, PageHeader, Panel, Segmented } from '@/components/app/ui';
import { ResponsiveSheet } from '@/components/app/sheet';
import { AccountPicker } from '@/components/app/account-picker';
import { useData } from '@/stores/data-store';
import { useAccounts, useCategories } from '@/hooks/use-finance';
import { useDayLabel } from '@/lib/format';
import { IconBubble } from '@/lib/icons';
import { importTransactions, newId, saveRule, undoImport, type NewTransaction } from '@/lib/actions';
import { pdfToLines } from '@/lib/import/pdf-text';
import { parseKaspiStatement } from '@/lib/import/kaspi';
import { buildRows, ruleFor, type Flag, type ImportRow } from '@/lib/import/review';
import { merchantKey } from '@/lib/import/categorize';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { MerchantRule } from '@/lib/types';

type Filter = 'all' | 'expense' | 'income' | 'attention';
const ATTENTION: Flag[] = ['duplicate', 'refund', 'own', 'unsure', 'ignored'];

const FLAG_STYLE: Record<Flag, string> = {
  duplicate: 'bg-muted text-muted-foreground',
  refund: 'bg-chart-2/15 text-chart-2',
  own: 'bg-chart-4/15 text-chart-4',
  ignored: 'bg-muted text-muted-foreground',
  unsure: 'bg-warning/15 text-warning',
};

// ─── Step 1: upload ──────────────────────────────────────────────────────────

function UploadStep({ onFile, busy }: { onFile: (f: File) => void; busy: boolean }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-2">
      <Panel title={t('imp.howTitle')}>
        <ol className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex gap-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
              <span className="pt-1">{t(`imp.how${n}`)}</span>
            </li>
          ))}
        </ol>
      </Panel>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition-colors',
          drag ? 'border-primary bg-accent' : 'border-border bg-card',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banks/kaspi.png" alt="Kaspi" className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-sm" />
        <Button className="h-12 rounded-2xl px-6 text-base font-bold" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
          {busy ? t('imp.reading') : t('imp.pick')}
        </Button>
        <p className="hidden text-xs text-muted-foreground md:block">{t('imp.pickHint')}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t('imp.privacy')}</p>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }}
        />
      </div>
    </div>
  );
}

// ─── Category sheet ──────────────────────────────────────────────────────────

function CategorySheet({ row, onClose, onPick }: {
  row: ImportRow | null; onClose: () => void; onPick: (categoryId: string, remember: boolean) => void;
}) {
  const t = useT();
  const { byKind, label } = useCategories();
  const [remember, setRemember] = useState(true);
  if (!row) return null;
  const cats = byKind(row.kind === 'income' ? 'income' : 'expense');
  const name = row.op.details || '—';
  return (
    <ResponsiveSheet open onOpenChange={(v) => !v && onClose()} title={t('imp.pickCategory')} description={name}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1.5">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id, remember)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-colors',
                row.categoryId === c.id ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted',
              )}
            >
              <IconBubble icon={c.icon} color={c.color} size="sm" />
              <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight">{label(c)}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted/60 p-3">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--primary)]" />
          <span>
            <span className="block text-sm font-semibold">{t('imp.remember', { name: name.length > 28 ? `${name.slice(0, 28)}…` : name })}</span>
            <span className="block text-xs text-muted-foreground">{t('imp.rememberHint')}</span>
          </span>
        </label>
      </div>
    </ResponsiveSheet>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ row, onToggle, onCategory }: { row: ImportRow; onToggle: () => void; onCategory: () => void }) {
  const t = useT();
  const dayLabel = useDayLabel();
  const { map, label } = useCategories();
  const c = row.categoryId ? map.get(row.categoryId) : undefined;
  return (
    <div className={cn('flex items-center gap-2.5 rounded-2xl px-2 py-2 transition-opacity', !row.checked && 'opacity-55')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={row.checked}
        onClick={onToggle}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors',
          row.checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
        )}
      >
        {row.checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={row.kind === 'transfer' ? undefined : onCategory}
        disabled={row.kind === 'transfer'}
        aria-label={t('imp.pickCategory')}
        className="shrink-0 rounded-xl transition-transform active:scale-95"
      >
        <IconBubble icon={row.kind === 'transfer' ? 'cash' : c?.icon} color={row.kind === 'transfer' ? '#10B981' : c?.color} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{row.op.details || '—'}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span>{dayLabel(row.op.date)}</span>
          <span>·</span>
          {row.kind === 'transfer' ? (
            <span>{t('imp.withdrawal')}</span>
          ) : (
            <button type="button" onClick={onCategory} className="font-semibold text-primary underline-offset-2 hover:underline">{label(c)}</button>
          )}
          {row.flags.map((f) => (
            <span key={f} className={cn('rounded-full px-1.5 py-px text-[10px] font-bold', FLAG_STYLE[f])}>{t(`imp.flag_${f}`)}</span>
          ))}
        </p>
      </div>
      <Money value={row.op.amount} kind={row.kind === 'transfer' ? undefined : row.kind} className="shrink-0 text-sm font-bold" />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const t = useT();
  const transactions = useData((s) => s.transactions);
  const rulesList = useData((s) => s.rules);
  const { categories } = useCategories();
  const { active: accounts } = useAccounts();

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [accountId, setAccountId] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [catRow, setCatRow] = useState<string | null>(null);
  const [newRules, setNewRules] = useState<Map<string, MerchantRule>>(new Map());
  const [done, setDone] = useState<{ importId: string; count: number } | null>(null);

  const cash = accounts.find((a) => a.type === 'cash');
  const defaultAccount = accounts.find((a) => a.bankId === 'kaspi' && a.type === 'card') ?? accounts.find((a) => a.type === 'card') ?? accounts[0];

  async function onFile(file: File) {
    setBusy(true);
    try {
      const lines = await pdfToLines(file);
      const st = parseKaspiStatement(lines);
      if (st.ops.length === 0) {
        toast.error(t('imp.errorEmpty'), { duration: 8000 });
        return;
      }
      const acc = defaultAccount?.id;
      if (!acc) { toast.error(t('imp.noAccount')); return; }
      setAccountId(acc);
      setRange(st.period ?? { from: st.ops[st.ops.length - 1].date, to: st.ops[0].date });
      setRows(buildRows(st.ops, { accountId: acc, cashAccountId: cash?.id, existing: transactions, rules: rulesList, categories }));
      setNewRules(new Map());
      setFilter('all');
    } catch (e) {
      console.error(e);
      toast.error(t('imp.errorRead'));
    } finally {
      setBusy(false);
    }
  }

  // Re-check duplicates when the target account changes.
  const changeAccount = (id: string | undefined) => {
    if (!id || !rows) return;
    setAccountId(id);
    const fresh = buildRows(rows.map((r) => r.op), { accountId: id, cashAccountId: cash?.id, existing: transactions, rules: rulesList, categories });
    setRows(rows.map((r, i) => ({ ...r, flags: fresh[i].flags })));
  };

  const inRange = (r: ImportRow) => (!range.from || r.op.date >= range.from) && (!range.to || r.op.date <= range.to);
  const visible = useMemo(() => (rows ?? []).filter((r) => inRange(r) && (
    filter === 'all' ? true
      : filter === 'expense' ? r.kind === 'expense'
        : filter === 'income' ? r.kind === 'income'
          : r.flags.some((f) => ATTENTION.includes(f))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  )), [rows, filter, range]);
  const selected = (rows ?? []).filter((r) => r.checked && inRange(r));

  const update = (key: string, patch: (r: ImportRow) => ImportRow) => setRows((rs) => rs && rs.map((r) => (r.op.key === key ? patch(r) : r)));

  const pickCategory = (categoryId: string, remember: boolean) => {
    const row = rows?.find((r) => r.op.key === catRow);
    if (!row) return;
    const mk = merchantKey(row.op.details);
    setRows((rs) => rs && rs.map((r) => {
      const same = r.op.key === row.op.key || (remember && mk && merchantKey(r.op.details) === mk && r.kind === row.kind);
      return same ? { ...r, categoryId, flags: r.flags.filter((f) => f !== 'unsure') } : r;
    }));
    if (remember && mk) setNewRules((m) => new Map(m).set(mk, ruleFor(row.op.details, categoryId)));
    setCatRow(null);
  };

  async function doImport() {
    if (!rows || !accountId) return;
    if (selected.length === 0) return toast.error(t('imp.nothing'));
    setBusy(true);
    try {
      const importId = newId('imp');
      const items: NewTransaction[] = selected.map((r) => (r.kind === 'transfer'
        ? { kind: 'transfer', amount: r.op.amount, accountId, toAccountId: cash?.id, note: r.op.details || undefined, date: r.op.date, bankText: r.op.details }
        : { kind: r.kind, amount: r.op.amount, accountId, categoryId: r.categoryId, note: r.op.details || undefined, date: r.op.date, bankText: r.op.details }));
      await importTransactions(items, importId);
      newRules.forEach((rule) => saveRule(rule));
      if (newRules.size > 0) toast.success(t('imp.rulesSaved', { count: newRules.size }));
      setDone({ importId, count: items.length });
      setRows(null);
    } catch (e) {
      console.error(e);
      toast.error(t('common.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  // ── Done ──
  if (done) {
    return (
      <PageContainer>
        <Panel className="mx-auto max-w-md">
          <EmptyState
            icon={Sparkles}
            title={t('imp.doneTitle')}
            text={t('imp.doneText', { count: done.count })}
            action={
              <div className="flex flex-col gap-2">
                <Button asChild className="h-11 rounded-xl"><Link href="/dashboard/transactions">{t('imp.toTransactions')}</Link></Button>
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => setDone(null)}>{t('imp.another')}</Button>
                <Button
                  variant="ghost"
                  className="h-11 rounded-xl text-destructive hover:text-destructive"
                  onClick={async () => { await undoImport(done.importId); toast(t('imp.undone')); setDone(null); }}
                >
                  <Undo2 className="h-4 w-4" /> {t('imp.undo')}
                </Button>
              </div>
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  // ── Upload ──
  if (!rows) {
    return (
      <PageContainer>
        <PageHeader title={t('imp.title')} subtitle={t('imp.subtitle')} />
        <UploadStep onFile={onFile} busy={busy} />
      </PageContainer>
    );
  }

  // ── Review ──
  const hasRefund = rows.some((r) => r.flags.includes('refund'));
  return (
    <PageContainer className="pb-44 md:pb-28">
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => setRows(null)} aria-label={t('common.back')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{t('imp.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('imp.found', { count: rows.length })}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('imp.f_all') },
                { value: 'expense', label: t('imp.f_expense') },
                { value: 'income', label: t('imp.f_income') },
                { value: 'attention', label: t('imp.f_attention') },
              ]}
            />
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => setRows(rows.map((r) => (visible.includes(r) ? { ...r, checked: true } : r)))}>
                <CheckCheck className="h-4 w-4" /> {t('imp.selectAll')}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => setRows(rows.map((r) => (visible.includes(r) ? { ...r, checked: false } : r)))}>
                {t('imp.selectNone')}
              </Button>
            </div>
          </div>

          {hasRefund && (filter === 'all' || filter === 'attention') && (
            <p className="rounded-2xl bg-chart-2/10 px-4 py-3 text-xs leading-relaxed text-foreground/80">{t('imp.refundHint')}</p>
          )}

          <div className="rounded-3xl border border-border bg-card p-1.5 card-shadow">
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('common.empty')}</p>
            ) : visible.map((r) => (
              <Row
                key={r.op.key}
                row={r}
                onToggle={() => update(r.op.key, (x) => ({ ...x, checked: !x.checked }))}
                onCategory={() => setCatRow(r.op.key)}
              />
            ))}
          </div>
        </div>

        {/* Settings column (sticky on desktop) */}
        <div className="order-first space-y-3 lg:sticky lg:top-6 lg:order-none">
          <Panel title={t('imp.period')}>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('imp.from')}</span>
                <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-11 rounded-xl" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">{t('imp.to')}</span>
                <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-11 rounded-xl" />
              </label>
            </div>
          </Panel>
          <Panel title={t('imp.intoAccount')}>
            <AccountPicker value={accountId} onChange={changeAccount} />
          </Panel>
        </div>
      </div>

      {/* Sticky import bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl md:bottom-0 md:left-[76px] lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t('imp.selected', { count: selected.length })}</p>
          <Button className="h-12 rounded-2xl px-6 text-base font-bold" disabled={busy || selected.length === 0} onClick={doImport}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            {busy ? t('imp.importing') : t('imp.import', { count: selected.length })}
          </Button>
        </div>
      </div>

      <CategorySheet
        key={catRow ?? 'none'}
        row={rows.find((r) => r.op.key === catRow) ?? null}
        onClose={() => setCatRow(null)}
        onPick={pickCategory}
      />
    </PageContainer>
  );
}
