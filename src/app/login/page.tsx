'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import {
  AuthAlert, AuthField, AuthInput, AuthShell, GoogleButton, OrDivider, PasswordInput, SubmitButton,
} from '@/components/auth/auth-shell';
import { ResponsiveSheet } from '@/components/app/sheet';
import { SplashScreen } from '@/components/app/splash';
import { useAuthStore, type AuthErrorKey } from '@/stores/auth-store';
import { useLocale, useT } from '@/i18n';

function ResetPasswordSheet({ open, onOpenChange, initialEmail }: { open: boolean; onOpenChange: (v: boolean) => void; initialEmail: string }) {
  const t = useT();
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError(t('auth.emailRequired')); return; }
    setLoading(true);
    setError(null);
    const res = await sendPasswordReset(email);
    setLoading(false);
    if (res.success) setSent(true);
    else setError(t(`auth.${res.error}`));
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title={t('auth.resetTitle')} description={sent ? undefined : t('auth.resetText')}>
      {sent ? (
        <div className="flex flex-col items-center py-4 text-center" role="status">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="max-w-xs text-sm text-foreground/90">{t('auth.resetSent')}</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-5 h-11 rounded-2xl bg-muted px-5 text-sm font-semibold hover:bg-muted/70"
          >
            {t('auth.resetBack')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 pt-1" noValidate>
          <AuthField id="reset-email" label={t('auth.email')} error={error}>
            <AuthInput
              id="reset-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'reset-email-error' : undefined}
            />
          </AuthField>
          <SubmitButton loading={loading}>{t('auth.resetSend')}</SubmitButton>
        </form>
      )}
    </ResponsiveSheet>
  );
}

export default function LoginPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<AuthErrorKey | 'emailRequired' | null>(null);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const openReset = () => { setResetKey((k) => k + 1); setResetOpen(true); };

  useEffect(() => {
    if (!isLoading && currentUser) router.replace('/dashboard');
  }, [isLoading, currentUser, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('emailRequired'); return; }
    if (!password) { setError('errInvalid'); return; }
    setLoading('email');
    setError(null);
    const res = await login(email, password);
    if (res.success) router.replace('/dashboard');
    else { setError(res.error); setLoading(null); }
  };

  const google = async () => {
    setLoading('google');
    setError(null);
    const res = await loginWithGoogle(locale);
    if (res.success) router.replace('/dashboard');
    else { setError(res.error); setLoading(null); }
  };

  if (!isLoading && currentUser) return <SplashScreen />;

  const emailError = error === 'errEmail' || error === 'emailRequired';
  const generalError = error && !emailError ? t(`auth.${error}`) : null;

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link href="/register" className="font-bold text-primary hover:underline">{t('auth.signUpLink')}</Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton loading={loading === 'google'} disabled={loading === 'email'} onClick={google} />
        <OrDivider />

        <form onSubmit={submit} className="space-y-4" noValidate>
          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthField id="email" label={t('auth.email')} error={emailError ? t(`auth.${error}`) : undefined}>
            <AuthInput
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailError || error === 'errInvalid'}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
          </AuthField>

          <AuthField
            id="password"
            label={t('auth.password')}
            action={
              <button type="button" onClick={openReset} className="-my-2 rounded-lg px-1 py-2 text-xs font-semibold text-primary hover:underline">
                {t('auth.forgot')}
              </button>
            }
          >
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error === 'errInvalid'}
            />
          </AuthField>

          <SubmitButton loading={loading === 'email'} disabled={loading === 'google'} className="mt-2">
            {t('auth.login')}
          </SubmitButton>
        </form>
      </div>

      <ResetPasswordSheet key={resetKey} open={resetOpen} onOpenChange={setResetOpen} initialEmail={email} />
    </AuthShell>
  );
}
