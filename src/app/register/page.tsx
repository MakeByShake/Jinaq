'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AuthAlert, AuthField, AuthInput, AuthShell, GoogleButton, OrDivider, PasswordInput, SubmitButton,
} from '@/components/auth/auth-shell';
import { SplashScreen } from '@/components/app/splash';
import { useAuthStore, type AuthErrorKey } from '@/stores/auth-store';
import { useLocale, useT } from '@/i18n';

type FormError = AuthErrorKey | 'nameRequired' | 'emailRequired';

export default function RegisterPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const register = useAuthStore((s) => s.register);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);

  useEffect(() => {
    if (!isLoading && currentUser) router.replace('/dashboard');
  }, [isLoading, currentUser, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('nameRequired'); return; }
    if (!email.trim()) { setError('emailRequired'); return; }
    if (password.length < 6) { setError('errWeak'); return; }
    setLoading('email');
    setError(null);
    const res = await register(name, email, password, locale);
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

  const nameError = error === 'nameRequired';
  const emailError = error === 'emailRequired' || error === 'errEmail' || error === 'errExists';
  const passwordError = error === 'errWeak';
  const generalError = error && !nameError && !emailError && !passwordError ? t(`auth.${error}`) : null;

  return (
    <AuthShell
      title={t('auth.registerTitle')}
      subtitle={t('auth.registerSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">{t('auth.signInLink')}</Link>
        </>
      }
    >
      <div className="space-y-5">
        <GoogleButton loading={loading === 'google'} disabled={loading === 'email'} onClick={google} />
        <OrDivider />

        <form onSubmit={submit} className="space-y-4" noValidate>
          {generalError && <AuthAlert>{generalError}</AuthAlert>}

          <AuthField id="name" label={t('auth.name')} error={nameError ? t('auth.nameRequired') : undefined}>
            <AuthInput
              id="name"
              autoComplete="given-name"
              autoCapitalize="words"
              placeholder={t('auth.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              aria-invalid={nameError}
              aria-describedby={nameError ? 'name-error' : undefined}
            />
          </AuthField>

          <AuthField id="email" label={t('auth.email')} error={emailError ? t(`auth.${error}`) : undefined}>
            <AuthInput
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
            />
          </AuthField>

          <AuthField
            id="password"
            label={t('auth.password')}
            hint={t('auth.passwordHint')}
            error={passwordError ? t('auth.errWeak') : undefined}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={passwordError}
              aria-describedby={passwordError ? 'password-error' : 'password-hint'}
            />
          </AuthField>

          <SubmitButton loading={loading === 'email'} disabled={loading === 'google'} className="mt-2">
            {t('auth.register')}
          </SubmitButton>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">{t('auth.terms')}</p>
        </form>
      </div>
    </AuthShell>
  );
}
