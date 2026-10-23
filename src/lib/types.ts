// ─── Core domain model ──────────────────────────────────────────────────────
// Every money value is stored in the user's base currency, as a plain number.
// Dates are stored as ISO strings. "Day" dates use the `YYYY-MM-DD` format.

export type Locale = 'ru' | 'kk' | 'en';
export type UserRole = 'admin' | 'user';
export type CurrencyCode = 'KZT' | 'RUB' | 'USD' | 'EUR' | 'UZS' | 'KGS' | 'GBP' | 'CNY' | 'TRY' | 'AED';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string; // small data URL (resized on the client)
  currency: CurrencyCode;
  locale: Locale;
  createdAt: string;
  onboarded?: boolean;
  blocked?: boolean;
  lastSeenAt?: string;
  // Contacts used in debt reminders
  telegram?: string;
  whatsapp?: string;
  kaspiNumber?: string;
}

// ─── Accounts ────────────────────────────────────────────────────────────────
export type AccountType = 'card' | 'cash' | 'savings' | 'deposit' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  initialBalance: number;
  order: number;
  archived?: boolean;
  /** Excluded from the "spendable" balance (e.g. a deposit). */
  excludeFromTotal?: boolean;
  createdAt: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────
export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  kind: CategoryKind;
  /** Built-in categories have a key; their label comes from translations unless renamed. */
  key?: string;
  name?: string;
  icon: string;
  color: string;
  order: number;
  archived?: boolean;
}

// ─── Transactions ────────────────────────────────────────────────────────────
export type TransactionKind = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  amount: number; // always positive
  accountId: string;
  toAccountId?: string; // transfers only
  categoryId?: string; // income / expense only
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  recurringId?: string;
  debtId?: string;
  goalId?: string;
  /** Balance correction — moves the balance but is ignored in spending stats. */
  adjustment?: boolean;
}

// ─── Budgets (monthly limit per expense category) ────────────────────────────
export interface Budget {
  id: string; // = categoryId
  categoryId: string;
  limit: number;
}

// ─── Recurring payments / income ─────────────────────────────────────────────
export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface Recurring {
  id: string;
  name: string;
  kind: CategoryKind;
  amount: number;
  categoryId: string;
  accountId: string;
  frequency: Frequency;
  nextDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt: string;
}

// ─── Templates (one-tap favourites in quick add) ─────────────────────────────
export interface Template {
  id: string;
  kind: CategoryKind;
  name: string;
  amount: number;
  categoryId: string;
  accountId?: string;
  uses: number;
  createdAt: string;
}

// ─── Debts ───────────────────────────────────────────────────────────────────
export type DebtDirection = 'owed_to_me' | 'i_owe';

export interface DebtPayment {
  amount: number;
  date: string;
}

export interface Debt {
  id: string;
  personName: string;
  direction: DebtDirection;
  amount: number;
  paid: number;
  payments: DebtPayment[];
  dueDate?: string;
  note?: string;
  settled: boolean;
  createdAt: string;
}

// ─── Goals & wishlist ────────────────────────────────────────────────────────
export type GoalStatus = 'wish' | 'saving' | 'done';
export type GoalPriority = 'need' | 'want' | 'dream';

export interface Goal {
  id: string;
  title: string;
  icon: string;
  color: string;
  target: number;
  saved: number;
  status: GoalStatus;
  priority: GoalPriority;
  deadline?: string;
  note?: string;
  link?: string;
  order: number;
  createdAt: string;
  completedAt?: string;
}

// ─── Planner (saved "what if" distribution) ──────────────────────────────────
export interface PlanItem {
  id: string;
  label: string;
  amount: number;
}

export interface Plan {
  id: string;
  items: PlanItem[];
  updatedAt: string;
}
