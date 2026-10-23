import { todayISO } from './dates';
import type { CurrencyCode, Transaction } from './types';

export interface CsvExportOptions {
  /** Resolves a category id to its visible label. */
  categoryLabel: (categoryId?: string) => string;
  /** Resolves an account id to its name. */
  accountName: (accountId?: string) => string;
  currency: CurrencyCode;
  /** Localised kind names; defaults to the raw kind. */
  kindLabel?: (kind: Transaction['kind']) => string;
  /** Localised column headers in order: date, type, category, account, amount, note. */
  headers?: [string, string, string, string, string, string];
}

const SEP = ';';

/** Quotes a cell when it contains the separator, quotes or line breaks. */
function cell(v: string | number): string {
  const s = String(v ?? '');
  // Guard against spreadsheet formula injection from user-entered notes.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Builds the CSV text (without BOM). Expenses are negative, income positive, transfers as-is. */
export function transactionsToCsv(transactions: Transaction[], opts: CsvExportOptions): string {
  const headers = opts.headers ?? ['date', 'type', 'category', 'account', `amount (${opts.currency})`, 'note'];
  const rows = transactions.map((tx) => {
    const signed = tx.kind === 'expense' ? -tx.amount : tx.amount;
    const category = tx.kind === 'transfer' ? '' : opts.categoryLabel(tx.categoryId);
    const account = tx.kind === 'transfer'
      ? `${opts.accountName(tx.accountId)} → ${opts.accountName(tx.toAccountId)}`
      : opts.accountName(tx.accountId);
    return [
      tx.date.slice(0, 10),
      opts.kindLabel ? opts.kindLabel(tx.kind) : tx.kind,
      category,
      account,
      // Decimal comma keeps Excel in ru/kk locales from treating amounts as text.
      String(signed).replace('.', ','),
      tx.note ?? '',
    ].map(cell).join(SEP);
  });
  return [headers.map(cell).join(SEP), ...rows].join('\r\n');
}

/** Exports transactions as a UTF-8 (with BOM) CSV and triggers a download. */
export function exportTransactionsCsv(transactions: Transaction[], opts: CsvExportOptions): void {
  const csv = '﻿' + transactionsToCsv(transactions, opts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jinaq-transactions-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
