'use client';

import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveSheet } from '@/components/app/sheet';
import { Field, Segmented } from '@/components/app/ui';
import { ColorPicker, IconPicker } from '@/components/app/pickers';
import { IconBubble, PALETTE } from '@/lib/icons';
import { deleteGoal, newId, saveGoal } from '@/lib/actions';
import { useData } from '@/stores/data-store';
import { useT } from '@/i18n';
import type { Goal, GoalPriority, GoalStatus } from '@/lib/types';
import { normalizeUrl, parseAmount } from './money-fields';

export const PRIORITIES: GoalPriority[] = ['need', 'want', 'dream'];
export const STATUSES: GoalStatus[] = ['wish', 'saving', 'done'];

/**
 * Create / edit sheet. Mount with a fresh `key` every time it opens so the
 * form initialises from `goal` / `preset`.
 */
export function GoalFormSheet({ open, onOpenChange, goal, preset, onDelete }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goal?: Goal;
  preset?: Partial<Goal>;
  onDelete?: (g: Goal) => void;
}) {
  const t = useT();
  const goals = useData((s) => s.goals);
  const base = goal ?? preset ?? {};

  const [title, setTitle] = useState(base.title ?? '');
  const [target, setTarget] = useState(base.target ? String(base.target) : '');
  const [saved, setSaved] = useState(base.saved ? String(base.saved) : '');
  const [priority, setPriority] = useState<GoalPriority>(base.priority ?? 'want');
  const [status, setStatus] = useState<GoalStatus>(base.status ?? 'wish');
  const [deadline, setDeadline] = useState(base.deadline ?? '');
  const [icon, setIcon] = useState(base.icon ?? 'target');
  const [color, setColor] = useState(base.color ?? PALETTE[0]);
  const [note, setNote] = useState(base.note ?? '');
  const [link, setLink] = useState(base.link ?? '');

  function submit() {
    const targetNum = parseAmount(target);
    const savedNum = saved.trim() ? parseAmount(saved) : 0;
    if (!title.trim()) return toast.error(t('goals.titleRequired'));
    if (!Number.isFinite(targetNum) || targetNum <= 0) return toast.error(t('goals.targetRequired'));
    if (!Number.isFinite(savedNum) || savedNum < 0) return toast.error(t('common.invalidAmount'));

    // A wish that already has money in it is effectively being saved for.
    const finalStatus: GoalStatus = status === 'wish' && savedNum > 0 ? 'saving' : status;
    const now = new Date().toISOString();
    const next: Goal = {
      id: goal?.id ?? newId('goal'),
      title: title.trim(),
      icon,
      color,
      target: targetNum,
      saved: savedNum,
      status: finalStatus,
      priority,
      deadline: deadline || undefined,
      note: note.trim() || undefined,
      link: normalizeUrl(link),
      order: goal?.order ?? goals.reduce((m, g) => Math.max(m, g.order ?? 0), 0) + 1,
      createdAt: goal?.createdAt ?? now,
      completedAt: finalStatus === 'done' ? (goal?.completedAt ?? now) : undefined,
    };
    saveGoal(next);

    if (goal) {
      const prev = goal;
      toast.success(t('goals.updated'), { action: { label: t('common.undo'), onClick: () => saveGoal(prev) } });
    } else {
      toast.success(t('goals.created'), { action: { label: t('common.undo'), onClick: () => deleteGoal(next.id) } });
    }
    onOpenChange(false);
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? t('goals.editTitle') : t('goals.newTitle')}
      footer={
        <div className="flex gap-2">
          {goal && onDelete && (
            <Button
              variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-2xl text-destructive"
              onClick={() => onDelete(goal)} aria-label={t('common.delete')}
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
        <div className="flex items-end gap-3">
          <IconBubble icon={icon} color={color} size="lg" />
          <Field label={t('goals.fieldTitle')} className="flex-1">
            <Input
              value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('goals.titlePlaceholder')}
              className="h-11 rounded-xl" maxLength={60}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('goals.fieldTarget')}>
            <Input
              value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="0"
              className="h-11 rounded-xl tabular"
            />
          </Field>
          <Field label={t('goals.fieldSaved')}>
            <Input
              value={saved} onChange={(e) => setSaved(e.target.value)} inputMode="decimal" placeholder="0"
              className="h-11 rounded-xl tabular"
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{t('goals.amountHint')}</p>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('goals.priority')}</p>
          <Segmented
            value={priority} onChange={setPriority} className="w-full"
            options={PRIORITIES.map((p) => ({ value: p, label: t(`goals.priority_${p}`) }))}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('goals.status')}</p>
          <Segmented
            value={status} onChange={setStatus} className="w-full"
            options={STATUSES.map((s) => ({ value: s, label: t(`goals.status_${s}`) }))}
          />
        </div>

        <Field label={t('goals.fieldDeadline')}>
          <div className="flex gap-2">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-11 flex-1 rounded-xl" />
            {deadline && (
              <Button
                type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl"
                onClick={() => setDeadline('')} aria-label={t('goals.clearDate')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Field>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.icon')}</p>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.color')}</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <Field label={t('goals.fieldLink')}>
          <Input
            type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder={t('goals.linkPlaceholder')} className="h-11 rounded-xl"
          />
        </Field>
        <Field label={t('goals.fieldNote')}>
          <Textarea
            value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('goals.notePlaceholder')}
            className="min-h-20 rounded-xl" maxLength={300}
          />
        </Field>
        {/* Lets Enter submit on desktop */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </ResponsiveSheet>
  );
}
