import {
  LayoutDashboard, ArrowLeftRight, PieChart, Gauge, Target, CalendarClock, HandCoins,
  Calculator, UserRound, type LucideIcon,
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
  { href: '/dashboard/budgets', icon: Gauge, key: 'budgets', section: 'plan' },
  { href: '/dashboard/goals', icon: Target, key: 'goals', section: 'plan' },
  { href: '/dashboard/recurring', icon: CalendarClock, key: 'recurring', section: 'plan' },
  { href: '/dashboard/debts', icon: HandCoins, key: 'debts', section: 'plan' },
  { href: '/dashboard/planner', icon: Calculator, key: 'planner', section: 'plan' },
];

/** Profile hub: personal info, my accounts and all settings. */
export const SETTINGS_ITEM: NavItem = { href: '/dashboard/profile', icon: UserRound, key: 'profile', section: 'plan' };

export function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  // "My accounts" lives inside the profile.
  if (href === '/dashboard/profile' && pathname.startsWith('/dashboard/accounts')) return true;
  return pathname.startsWith(href);
}
