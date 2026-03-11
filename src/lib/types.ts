// ─── Auth ────────────────────────────────────────────────────────────────────
export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string; // stored hashed in real apps; plaintext for localStorage demo
  role: UserRole;
  avatar?: string; // base64 data URL
  currency: string;
  theme: 'dark' | 'light' | 'system';
  createdAt: string;
  status?: 'pending' | 'approved' | 'rejected';
  // Social & contact info
  telegram?: string;
  whatsapp?: string;
  instagram?: string;
  kaspiNumber?: string;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
export interface Wallet {
  currentMoney: number;
  currency: string;
}

// ─── Wishlist / Kanban ────────────────────────────────────────────────────────
export type WishLabel = 'нужное' | 'хотелка' | 'необходимое' | string;

export interface WishCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
  icon: string;
  labels: WishLabel[];
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // ISO date
  createdAt: string;
}

export interface WishColumn {
  id: string;
  title: string;
  order: number;
}

// ─── Income / Expense ─────────────────────────────────────────────────────────
export type IncomeCategory = 'стипендия' | 'зарплата' | 'аренда' | 'бизнес' | 'подарок' | 'другое';
export type ExpenseCategory = 'транспорт' | 'еда' | 'жилье' | 'здоровье' | 'развлечения' | 'одежда' | 'другое';

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  category: IncomeCategory;
  scheduleDay?: number; // day of month (legacy)
  scheduleDate?: string; // ISO date string (preferred)
  receivedThisMonth: boolean;
  createdAt: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  scheduleDay?: number; // legacy
  scheduleDate?: string; // ISO date string (preferred)
  paidThisMonth: boolean;
  createdAt: string;
}

// ─── Debt ─────────────────────────────────────────────────────────────────────
export type DebtDirection = 'owed_to_me' | 'i_owe';

export interface Debt {
  id: string;
  personName: string;
  direction: DebtDirection;
  amount: number;
  dueDate: string; // ISO date
  notes: string;
  settled: boolean;
  createdAt: string;
}

// ─── Transaction History ──────────────────────────────────────────────────────
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  date: string; // ISO date
  createdAt: string;
}
