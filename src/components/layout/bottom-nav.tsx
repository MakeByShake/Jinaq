'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, PieChart, Plus, Grid2x2, Shield } from 'lucide-react';
import { useQuickAdd } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { ResponsiveSheet } from '@/components/app/sheet';
import { NAV_ITEMS, SETTINGS_ITEM, isActive } from './nav-items';

const PRIMARY = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'overview' },
  { href: '/dashboard/transactions', icon: ArrowLeftRight, key: 'transactions' },
  null, // FAB slot
  { href: '/dashboard/analytics', icon: PieChart, key: 'analytics' },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const openAdd = useQuickAdd((s) => s.openAdd);
  const isAdmin = useAuthStore((s) => s.currentUser?.role === 'admin');
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryHrefs = PRIMARY.filter(Boolean).map((p) => p!.href);
  const moreActive = !primaryHrefs.some((h) => isActive(pathname, h)) && pathname.startsWith('/dashboard');

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/90 px-[env(safe-area-inset-left)] backdrop-blur-xl md:hidden safe-bottom">
        <div className="mx-auto flex h-16 max-w-md items-stretch px-1 min-[360px]:px-2">
          {PRIMARY.map((item, i) =>
            item ? (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors',
                  isActive(pathname, item.href) ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-[22px] w-[22px]" strokeWidth={isActive(pathname, item.href) ? 2.4 : 2} />
                <span className="max-w-full truncate">{t(`nav.${item.key}`)}</span>
              </Link>
            ) : (
              <div key={`fab-${i}`} className="flex flex-1 items-start justify-center">
                <button
                  type="button"
                  onClick={() => openAdd('expense')}
                  aria-label={t('nav.add')}
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-90"
                >
                  <Plus className="h-7 w-7" strokeWidth={2.6} />
                </button>
              </div>
            ),
          )}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold',
              moreActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Grid2x2 className="h-[22px] w-[22px]" />
            <span className="max-w-full truncate">{t('common.more')}</span>
          </button>
        </div>
      </nav>

      <ResponsiveSheet open={moreOpen} onOpenChange={setMoreOpen} title={t('common.more')}>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {[...NAV_ITEMS.filter((i) => !primaryHrefs.includes(i.href)), SETTINGS_ITEM].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-semibold transition-colors',
                isActive(pathname, item.href) ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <item.icon className="h-5 w-5" />
              </span>
              {t(`nav.${item.key}`)}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center text-xs font-semibold hover:bg-muted"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Shield className="h-5 w-5" />
              </span>
              {t('nav.admin')}
            </Link>
          )}
        </div>
      </ResponsiveSheet>
    </>
  );
}
