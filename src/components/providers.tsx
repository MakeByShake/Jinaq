'use client';

import { useEffect, useRef } from 'react';
import { ThemeProvider } from 'next-themes';
import { WifiOff } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { useFirebaseData } from '@/hooks/use-firebase-data';
import { usePwa } from '@/hooks/use-pwa';
import { initLocale, useLocaleStore, useT } from '@/i18n';
import { useAuthStore } from '@/stores/auth-store';

function FirebaseInit() {
  useFirebaseData();
  return null;
}

/** Restores the saved language, then follows the profile language once it loads. */
function LocaleInit() {
  const profileLocale = useAuthStore((s) => s.currentUser?.locale);
  const synced = useRef(false);

  useEffect(() => {
    initLocale();
  }, []);

  useEffect(() => {
    if (profileLocale && !synced.current) {
      synced.current = true;
      useLocaleStore.getState().setLocale(profileLocale);
    }
    if (!profileLocale) synced.current = false;
  }, [profileLocale]);

  return null;
}

function OfflineBanner() {
  const { isOnline } = usePwa();
  const t = useT();
  if (isOnline) return null;
  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-warning px-4 py-1.5 text-xs font-semibold text-black safe-top"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>{t('common.offline')}</span>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <FirebaseInit />
      <LocaleInit />
      <OfflineBanner />
      {children}
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}
