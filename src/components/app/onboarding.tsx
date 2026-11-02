'use client';

import { useState } from 'react';
import { addDays } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogoMark } from '@/components/brand/logo';
import { Field } from './ui';
import { LOCALES, useLocale, useLocaleStore, useT } from '@/i18n';
import { useAuthStore } from '@/stores/auth-store';
import { CURRENCIES, builtinCategoryId } from '@/lib/defaults';
import { BANKS, getBank, suggestName } from '@/lib/banks';
import { formatMoney } from '@/lib/format';
import { newId, saveRecurring, seedUserData } from '@/lib/actions';
import { safeToSpend } from '@/lib/finance';
import { toDay } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { CurrencyCode, Recurring } from '@/lib/types';

type IncomeKey = 'salary' | 'scholarship' | 'freelance' | 'none';

export function Onboarding() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const user = useAuthStore((s) => s.currentUser)!;
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState<CurrencyCode>(user.currency ?? 'KZT');
  // Picked banks: bankId → { name, balance }
  const [banks, setBanks] = useState<{ bankId: string; name: string; balance: string }[]>([]);
  const [cash, setCash] = useState('');
  const [income, setIncome] = useState<IncomeKey>('scholarship');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(toDay(addDays(new Date(), 10)));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0;

  async function finish() {
    setBusy(true);
    try {
      await seedUserData({
        cashName: t('enums.defaultCash'),
        cash: num(cash),
        banks: banks.map((b) => ({ bankId: b.bankId, name: b.name.trim() || getBank(b.bankId)!.name, balance: num(b.balance) })),
      });
      let rec: Recurring | null = null;
      if (income !== 'none' && num(incomeAmount) > 0) {
        rec = {
          id: newId('rec'), name: t(`cat.${income}`), kind: 'income', amount: num(incomeAmount),
          categoryId: builtinCategoryId(income), accountId: banks[0] ? `acc-${banks[0].bankId}` : 'acc-cash', frequency: 'monthly',
          nextDate: incomeDate, active: true, createdAt: new Date().toISOString(),
        };
        saveRecurring(rec);
      }
      const sts = safeToSpend(banks.reduce((a, b) => a + num(b.balance), 0) + num(cash), [], rec ? [rec] : []);
      setResult(sts.daily);
      await updateProfile({ currency, locale });
    } catch (e) {
      console.error(e);
      toast.error(t('common.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const done = () => updateProfile({ onboarded: true });

  return (
    <div className="flex min-h-dvh flex-col bg-background bg-dots">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-8 flex items-center justify-between">
          <LogoMark className="h-10 w-10" />
          {result === null && (
            <div className="flex gap-1.5" aria-label={t('onb.step', { n: step })}>
              {[1, 2, 3].map((i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i <= step ? 'w-6 bg-primary' : 'w-3 bg-muted')} />
              ))}
            </div>
          )}
        </div>

        {result !== null ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t('onb.resultTitle')}</h1>
            <p className="mt-3 text-muted-foreground">{t('onb.resultText')}</p>
            <p className="mt-2 font-display text-4xl font-semibold text-primary tabular">{formatMoney(Math.round(result), currency, locale)}</p>
            <p className="text-sm text-muted-foreground">{t('onb.resultPerDay')}</p>
            <Button className="mt-10 h-12 w-full rounded-2xl text-base font-bold" onClick={done}>
              {t('onb.go')} <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <div key={step} className="flex flex-1 flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{t('onb.step', { n: step })}</p>

            {step === 1 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t('onb.s1Title', { name: user.name.split(' ')[0] })}</h1>
                <p className="mt-2 text-muted-foreground">{t('onb.s1Text')}</p>
                <div className="mt-8 space-y-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{t('common.language')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {LOCALES.map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => setLocale(l.code)}
                          className={cn('rounded-2xl border px-3 py-3 text-sm font-bold', locale === l.code ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card')}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{t('common.currency')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {CURRENCIES.slice(0, 8).map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setCurrency(c.code)}
                          className={cn('rounded-2xl border px-2 py-2.5 text-center', currency === c.code ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card')}
                        >
                          <span className="block text-lg font-bold leading-none">{c.symbol}</span>
                          <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t('onb.s2Title')}</h1>
                <p className="mt-2 text-muted-foreground">{t('onb.s2Text')}</p>
                <div className="mt-8 space-y-5">
                  <Field label={`💵 ${t('onb.cashBalance')}`}>
                    <Input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" className="h-12 rounded-2xl text-base tabular" />
                  </Field>
                  <div className="space-y-2">
                    <p className="text-[13px] font-semibold text-foreground/80">{t('onb.banksTitle')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {BANKS.slice(0, 12).map((b) => {
                        const on = banks.some((x) => x.bankId === b.id);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setBanks((list) => (on ? list.filter((x) => x.bankId !== b.id) : [...list, { bankId: b.id, name: suggestName(b, 'card'), balance: '' }]))}
                            className={cn('relative flex flex-col items-center gap-1 rounded-2xl border p-2 text-center transition-colors', on ? 'border-primary bg-accent' : 'border-border bg-card')}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={b.logo} alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5 shadow-sm" />
                            <span className="line-clamp-1 text-[10px] font-semibold">{b.short ?? b.name}</span>
                            {on && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span>}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">{t('onb.banksHint')}</p>
                  </div>
                  {banks.map((b) => {
                    const bank = getBank(b.bankId)!;
                    return (
                      <div key={b.bankId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bank.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-0.5" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Input
                            value={b.name}
                            onChange={(e) => setBanks((list) => list.map((x) => (x.bankId === b.bankId ? { ...x, name: e.target.value } : x)))}
                            aria-label={t('onb.cardName')}
                            className="h-9 rounded-xl text-sm font-semibold"
                          />
                          <Input
                            inputMode="decimal"
                            value={b.balance}
                            onChange={(e) => setBanks((list) => list.map((x) => (x.bankId === b.bankId ? { ...x, balance: e.target.value } : x)))}
                            placeholder={t('onb.bankBalance')}
                            aria-label={t('onb.bankBalance')}
                            className="h-11 rounded-xl text-base tabular"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t('onb.s3Title')}</h1>
                <p className="mt-2 text-muted-foreground">{t('onb.s3Text')}</p>
                <div className="mt-8 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {(['scholarship', 'salary', 'freelance', 'none'] as IncomeKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setIncome(k)}
                        className={cn('rounded-2xl border px-3 py-3 text-sm font-bold', income === k ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card')}
                      >
                        {k === 'none' ? t('onb.incomeNone') : t(`cat.${k}`)}
                      </button>
                    ))}
                  </div>
                  {income !== 'none' && (
                    <>
                      <Field label={t('onb.incomeAmount')}>
                        <Input inputMode="decimal" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="0" className="h-12 rounded-2xl text-base tabular" />
                      </Field>
                      <Field label={t('onb.incomeDate')}>
                        <Input type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} className="h-12 rounded-2xl text-base" />
                      </Field>
                    </>
                  )}
                </div>
              </>
            )}

            <div className="mt-auto flex gap-2 pt-8">
              {step > 1 && (
                <Button variant="outline" size="icon" className="h-12 w-12 rounded-2xl" onClick={() => setStep((s) => s - 1)} aria-label={t('common.back')}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <Button
                className="h-12 flex-1 rounded-2xl text-base font-bold"
                disabled={busy}
                onClick={() => (step < 3 ? setStep((s) => s + 1) : finish())}
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : step < 3 ? t('common.next') : t('onb.finish')}
                {!busy && <ArrowRight className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
