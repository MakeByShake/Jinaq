'use client';

import {
  ArrowDownToLine, CalendarClock, CheckCircle2, ExternalLink, MoreHorizontal, Pencil, Plus, RotateCcw,
  ShoppingBag, Sparkles, Trash2, MoveRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Money, ProgressBar, Ring } from '@/components/app/ui';
import { IconBubble } from '@/lib/icons';
import { useDayLabel, useMoney } from '@/lib/format';
import { daysUntil } from '@/lib/dates';
import { daysToAfford, goalPerMonth } from '@/lib/finance';
import { useT, type TFunction } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Goal, GoalPriority, GoalStatus } from '@/lib/types';
import { STATUSES } from './goal-form-sheet';

export interface GoalHandlers {
  onContribute: (g: Goal) => void;
  onWithdraw: (g: Goal) => void;
  onBuy: (g: Goal) => void;
  onEdit: (g: Goal) => void;
  onDelete: (g: Goal) => void;
  onMove: (g: Goal, status: GoalStatus) => void;
}

interface Props extends GoalHandlers {
  goal: Goal;
  /** safeToSpend().available — money that can be spent without hurting upcoming bills. */
  available: number;
  avgSavings: number;
}

const PRIORITY_TONE: Record<GoalPriority, string> = {
  need: 'bg-chart-2/12 text-chart-2',
  want: 'bg-accent text-accent-foreground',
  dream: 'bg-gold/15 text-gold',
};

export function PriorityBadge({ priority }: { priority: GoalPriority }) {
  const t = useT();
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold', PRIORITY_TONE[priority])}>
      {t(`goals.priority_${priority}`)}
    </span>
  );
}

const pctOf = (g: Goal) => (g.target > 0 ? Math.min(1, g.saved / g.target) : 0);

/** The "Can I buy it?" verdict. */
function affordVerdict(goal: Goal, available: number, avgSavings: number, t: TFunction) {
  const left = goal.target - goal.saved;
  if (left <= 0) return { tone: 'text-income bg-income/12', text: t('goals.fullySaved'), hint: undefined };
  if (available > 0 && left <= available) return { tone: 'text-income bg-income/12', text: t('goals.affordNow'), hint: undefined };
  const days = daysToAfford(left, avgSavings);
  if (days === null) return { tone: 'text-warning bg-warning/15', text: t('goals.affordStart'), hint: t('goals.affordStartHint') };
  const text = days >= 90
    ? t('goals.affordMonths', { count: Math.round(days / 30.4) })
    : t('goals.affordDays', { count: days });
  return { tone: 'text-chart-2 bg-chart-2/12', text, hint: undefined };
}

function GoalMenu({ goal, onEdit, onDelete, onMove, onWithdraw, onBuy }: Pick<Props, 'goal' | 'onEdit' | 'onDelete' | 'onMove' | 'onWithdraw' | 'onBuy'>) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground" aria-label={t('goals.actions')}>
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl">
        <DropdownMenuItem onClick={() => onEdit(goal)}><Pencil /> {t('common.edit')}</DropdownMenuItem>
        {goal.status !== 'done' && (
          <DropdownMenuItem onClick={() => onBuy(goal)}><ShoppingBag /> {t('goals.bought')}</DropdownMenuItem>
        )}
        {goal.saved > 0 && (
          <DropdownMenuItem onClick={() => onWithdraw(goal)}><ArrowDownToLine /> {t('goals.withdraw')}</DropdownMenuItem>
        )}
        {goal.link && (
          <DropdownMenuItem asChild>
            <a href={goal.link} target="_blank" rel="noopener noreferrer"><ExternalLink /> {t('goals.openLink')}</a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {STATUSES.filter((s) => s !== goal.status && s !== 'done').map((s) => (
          <DropdownMenuItem key={s} onClick={() => onMove(goal, s)}>
            <MoveRight /> {t('goals.moveTo', { status: t(`goals.status_${s}`) })}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(goal)}><Trash2 /> {t('common.delete')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Deadline + "save X a month" line; null when there is no deadline. */
function DeadlineLine({ goal }: { goal: Goal }) {
  const t = useT();
  const fmt = useMoney();
  const dayLabel = useDayLabel();
  if (!goal.deadline || goal.status === 'done') return null;
  const passed = daysUntil(goal.deadline) < 0;
  const perMonth = goalPerMonth(goal);
  return (
    <p className={cn('flex items-start gap-1.5 text-xs', passed ? 'text-expense' : 'text-muted-foreground')}>
      <CalendarClock className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        {passed ? t('goals.deadlinePassed', { date: dayLabel(goal.deadline) }) : t('goals.deadline', { date: dayLabel(goal.deadline) })}
        {!passed && perMonth ? <> · <span className="font-semibold text-foreground">{t('goals.perMonthNeed', { amount: fmt(Math.ceil(perMonth)) })}</span></> : null}
      </span>
    </p>
  );
}

function AffordBadge({ goal, available, avgSavings }: { goal: Goal; available: number; avgSavings: number }) {
  const t = useT();
  if (goal.status === 'done') return null;
  const v = affordVerdict(goal, available, avgSavings, t);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" title={v.hint}>
      <span className="text-[11px] font-semibold text-muted-foreground">{t('goals.canBuy')}</span>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', v.tone)}>
        <Sparkles className="h-3 w-3" /> {v.text}
      </span>
    </div>
  );
}

// ─── Board card ──────────────────────────────────────────────────────────────

export function GoalCard(props: Props) {
  const { goal, available, avgSavings, onContribute, onBuy, onMove } = props;
  const t = useT();
  const dayLabel = useDayLabel();
  const pct = pctOf(goal);
  const done = goal.status === 'done';

  return (
    <article className={cn('rounded-3xl border border-border bg-card p-4 card-shadow', done && 'bg-card/70')}>
      <div className="flex items-start gap-3">
        <Ring value={done ? 1 : pct} size={52} stroke={5} color={goal.color}>
          <IconBubble icon={goal.icon} color={goal.color} size="sm" className="h-7 w-7 bg-transparent!" />
        </Ring>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="line-clamp-2 font-bold leading-snug break-words">{goal.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={goal.priority} />
            {done && goal.completedAt && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-income">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('goals.completedOn', { date: dayLabel(goal.completedAt.slice(0, 10)) })}
              </span>
            )}
          </div>
        </div>
        <GoalMenu {...props} />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          <Money value={goal.saved} className="font-display text-lg font-semibold text-foreground" />
          {' '}{t('common.of')} <Money value={goal.target} compact />
        </p>
        <span className="text-sm font-bold tabular" style={{ color: goal.color }}>{Math.round(pct * 100)}%</span>
      </div>

      <div className="mt-2 space-y-2">
        <DeadlineLine goal={goal} />
        <AffordBadge goal={goal} available={available} avgSavings={avgSavings} />
        {goal.note && <p className="line-clamp-2 text-xs text-muted-foreground">{goal.note}</p>}
      </div>

      <div className="mt-3 flex gap-2">
        {done ? (
          <Button variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => onMove(goal, 'saving')}>
            <RotateCcw className="h-4 w-4" /> {t('goals.reopen')}
          </Button>
        ) : (
          <>
            <Button className="h-10 flex-1 rounded-xl font-bold" onClick={() => onContribute(goal)}>
              <Plus className="h-4 w-4" /> {t('goals.contribute')}
            </Button>
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => onBuy(goal)}>
              <ShoppingBag className="h-4 w-4" /> {t('goals.bought')}
            </Button>
          </>
        )}
        {goal.link && (
          <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
            <a href={goal.link} target="_blank" rel="noopener noreferrer" aria-label={t('goals.openLink')}>
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

// ─── List row ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<GoalStatus, string> = {
  wish: 'bg-muted text-muted-foreground',
  saving: 'bg-accent text-accent-foreground',
  done: 'bg-income/12 text-income',
};

export function GoalRow(props: Props) {
  const { goal, available, avgSavings, onContribute } = props;
  const t = useT();
  const pct = pctOf(goal);
  const done = goal.status === 'done';

  return (
    <li className="flex gap-3 rounded-2xl px-2 py-3 sm:px-3">
      <IconBubble icon={goal.icon} color={goal.color} size="lg" className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-0 truncate font-bold">{goal.title}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_TONE[goal.status])}>
            {t(`goals.status_${goal.status}`)}
          </span>
          <PriorityBadge priority={goal.priority} />
        </div>
        <div className="flex items-center gap-2">
          <ProgressBar value={done ? 1 : pct} color={goal.color} className="flex-1" />
          <span className="w-10 text-right text-xs font-bold tabular">{Math.round((done ? 1 : pct) * 100)}%</span>
        </div>
        <p className="text-xs text-muted-foreground tabular">
          <Money value={goal.saved} className="font-semibold text-foreground" /> {t('common.of')} <Money value={goal.target} />
        </p>
        <DeadlineLine goal={goal} />
        <AffordBadge goal={goal} available={available} avgSavings={avgSavings} />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-start">
        {!done && (
          <Button
            size="icon" className="h-10 w-10 rounded-xl" onClick={() => onContribute(goal)}
            aria-label={t('goals.contribute')} title={t('goals.contribute')}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <GoalMenu {...props} />
      </div>
    </li>
  );
}
