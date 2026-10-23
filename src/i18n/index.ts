'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCallback } from 'react';
import { ru as dfRu, kk as dfKk, enUS as dfEn } from 'date-fns/locale';
import type { Locale } from '@/lib/types';
import { MESSAGES } from './messages';

export const LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'kk', label: 'Қазақша', short: 'KZ' },
  { code: 'en', label: 'English', short: 'EN' },
];

export const INTL_LOCALE: Record<Locale, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' };
export const DATE_FNS_LOCALE = { ru: dfRu, kk: dfKk, en: dfEn };

function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'ru';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('kk')) return 'kk';
  if (lang.startsWith('en')) return 'en';
  return 'ru';
}

interface LocaleStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      // Server and first client render both use 'ru'; the real value is applied in initLocale().
      locale: 'ru',
      setLocale: (locale) => {
        set({ locale });
        if (typeof document !== 'undefined') document.documentElement.lang = locale;
      },
    }),
    { name: 'jinaq-locale', skipHydration: true },
  ),
);

/** Call once on the client after mount: restores the saved language or detects it. */
export async function initLocale() {
  let hadSaved = false;
  try { hadSaved = !!localStorage.getItem('jinaq-locale'); } catch { /* storage blocked */ }
  await useLocaleStore.persist.rehydrate();
  const { locale, setLocale } = useLocaleStore.getState();
  setLocale(hadSaved ? locale : detectLocale());
}

type Vars = Record<string, string | number>;

function pluralIndex(locale: Locale, n: number, forms: number): number {
  if (forms <= 1) return 0;
  const abs = Math.abs(n);
  if (locale === 'ru') {
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return 0;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return Math.min(1, forms - 1);
    return Math.min(2, forms - 1);
  }
  return abs === 1 ? 0 : Math.min(1, forms - 1);
}

export function translate(locale: Locale, key: string, vars?: Vars): string {
  const [ns, ...rest] = key.split('.');
  const k = rest.join('.');
  const bundle = MESSAGES[ns as keyof typeof MESSAGES] as Record<Locale, Record<string, string>> | undefined;
  let msg = bundle?.[locale]?.[k] ?? bundle?.ru?.[k] ?? key;
  // Plural forms are separated by "|" and selected by the `count` variable.
  if (msg.includes('|') && vars && typeof vars.count === 'number') {
    const forms = msg.split('|');
    msg = forms[pluralIndex(locale, vars.count, forms.length)];
  }
  if (vars) {
    msg = msg.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
  }
  return msg;
}

export type TFunction = (key: string, vars?: Vars) => string;

export function useT(): TFunction {
  const locale = useLocaleStore((s) => s.locale);
  return useCallback((key: string, vars?: Vars) => translate(locale, key, vars), [locale]);
}

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}
