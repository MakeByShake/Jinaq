import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Category, MerchantRule, Transaction, TransactionKind } from '../types';
import { builtinCategoryId } from '../defaults';
import type { ParsedOp } from './kaspi';
import { guessCategory, isOwnTransfer, merchantKey } from './categorize';

export type Flag = 'duplicate' | 'refund' | 'own' | 'ignored' | 'unsure';

/** One operation in the import review list. */
export interface ImportRow {
  op: ParsedOp;
  kind: TransactionKind;
  categoryId?: string;
  /** Selected for import. */
  checked: boolean;
  flags: Flag[];
  /** Key of the matching row for a "spent for a friend → got it back" pair. */
  pairKey?: string;
}

const sameDayAmount = (tx: Transaction, op: ParsedOp, accountId: string) =>
  tx.date.slice(0, 10) === op.date && Math.abs(tx.amount - op.amount) < 0.01 && (tx.accountId === accountId || tx.toAccountId === accountId);

export function buildRows(
  ops: ParsedOp[],
  opts: { accountId: string; cashAccountId?: string; existing: Transaction[]; rules: MerchantRule[]; categories: Category[] },
): ImportRow[] {
  const ruleMap = new Map(opts.rules.map((r) => [r.id, r]));
  const catIds = new Set(opts.categories.map((c) => c.id));
  const rows: ImportRow[] = ops.map((op) => {
    const flags: Flag[] = [];
    let kind: TransactionKind = op.sign > 0 ? 'income' : 'expense';
    // Cash withdrawal = money moves from the card to the Cash account, not spending.
    if (op.type === 'withdrawal' && op.sign < 0 && opts.cashAccountId) kind = 'transfer';
    const g = guessCategory(op.type, op.sign, op.details, ruleMap);
    let categoryId = g.ruleCategoryId ?? (g.categoryKey ? builtinCategoryId(g.categoryKey) : undefined);
    if (categoryId && !catIds.has(categoryId)) categoryId = builtinCategoryId(op.sign > 0 ? 'other_in' : 'other');
    if (!g.confident && kind !== 'transfer') flags.push('unsure');
    if (g.ignore) flags.push('ignored');
    if (isOwnTransfer(op.details)) flags.push('own');
    if (opts.existing.some((tx) => sameDayAmount(tx, op, opts.accountId))) flags.push('duplicate');
    return { op, kind, categoryId: kind === 'transfer' ? undefined : categoryId, checked: true, flags };
  });

  // "Bought something for a friend, they sent the same amount back within a week" → skip both.
  const used = new Set<number>();
  rows.forEach((out, i) => {
    if (out.op.sign > 0 || out.kind === 'transfer' || used.has(i)) return;
    const j = rows.findIndex((inc, k) => {
      if (k === i || used.has(k) || inc.op.sign < 0) return false;
      if (Math.abs(inc.op.amount - out.op.amount) > 0.01) return false;
      if (!(inc.op.type === 'transfer' || inc.op.type === 'topup' || inc.op.type === 'other')) return false;
      const d = differenceInCalendarDays(parseISO(inc.op.date), parseISO(out.op.date));
      return d >= 0 && d <= 7;
    });
    if (j >= 0) {
      used.add(i); used.add(j);
      rows[i].flags.push('refund'); rows[j].flags.push('refund');
      rows[i].pairKey = rows[j].op.key; rows[j].pairKey = rows[i].op.key;
    }
  });

  for (const r of rows) {
    if (r.flags.some((f) => f === 'duplicate' || f === 'refund' || f === 'own' || f === 'ignored')) r.checked = false;
  }
  return rows;
}

export function ruleFor(details: string, categoryId: string, ignore = false): MerchantRule {
  return { id: merchantKey(details) || 'unknown', merchant: details, categoryId, ignore: ignore || undefined, updatedAt: new Date().toISOString() };
}
