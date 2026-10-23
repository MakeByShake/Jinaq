'use client';

import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { IconBubble } from '@/lib/icons';
import { useCategories } from '@/hooks/use-finance';
import { deleteTransaction, payRecurring, saveRecurring } from '@/lib/actions';
import { useDayLabel } from '@/lib/format';
import type { UpcomingItem } from '@/lib/finance';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { Money } from './ui';

export function UpcomingRow({ item }: { item: UpcomingItem }) {
  const { map } = useCategories();
  const t = useT();
  const dayLabel = useDayLabel();
  const r = item.recurring;
  const c = map.get(r.categoryId);
  const overdue = item.days < 0;
  const when = overdue
    ? t('dash.overdue')
    : item.days <= 1
      ? dayLabel(r.nextDate)
      : t('dash.inDays', { days: t('common.days', { count: item.days }) });

  const mark = () => {
    const prev = { ...r };
    const tx = payRecurring(r);
    toast.success(t('dash.paid', { name: r.name }), {
      action: {
        label: t('common.undo'),
        onClick: () => {
          deleteTransaction(tx);
          saveRecurring(prev);
        },
      },
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
      <IconBubble icon={c?.icon} color={c?.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{r.name}</p>
        <p className={cn('text-xs', overdue ? 'font-semibold text-expense' : item.days <= 1 ? 'font-semibold text-warning' : 'text-muted-foreground')}>
          {when}
        </p>
      </div>
      <Money value={r.amount} kind={r.kind} className="text-sm font-bold" />
      <button
        type="button"
        onClick={mark}
        aria-label={r.kind === 'income' ? t('dash.receive') : t('dash.pay')}
        title={r.kind === 'income' ? t('dash.receive') : t('dash.pay')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-primary"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}
