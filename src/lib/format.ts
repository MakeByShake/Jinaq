'use client';

import { useCallback } from 'react';
import { format as dfFormat, isToday, isYesterday, isTomorrow } from 'date-fns';
import { DATE_FNS_LOCALE, INTL_LOCALE, useLocale, useT } from '@/i18n';
import { useAuthStore } from '@/stores/auth-store';
import { currencySymbol, normalizeCurrency } from './defaults';
import { parseDay } from './dates';
import type { CurrencyCode, Locale } from './types';

const PREFIX_SYMBOLS = new Set(['$', '€', '£']);

export interface MoneyOptions {
  /** '+' / '−' prefix for positive / negative values. */
  sign?: boolean;
  /** 12.5K style for tight places. */
  compact?: boolean;
  /** Hide the currency symbol. */
  bare?: boolean;
  decimals?: number;
}

export function formatMoney(value: number, currency: CurrencyCode, locale: Locale, opts: MoneyOptions = {}): string {
  const abs = Math.abs(value);
  const nf = new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: opts.compact ? 1 : opts.decimals ?? (abs % 1 === 0 ? 0 : 2),
    minimumFractionDigits: 0,
    notation: opts.compact && abs >= 10_000 ? 'compact' : 'standard',
  });
  const num = nf.format(abs);
  const sym = currencySymbol(currency);
  const sign = value < 0 ? '−' : opts.sign && value > 0 ? '+' : '';
  if (opts.bare) return `${sign}${num}`;
  if (PREFIX_SYMBOLS.has(sym) && locale === 'en') return `${sign}${sym}${num}`;
  return `${sign}${num} ${sym}`;
}

export function useCurrency(): CurrencyCode {
  return useAuthStore((s) => normalizeCurrency(s.currentUser?.currency));
}

/** Returns a money formatter bound to the user's currency and language. */
export function useMoney() {
  const currency = useCurrency();
  const locale = useLocale();
  return useCallback((v: number, opts?: MoneyOptions) => formatMoney(v, currency, locale, opts), [currency, locale]);
}

/** Relative-friendly day label: Today / Yesterday / 12 March. */
export function useDayLabel() {
  const locale = useLocale();
  const t = useT();
  return useCallback(
    (day: string, withWeekday = false) => {
      const d = parseDay(day);
      if (isToday(d)) return t('common.today');
      if (isYesterday(d)) return t('common.yesterday');
      if (isTomorrow(d)) return t('common.tomorrow');
      const sameYear = d.getFullYear() === new Date().getFullYear();
      const pattern = (withWeekday ? 'EEEE, ' : '') + (sameYear ? 'd MMMM' : 'd MMMM yyyy');
      return dfFormat(d, pattern, { locale: DATE_FNS_LOCALE[locale] });
    },
    [locale, t],
  );
}

export function useDateFormat() {
  const locale = useLocale();
  return useCallback(
    (d: Date | string, pattern: string) =>
      dfFormat(typeof d === 'string' ? parseDay(d) : d, pattern, { locale: DATE_FNS_LOCALE[locale] }),
    [locale],
  );
}

/** Evaluates simple "1500+300-200" expressions typed into amount fields. */
export function evalAmount(input: string): number {
  const s = input.replace(/\s/g, '').replace(/,/g, '.').replace(/[×x]/g, '*').replace(/÷/g, '/');
  if (!s) return 0;
  if (!/^[\d.+\-*/]+$/.test(s)) return NaN;
  const tokens = s.match(/(\d*\.?\d+|[+\-*/])/g);
  if (!tokens) return NaN;
  // Two-pass evaluation: * and / first, then + and -.
  const stack: (number | string)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '*' || tok === '/') {
      const prev = Number(stack.pop());
      const next = Number(tokens[++i]);
      stack.push(tok === '*' ? prev * next : next === 0 ? NaN : prev / next);
    } else stack.push(/[+\-]/.test(tok) ? tok : Number(tok));
  }
  let result = typeof stack[0] === 'number' ? (stack[0] as number) : 0;
  let i = typeof stack[0] === 'number' ? 1 : 0;
  for (; i < stack.length; i += 2) {
    const op = stack[i];
    const val = Number(stack[i + 1] ?? 0);
    result = op === '-' ? result - val : result + val;
  }
  return Math.round(result * 100) / 100;
}
