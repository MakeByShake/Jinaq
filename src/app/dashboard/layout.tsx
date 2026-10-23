'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useData } from '@/stores/data-store';
import { useQuickAdd } from '@/stores/ui-store';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { MobileHeader } from '@/components/layout/mobile-header';
import { QuickAddSheet } from '@/components/app/quick-add';
import { Onboarding } from '@/components/app/onboarding';
import { SplashScreen } from '@/components/app/splash';
import { ensureDefaultCategories } from '@/lib/actions';

/** Opens quick add from PWA shortcuts (?add=expense) and the "N" key. */
function QuickAddTriggers() {
  const params = useSearchParams();
  const router = useRouter();
  const openAdd = useQuickAdd((s) => s.openAdd);

  useEffect(() => {
    const add = params.get('add');
    if (add === 'expense' || add === 'income' || add === 'transfer') {
      openAdd(add);
      router.replace(window.location.pathname);
    }
  }, [params, openAdd, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        openAdd('expense');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAdd]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.currentUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const loaded = useData((s) => s.loaded);
  const categoriesCount = useData((s) => s.categories.length);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  // Accounts that finished onboarding but lost categories get the defaults back.
  useEffect(() => {
    if (loaded && user?.onboarded && categoriesCount === 0) ensureDefaultCategories();
  }, [loaded, user?.onboarded, categoriesCount]);

  if (isLoading || !user || !loaded) return <SplashScreen />;
  if (!user.onboarded) return <Onboarding />;

  return (
    <div className="min-h-dvh bg-background">
      <DesktopSidebar />
      <MobileHeader />
      <main className="min-h-dvh pt-[calc(3.5rem+env(safe-area-inset-top))] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] md:ml-[76px] md:pt-0 md:pl-0 lg:ml-64">{children}</main>
      <BottomNav />
      <QuickAddSheet />
      <Suspense fallback={null}>
        <QuickAddTriggers />
      </Suspense>
    </div>
  );
}
