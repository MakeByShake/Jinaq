'use client';

import {
  collection, deleteDoc, doc, getDocs, setDoc, writeBatch, type WriteBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { nextOccurrence, todayISO } from './dates';
import {
  buildDefaultAccounts, buildDefaultCategories, DEBT_EXPENSE_CATEGORY_ID, DEBT_INCOME_CATEGORY_ID,
  SAVINGS_CATEGORY_ID,
} from './defaults';
import type {
  Account, Budget, Category, Debt, Goal, Plan, Recurring, Template, Transaction,
} from './types';
import { COLLECTIONS, useData, type CollectionName } from '@/stores/data-store';

// ─── Low-level helpers ───────────────────────────────────────────────────────

function uid(): string {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('Not signed in');
  return u;
}

const ref = (col: CollectionName, id: string) => doc(db, 'users', uid(), col, id);

/** Firestore rejects `undefined`; drop those keys. */
function clean<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${rand}`;
}

// Writes are fire-and-forget: Firestore applies them to the local cache at once
// (snapshots update the UI immediately) and syncs when online.
function put<T extends { id: string }>(col: CollectionName, item: T) {
  return setDoc(ref(col, item.id), clean(item)).catch((e) => console.error(`[put ${col}]`, e));
}

function remove(col: CollectionName, id: string) {
  return deleteDoc(ref(col, id)).catch((e) => console.error(`[remove ${col}]`, e));
}

function batchPut<T extends { id: string }>(b: WriteBatch, col: CollectionName, item: T) {
  b.set(ref(col, item.id), clean(item));
}

// ─── Transactions ────────────────────────────────────────────────────────────

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;

export function addTransaction(data: NewTransaction): Transaction {
  const tx: Transaction = { ...data, id: newId('tx'), createdAt: new Date().toISOString() };
  put('transactions', tx);
  return tx;
}

export function updateTransaction(tx: Transaction) {
  put('transactions', tx);
}

/** Deletes and returns a function that restores it (for undo toasts). */
export function deleteTransaction(tx: Transaction): () => void {
  remove('transactions', tx.id);
  return () => put('transactions', tx);
}

// ─── Accounts / categories / budgets / templates ─────────────────────────────

export const saveAccount = (a: Account) => put('accounts', a);
export const deleteAccount = (id: string) => remove('accounts', id);
export const saveCategory = (c: Category) => put('categories', c);
export const deleteCategory = (id: string) => remove('categories', id);

export function setBudget(categoryId: string, limit: number) {
  if (limit > 0) put<Budget>('budgets', { id: categoryId, categoryId, limit });
  else remove('budgets', categoryId);
}

export const saveTemplate = (t: Template) => put('templates', t);
export const deleteTemplate = (id: string) => remove('templates', id);

export function applyTemplate(t: Template, accountId: string): Transaction {
  put('templates', { ...t, uses: (t.uses ?? 0) + 1 });
  return addTransaction({
    kind: t.kind, amount: t.amount, categoryId: t.categoryId, accountId: t.accountId ?? accountId,
    note: t.name, date: todayISO(),
  });
}

// ─── Recurring ───────────────────────────────────────────────────────────────

export const saveRecurring = (r: Recurring) => put('recurring', r);
export const deleteRecurring = (id: string) => remove('recurring', id);

/** Records the payment as a transaction and moves the schedule forward. */
export function payRecurring(r: Recurring, amount = r.amount): Transaction {
  const tx = addTransaction({
    kind: r.kind, amount, categoryId: r.categoryId, accountId: r.accountId, note: r.name,
    date: todayISO(), recurringId: r.id,
  });
  put('recurring', { ...r, nextDate: nextOccurrence(r.nextDate, r.frequency) });
  return tx;
}

export function skipRecurring(r: Recurring) {
  put('recurring', { ...r, nextDate: nextOccurrence(r.nextDate, r.frequency) });
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export const saveGoal = (g: Goal) => put('goals', g);
export const deleteGoal = (id: string) => remove('goals', id);

/**
 * Moves money into a goal. When `accountId` is given the money also leaves that
 * account (recorded as a "Savings" expense) so the spendable balance stays honest.
 */
export function contributeToGoal(goal: Goal, amount: number, accountId?: string) {
  const saved = Math.max(0, goal.saved + amount);
  const reached = saved >= goal.target;
  put('goals', {
    ...goal,
    saved,
    status: reached ? 'done' : goal.status === 'wish' ? 'saving' : goal.status,
    completedAt: reached && !goal.completedAt ? new Date().toISOString() : goal.completedAt,
  });
  if (accountId && amount !== 0) {
    addTransaction({
      kind: amount > 0 ? 'expense' : 'income',
      amount: Math.abs(amount),
      categoryId: amount > 0 ? SAVINGS_CATEGORY_ID : DEBT_INCOME_CATEGORY_ID,
      accountId,
      note: goal.title,
      date: todayISO(),
      goalId: goal.id,
    });
  }
}

// ─── Debts ───────────────────────────────────────────────────────────────────

export const saveDebt = (d: Debt) => put('debts', d);
export const deleteDebt = (id: string) => remove('debts', id);

/** Partial or full repayment. Optionally records the money movement on an account. */
export function repayDebt(debt: Debt, amount: number, accountId?: string) {
  const paid = Math.min(debt.amount, debt.paid + amount);
  const payments = [...(debt.payments ?? []), { amount, date: todayISO() }];
  put('debts', { ...debt, paid, payments, settled: paid >= debt.amount });
  if (accountId) {
    const iOwe = debt.direction === 'i_owe';
    addTransaction({
      kind: iOwe ? 'expense' : 'income',
      amount,
      categoryId: iOwe ? DEBT_EXPENSE_CATEGORY_ID : DEBT_INCOME_CATEGORY_ID,
      accountId,
      note: debt.personName,
      date: todayISO(),
      debtId: debt.id,
    });
  }
}

// ─── Planner ─────────────────────────────────────────────────────────────────

export function savePlan(plan: Plan) {
  return setDoc(doc(db, 'users', uid(), 'meta', 'plan'), clean(plan)).catch((e) => console.error('[plan]', e));
}

// ─── Seeding & reset ─────────────────────────────────────────────────────────

/** Creates default categories (idempotent) and starting accounts. */
export async function seedUserData(opts: { cardName: string; cashName: string; card: number; cash: number }) {
  const b = writeBatch(db);
  const existing = useData.getState().categories;
  if (existing.length === 0) buildDefaultCategories().forEach((c) => batchPut(b, 'categories', c));
  if (useData.getState().accounts.length === 0) {
    buildDefaultAccounts(opts.cardName, opts.cashName, { card: opts.card, cash: opts.cash })
      .forEach((a) => batchPut(b, 'accounts', a));
  }
  await b.commit();
}

/** Ensures built-in categories exist (for accounts that skipped onboarding). */
export async function ensureDefaultCategories() {
  if (useData.getState().categories.length > 0) return;
  const b = writeBatch(db);
  buildDefaultCategories().forEach((c) => batchPut(b, 'categories', c));
  await b.commit();
}

/** Deletes every document in the user's data collections. */
export async function wipeUserData() {
  const u = uid();
  for (const col of [...COLLECTIONS, 'meta']) {
    const snap = await getDocs(collection(db, 'users', u, col));
    // Batches are limited to 500 operations.
    for (let i = 0; i < snap.docs.length; i += 450) {
      const b = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
  }
}
