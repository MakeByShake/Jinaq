'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, ShoppingBag, Calculator, TrendingUp, CreditCard, Clock,
  User, Shield, LogOut, Wallet, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, label: 'Главная (Цели)' },
  { href: '/dashboard/wishlist', icon: ShoppingBag, label: 'Вишлист' },
  { href: '/dashboard/calculations', icon: Calculator, label: 'Расчёты' },
  { href: '/dashboard/income', icon: TrendingUp, label: 'Доходы / Расходы' },
  { href: '/dashboard/debts', icon: CreditCard, label: 'Долги' },
  { href: '/dashboard/history', icon: Clock, label: 'История' },
  { href: '/dashboard/profile', icon: User, label: 'Профиль' },
];

export function MobileNavDrawer() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const pendingUsers = useAuthStore((s) => s.pendingUsers);
  const logout = useAuthStore((s) => s.logout);
  const currentMoney = useWalletStore((s) => s.currentMoney);
  const [open, setOpen] = useState(false);

  const initials = currentUser?.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  const handleLogout = () => {
    setOpen(false);
    logout();
    toast.success('Вы вышли из аккаунта');
    router.push('/login');
  };

  const handleNav = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col bg-card border-r border-border">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-500">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">PFA</p>
            <p className="text-[11px] text-muted-foreground leading-none">Finance App</p>
          </div>
        </div>

        {/* Balance */}
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs text-muted-foreground mb-0.5">Текущий баланс</p>
          <p className="text-xl font-bold text-emerald-400">
            {currentMoney.toLocaleString('ru-RU')} {currentUser?.currency ?? '₸'}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => handleNav('/admin')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                  pathname.startsWith('/admin')
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">Панель администратора</span>
                {pendingUsers.length > 0 && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{pendingUsers.length}</Badge>
                )}
              </button>
              <Separator className="my-2" />
            </>
          )}
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => handleNav(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                  active
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9 border-2 border-emerald-500/30">
              <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} />
              <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
            </div>
          </div>
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
      </SheetContent>
    </Sheet>
  );
}
