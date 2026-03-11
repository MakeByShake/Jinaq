'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Wallet, Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { usePwa } from '@/hooks/use-pwa';
import { formatMoneyCompact } from '@/lib/utils';
import { toast } from 'sonner';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Мои цели',
  '/dashboard/wishlist': 'Вишлист',
  '/dashboard/calculations': 'Расчёты',
  '/dashboard/income': 'Доходы',
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
  const [iosModal, setIosModal] = useState(false);

  const title = PAGE_TITLES[pathname] ?? 'PFA';
  const { installPrompt, isInstalled, isIos, installApp } = usePwa();

  const handleLogout = () => {
    logout();
    toast.success('Вы вышли');
    router.push('/login');
  };

  const handleInstall = async () => {
    if (installPrompt) {
      await installApp();
    } else if (isIos) {
      setIosModal(true);
    }
  };

  return (
    <>
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
            <div className="text-sm font-semibold text-emerald-400 mr-2 tabular-nums">
              {formatMoneyCompact(currentMoney)} {currentUser?.currency ?? '₸'}
            </div>
            {!isInstalled && (installPrompt || isIos) && (
              <button
                onClick={handleInstall}
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

      {/* iOS install instructions modal */}
      {iosModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm md:hidden">
          <div className="w-full bg-card rounded-t-2xl p-6 pb-10 border-t border-border shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Установить приложение</h2>
              <button onClick={() => setIosModal(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              На iPhone/iPad установить PWA можно через Safari:
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-medium">Открой эту страницу в Safari</p>
                  <p className="text-xs text-muted-foreground">Если ты в Chrome — скопируй ссылку и открой в Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Нажми кнопку</p>
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs font-medium">
                    <Share className="h-3.5 w-3.5" /> Поделиться
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-medium">Выбери «На экран Домой»</p>
                  <p className="text-xs text-muted-foreground">Прокрути список действий вниз</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
                <div>
                  <p className="text-sm font-medium">Нажми «Добавить»</p>
                  <p className="text-xs text-muted-foreground">PFA появится на главном экране как обычное приложение</p>
                </div>
              </div>
            </div>
            <Button onClick={() => setIosModal(false)} className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white">
              Понятно
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
