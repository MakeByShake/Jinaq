'use client';

import { create } from 'zustand';
import type {
  Account, Budget, Category, Debt, Goal, Plan, Recurring, Template, Transaction,
} from '@/lib/types';

/** Firestore sub-collections under users/{uid}. */
export const COLLECTIONS = [
  'accounts', 'categories', 'transactions', 'budgets', 'recurring', 'templates', 'debts', 'goals',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface DataState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring: Recurring[];
  templates: Template[];
  debts: Debt[];
  goals: Goal[];
  plan: Plan | null;
  /** Which collections have delivered their first snapshot. */
  ready: Partial<Record<CollectionName, boolean>>;
  loaded: boolean;
  setCollection: <K extends CollectionName>(name: K, items: DataState[K]) => void;
  setPlan: (plan: Plan | null) => void;
  reset: () => void;
}

const EMPTY = {
  accounts: [], categories: [], transactions: [], budgets: [], recurring: [], templates: [],
  debts: [], goals: [], plan: null, ready: {}, loaded: false,
};

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const byDateDesc = (a: Transaction, b: Transaction) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export const useData = create<DataState>()((set) => ({
  ...EMPTY,
  setCollection: (name, items) =>
    set((s) => {
      let sorted = items as unknown[];
      if (name === 'transactions') sorted = [...(items as Transaction[])].sort(byDateDesc);
      else if (name === 'accounts' || name === 'categories' || name === 'goals')
        sorted = [...(items as (Account | Category | Goal)[])].sort(byOrder);
      const ready = { ...s.ready, [name]: true };
      return {
        [name]: sorted,
        ready,
        loaded: COLLECTIONS.every((c) => ready[c]),
      } as Partial<DataState>;
    }),
  setPlan: (plan) => set({ plan }),
  reset: () => set(EMPTY),
}));
