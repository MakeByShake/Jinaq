'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Archive, ArchiveRestore, Bookmark, ChevronDown, ChevronRight, ChevronUp, Database, FileJson, FileSpreadsheet,
  Info, KeyRound, LogOut, Monitor, Moon, Palette, Pencil, Plus, Send, Sun, Tags, Trash2, UserRound, UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConfirmDialog, EmptyState, Field, PageContainer, PageHeader, Panel, Segmented, useConfirm } from '@/components/app/ui';
import { ResponsiveSheet } from '@/components/app/sheet';
import { ColorPicker, IconPicker } from '@/components/app/pickers';
import { UserAvatar } from '@/components/app/user-avatar';
import { LogoMark } from '@/components/brand/logo';
import { useData } from '@/stores/data-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAccounts, useCategories } from '@/hooks/use-finance';
import { evalAmount, useCurrency, useMoney } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import {
  deleteCategory, deleteTemplate, newId, saveCategory, saveTemplate, wipeUserData,
} from '@/lib/actions';
import { exportTransactionsCsv } from '@/lib/export';
import { CURRENCIES } from '@/lib/defaults';
import { DynamicIcon, IconBubble, PALETTE } from '@/lib/icons';
import { LOCALES, useLocale, useLocaleStore, useT } from '@/i18n';
import { cn } from '@/lib/utils';
import type { Category, CategoryKind, CurrencyCode, Locale, Template } from '@/lib/types';

const APP_VERSION = '2.0';
const inputCls = 'h-11 rounded-xl';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Center-crops and scales an image file to a square JPEG data URL. */
async function resizeImage(file: File, max = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(max, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ActionRow({ icon, title, hint, onClick, danger, disabled }: {
  icon: React.ReactNode; title: React.ReactNode; hint?: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-muted/70 disabled:opacity-50"
    >
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', danger ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground')}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', danger && 'text-destructive')}>{title}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Irreversible action that requires typing a confirmation word. */
function TypedConfirm({ open, onOpenChange, title, text, confirmLabel, onConfirm, busy }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; text: string; confirmLabel: string;
  onConfirm: () => void; busy: boolean;
}) {
  const t = useT();
  const word = t('set.confirmWord');
  const [typed, setTyped] = useState('');
  const ok = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) setTyped(''); } }}>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <Field label={t('set.typeToConfirm', { word })}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputCls} autoComplete="off" placeholder={word} />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl" disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
          <Button className="rounded-xl bg-destructive text-white hover:bg-destructive/90" disabled={!ok || busy} onClick={onConfirm}>
            {busy ? t('common.loading') : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileSection() {
  const t = useT();
  const user = useAuthStore((s) => s.currentUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = name.trim() !== (user?.name ?? '');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const avatar = await resizeImage(file);
      await updateProfile({ avatar });
      toast.success(t('set.photoUpdated'));
    } catch {
      toast.error(t('set.photoError'));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!name.trim()) return toast.error(t('set.nameRequired'));
    await updateProfile({ name: name.trim() }).catch(() => toast.error(t('common.errorGeneric')));
    toast.success(t('common.saved'));
  };

  return (
    <Panel title={t('set.profile')} icon={UserRound}>
      <div className="flex items-center gap-4">
        <UserAvatar className="h-20 w-20 text-xl" />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <Button variant="outline" size="sm" className="h-10 rounded-xl" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? t('common.loading') : user?.avatar ? t('set.changePhoto') : t('set.uploadPhoto')}
          </Button>
          {user?.avatar && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-muted-foreground"
              onClick={() => updateProfile({ avatar: undefined }).then(() => toast(t('set.photoRemoved')))}
            >
              {t('set.removePhoto')}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <Field label={t('set.name')}>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && dirty) saveName(); }} className={inputCls} maxLength={50} autoComplete="name" />
            {dirty && <Button className="h-11 shrink-0 rounded-xl" onClick={saveName}>{t('common.save')}</Button>}
          </div>
        </Field>
        <Field label={t('set.email')}>
          <Input value={user?.email ?? ''} readOnly className={cn(inputCls, 'bg-muted/50 text-muted-foreground')} />
        </Field>
      </div>
    </Panel>
  );
}

// ─── Preferences ─────────────────────────────────────────────────────────────

function PreferencesSection() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const currency = useCurrency();
  const { theme, setTheme } = useTheme();

  return (
    <Panel title={t('set.preferences')} icon={Palette}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.language')}</p>
          <Segmented<Locale>
            value={locale}
            onChange={(l) => { setLocale(l); updateProfile({ locale: l }).catch(() => {}); }}
            className="w-full"
            options={LOCALES.map((l) => ({ value: l.code, label: l.label }))}
          />
        </div>
        <Field label={t('common.currency')}>
          <Select value={currency} onValueChange={(v) => updateProfile({ currency: v as CurrencyCode }).catch(() => toast.error(t('common.errorGeneric')))}>
            <SelectTrigger className="h-11! w-full rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="w-10 font-semibold">{c.symbol}</span> {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.theme')}</p>
          <Segmented
            value={(theme ?? 'system') as 'light' | 'dark' | 'system'}
            onChange={setTheme}
            className="w-full"
            options={[
              { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun className="h-4 w-4" />{t('common.themeLight')}</span> },
              { value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon className="h-4 w-4" />{t('common.themeDark')}</span> },
              { value: 'system', label: <span className="flex items-center justify-center gap-1.5"><Monitor className="h-4 w-4" />{t('common.themeSystem')}</span> },
            ]}
          />
        </div>
      </div>
    </Panel>
  );
}

// ─── Contacts ────────────────────────────────────────────────────────────────

function ContactsSection() {
  const t = useT();
  const user = useAuthStore((s) => s.currentUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [kaspi, setKaspi] = useState(user?.kaspiNumber ?? '');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '');
  const dirty = kaspi.trim() !== (user?.kaspiNumber ?? '') || telegram.trim() !== (user?.telegram ?? '') || whatsapp.trim() !== (user?.whatsapp ?? '');

  const save = async () => {
    try {
      await updateProfile({
        kaspiNumber: kaspi.trim() || undefined,
        telegram: telegram.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
      });
      toast.success(t('common.saved'));
    } catch {
      toast.error(t('common.errorGeneric'));
    }
  };

  return (
    <Panel title={t('set.contacts')} icon={Send}>
      <p className="-mt-1 mb-3 text-xs text-muted-foreground">{t('set.contactsHint')}</p>
      <div className="space-y-3">
        <Field label={t('set.kaspi')}>
          <Input value={kaspi} onChange={(e) => setKaspi(e.target.value)} placeholder={t('set.kaspiPlaceholder')} inputMode="tel" autoComplete="tel" className={inputCls} />
        </Field>
        <Field label={t('set.telegram')}>
          <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder={t('set.telegramPlaceholder')} className={inputCls} autoCapitalize="off" />
        </Field>
        <Field label={t('set.whatsapp')}>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t('set.whatsappPlaceholder')} inputMode="tel" className={inputCls} />
        </Field>
        <Button className="h-11 w-full rounded-xl" disabled={!dirty} onClick={save}>{t('common.save')}</Button>
      </div>
    </Panel>
  );
}

// ─── Categories ──────────────────────────────────────────────────────────────

function CategoryForm({ open, onOpenChange, category, kind, nextOrder }: {
  open: boolean; onOpenChange: (v: boolean) => void; category: Category | null; kind: CategoryKind; nextOrder: number;
}) {
  const t = useT();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'more');
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const builtinLabel = category?.key ? t(`cat.${category.key}`) : '';

  const submit = () => {
    if (!name.trim() && !category?.key) return toast.error(t('common.required'));
    saveCategory({
      ...(category ?? { id: newId('cat'), kind, order: nextOrder }),
      name: name.trim() || undefined,
      icon, color,
    });
    toast.success(category ? t('common.saved') : t('set.categoryCreated'));
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={category ? t('set.editCategory') : t('set.addCategory')}
      footer={<Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={submit}>{t('common.save')}</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
          <IconBubble icon={icon} color={color} />
          <span className="truncate font-semibold">{name.trim() || builtinLabel || t('set.categoryName')}</span>
        </div>
        <Field label={t('set.categoryName')} hint={category?.key ? t('set.categoryNameHint') : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={builtinLabel} className={inputCls} maxLength={40} />
        </Field>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.icon')}</p>
          <IconPicker value={icon} onChange={setIcon} color={color} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.color')}</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
    </ResponsiveSheet>
  );
}

function CategoriesSection() {
  const t = useT();
  const { categories, label } = useCategories();
  const transactions = useData((s) => s.transactions);
  const recurring = useData((s) => s.recurring);
  const templates = useData((s) => s.templates);
  const budgets = useData((s) => s.budgets);
  const confirm = useConfirm();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [form, setForm] = useState<{ open: boolean; category: Category | null; key: number }>({ open: false, category: null, key: 0 });
  const [showArchived, setShowArchived] = useState(false);

  const list = useMemo(() => categories.filter((c) => c.kind === kind).sort((a, b) => a.order - b.order), [categories, kind]);
  const active = list.filter((c) => !c.archived);
  const archived = list.filter((c) => c.archived);
  const nextOrder = categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;

  const used = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((x) => x.categoryId && s.add(x.categoryId));
    recurring.forEach((x) => s.add(x.categoryId));
    templates.forEach((x) => s.add(x.categoryId));
    budgets.forEach((x) => s.add(x.categoryId));
    return s;
  }, [transactions, recurring, templates, budgets]);

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= active.length) return;
    const next = [...active];
    [next[idx], next[j]] = [next[j], next[idx]];
    let orders = active.map((c) => c.order).sort((a, b) => a - b);
    if (new Set(orders).size !== orders.length) orders = active.map((_, k) => orders[0] + k);
    next.forEach((c, k) => { if (c.order !== orders[k]) saveCategory({ ...c, order: orders[k] }); });
  };

  const toggleArchive = (c: Category) => {
    saveCategory({ ...c, archived: !c.archived || undefined });
    toast.success(c.archived ? t('set.unarchivedToast') : t('set.archivedToast'), {
      action: { label: t('common.undo'), onClick: () => saveCategory(c) },
    });
  };

  const remove = (c: Category) => {
    if (used.has(c.id)) {
      toast.error(t('set.categoryInUse'), c.archived ? undefined : { action: { label: t('set.archive'), onClick: () => toggleArchive(c) } });
      return;
    }
    confirm.ask(() => {
      deleteCategory(c.id);
      toast(t('set.categoryDeleted'), { action: { label: t('common.undo'), onClick: () => saveCategory(c) } });
    });
  };

  const openForm = (category: Category | null) => setForm((f) => ({ open: true, category, key: f.key + 1 }));

  const renderRow = (c: Category, idx: number, isArchived: boolean) => (
    <li key={c.id} className={cn('flex items-center gap-1 rounded-2xl py-1 pl-1 hover:bg-muted/50', isArchived && 'opacity-60')}>
      <button type="button" onClick={() => openForm(c)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left">
        <IconBubble icon={c.icon} color={c.color} size="sm" />
        <span className="truncate text-sm font-semibold">{label(c)}</span>
      </button>
      {!isArchived && (
        <>
          <Button variant="ghost" size="icon" className="h-10 w-9 rounded-xl text-muted-foreground" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label={t('set.moveUp')}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-9 rounded-xl text-muted-foreground" disabled={idx === active.length - 1} onClick={() => move(idx, 1)} aria-label={t('set.moveDown')}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="h-10 w-9 rounded-xl text-muted-foreground" onClick={() => toggleArchive(c)} aria-label={isArchived ? t('set.unarchive') : t('set.archive')}>
        {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-10 w-9 rounded-xl text-muted-foreground hover:text-destructive" onClick={() => remove(c)} aria-label={t('common.delete')}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );

  return (
    <Panel
      title={t('set.categories')}
      icon={Tags}
      action={
        <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => openForm(null)}>
          <Plus className="h-4 w-4" /> {t('common.add')}
        </Button>
      }
    >
      <Segmented
        value={kind}
        onChange={(k) => { setKind(k); setShowArchived(false); }}
        className="mb-3 w-full"
        size="sm"
        options={[
          { value: 'expense', label: t('common.expenses'), className: 'text-expense' },
          { value: 'income', label: t('common.incomes'), className: 'text-income' },
        ]}
      />
      {active.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('set.noCategories')}</p>
      ) : (
        <ul className="-mx-1 max-h-[26rem] overflow-y-auto">{active.map((c, i) => renderRow(c, i, false))}</ul>
      )}
      {archived.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            <Archive className="h-3.5 w-3.5" /> {t('set.archived')} · {archived.length}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showArchived && 'rotate-180')} />
          </button>
          {showArchived && <ul className="-mx-1">{archived.map((c, i) => renderRow(c, i, true))}</ul>}
        </div>
      )}
      <CategoryForm
        key={form.key}
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        category={form.category}
        kind={kind}
        nextOrder={nextOrder}
      />
      <ConfirmDialog {...confirm.props} />
    </Panel>
  );
}

// ─── Templates ───────────────────────────────────────────────────────────────

function TemplateForm({ template, onClose }: { template: Template; onClose: () => void }) {
  const t = useT();
  const { byKind, label } = useCategories();
  const { active: accounts } = useAccounts();
  const [name, setName] = useState(template.name);
  const [amount, setAmount] = useState(String(template.amount));
  const [categoryId, setCategoryId] = useState(template.categoryId);
  const [accountId, setAccountId] = useState<string | undefined>(template.accountId);

  const submit = () => {
    const v = evalAmount(amount);
    if (!name.trim()) return toast.error(t('common.required'));
    if (!Number.isFinite(v) || v <= 0) return toast.error(t('common.invalidAmount'));
    saveTemplate({ ...template, name: name.trim(), amount: v, categoryId, accountId });
    toast.success(t('common.saved'));
    onClose();
  };

  const chip = (active: boolean) => cn(
    'flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors',
    active ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted',
  );

  return (
    <ResponsiveSheet
      open
      onOpenChange={(v) => !v && onClose()}
      title={t('set.editTemplate')}
      footer={<Button className="h-12 w-full rounded-2xl text-base font-bold" onClick={submit}>{t('common.save')}</Button>}
    >
      <div className="space-y-4">
        <Field label={t('common.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={40} />
        </Field>
        <Field label={t('common.amount')}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={cn(inputCls, 'tabular')} />
        </Field>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.category')}</p>
          <div className="flex flex-wrap gap-2">
            {byKind(template.kind).map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={chip(c.id === categoryId)}>
                <DynamicIcon name={c.icon} className="h-3.5 w-3.5" style={{ color: c.color }} />
                {label(c)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-foreground/80">{t('common.account')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAccountId(undefined)} className={chip(!accountId)}>{t('set.anyAccount')}</button>
            {accounts.map((a) => (
              <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={chip(a.id === accountId)}>
                <DynamicIcon name={a.icon} className="h-3.5 w-3.5" style={{ color: a.color }} />
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveSheet>
  );
}

function TemplatesSection() {
  const t = useT();
  const fmt = useMoney();
  const templates = useData((s) => s.templates);
  const { map, label } = useCategories();
  const [editing, setEditing] = useState<Template | null>(null);
  const sorted = useMemo(() => [...templates].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0)), [templates]);

  const remove = (tp: Template) => {
    deleteTemplate(tp.id);
    toast(t('set.templateDeleted'), { action: { label: t('common.undo'), onClick: () => saveTemplate(tp) } });
  };

  return (
    <Panel title={t('set.templates')} icon={Bookmark}>
      {sorted.length === 0 ? (
        <EmptyState icon={Bookmark} title={t('set.templatesEmpty')} text={t('set.templatesEmptyText')} className="py-6" />
      ) : (
        <ul className="-mx-1">
          {sorted.map((tp) => {
            const c = map.get(tp.categoryId);
            return (
              <li key={tp.id} className="flex items-center gap-1 rounded-2xl py-1 pl-1 hover:bg-muted/50">
                <button type="button" onClick={() => setEditing(tp)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl text-left">
                  <IconBubble icon={c?.icon} color={c?.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{tp.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {label(c)} · {t('set.used', { count: tp.uses ?? 0 })}
                    </span>
                  </span>
                  <span className={cn('shrink-0 text-sm font-bold tabular', tp.kind === 'income' ? 'text-income' : 'text-expense')}>
                    {fmt(tp.kind === 'income' ? tp.amount : -tp.amount, { sign: true })}
                  </span>
                </button>
                <Button variant="ghost" size="icon" className="h-10 w-9 rounded-xl text-muted-foreground" onClick={() => setEditing(tp)} aria-label={t('common.edit')}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-9 rounded-xl text-muted-foreground hover:text-destructive" onClick={() => remove(tp)} aria-label={t('common.delete')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <TemplateForm key={editing.id} template={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

function DataSection() {
  const t = useT();
  const router = useRouter();
  const user = useAuthStore((s) => s.currentUser);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const logout = useAuthStore((s) => s.logout);
  const currency = useCurrency();
  const { label } = useCategories();
  const { map: accMap } = useAccounts();
  const [dialog, setDialog] = useState<'wipe' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  const exportJson = () => {
    const s = useData.getState();
    const backup = {
      app: 'jinaq',
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      profile: user ? { name: user.name, email: user.email, currency: user.currency, locale: user.locale } : null,
      accounts: s.accounts,
      categories: s.categories,
      transactions: s.transactions,
      budgets: s.budgets,
      recurring: s.recurring,
      templates: s.templates,
      debts: s.debts,
      goals: s.goals,
      plan: s.plan,
    };
    downloadText(JSON.stringify(backup, null, 2), `jinaq-backup-${todayISO()}.json`, 'application/json');
    toast.success(t('set.exported'));
  };

  const exportCsv = () => {
    const txs = useData.getState().transactions;
    if (txs.length === 0) return toast(t('set.exportEmpty'));
    exportTransactionsCsv(txs, {
      currency,
      categoryLabel: (id) => label(id),
      accountName: (id) => (id ? accMap.get(id)?.name ?? '—' : '—'),
      kindLabel: (k) => t(`common.${k}`),
      headers: [t('tx.csvDate'), t('tx.csvType'), t('tx.csvCategory'), t('tx.csvAccount'), t('tx.csvAmount', { currency }), t('tx.csvNote')],
    });
    toast.success(t('set.exported'));
  };

  const wipe = async () => {
    setBusy(true);
    try {
      await wipeUserData();
      await updateProfile({ onboarded: false });
      toast.success(t('set.wipeDone'));
      setDialog(null);
      router.replace('/dashboard');
    } catch {
      toast.error(t('common.errorGeneric'));
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    const res = await deleteAccount();
    setBusy(false);
    if (res.success) {
      setDialog(null);
      toast.success(t('set.accountDeleted'));
      router.replace('/login');
      return;
    }
    if (res.error === 'errRecentLogin') {
      setDialog(null);
      toast.error(t('auth.errRecentLogin'), {
        duration: 10000,
        action: { label: t('set.relogin'), onClick: () => { logout().then(() => router.replace('/login')); } },
      });
    } else {
      toast.error(t(`auth.${res.error}`));
    }
  };

  return (
    <Panel title={t('set.data')} icon={Database}>
      <div className="-mx-1 space-y-0.5">
        <ActionRow icon={<FileJson className="h-[18px] w-[18px]" />} title={t('set.exportJson')} hint={t('set.exportJsonHint')} onClick={exportJson} />
        <ActionRow icon={<FileSpreadsheet className="h-[18px] w-[18px]" />} title={t('set.exportCsv')} hint={t('set.exportCsvHint')} onClick={exportCsv} />
        <ActionRow icon={<Trash2 className="h-[18px] w-[18px]" />} title={t('set.wipe')} hint={t('set.wipeHint')} onClick={() => setDialog('wipe')} danger />
        <ActionRow icon={<UserX className="h-[18px] w-[18px]" />} title={t('set.deleteAccount')} hint={t('set.deleteAccountHint')} onClick={() => setDialog('delete')} danger />
      </div>
      <TypedConfirm
        key={dialog ?? 'none'}
        open={dialog !== null}
        onOpenChange={(v) => !v && setDialog(null)}
        title={dialog === 'delete' ? t('set.deleteAccountTitle') : t('set.wipeTitle')}
        text={dialog === 'delete' ? t('set.deleteAccountText') : t('set.wipeText')}
        confirmLabel={dialog === 'delete' ? t('set.deleteAccount') : t('set.wipe')}
        onConfirm={dialog === 'delete' ? removeAccount : wipe}
        busy={busy}
      />
    </Panel>
  );
}

// ─── Security & about ────────────────────────────────────────────────────────

function SecuritySection() {
  const t = useT();
  const user = useAuthStore((s) => s.currentUser);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const [busy, setBusy] = useState(false);
  const email = user?.email ?? '';

  const send = async () => {
    setBusy(true);
    const res = await sendPasswordReset(email);
    setBusy(false);
    if (res.success) toast.success(t('set.resetSent', { email }));
    else toast.error(t(`auth.${res.error}`));
  };

  return (
    <Panel title={t('set.security')} icon={KeyRound}>
      <div className="-mx-1">
        <ActionRow
          icon={<KeyRound className="h-[18px] w-[18px]" />}
          title={busy ? t('common.loading') : t('set.resetPassword')}
          hint={t('set.resetPasswordHint', { email })}
          onClick={send}
          disabled={busy || !email}
        />
      </div>
    </Panel>
  );
}

function AboutSection() {
  const t = useT();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  return (
    <Panel title={t('set.about')} icon={Info}>
      <div className="flex items-center gap-3">
        <LogoMark className="h-12 w-12" />
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{t('common.appName')}</p>
          <p className="text-xs text-muted-foreground">{t('set.version', { version: APP_VERSION })} · {t('common.tagline')}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t('set.aboutText')}</p>
      <Button
        variant="outline"
        className="mt-4 h-11 w-full rounded-xl"
        onClick={async () => { await logout(); toast.success(t('common.loggedOut')); router.push('/login'); }}
      >
        <LogOut className="h-4 w-4" /> {t('common.logout')}
      </Button>
    </Panel>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useT();
  return (
    <PageContainer>
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          <ProfileSection />
          <PreferencesSection />
          <ContactsSection />
          <SecuritySection />
        </div>
        <div className="space-y-4 lg:space-y-5">
          <CategoriesSection />
          <TemplatesSection />
          <DataSection />
          <AboutSection />
        </div>
      </div>
    </PageContainer>
  );
}
