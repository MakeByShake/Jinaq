'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import type { AppUser } from '@/lib/types';
import { cn } from '@/lib/utils';

export function initials(name?: string) {
  return (name ?? '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function UserAvatar({ user, className }: { user?: AppUser | null; className?: string }) {
  const current = useAuthStore((s) => s.currentUser);
  const u = user ?? current;
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {u?.avatar && <AvatarImage src={u.avatar} alt={u.name} />}
      <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">{initials(u?.name)}</AvatarFallback>
    </Avatar>
  );
}
