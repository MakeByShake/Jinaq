'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Shield, Users, Crown, Pencil, Eye, EyeOff, RotateCcw, X, CalendarIcon, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PeriodCalendarPicker } from '@/features/goals/components/period-calendar-picker';
import { useAuthStore } from '@/stores/auth-store';
import type { AppUser, UserRole } from '@/lib/types';

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'range';

const DATE_FILTER_LABELS: Record<Exclude<DateFilter, 'range'>, string> = {
  all: 'Все',
  today: 'Сегодня',
  yesterday: 'Вчера',
  week: 'Неделя',
  month: 'Месяц',
};

function getDateRange(filter: DateFilter, rangeStart: Date, rangeEnd: Date): { start: Date; end: Date } | null {
  if (filter === 'all') return null;
  if (filter === 'range') return { start: rangeStart, end: rangeEnd };

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (filter === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (filter === 'week') {
    start.setDate(start.getDate() - 7);
  } else if (filter === 'month') {
    start.setDate(1);
  }

  return { start, end };
}

function UserAvatar({ user }: { user: AppUser }) {
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Avatar className="h-8 w-8">
      <AvatarImage src={user.avatar} alt={user.name} />
      <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

export default function AdminPage() {
  const { users, deletedUsers, pendingUsers, currentUser, addUser, deleteUser, restoreUser, permanentDeleteUser, updateUser, loadAllUsers, approveUser, rejectUser } = useAuthStore();

  useEffect(() => { loadAllUsers(); }, []);

  // Add user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'user' as UserRole });
  const [showAddPwd, setShowAddPwd] = useState(false);

  // Edit user dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'user' as UserRole });
  const [showEditPwd, setShowEditPwd] = useState(false);

  // Date filter
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });

  const filteredUsers = useMemo(() => {
    const range = getDateRange(dateFilter, rangeStart, rangeEnd);
    if (!range) return users;
    return users.filter((u) => {
      const d = new Date(u.createdAt);
      return d >= range.start && d <= range.end;
    });
  }, [users, dateFilter, rangeStart, rangeEnd]);

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const userCount = users.filter((u) => u.role === 'user').length;

  const openEdit = (user: AppUser) => {
    setEditTarget(user);
    setEditForm({ name: user.name, email: user.email, password: user.password, role: user.role });
    setShowEditPwd(false);
    setEditOpen(true);
  };

  const handleAdd = async () => {
    if (!addForm.name || !addForm.email || !addForm.password) { toast.error('Заполните все поля'); return; }
    const exists = users.some((u) => u.email.toLowerCase() === addForm.email.toLowerCase());
    if (exists) { toast.error('Пользователь с таким email уже существует'); return; }
    await addUser({ name: addForm.name, email: addForm.email, password: addForm.password, role: addForm.role, currency: '₸', theme: 'dark' });
    setAddForm({ name: '', email: '', password: '', role: 'user' });
    setAddOpen(false);
    toast.success('Пользователь добавлен');
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name || !editForm.email) { toast.error('Заполните все поля'); return; }
    const emailConflict = users.some((u) => u.email.toLowerCase() === editForm.email.toLowerCase() && u.id !== editTarget.id);
    if (emailConflict) { toast.error('Этот email уже занят'); return; }
    await updateUser(editTarget.id, { name: editForm.name, email: editForm.email, role: editForm.role });
    setEditOpen(false);
    setEditTarget(null);
    toast.success('Данные пользователя обновлены');
  };

  const handleDelete = (id: string, name: string) => {
    if (id === currentUser?.id) { toast.error('Нельзя удалить себя'); return; }
    deleteUser(id);
    toast.success(`${name} перемещён в корзину`);
  };

  const handleRoleChange = (id: string, role: UserRole) => {
    if (id === currentUser?.id) { toast.error('Нельзя изменить свою роль'); return; }
    updateUser(id, { role });
    toast.success('Роль обновлена');
  };

  const UserRow = ({ user }: { user: AppUser }) => (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <UserAvatar user={user} />
          <span className="font-medium">{user.name}{user.id === currentUser?.id && <span className="ml-1 text-xs text-muted-foreground">(вы)</span>}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{'•'.repeat(Math.min(user.password.length, 8))}</TableCell>
      <TableCell>
        <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v as UserRole)} disabled={user.id === currentUser?.id}>
          <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Пользователь</SelectItem>
            <SelectItem value="admin">Администратор</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(user)} disabled={user.id === currentUser?.id}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={user.id === currentUser?.id}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                <AlertDialogDescription>{user.name} будет перемещён в корзину. Его можно будет восстановить.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(user.id, user.name)} className="bg-destructive text-white hover:bg-destructive/90">В корзину</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );

  const UserCard = ({ user }: { user: AppUser }) => {
    const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-sm font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{user.name}{user.id === currentUser?.id && <span className="ml-1 text-xs text-muted-foreground">(вы)</span>}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground font-mono">{'•'.repeat(Math.min(user.password.length, 8))}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Зарег.: {new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v as UserRole)} disabled={user.id === currentUser?.id}>
                  <SelectTrigger className="h-6 text-[11px] w-32 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Пользователь</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {user.id !== currentUser?.id && (
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(user)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                      <AlertDialogDescription>{user.name} будет перемещён в корзину.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(user.id, user.name)} className="bg-destructive text-white">В корзину</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-background to-background pointer-events-none" />
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-5 w-5 text-emerald-400" />
              <h1 className="text-2xl font-bold">Администратор</h1>
            </div>
            <p className="text-sm text-muted-foreground">Управление пользователями</p>
          </div>
          <Button onClick={() => setAddOpen(true)} className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white">
            <Plus className="h-4 w-4" /> Добавить
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-1 text-emerald-400" />
              <p className="text-2xl font-bold">{users.length}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Всего</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="h-6 w-6 mx-auto mb-1 text-amber-400" />
              <p className="text-2xl font-bold">{adminCount}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Админов</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-1 text-blue-400" />
              <p className="text-2xl font-bold">{userCount}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Юзеров</p>
            </CardContent>
          </Card>
          {pendingUsers.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 mx-auto mb-1 text-amber-400" />
                <p className="text-2xl font-bold text-amber-400">{pendingUsers.length}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Заявок</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-4">
            <TabsTrigger value="users">Пользователи ({filteredUsers.length})</TabsTrigger>
            <TabsTrigger value="trash" className="gap-1.5">
              Корзина
              {deletedUsers.length > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">{deletedUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              Заявки
              {pendingUsers.length > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            {/* Date filter */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(DATE_FILTER_LABELS) as Exclude<DateFilter, 'range'>[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    dateFilter === f
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {DATE_FILTER_LABELS[f]}
                </button>
              ))}
              <button
                onClick={() => setDateFilter('range')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  dateFilter === 'range'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Период
              </button>
            </div>

            {/* Calendar range picker (shown when range is active) */}
            {dateFilter === 'range' && (
              <div className="mb-4">
                <PeriodCalendarPicker
                  periodStart={rangeStart}
                  periodEnd={rangeEnd}
                  onPeriodChange={(start, end) => {
                    setRangeStart(start);
                    setRangeEnd(end);
                  }}
                />
              </div>
            )}

            {/* Desktop table */}
            <Card className="hidden md:block">
              <CardHeader className="pb-3"><CardTitle className="text-base">Список пользователей</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пользователь</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Пароль</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Зарегистрирован</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => <UserRow key={user.id} user={user} />)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredUsers.map((user) => <UserCard key={user.id} user={user} />)}
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Нет пользователей за этот период</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trash">
            {deletedUsers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Корзина пуста</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deletedUsers.map((user) => {
                  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <Card key={user.id} className="border-border/50 opacity-80">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback className="bg-muted text-muted-foreground text-sm font-bold">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <Badge variant="secondary" className="mt-1 text-[11px]">
                              {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                            </Badge>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                              onClick={() => { restoreUser(user.id); toast.success(`${user.name} восстановлен`); }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Восстановить
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                  <X className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить навсегда?</AlertDialogTitle>
                                  <AlertDialogDescription>Данные {user.name} будут удалены без возможности восстановления.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => { permanentDeleteUser(user.id); toast.success(`${user.name} удалён навсегда`); }} className="bg-destructive text-white">Удалить</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending">
            {pendingUsers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Нет ожидающих заявок</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => {
                  const initials = user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
                  return (
                    <Card key={user.id} className="border-amber-500/20 bg-amber-500/5">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback className="bg-amber-500/20 text-amber-400 text-sm font-bold">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                              onClick={async () => { await approveUser(user.id); toast.success(`${user.name} одобрен`); }}
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Одобрить
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                                  <X className="h-3.5 w-3.5" /> Отклонить
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Отклонить заявку?</AlertDialogTitle>
                                  <AlertDialogDescription>{user.name} не сможет войти в систему.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction onClick={async () => { await rejectUser(user.id); toast.success(`Заявка ${user.name} отклонена`); }} className="bg-destructive text-white">Отклонить</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>Новый пользователь</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1"><Label>Имя</Label><Input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="Иван Иванов" /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="ivan@example.com" /></div>
            <div className="space-y-1">
              <Label>Пароль</Label>
              <div className="relative">
                <Input
                  type={showAddPwd ? 'text' : 'password'}
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button type="button" onClick={() => setShowAddPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showAddPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1"><Label>Роль</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Пользователь</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Отмена</Button>
            <Button onClick={handleAdd} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">Добавить</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) { setEditOpen(false); setEditTarget(null); } }}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>Редактировать: {editTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1"><Label>Имя</Label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Пароль</Label>
              <div className="relative">
                <Input
                  type={showEditPwd ? 'text' : 'password'}
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  className="pr-9"
                />
                <button type="button" onClick={() => setShowEditPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showEditPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1"><Label>Роль</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Пользователь</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="flex-1">Отмена</Button>
            <Button onClick={handleEdit} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
