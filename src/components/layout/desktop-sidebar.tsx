'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, Shield, LogOut, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Logo, LogoMark } from '@/components/brand/logo';
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

/*
 * Two layouts in one component:
 *  - md (tablets, 768–1023px): a slim 76px icon rail with tooltips
 *  - lg+ (laptops/desktops): the full 256px sidebar with labels
 * Phones use MobileHeader + BottomNav instead.
 */

function NavLink({ item, pathname, label }: { item: NavItem; pathname: string; label: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={label}
      aria-label={label}
      className={cn(
        'group flex items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-colors lg:justify-start lg:px-3 lg:py-2',
        active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <item.icon className={cn('h-5 w-5 shrink-0 lg:h-[18px] lg:w-[18px]', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      <span className="hidden truncate lg:inline">{label}</span>
    </Link>
  );
}

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

  const doLogout = async () => {
    await logout();
    toast.success(t('common.loggedOut'));
    router.push('/login');
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-sidebar-border bg-sidebar pl-[env(safe-area-inset-left)] md:flex lg:w-64">
      <div className="flex justify-center pt-5 pb-4 lg:justify-start lg:px-5">
        <Link href="/dashboard" aria-label="Jinaq">
          <LogoMark className="h-10 w-10 lg:hidden" />
          <Logo className="hidden lg:inline-flex" />
        </Link>
      </div>

      {/* Rail: just the add button. Full: balance card + add button. */}
      <div className="flex justify-center lg:hidden">
        <button
          type="button"
          onClick={() => openAdd('expense')}
          aria-label={t('nav.add')}
          title={`${t('nav.add')} (N)`}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/30 transition-transform active:scale-95"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </button>
      </div>
      <div className="mx-4 hidden rounded-2xl bg-brand-gradient p-4 text-white shadow-lg shadow-emerald-900/20 lg:block">
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

      <nav className="mt-4 flex-1 space-y-4 overflow-y-auto px-3 pb-4 scrollbar-hide lg:space-y-5">
        <div className="space-y-1 lg:space-y-0.5">
          <p className="hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 lg:block">{t('nav.sectionMoney')}</p>
          {NAV_ITEMS.filter((i) => i.section === 'money').map((i) => <NavLink key={i.href} item={i} pathname={pathname} label={t(`nav.${i.key}`)} />)}
        </div>
        <div className="space-y-1 border-t border-sidebar-border pt-4 lg:space-y-0.5 lg:border-0 lg:pt-0">
          <p className="hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 lg:block">{t('nav.sectionPlan')}</p>
          {NAV_ITEMS.filter((i) => i.section === 'plan').map((i) => <NavLink key={i.href} item={i} pathname={pathname} label={t(`nav.${i.key}`)} />)}
        </div>
        <div className="space-y-1 border-t border-sidebar-border pt-3 lg:space-y-0.5">
          <NavLink item={SETTINGS_ITEM} pathname={pathname} label={t(`nav.${SETTINGS_ITEM.key}`)} />
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              title={t('nav.admin')}
              aria-label={t('nav.admin')}
              className="flex items-center justify-center gap-3 rounded-xl py-2.5 text-sm font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent/60 lg:justify-start lg:px-3 lg:py-2"
            >
              <Shield className="h-5 w-5 text-gold lg:h-[18px] lg:w-[18px]" />
              <span className="hidden lg:inline">{t('nav.admin')}</span>
            </Link>
          )}
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {installPrompt && !isInstalled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={installApp}
            title={t('common.install')}
            className="mb-1 w-full justify-center gap-2 rounded-xl text-primary lg:justify-start"
          >
            <Download className="h-4 w-4" /> <span className="hidden lg:inline">{t('common.install')}</span>
          </Button>
        )}
        <div className="flex flex-col items-center gap-2 rounded-xl lg:flex-row lg:gap-3 lg:p-2">
          <Link href="/dashboard/settings" className="flex min-w-0 flex-1 items-center gap-3" title={user?.name}>
            <UserAvatar className="h-9 w-9" />
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.logout')}
            title={t('common.logout')}
            className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-destructive"
            onClick={doLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
