'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, Mail, User, Wallet, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Заполните все поля');
      return;
    }
    if (password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }
    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.success) {
      toast.success('Аккаунт создан!');
      setSubmitted(true);
    } else {
      toast.error(result.error);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/40 via-background to-background pointer-events-none" />
        <div className="relative w-full max-w-md text-center">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 shadow-lg mb-4">
              <Clock className="h-10 w-10 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Заявка отправлена!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ваши данные отправлены администратору. Пожалуйста, подождите — после одобрения вы сможете войти в систему.
            </p>
          </div>
          <Card className="border-border bg-card shadow-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-left">Аккаунт создан и ожидает проверки</p>
                </div>
                <p className="text-xs text-muted-foreground">После одобрения администратором вы получите доступ к системе.</p>
                <Button variant="outline" className="w-full mt-2" onClick={() => router.push('/login')}>
                  Перейти к входу
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/40 via-background to-background pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/30 mb-4">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">PFA</h1>
          <p className="text-sm text-muted-foreground">Personal Finance Application</p>
        </div>

        <Card className="border-border bg-card shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Регистрация</CardTitle>
            <CardDescription>Создайте новый аккаунт</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Иван Иванов"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ivan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
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
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium"
                disabled={loading}
              >
                {loading ? 'Создание...' : 'Создать аккаунт'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Уже есть аккаунт?{' '}
                <Link href="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                  Войти
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
