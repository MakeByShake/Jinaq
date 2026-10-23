'use client';

import { Check } from 'lucide-react';
import { ICON_KEYS, PALETTE, getIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110"
          style={{ backgroundColor: c, boxShadow: value === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined }}
        >
          {value === c && <Check className="h-4 w-4 text-white" />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange, color = '#10B981', keys = ICON_KEYS }: {
  value: string; onChange: (k: string) => void; color?: string; keys?: string[];
}) {
  return (
    <div className="grid max-h-48 grid-cols-7 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-9">
      {keys.map((k) => {
        const Icon = getIcon(k);
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            aria-label={k}
            onClick={() => onChange(k)}
            className={cn(
              'flex aspect-square items-center justify-center rounded-xl border transition-colors',
              active ? 'border-transparent' : 'border-border text-muted-foreground hover:bg-muted',
            )}
            style={active ? { backgroundColor: `${color}22`, color, borderColor: color } : undefined}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
