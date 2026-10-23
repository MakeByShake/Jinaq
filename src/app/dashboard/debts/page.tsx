'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog, EmptyState, Money, PageContainer, PageHeader, Panel, Segmented, StatTile, useConfirm,
} from '@/components/app/ui';
import { useData } from '@/stores/data-store';
import { deleteDebt, saveDebt } from '@/lib/actions';
import { useT } from '@/i18n';
import type { Debt, DebtDirection } from '@/lib/types';
import {
  groupByPerson, PersonCard, remainingOf, type DebtTab, type PersonCardHandlers, type PersonGroup,
} from './_components/person-card';
import { DebtFormSheet, RemindSheet, RepaySheet } from './_components/debt-sheets';

// Sheets are re-mounted with a new key on each opening so their forms start fresh.
interface FormState { key: number; open: boolean; debt?: Debt; direction?: DebtDirection }
interface RepayState { key: number; open: boolean; debt: Debt }
interface RemindState { key: number; open: boolean; name: string; amount: number }

export default function DebtsPage() {
  const t = useT();
  const debts = useData((s) => s.debts);
  const confirm = useConfirm();

  const [tab, setTab] = useState<DebtTab>(() =>
    useData.getState().debts.some((d) => !d.settled && d.direction === 'owed_to_me')
      || !useData.getState().debts.some((d) => !d.settled) ? 'owed_to_me' : 'i_owe');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>({ key: 0, open: false });
  const [repay, setRepay] = useState<RepayState | null>(null);
  const [remind, setRemind] = useState<RemindState | null>(null);

  const { totals, groups, counts } = useMemo(() => {
    const open = debts.filter((d) => !d.settled);
    const owedToMe = open.filter((d) => d.direction === 'owed_to_me').reduce((s, d) => s + remainingOf(d), 0);
    const iOwe = open.filter((d) => d.direction === 'i_owe').reduce((s, d) => s + remainingOf(d), 0);
    const groups = {
      owed_to_me: groupByPerson(debts, 'owed_to_me'),
      i_owe: groupByPerson(debts, 'i_owe'),
      closed: groupByPerson(debts, 'closed'),
    };
    return {
      totals: { owedToMe, iOwe, net: owedToMe - iOwe },
      groups,
      counts: { owed_to_me: groups.owed_to_me.length, i_owe: groups.i_owe.length, closed: debts.length - open.length },
    };
  }, [debts]);

  // Always pass the live debt to sheets.
  const live = (d: Debt) => debts.find((x) => x.id === d.id) ?? d;

  const openCreate = () => setForm((f) => ({
    key: f.key + 1, open: true, direction: tab === 'closed' ? 'owed_to_me' : tab,
  }));

  const toggle = (key: string) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const handlers: PersonCardHandlers = {
    onRepay: (debt) => setRepay((r) => ({ key: (r?.key ?? 0) + 1, open: true, debt })),
    onEdit: (debt) => setForm((f) => ({ key: f.key + 1, open: true, debt })),
    onDelete: (debt) => confirm.ask(() => {
      deleteDebt(debt.id);
      setForm((f) => ({ ...f, open: false }));
      toast(t('debts.deleted'), { action: { label: t('common.undo'), onClick: () => saveDebt(debt) } });
    }),
    onRemind: (g: PersonGroup) => setRemind((r) => ({ key: (r?.key ?? 0) + 1, open: true, name: g.name, amount: g.total })),
  };

  const list = groups[tab];
  const netTone = totals.net > 0 ? 'income' : totals.net < 0 ? 'expense' : 'default';

  return (
    <PageContainer>
      <PageHeader
        title={t('debts.title')}
        subtitle={t('debts.subtitle')}
        actions={debts.length > 0 && (
          <Button className="h-10 rounded-xl font-bold" onClick={openCreate}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('debts.add')}</span>
            <span className="sr-only sm:hidden">{t('debts.add')}</span>
          </Button>
        )}
      />

      {debts.length === 0 ? (
        <Panel>
          <EmptyState
            icon={HandCoins}
            title={t('debts.emptyTitle')}
            text={t('debts.emptyText')}
            action={
              <Button className="h-11 rounded-xl font-bold" onClick={openCreate}>
                <Plus className="h-4 w-4" /> {t('debts.add')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          {/* ─── Summary ─── */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:mb-6">
            <StatTile
              icon={ArrowDownLeft} tone="income" label={t('debts.owedToMe')}
              value={<Money value={totals.owedToMe} className="text-income" />}
              hint={t('debts.peopleCount', { count: counts.owed_to_me })}
            />
            <StatTile
              icon={ArrowUpRight} tone="expense" label={t('debts.iOwe')}
              value={<Money value={totals.iOwe} className="text-expense" />}
              hint={t('debts.peopleCount', { count: counts.i_owe })}
            />
            <StatTile
              className="col-span-2 sm:col-span-1"
              icon={Scale} tone={netTone} label={t('debts.net')}
              value={<Money value={totals.net} kind="auto" />}
              hint={totals.net > 0 ? t('debts.netPositive') : totals.net < 0 ? t('debts.netNegative') : t('debts.netZero')}
            />
          </div>

          {/* ─── Tabs ─── */}
          <Segmented
            value={tab}
            onChange={setTab}
            className="mb-4 flex w-full sm:w-auto"
            options={([
              ['owed_to_me', t('debts.owedToMe')],
              ['i_owe', t('debts.iOwe')],
              ['closed', t('debts.closed')],
            ] as const).map(([value, label]) => ({
              value,
              label: <>{label} <span className="ml-0.5 text-xs opacity-60 tabular">{counts[value]}</span></>,
            }))}
          />

          {list.length === 0 ? (
            <Panel>
              <EmptyState
                icon={HandCoins}
                title={t(`debts.tabEmpty_${tab}`)}
                action={tab !== 'closed' && (
                  <Button variant="outline" className="h-10 rounded-xl" onClick={openCreate}>
                    <Plus className="h-4 w-4" /> {t('debts.add')}
                  </Button>
                )}
              />
            </Panel>
          ) : (
            <div className="grid items-start gap-3 lg:grid-cols-2">
              {list.map((g) => (
                <PersonCard
                  key={g.key}
                  group={g}
                  tab={tab}
                  // A lone person starts expanded; a tap flips the default either way.
                  expanded={expanded.has(`${tab}:${g.key}`) !== (list.length === 1)}
                  onToggle={() => toggle(`${tab}:${g.key}`)}
                  {...handlers}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── Sheets ─── */}
      {form.key > 0 && (
        <DebtFormSheet
          key={form.key}
          open={form.open}
          onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
          debt={form.debt && live(form.debt)}
          direction={form.direction}
          onDelete={handlers.onDelete}
        />
      )}
      {repay && (
        <RepaySheet
          key={repay.key}
          open={repay.open}
          onOpenChange={(open) => setRepay((r) => r && { ...r, open })}
          debt={live(repay.debt)}
        />
      )}
      {remind && (
        <RemindSheet
          key={remind.key}
          open={remind.open}
          onOpenChange={(open) => setRemind((r) => r && { ...r, open })}
          name={remind.name}
          amount={remind.amount}
        />
      )}
      <ConfirmDialog {...confirm.props} title={t('debts.deleteTitle')} text={t('debts.deleteText')} />
    </PageContainer>
  );
}
