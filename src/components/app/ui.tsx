'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMoney, type MoneyOptions } from '@/lib/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, className }: {
  title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-3 md:mb-7', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 pt-4 pb-28 sm:px-6 md:pt-8 md:pb-12', className)}>{children}</div>;
}

// ─── Money ───────────────────────────────────────────────────────────────────

export function Money({ value, kind, className, ...opts }: MoneyOptions & {
  value: number; kind?: 'income' | 'expense' | 'transfer' | 'auto'; className?: string;
}) {
  const fmt = useMoney();
  const color =
    kind === 'income' ? 'text-income'
      : kind === 'expense' ? 'text-expense'
        : kind === 'auto' ? (value >= 0 ? 'text-income' : 'text-expense')
          : '';
  const shown = kind === 'expense' ? -Math.abs(value) : kind === 'income' ? Math.abs(value) : value;
  const sign = opts.sign ?? (kind === 'income' || kind === 'expense' || kind === 'auto');
  return <span className={cn('tabular whitespace-nowrap', color, className)}>{fmt(shown, { ...opts, sign })}</span>;
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export function Panel({ children, className, title, action, href, icon: Icon }: {
  children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode;
  href?: string; icon?: LucideIcon;
}) {
  const t = useT();
  return (
    <section className={cn('rounded-3xl border border-border bg-card p-4 card-shadow sm:p-5', className)}>
      {(title || action || href) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {title}
          </h2>
          {action ?? (href && (
            <Link href={href} className="-mr-1 flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-xs font-semibold text-primary hover:bg-accent">
              {t('common.seeAll')} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({ label, value, hint, icon: Icon, tone = 'default', className }: {
  label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon;
  tone?: 'default' | 'income' | 'expense' | 'warning' | 'gold'; className?: string;
}) {
  const toneCls = {
    default: 'bg-muted text-muted-foreground',
    income: 'bg-income/12 text-income',
    expense: 'bg-expense/12 text-expense',
    warning: 'bg-warning/15 text-warning',
    gold: 'bg-gold/15 text-gold',
  }[tone];
  return (
    <div className={cn('rounded-2xl border border-border bg-card p-3.5 card-shadow', className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', toneCls)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, text, action, className }: {
  icon: LucideIcon; title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; className?: string }[];
  className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full rounded-2xl bg-muted p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 flex-auto truncate rounded-xl font-semibold transition-all',
              size === 'sm' ? 'px-2 py-1.5 text-xs sm:px-3' : 'px-2.5 py-2 text-sm sm:px-4',
              active ? cn('bg-card text-foreground shadow-sm', o.className) : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Progress with pace marker ───────────────────────────────────────────────

export function ProgressBar({ value, pace, color, className, tone }: {
  value: number; pace?: number; color?: string; className?: string; tone?: 'ok' | 'warn' | 'over';
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const toneBg = tone === 'over' ? 'bg-expense' : tone === 'warn' ? 'bg-warning' : 'bg-primary';
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', !color && toneBg)}
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      {pace !== undefined && pace > 0 && pace < 1 && (
        <div className="absolute top-0 h-full w-0.5 bg-foreground/50" style={{ left: `${pace * 100}%` }} aria-hidden />
      )}
    </div>
  );
}

/** Circular progress ring. */
export function Ring({ value, size = 56, stroke = 6, color = 'var(--primary)', children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--muted)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// ─── Confirm ─────────────────────────────────────────────────────────────────

export function ConfirmDialog({ open, onOpenChange, onConfirm, title, text, confirmLabel }: {
  open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void;
  title?: React.ReactNode; text?: React.ReactNode; confirmLabel?: React.ReactNode;
}) {
  const t = useT();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('common.confirmDelete')}</AlertDialogTitle>
          <AlertDialogDescription>{text ?? t('common.confirmDeleteText')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction className="rounded-xl bg-destructive text-white hover:bg-destructive/90" onClick={onConfirm}>
            {confirmLabel ?? t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; action?: () => void }>({ open: false });
  return {
    ask: (action: () => void) => setState({ open: true, action }),
    props: {
      open: state.open,
      onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
      onConfirm: () => state.action?.(),
    },
  };
}

// ─── Field label ─────────────────────────────────────────────────────────────

export function Field({ label, hint, children, className }: {
  label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-[13px] font-semibold text-foreground/80">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
