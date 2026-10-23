'use client';

import { create } from 'zustand';
import type { Transaction, TransactionKind } from '@/lib/types';

interface QuickAddState {
  open: boolean;
  kind: TransactionKind;
  /** When set, the sheet edits this transaction instead of creating a new one. */
  editing: Transaction | null;
  openAdd: (kind?: TransactionKind) => void;
  openEdit: (tx: Transaction) => void;
  close: () => void;
}

export const useQuickAdd = create<QuickAddState>()((set) => ({
  open: false,
  kind: 'expense',
  editing: null,
  openAdd: (kind = 'expense') => set({ open: true, kind, editing: null }),
  openEdit: (tx) => set({ open: true, kind: tx.kind, editing: tx }),
  close: () => set({ open: false }),
}));
