'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, deleteField, doc, getDocs, updateDoc } from 'firebase/firestore';
import { addWeeks, format, formatDistance, startOfWeek } from 'date-fns';
import { toast } from 'sonner';
import {
  Activity, Ban, Loader2, MoreHorizontal, RefreshCw, Search, Shield, ShieldOff, Trash2, TrendingUp,
  UserCheck, UserPlus, Users,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { PageContainer, PageHeader, Panel, Segmented, StatTile, EmptyState, ConfirmDialog } from '@/components/app/ui';
import { UserAvatar } from '@/components/app/user-avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { DATE_FNS_LOCALE, useLocale, useT } from '@/i18n';
import type { AppUser, Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'admins' | 'blocked';
type Confirm = { kind: 'delete' | 'block'; user: AppUser } | null;

const DAY = 86_400_000;
const WEEKS = 8;

function ts(iso?: string): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

function displayName(u: AppUser) {
  return u.name || u.email || u.id.slice(0, 6);
}

// ─── Growth chart ────────────────────────────────────────────────────────────

function GrowthChart({ users, now, locale }: { users: AppUser[]; now: number; locale: Locale }) {
  const t = useT();
  const weeks = useMemo(() => {
    const first = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), -(WEEKS - 1));
    const buckets = Array.from({ length: WEEKS }, (_, i) => ({ start: addWeeks(first, i), count: 0 }));
    for (const u of users) {
      const c = ts(u.createdAt);
      if (!c || c < first.getTime()) continue;
      const idx = Math.floor((c - first.getTime()) / (7 * DAY));
      if (idx >= 0 && idx < WEEKS) buckets[idx].count += 1;
    }
    return buckets;
  }, [users, now]);
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const dfLocale = DATE_FNS_LOCALE[locale];
  const label = (d: Date) => format(d, 'd MMM', { locale: dfLocale });

  return (
    <Panel title={t('admin.growthTitle')} icon={TrendingUp} action={<span className="text-xs text-muted-foreground">{t('admin.growthHint', { count: WEEKS })}</span>}>
      <ul className="flex h-40 items-end gap-1.5 sm:gap-2.5" aria-label={t('admin.growthTitle')}>
        {weeks.map((w, i) => {
          const last = i === weeks.length - 1;
          const text = t('admin.growthWeek', { date: label(w.start), count: w.count });
          return (
            <li key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={text}>
              <span className="sr-only">{text}</span>
              <span aria-hidden className={cn('text-[11px] font-bold tabular', w.count ? 'text-foreground' : 'text-muted-foreground/60')}>{w.count}</span>
              <span
                aria-hidden
                className={cn('w-full max-w-10 rounded-t-lg rounded-b-sm transition-[height] duration-500', last ? 'bg-primary' : 'bg-primary/35')}
                style={{ height: `${Math.max(4, (w.count / max) * 100)}%` }}
              />
              <span aria-hidden className="w-full truncate text-center text-[10px] text-muted-foreground">{label(w.start)}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ─── User row ────────────────────────────────────────────────────────────────

function UserRow({ user, self, now, locale, busy, onToggleAdmin, onBlock, onUnblock, onDelete }: {
  user: AppUser; self: boolean; now: number; locale: Locale; busy: boolean;
  onToggleAdmin: () => void; onBlock: () => void; onUnblock: () => void; onDelete: () => void;
}) {
  const t = useT();
  const dfLocale = DATE_FNS_LOCALE[locale];
  const name = displayName(user);
  const joined = ts(user.createdAt);
  const seen = ts(user.lastSeenAt);
  const isAdmin = user.role === 'admin';

  return (
    <li className={cn('flex items-center gap-3 rounded-2xl px-2 py-3 sm:px-3', user.blocked && 'opacity-70')}>
      <UserAvatar user={user} className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-[15px] font-bold">{name}</p>
          {self && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">{t('admin.you')}</span>}
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">
              <Shield className="h-3 w-3" /> {t('admin.roleAdmin')}
            </span>
          )}
          {user.blocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-expense/12 px-2 py-0.5 text-[10px] font-bold text-expense">
              <Ban className="h-3 w-3" /> {t('admin.blocked')}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground/90">
          {joined > 0 && <span>{t('admin.joined', { date: format(joined, 'd MMM yyyy', { locale: dfLocale }) })}</span>}
          <span>
            {seen > 0
              ? t('admin.lastSeen', { when: formatDistance(seen, now, { addSuffix: true, locale: dfLocale }) })
              : t('admin.neverSeen')}
          </span>
        </p>
      </div>

      {!self && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label={t('admin.actions', { name })}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-5 w-5" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
            <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={onToggleAdmin}>
              {isAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4 text-gold" />}
              {isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
            </DropdownMenuItem>
            {user.blocked ? (
              <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={onUnblock}>
                <UserCheck className="h-4 w-4 text-income" /> {t('admin.unblock')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="min-h-10 rounded-xl" onSelect={onBlock}>
                <Ban className="h-4 w-4 text-warning" /> {t('admin.block')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="min-h-10 rounded-xl" onSelect={onDelete}>
              <Trash2 className="h-4 w-4" /> {t('admin.deleteUser')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-1">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const t = useT();
  const locale = useLocale();
  const me = useAuthStore((s) => s.currentUser);

  const [data, setData] = useState<{ users: AppUser[]; loadedAt: number } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map((d) => ({ ...(d.data() as AppUser), id: d.id }));
      users.sort((a, b) => ts(b.createdAt) - ts(a.createdAt));
      setData({ users, loadedAt: Date.now() });
      setLoadError(false);
    } catch (err) {
      console.error('[admin] load users', err);
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const users = useMemo(() => data?.users ?? [], [data]);
  const now = data?.loadedAt ?? 0;

  const stats = useMemo(() => {
    const weekAgo = now - 7 * DAY;
    const active = users.filter((u) => ts(u.lastSeenAt) >= weekAgo).length;
    return {
      total: users.length,
      fresh: users.filter((u) => ts(u.createdAt) >= weekAgo).length,
      active,
      activePct: users.length ? Math.round((active / users.length) * 100) : 0,
      admins: users.filter((u) => u.role === 'admin').length,
      blocked: users.filter((u) => u.blocked).length,
    };
  }, [users, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'admins' && u.role !== 'admin') return false;
      if (filter === 'blocked' && !u.blocked) return false;
      if (!q) return true;
      return (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q);
    });
  }, [users, query, filter]);

  const patchLocal = (id: string, patch: Partial<AppUser>) =>
    setData((d) => d && { ...d, users: d.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) });

  const guardSelf = (u: AppUser) => u.id === me?.id;

  const toggleAdmin = async (u: AppUser) => {
    if (guardSelf(u)) return;
    const role = u.role === 'admin' ? 'user' : 'admin';
    setBusyId(u.id);
    try {
      await updateDoc(doc(db, 'users', u.id), { role });
      patchLocal(u.id, { role });
      toast.success(t(role === 'admin' ? 'admin.madeAdmin' : 'admin.removedAdmin', { name: displayName(u) }));
    } catch (err) {
      console.error(err);
      toast.error(t('admin.errUpdate'));
    } finally {
      setBusyId(null);
    }
  };

  const setBlocked = async (u: AppUser, blocked: boolean) => {
    if (guardSelf(u)) return;
    setBusyId(u.id);
    try {
      await updateDoc(doc(db, 'users', u.id), { blocked: blocked ? true : deleteField() });
      patchLocal(u.id, { blocked: blocked || undefined });
      toast.success(t(blocked ? 'admin.blockedToast' : 'admin.unblockedToast', { name: displayName(u) }));
    } catch (err) {
      console.error(err);
      toast.error(t('admin.errUpdate'));
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u: AppUser) => {
    if (guardSelf(u)) return;
    const fbUser = auth.currentUser;
    if (!fbUser) { toast.error(t('admin.errSession')); return; }
    setBusyId(u.id);
    try {
      const idToken = await fbUser.getIdToken();
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ uid: u.id }),
      });
      if (res.ok) {
        setData((d) => d && { ...d, users: d.users.filter((x) => x.id !== u.id) });
        toast.success(t('admin.deletedToast', { name: displayName(u) }));
        return;
      }
      if (res.status === 503) toast.error(t('admin.errNotConfigured'), { duration: 10_000 });
      else if (res.status === 401) toast.error(t('admin.errSession'));
      else if (res.status === 403) toast.error(t('admin.errForbidden'));
      else toast.error(t('admin.errDelete'));
    } catch (err) {
      console.error(err);
      toast.error(t('admin.errDelete'));
    } finally {
      setBusyId(null);
    }
  };

  const ask = (kind: 'delete' | 'block', user: AppUser) => {
    setConfirm({ kind, user });
    setConfirmOpen(true);
  };

  const filterCounts: Record<Filter, number> = { all: users.length, admins: stats.admins, blocked: stats.blocked };
  const loading = !data && !loadError;

  return (
    <PageContainer className="pb-12">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        actions={
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            aria-label={t('admin.refresh')}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold card-shadow transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
            <span className="hidden sm:inline">{t('admin.refresh')}</span>
          </button>
        }
      />

      {loadError && (
        <div role="alert" className="mb-5 rounded-2xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive">
          {t('admin.errLoad')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)
        ) : (
          <>
            <StatTile icon={Users} label={t('admin.statTotal')} value={<span className="font-display tabular">{stats.total}</span>} hint={t('admin.statBlocked', { count: stats.blocked })} />
            <StatTile icon={UserPlus} tone="income" label={t('admin.statNew')} value={<span className="font-display tabular">{stats.fresh}</span>} />
            <StatTile icon={Activity} tone="warning" label={t('admin.statActive')} value={<span className="font-display tabular">{stats.active}</span>} hint={t('admin.statActivePct', { pct: stats.activePct })} />
            <StatTile icon={Shield} tone="gold" label={t('admin.statAdmins')} value={<span className="font-display tabular">{stats.admins}</span>} />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-3 lg:gap-5">
        <div className="lg:col-span-1">
          {loading ? <Skeleton className="h-60 rounded-3xl" /> : <GrowthChart users={users} now={now} locale={locale} />}
        </div>

        <Panel
          className="p-3 sm:p-4 lg:col-span-2"
          title={<span className="px-1">{t('admin.usersTitle')}</span>}
          action={<span className="text-xs text-muted-foreground tabular">{t('admin.count', { count: visible.length })}</span>}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">{t('common.search')}</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('admin.searchPlaceholder')}
                className="h-11 w-full rounded-2xl border border-input bg-background pr-3 pl-10 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:text-sm dark:bg-input/30"
              />
            </label>
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              size="sm"
              className="w-full sm:w-auto"
              options={(['all', 'admins', 'blocked'] as const).map((f) => ({
                value: f,
                label: (
                  <span className="flex items-center justify-center gap-1.5 py-1">
                    {t(`admin.filter${f[0].toUpperCase()}${f.slice(1)}`)}
                    <span className="text-[10px] tabular opacity-60">{filterCounts[f]}</span>
                  </span>
                ),
              }))}
            />
          </div>

          <div className="mt-2">
            {loading ? (
              <ListSkeleton />
            ) : visible.length === 0 ? (
              <EmptyState icon={Search} title={t('admin.empty')} className="py-8" />
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    self={u.id === me?.id}
                    now={now}
                    locale={locale}
                    busy={busyId === u.id}
                    onToggleAdmin={() => void toggleAdmin(u)}
                    onBlock={() => ask('block', u)}
                    onUnblock={() => void setBlocked(u, false)}
                    onDelete={() => ask('delete', u)}
                  />
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirm && t(confirm.kind === 'delete' ? 'admin.deleteTitle' : 'admin.blockTitle', { name: displayName(confirm.user) })}
        text={confirm && t(confirm.kind === 'delete' ? 'admin.deleteText' : 'admin.blockText')}
        confirmLabel={confirm && t(confirm.kind === 'delete' ? 'admin.deleteUser' : 'admin.block')}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === 'delete') void deleteUser(confirm.user);
          else void setBlocked(confirm.user, true);
        }}
      />
    </PageContainer>
  );
}
