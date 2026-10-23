'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useCategories } from '@/hooks/use-finance';
import { useMoney } from '@/lib/format';
import { IconBubble } from '@/lib/icons';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface CategorySlice {
  categoryId: string;
  amount: number;
  count?: number;
}

/** Donut + total in the middle. Small slices are folded into "Other" for legibility. */
export function CategoryDonut({ data, total, size = 180, label }: {
  data: CategorySlice[]; total: number; size?: number; label?: string;
}) {
  const { map } = useCategories();
  const fmt = useMoney();
  const t = useT();
  const main = data.slice(0, 7);
  const rest = data.slice(7).reduce((s, d) => s + d.amount, 0);
  const slices = [
    ...main.map((d) => ({ id: d.categoryId, value: d.amount, color: map.get(d.categoryId)?.color ?? '#64748B' })),
    ...(rest > 0 ? [{ id: '__rest', value: rest, color: '#94A3B8' }] : []),
  ];

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices.length ? slices : [{ id: 'empty', value: 1, color: 'var(--muted)' }]}
            dataKey="value"
            innerRadius="72%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            cornerRadius={6}
            stroke="none"
            isAnimationActive
          >
            {(slices.length ? slices : [{ id: 'empty', color: 'var(--muted)' }]).map((s) => (
              <Cell key={s.id} fill={s.color} />
            ))}
          </Pie>
          {slices.length > 0 && (
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { id: string; value: number };
                const name = p.id === '__rest' ? t('cat.other') : (map.get(p.id) ? undefined : t('cat.uncategorized'));
                return (
                  <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                    <CategoryName id={p.id} fallback={name} />
                    <p className="font-bold tabular">{fmt(p.value)}</p>
                  </div>
                );
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {label && <span className="text-[11px] font-medium text-muted-foreground">{label}</span>}
        <span className="max-w-[70%] truncate font-display text-lg font-semibold tabular">{fmt(total, { compact: true })}</span>
      </div>
    </div>
  );
}

function CategoryName({ id, fallback }: { id: string; fallback?: string }) {
  const { label } = useCategories();
  return <p className="font-semibold">{fallback ?? label(id)}</p>;
}

/** Ranked list of categories with share bars. */
export function CategoryBreakdown({ data, total, limit, onSelect, selected }: {
  data: CategorySlice[]; total: number; limit?: number; onSelect?: (id: string) => void; selected?: string | null;
}) {
  const { map, label } = useCategories();
  const fmt = useMoney();
  const rows = limit ? data.slice(0, limit) : data;
  return (
    <ul className="space-y-1">
      {rows.map((d) => {
        const c = map.get(d.categoryId);
        const share = total > 0 ? d.amount / total : 0;
        const Comp = onSelect ? 'button' : 'div';
        return (
          <li key={d.categoryId}>
            <Comp
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(d.categoryId) } : {})}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left',
                onSelect && 'transition-colors hover:bg-muted',
                selected === d.categoryId && 'bg-muted',
              )}
            >
              <IconBubble icon={c?.icon} color={c?.color} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{label(c)}</span>
                  <span className="shrink-0 text-sm font-bold tabular">{fmt(d.amount)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: c?.color ?? '#64748B' }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-muted-foreground tabular">
                    {Math.round(share * 100)}%
                  </span>
                </div>
              </div>
            </Comp>
          </li>
        );
      })}
    </ul>
  );
}
