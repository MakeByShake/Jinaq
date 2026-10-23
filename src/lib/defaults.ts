import type { Account, Category, CurrencyCode } from './types';

type CategorySeed = Pick<Category, 'kind' | 'key' | 'icon' | 'color'>;

export const DEFAULT_EXPENSE_CATEGORIES: CategorySeed[] = [
  { kind: 'expense', key: 'groceries', icon: 'cart', color: '#10B981' },
  { kind: 'expense', key: 'cafe', icon: 'coffee', color: '#F97316' },
  { kind: 'expense', key: 'transport', icon: 'bus', color: '#3B82F6' },
  { kind: 'expense', key: 'taxi', icon: 'taxi', color: '#F59E0B' },
  { kind: 'expense', key: 'housing', icon: 'home', color: '#6366F1' },
  { kind: 'expense', key: 'mobile', icon: 'wifi', color: '#06B6D4' },
  { kind: 'expense', key: 'subscriptions', icon: 'repeat', color: '#A855F7' },
  { kind: 'expense', key: 'health', icon: 'health', color: '#EF4444' },
  { kind: 'expense', key: 'clothes', icon: 'shirt', color: '#EC4899' },
  { kind: 'expense', key: 'beauty', icon: 'beauty', color: '#D946EF' },
  { kind: 'expense', key: 'fun', icon: 'game', color: '#8B5CF6' },
  { kind: 'expense', key: 'education', icon: 'education', color: '#14B8A6' },
  { kind: 'expense', key: 'gifts', icon: 'gift', color: '#F43F5E' },
  { kind: 'expense', key: 'travel', icon: 'plane', color: '#0EA5E9' },
  { kind: 'expense', key: 'sport', icon: 'sport', color: '#84CC16' },
  { kind: 'expense', key: 'home_goods', icon: 'sofa', color: '#A16207' },
  { kind: 'expense', key: 'savings', icon: 'piggy', color: '#059669' },
  { kind: 'expense', key: 'other', icon: 'more', color: '#64748B' },
];

export const DEFAULT_INCOME_CATEGORIES: CategorySeed[] = [
  { kind: 'income', key: 'salary', icon: 'briefcase', color: '#10B981' },
  { kind: 'income', key: 'scholarship', icon: 'education', color: '#3B82F6' },
  { kind: 'income', key: 'freelance', icon: 'laptop', color: '#8B5CF6' },
  { kind: 'income', key: 'business', icon: 'store', color: '#F59E0B' },
  { kind: 'income', key: 'gift_in', icon: 'gift', color: '#EC4899' },
  { kind: 'income', key: 'cashback', icon: 'percent', color: '#14B8A6' },
  { kind: 'income', key: 'interest', icon: 'bank', color: '#6366F1' },
  { kind: 'income', key: 'other_in', icon: 'more', color: '#64748B' },
];

/** Category ids are deterministic for built-ins so seeding is idempotent. */
export const builtinCategoryId = (key: string) => `cat-${key}`;
export const SAVINGS_CATEGORY_ID = builtinCategoryId('savings');
export const DEBT_EXPENSE_CATEGORY_ID = builtinCategoryId('other');
export const DEBT_INCOME_CATEGORY_ID = builtinCategoryId('other_in');

export function buildDefaultCategories(): Category[] {
  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map((c, i) => ({
    ...c,
    id: builtinCategoryId(c.key!),
    order: i,
  }));
}

export function buildDefaultAccounts(cardName: string, cashName: string, balances: { card: number; cash: number }): Account[] {
  const now = new Date().toISOString();
  return [
    { id: 'acc-card', name: cardName, type: 'card', icon: 'card', color: '#EF4444', initialBalance: balances.card, order: 0, createdAt: now },
    { id: 'acc-cash', name: cashName, type: 'cash', icon: 'cash', color: '#10B981', initialBalance: balances.cash, order: 1, createdAt: now },
  ];
}

export const CURRENCIES: { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: 'KZT', symbol: '₸', name: 'Тенге' },
  { code: 'RUB', symbol: '₽', name: 'Рубль' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'UZS', symbol: 'сўм', name: 'Сўм' },
  { code: 'KGS', symbol: 'с', name: 'Сом' },
  { code: 'GBP', symbol: '£', name: 'Pound' },
  { code: 'CNY', symbol: '¥', name: 'Yuan' },
  { code: 'TRY', symbol: '₺', name: 'Lira' },
  { code: 'AED', symbol: 'AED', name: 'Dirham' },
];

/** Legacy profiles stored the symbol; map it back to a code. */
export function normalizeCurrency(v?: string): CurrencyCode {
  if (!v) return 'KZT';
  const byCode = CURRENCIES.find((c) => c.code === v);
  if (byCode) return byCode.code;
  const bySymbol = CURRENCIES.find((c) => c.symbol === v);
  return bySymbol?.code ?? 'KZT';
}

export function currencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}
