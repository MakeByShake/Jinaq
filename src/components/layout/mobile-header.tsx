'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Wallet, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { usePwa } from '@/hooks/use-pwa';
import { toast } from 'sonner';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Мои цели',
  '/dashboard/wishlist': 'Вишлист',
  '/dashboard/calculations': 'Расчёты',
  '/dashboard/income': 'Доходы / Расходы',
  '/dashboard/debts': 'Долги',
  '/dashboard/history': 'История',
  '/dashboard/profile': 'Профиль',
  '/admin': 'Администратор',
};

export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentMoney = useWalletStore((s) => s.currentMoney);

  const title = PAGE_TITLES[pathname] ?? 'PFA';
  const { installPrompt, isInstalled, isIos, installApp } = usePwa();

  const handleLogout = () => {
    logout();
    toast.success('Вы вышли');
    router.push('/login');
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border safe-top">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <MobileNavDrawer />
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="text-sm font-semibold text-emerald-400 mr-2">
            {currentMoney.toLocaleString('ru-RU')} {currentUser?.currency ?? '₸'}
          </div>
          {!isInstalled && (installPrompt || isIos) && (
            <button
              onClick={() => {
                if (installPrompt) {
                  installApp();
                  toast.success('Приложение устанавливается...');
                } else {
                  toast('Нажми Share → «На экран Домой»', {
                    description: 'Так ты установишь PFA как приложение',
                    duration: 6000,
                  });
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 active:scale-95 transition-all"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Download className="h-3 w-3" />
            </button>
          )}
          {pathname === '/dashboard' && <ThemeToggle />}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
