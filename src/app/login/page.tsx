'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Заполните все поля');
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      toast.success('Добро пожаловать!');
      router.push('/dashboard');
    } else {
      toast.error(result.error);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Введите email'); return; }
    setResetLoading(true);
    const result = await sendPasswordReset(email);
    setResetLoading(false);
    if (result.success) {
      toast.success('Письмо для сброса пароля отправлено на ' + email);
      setResetMode(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/40 via-background to-background pointer-events-none" />
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 mb-4">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">PFA</h1>
          <p className="text-sm text-muted-foreground">Personal Finance Application</p>
        </div>

        <Card className="border-border bg-card shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Вход в аккаунт</CardTitle>
            <CardDescription>Введите ваши данные для входа</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
                disabled={loading}
              >
                {loading ? 'Вход...' : 'Войти'}
              </Button>
              <button type="button" onClick={() => setResetMode(true)} className="text-xs text-muted-foreground hover:text-emerald-400 transition-colors">
                Забыли пароль?
              </button>
              <p className="text-sm text-muted-foreground text-center">
                Нет аккаунта?{' '}
                <Link href="/register" className="text-emerald-500 hover:text-emerald-400 font-medium">
                  Зарегистрироваться
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Reset password dialog */}
      {resetMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm border-border bg-card shadow-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Сброс пароля</CardTitle>
              <CardDescription>Введите ваш email — мы отправим ссылку для сброса пароля.</CardDescription>
            </CardHeader>
            <form onSubmit={handleReset}>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reset-email" type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setResetMode(false)}>Отмена</Button>
                <Button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" disabled={resetLoading}>
                  {resetLoading ? 'Отправка...' : 'Отправить'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
