import {
  LayoutDashboard, ArrowLeftRight, PieChart, Wallet, Gauge, Target, CalendarClock, HandCoins,
  Calculator, Settings, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  key: string; // nav.<key>
  section: 'money' | 'plan';
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'overview', section: 'money' },
  { href: '/dashboard/transactions', icon: ArrowLeftRight, key: 'transactions', section: 'money' },
  { href: '/dashboard/analytics', icon: PieChart, key: 'analytics', section: 'money' },
  { href: '/dashboard/accounts', icon: Wallet, key: 'accounts', section: 'money' },
  { href: '/dashboard/budgets', icon: Gauge, key: 'budgets', section: 'plan' },
  { href: '/dashboard/goals', icon: Target, key: 'goals', section: 'plan' },
  { href: '/dashboard/recurring', icon: CalendarClock, key: 'recurring', section: 'plan' },
  { href: '/dashboard/debts', icon: HandCoins, key: 'debts', section: 'plan' },
  { href: '/dashboard/planner', icon: Calculator, key: 'planner', section: 'plan' },
];

export const SETTINGS_ITEM: NavItem = { href: '/dashboard/settings', icon: Settings, key: 'settings', section: 'plan' };

export function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
}
