'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, ShoppingBag, Calculator, TrendingUp, CreditCard, Clock,
  User, Shield, LogOut, Wallet, ChevronRight, Download,
} from 'lucide-react';
import { cn, formatMoneyCompact } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { usePwa } from '@/hooks/use-pwa';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const USER_NAV = [
  { href: '/dashboard', icon: Home, label: 'Главная (Цели)' },
  { href: '/dashboard/wishlist', icon: ShoppingBag, label: 'Вишлист' },
  { href: '/dashboard/calculations', icon: Calculator, label: 'Расчёты' },
  { href: '/dashboard/income', icon: TrendingUp, label: 'Доходы / Расходы' },
  { href: '/dashboard/debts', icon: CreditCard, label: 'Долги' },
  { href: '/dashboard/history', icon: Clock, label: 'История' },
  { href: '/dashboard/profile', icon: User, label: 'Профиль' },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const currentMoney = useWalletStore((s) => s.currentMoney);

  const handleLogout = () => {
    logout();
    toast.success('Вы вышли из аккаунта');
    router.push('/login');
  };

  const { installPrompt, isInstalled, installApp } = usePwa();

  const initials = currentUser?.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-500 shadow-md shadow-emerald-500/30">
          <Wallet className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sidebar-foreground text-sm">PFA</p>
          <p className="text-[11px] text-muted-foreground leading-none">Finance App</p>
        </div>
      </div>

      {/* Wallet chip */}
      <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <p className="text-xs text-muted-foreground mb-1">Текущий баланс</p>
        <p className="text-xl font-bold text-emerald-400 tabular-nums">
          {formatMoneyCompact(currentMoney)} {currentUser?.currency ?? '₸'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {currentUser?.role === 'admin' && (
          <>
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith('/admin')
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Shield className="h-4 w-4" />
              Панель администратора
            </Link>
            <Separator className="my-2 bg-sidebar-border" />
          </>
        )}
        {USER_NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="h-3 w-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9 border-2 border-emerald-500/30">
            <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
          </div>
        </div>
        {installPrompt && !isInstalled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { installApp(); toast.success('Установка приложения...'); }}
            className="w-full justify-start gap-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 mb-1"
          >
            <Download className="h-4 w-4" />
            Установить приложение
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </aside>
  );
}
