'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Shield, LogOut, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/logo';
import { UserAvatar } from '@/components/app/user-avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { useQuickAdd } from '@/stores/ui-store';
import { useBalances } from '@/hooks/use-finance';
import { usePwa } from '@/hooks/use-pwa';
import { useMoney } from '@/lib/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SETTINGS_ITEM, isActive, type NavItem } from './nav-items';

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const fmt = useMoney();
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const openAdd = useQuickAdd((s) => s.openAdd);
  const { total } = useBalances();
  const { installPrompt, isInstalled, installApp } = usePwa();

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        href={item.href}
        className={cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
          active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
        {t(`nav.${item.key}`)}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="px-5 pt-5 pb-4">
        <Link href="/dashboard" aria-label="Jinaq"><Logo /></Link>
      </div>

      <div className="mx-4 rounded-2xl bg-brand-gradient p-4 text-white shadow-lg shadow-emerald-900/20">
        <p className="text-xs font-medium text-white/75">{t('common.balance')}</p>
        <p className="mt-0.5 truncate font-display text-xl font-semibold tabular">{fmt(total)}</p>
        <Button
          onClick={() => openAdd('expense')}
          className="mt-3 h-9 w-full rounded-xl bg-white/95 font-bold text-emerald-800 hover:bg-white"
        >
          <Plus className="h-4 w-4" /> {t('nav.add')}
          <kbd className="ml-auto rounded bg-emerald-900/10 px-1.5 text-[10px] font-semibold">N</kbd>
        </Button>
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{t('nav.sectionMoney')}</p>
          {NAV_ITEMS.filter((i) => i.section === 'money').map((i) => <NavLink key={i.href} item={i} />)}
        </div>
        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">{t('nav.sectionPlan')}</p>
          {NAV_ITEMS.filter((i) => i.section === 'plan').map((i) => <NavLink key={i.href} item={i} />)}
        </div>
        <div className="space-y-0.5 border-t border-sidebar-border pt-3">
          <NavLink item={SETTINGS_ITEM} />
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent/60"
            >
              <Shield className="h-[18px] w-[18px] text-gold" /> {t('nav.admin')}
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {installPrompt && !isInstalled && (
          <Button variant="ghost" size="sm" onClick={installApp} className="mb-1 w-full justify-start gap-2 rounded-xl text-primary">
            <Download className="h-4 w-4" /> {t('common.install')}
          </Button>
        )}
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Link href="/dashboard/settings" className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.logout')}
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
            onClick={async () => { await logout(); toast.success(t('common.loggedOut')); router.push('/login'); }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
