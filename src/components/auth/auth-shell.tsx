'use client';

import { forwardRef, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ArrowLeft, Check, Clock, Eye, EyeOff, Loader2, Moon, Sun, TriangleAlert } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Ring } from '@/components/app/ui';
import { LOCALES, useLocaleStore, useT } from '@/i18n';
import { cn } from '@/lib/utils';

// ─── Small shared controls (also used by the landing page) ──────────────────

export function LanguageSwitcher({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'onBrand' }) {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      className={cn('inline-flex rounded-full p-0.5', tone === 'onBrand' ? 'bg-white/15' : 'bg-muted', className)}
    >
      {LOCALES.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={l.label}
            lang={l.code}
            onClick={() => setLocale(l.code)}
            className={cn(
              'h-8 min-w-10 rounded-full px-2.5 text-xs font-bold transition-colors',
              active
                ? tone === 'onBrand' ? 'bg-white text-foreground' : 'bg-card text-foreground shadow-sm'
                : tone === 'onBrand' ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeButton({ className }: { className?: string }) {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label={t('common.theme')}
      title={t('common.theme')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground',
        className,
      )}
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-5 w-5', className)} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

// ─── Form pieces ─────────────────────────────────────────────────────────────

const inputCls =
  'h-12 w-full rounded-2xl border border-input bg-card px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30';

export const AuthInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(function AuthInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputCls, className)} {...props} />;
});

export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} className={cn(inputCls, 'pr-12', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={show}
        className="absolute top-1/2 right-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

export function AuthField({ id, label, hint, error, action, children }: {
  id: string; label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-semibold text-foreground/80">{label}</label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-sm font-medium text-destructive">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SubmitButton({ loading, children, className, ...props }: React.ComponentProps<'button'> & { loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      aria-busy={loading}
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-[transform,background-color] hover:bg-primary/90 active:scale-[0.99] disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function GoogleButton({ loading, onClick, disabled }: { loading?: boolean; onClick: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-input bg-card px-5 text-[15px] font-semibold transition-colors hover:bg-muted disabled:opacity-60 dark:bg-input/30 dark:hover:bg-input/50"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
      {t('auth.google')}
    </button>
  );
}

export function OrDivider() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-muted-foreground uppercase" role="separator">
      <span className="h-px flex-1 bg-border" />
      {t('auth.or')}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────

function BrandPanel() {
  const t = useT();
  return (
    <aside className="relative hidden overflow-hidden bg-brand-gradient text-white lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-30" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <LogoMark className="h-10 w-10 ring-1 ring-white/25 rounded-2xl" />
        <span className="font-display text-xl font-semibold lowercase">jinaq</span>
      </div>

      <div className="relative max-w-md">
        <h2 className="font-display text-3xl leading-tight font-semibold xl:text-4xl">{t('auth.sideTitle')}</h2>
        <p className="mt-4 text-base leading-relaxed text-white/80">{t('auth.sideText')}</p>
        <ul className="mt-8 space-y-3.5">
          {(['sidePoint1', 'sidePoint2', 'sidePoint3'] as const).map((k) => (
            <li key={k} className="flex items-center gap-3 text-[15px] font-semibold">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/18">
                <Check className="h-4 w-4" />
              </span>
              {t(`auth.${k}`)}
            </li>
          ))}
        </ul>
      </div>

      {/* Mini "safe to spend" card */}
      <div className="relative flex max-w-sm items-center gap-4 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
        <Ring value={0.64} size={60} stroke={7} color="#fde68a">
          <Clock className="h-5 w-5 text-white/85" />
        </Ring>
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/75">{t('auth.sideMockToday')}</p>
          <p className="font-display text-2xl font-semibold tabular">6 400 ₸</p>
          <p className="text-[11px] text-white/70">{t('auth.sideMockDays')}</p>
        </div>
      </div>
    </aside>
  );
}

export function AuthShell({ title, subtitle, children, footer }: {
  title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <header className="flex items-center justify-between gap-2 sm:gap-3">
          <Link href="/" aria-label={t('auth.backHome')} className="flex items-center gap-1.5 rounded-xl py-1.5 pr-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 lg:hidden" />
            <Logo markClassName="h-8 w-8" className="text-foreground [&>span:last-child]:hidden min-[360px]:[&>span:last-child]:inline" />
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <ThemeButton />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="font-display text-[1.45rem] leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] min-[360px]:text-[1.7rem] sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-7 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </main>
      </div>
      <BrandPanel />
    </div>
  );
}
