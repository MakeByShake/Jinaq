'use client';

import { useCallback, useMemo } from 'react';
import { useData } from '@/stores/data-store';
import { useT } from '@/i18n';
import { accountBalances, balancesAfter, categoryLabel, totalBalance } from '@/lib/finance';
import type { Category, CategoryKind } from '@/lib/types';

export function useBalances() {
  const accounts = useData((s) => s.accounts);
  const transactions = useData((s) => s.transactions);
  return useMemo(() => {
    const balances = accountBalances(accounts, transactions);
    return {
      balances,
      total: totalBalance(accounts, balances),
      spendable: totalBalance(accounts, balances, true),
    };
  }, [accounts, transactions]);
}

const afterCache = new WeakMap<object, { accounts: object; value: ReturnType<typeof balancesAfter> }>();
/** Computed once per data change and shared by every row on screen. */
function cachedBalancesAfter(accounts: Parameters<typeof balancesAfter>[0], txs: Parameters<typeof balancesAfter>[1]) {
  const hit = afterCache.get(txs);
  if (hit && hit.accounts === accounts) return hit.value;
  const value = balancesAfter(accounts, txs);
  afterCache.set(txs, { accounts, value });
  return value;
}

/** Balance on the account right after each operation, keyed by transaction id. */
export function useBalanceAfter() {
  const accounts = useData((s) => s.accounts);
  const transactions = useData((s) => s.transactions);
  return cachedBalancesAfter(accounts, transactions);
}

export function useCategories() {
  const categories = useData((s) => s.categories);
  const t = useT();
  const map = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const label = useCallback((idOrCat?: string | Category) => {
    const c = typeof idOrCat === 'string' ? map.get(idOrCat) : idOrCat;
    return categoryLabel(c, t);
  }, [map, t]);
  const byKind = useCallback(
    (kind: CategoryKind) => categories.filter((c) => c.kind === kind && !c.archived),
    [categories],
  );
  return { categories, map, label, byKind };
}

export function useAccounts() {
  const accounts = useData((s) => s.accounts);
  const active = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const map = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  return { accounts, active, map };
}
