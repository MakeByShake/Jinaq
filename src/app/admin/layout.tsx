'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { SplashScreen } from '@/components/app/splash';
import { LogoMark } from '@/components/brand/logo';
import { UserAvatar } from '@/components/app/user-avatar';
import { LanguageSwitcher, ThemeButton } from '@/components/auth/auth-shell';
import { useT } from '@/i18n';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const router = useRouter();
  const isAdmin = currentUser?.role === 'admin' && !currentUser.blocked;

  useEffect(() => {
    if (isLoading) return;
    if (!currentUser) router.replace('/login');
    else if (!isAdmin) router.replace('/dashboard');
  }, [currentUser, isAdmin, isLoading, router]);

  if (isLoading || !isAdmin) return <SplashScreen />;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl safe-top">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/dashboard"
              className="flex h-10 items-center gap-1.5 rounded-xl pr-2.5 pl-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t('admin.backToApp')}</span>
            </Link>
            <LogoMark className="h-8 w-8" />
            <span className="flex min-w-0 items-center gap-1.5 truncate text-base font-extrabold tracking-tight">
              <Shield className="h-4 w-4 shrink-0 text-gold" />
              <span className="truncate">{t('admin.title')}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <ThemeButton />
            <UserAvatar className="hidden h-9 w-9 sm:flex" />
          </div>
        </div>
      </header>
      <main className="pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
