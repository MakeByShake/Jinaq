'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/logo';
import { UserAvatar } from '@/components/app/user-avatar';
import { usePwa } from '@/hooks/use-pwa';
import { useT } from '@/i18n';
import { NAV_ITEMS, SETTINGS_ITEM, isActive } from './nav-items';

export function MobileHeader() {
  const pathname = usePathname();
  const t = useT();
  const { installPrompt, isInstalled, isIos, installApp } = usePwa();
  const item = [...NAV_ITEMS, SETTINGS_ITEM].find((i) => isActive(pathname, i.href));

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl md:hidden safe-top">
      <div className="flex h-14 items-center justify-between gap-2 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="truncate text-base font-extrabold tracking-tight">
            {item ? t(`nav.${item.key}`) : 'Jinaq'}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {!isInstalled && (installPrompt || isIos) && (
            <button
              type="button"
              aria-label={t('common.install')}
              onClick={() => (installPrompt ? installApp() : toast(t('common.iosInstall'), { duration: 6000 }))}
              className="flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 text-xs font-bold text-accent-foreground"
            >
              <Download className="h-3.5 w-3.5" /> {t('common.installShort')}
            </button>
          )}
          <Link href="/dashboard/settings" aria-label={t('nav.settings')}>
            <UserAvatar className="h-8 w-8" />
          </Link>
        </div>
      </div>
    </header>
  );
}
