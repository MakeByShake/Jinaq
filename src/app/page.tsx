'use client';

import Link from 'next/link';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Car, Check, Clock, Coffee, Gauge, GraduationCap,
  HandCoins, Languages, Lock, Plus, ShoppingBasket, Sparkles, Target, WifiOff, Wallet, Zap, BadgePercent,
  Landmark, ShieldCheck, Send, MessageCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher, ThemeButton } from '@/components/auth/auth-shell';
import { Ring } from '@/components/app/ui';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuthStore } from '@/stores/auth-store';
import { useLocale, useT, type TFunction } from '@/i18n';
import { formatMoney } from '@/lib/format';
import type { Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─── Motion (CSS only, disabled for reduced motion) ─────────────────────────

const MOTION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes land-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes land-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @keyframes land-pop { from { opacity: 0; transform: translateY(10px) scale(.94); } to { opacity: 1; transform: none; } }
  .land-rise { animation: land-rise .8s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--d, 0s); }
  .land-float { animation: land-float 7s ease-in-out infinite; }
  .land-pop { animation: land-pop .7s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--d, .6s); }
  @supports (animation-timeline: view()) {
    .land-reveal { animation: land-rise linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
  }
}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCta() {
  const t = useT();
  const user = useAuthStore((s) => s.currentUser);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signedIn = !isLoading && !!user;
  return { signedIn, href: signedIn ? '/dashboard' : '/register', label: signedIn ? t('land.openApp') : t('land.start') };
}

function PrimaryCta({ className, size = 'lg' }: { className?: string; size?: 'md' | 'lg' }) {
  const { href, label } = useCta();
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-[transform,background-color] hover:bg-primary/90 active:scale-[0.98]',
        size === 'lg' ? 'h-13 px-6 text-base' : 'h-10 px-4 text-sm',
        className,
      )}
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionHeading({ id, kicker, title, sub }: { id: string; kicker: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center land-reveal">
      <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">{kicker}</p>
      <h2 id={id} className="mt-3 font-display text-[1.65rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">{sub}</p>}
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function SiteHeader() {
  const t = useT();
  const { signedIn } = useCta();
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl safe-top">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="Jinaq" className="shrink-0 rounded-xl">
          <Logo markClassName="h-8 w-8" />
        </Link>

        <nav aria-label={t('land.menu')} className="hidden items-center gap-1 lg:flex">
          {[
            ['#features', 'land.navFeatures'],
            ['#how', 'land.navHow'],
            ['#faq', 'land.navFaq'],
          ].map(([href, key]) => (
            <a key={href} href={href} className="rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {t(key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <ThemeButton />
          {signedIn ? (
            <PrimaryCta size="md" className="hidden sm:inline-flex" />
          ) : (
            <>
              <Link href="/login" className="hidden h-10 items-center rounded-2xl px-3 text-sm font-bold hover:bg-muted sm:inline-flex">
                {t('land.login')}
              </Link>
              <PrimaryCta size="md" className="hidden md:inline-flex" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Phone mockup (pure markup, decorative) ─────────────────────────────────

const MOCK_TX: { key: string; icon: LucideIcon; color: string; amount: number; account: string }[] = [
  { key: 'mockCoffee', icon: Coffee, color: '#F59E0B', amount: -1200, account: 'mockCard' },
  { key: 'mockTaxi', icon: Car, color: '#3B82F6', amount: -1850, account: 'mockCard' },
  { key: 'mockGrant', icon: GraduationCap, color: '#8B5CF6', amount: 36750, account: 'mockCard' },
  { key: 'mockGroceries', icon: ShoppingBasket, color: '#10B981', amount: -4350, account: 'mockCash' },
];

function PhoneMockup({ t, locale }: { t: TFunction; locale: Locale }) {
  const money = (v: number, sign = false) => formatMoney(v, 'KZT', locale, { sign });
  return (
    <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[320px]" aria-hidden>
      {/* glow */}
      <div className="pointer-events-none absolute inset-x-0 top-10 bottom-0 -z-10 rounded-full bg-primary/25 blur-3xl" />
      <div className="land-float">
        <div className="rounded-[2.75rem] border border-border bg-card p-2.5 shadow-2xl shadow-black/15 ring-1 ring-black/5 dark:shadow-black/50">
          <div className="relative overflow-hidden rounded-[2.2rem] bg-background">
            {/* status bar */}
            <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-bold tabular">
              <span>9:41</span>
              <span className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground/90" />
              <span className="flex gap-1">
                <span className="h-2 w-3.5 rounded-sm bg-foreground/80" />
              </span>
            </div>

            <div className="space-y-3 px-3.5 pt-3 pb-4">
              <div className="flex items-center gap-2.5 px-0.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">А</span>
                <span className="text-sm font-extrabold">{t('land.mockHello')}</span>
              </div>

              {/* balance card */}
              <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-4 text-white">
                <div className="pointer-events-none absolute -right-8 -bottom-12 h-32 w-32 rounded-full bg-white/10 blur-xl" />
                <p className="text-[11px] font-medium text-white/75">{t('land.mockBalance')}</p>
                <p className="mt-0.5 font-display text-[1.6rem] leading-tight font-semibold tabular">{money(184500)}</p>
                <div className="mt-2 flex gap-3 text-[11px] text-white/85">
                  <span className="flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" /> {money(36750, true)}</span>
                  <span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> {money(-48200)}</span>
                </div>
                <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/12 p-2.5 backdrop-blur-sm">
                  <Ring value={0.64} size={44} stroke={5} color="#fde68a">
                    <Clock className="h-4 w-4 text-white/85" />
                  </Ring>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-white/75">{t('land.mockToday')}</p>
                    <p className="font-display text-base font-semibold tabular">{money(6400)}</p>
                    <p className="truncate text-[10px] text-white/70">{t('land.mockDays')}</p>
                  </div>
                </div>
              </div>

              {/* transactions */}
              <div className="rounded-3xl border border-border bg-card p-2 card-shadow">
                <p className="px-2 pt-1 pb-1.5 text-[11px] font-bold text-muted-foreground">{t('land.mockRecent')}</p>
                <ul>
                  {MOCK_TX.map((tx) => (
                    <li key={tx.key} className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tx.color}22`, color: tx.color }}>
                        <tx.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{t(`land.${tx.key}`)}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{t(`land.${tx.account}`)}</span>
                      </span>
                      <span className={cn('text-[13px] font-bold tabular', tx.amount > 0 ? 'text-income' : 'text-foreground')}>
                        {money(tx.amount, true)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* bottom bar */}
              <div className="flex items-center justify-around rounded-2xl bg-card px-2 py-1.5 card-shadow">
                <span className="h-1.5 w-6 rounded-full bg-primary" />
                <span className="h-1.5 w-6 rounded-full bg-muted-foreground/30" />
                <span className="-mt-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="h-1.5 w-6 rounded-full bg-muted-foreground/30" />
                <span className="h-1.5 w-6 rounded-full bg-muted-foreground/30" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* floating chips */}
      <div className="land-pop absolute top-24 -left-10 hidden w-52 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur sm:block lg:-left-44" style={{ ['--d' as string]: '.7s' }}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15 text-gold"><Sparkles className="h-3.5 w-3.5" /></span>
          <span className="text-xs font-bold">{t('land.mockChipBuy')}</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t('land.mockChipBuyText')}</p>
      </div>
      <div className="land-pop absolute -right-4 bottom-32 hidden w-48 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur sm:block lg:-right-20" style={{ ['--d' as string]: '.95s' }}>
        <p className="text-xs font-bold">{t('land.mockChipBudget')}</p>
        <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[62%] rounded-full bg-warning" />
          <div className="absolute top-0 left-[74%] h-full w-0.5 bg-foreground/50" />
        </div>
      </div>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function Hero() {
  const t = useT();
  const locale = useLocale();
  const { signedIn } = useCta();
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-dots [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
      <div className="pointer-events-none absolute -top-40 right-[-10%] -z-10 h-[28rem] w-[28rem] rounded-full bg-gold/15 blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pt-20 lg:pb-24">
        <div className="text-center lg:text-left">
          <p className="land-rise inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> {t('land.heroBadge')}
          </p>
          <h1 id="hero-title" className="land-rise mt-5 font-display text-[2.15rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem]" style={{ ['--d' as string]: '.08s' }}>
            {t('land.heroTitle')}{' '}
            <span className="bg-gradient-to-r from-primary to-gold bg-clip-text text-transparent">{t('land.heroTitleAccent')}</span>
          </h1>
          <p className="land-rise mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg lg:mx-0" style={{ ['--d' as string]: '.16s' }}>
            {t('land.heroSub')}
          </p>
          <div className="land-rise mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start" style={{ ['--d' as string]: '.24s' }}>
            <PrimaryCta />
            {!signedIn && (
              <Link href="/login" className="inline-flex h-13 items-center justify-center rounded-2xl border border-border bg-card px-6 text-base font-bold transition-colors hover:bg-muted">
                {t('land.heroSecondary')}
              </Link>
            )}
          </div>
          <p className="land-rise mt-4 text-sm text-muted-foreground" style={{ ['--d' as string]: '.3s' }}>{t('land.heroNote')}</p>
          <ul className="land-rise mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold lg:justify-start" style={{ ['--d' as string]: '.36s' }}>
            {(['heroProof1', 'heroProof2'] as const).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-income" /> {t(`land.${k}`)}
              </li>
            ))}
            <li className="flex items-center gap-1.5"><Check className="h-4 w-4 text-income" /> RU · KZ · EN</li>
          </ul>
        </div>
        <div className="land-rise" style={{ ['--d' as string]: '.2s' }}>
          <PhoneMockup t={t} locale={locale} />
        </div>
      </div>
    </section>
  );
}

const FEATURES: { n: number; icon: LucideIcon; tone: string; wide?: boolean }[] = [
  { n: 1, icon: Zap, tone: 'bg-gold/15 text-gold', wide: true },
  { n: 2, icon: Wallet, tone: 'bg-white/18 text-white', wide: true },
  { n: 3, icon: Gauge, tone: 'bg-warning/15 text-warning' },
  { n: 4, icon: Target, tone: 'bg-accent text-accent-foreground' },
  { n: 5, icon: HandCoins, tone: 'bg-chart-2/15 text-chart-2' },
  { n: 6, icon: BarChart3, tone: 'bg-chart-4/15 text-chart-4' },
  { n: 7, icon: WifiOff, tone: 'bg-muted text-foreground', wide: true },
  { n: 8, icon: Languages, tone: 'bg-income/12 text-income', wide: true },
];

function FeatureExtra({ n, t }: { n: number; t: TFunction }) {
  if (n === 1) {
    return (
      <div className="mt-5 flex flex-wrap gap-2" aria-hidden>
        {[[Coffee, '#F59E0B', 'mockCoffee'], [Car, '#3B82F6', 'mockTaxi'], [ShoppingBasket, '#10B981', 'mockGroceries']].map(([Icon, color, key]) => {
          const I = Icon as LucideIcon;
          return (
            <span key={key as string} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold">
              <I className="h-3.5 w-3.5" style={{ color: color as string }} /> {t(`land.${key}`)}
            </span>
          );
        })}
      </div>
    );
  }
  if (n === 5) {
    return (
      <div className="mt-4 flex gap-2" aria-hidden>
        <span className="inline-flex items-center gap-1 rounded-full bg-income/12 px-2.5 py-1 text-[11px] font-bold text-income"><MessageCircle className="h-3 w-3" /> WhatsApp</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-chart-2/15 px-2.5 py-1 text-[11px] font-bold text-chart-2"><Send className="h-3 w-3" /> Telegram</span>
      </div>
    );
  }
  if (n === 8) {
    return (
      <div className="mt-5 flex gap-2" aria-hidden>
        {['Русский', 'Қазақша', 'English'].map((l) => (
          <span key={l} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold">{l}</span>
        ))}
      </div>
    );
  }
  return null;
}

function Features() {
  const t = useT();
  const locale = useLocale();
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="features-title" kicker={t('land.featuresKicker')} title={t('land.featuresTitle')} sub={t('land.featuresSub')} />
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const hero = f.n === 2;
            return (
              <li
                key={f.n}
                className={cn(
                  'land-reveal relative overflow-hidden rounded-3xl border p-5 transition-transform duration-300 hover:-translate-y-0.5 sm:p-6',
                  f.wide && 'lg:col-span-2',
                  hero ? 'border-transparent bg-brand-gradient text-white shadow-xl shadow-primary/20' : 'border-border bg-card card-shadow',
                )}
              >
                {hero && <div className="pointer-events-none absolute inset-0 bg-dots opacity-25" />}
                <div className="relative">
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', f.tone)}>
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold tracking-tight">{t(`land.f${f.n}Title`)}</h3>
                  <p className={cn('mt-1.5 text-[15px] leading-relaxed', hero ? 'text-white/85' : 'text-muted-foreground')}>{t(`land.f${f.n}Text`)}</p>
                  {hero && (
                    <p className="mt-4 font-display text-3xl font-semibold tabular" aria-hidden>
                      {formatMoney(6400, 'KZT', locale)} <span className="text-sm font-medium text-white/70">/ {t('common.today').toLowerCase()}</span>
                    </p>
                  )}
                  <FeatureExtra n={f.n} t={t} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const t = useT();
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-y border-border bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="how-title" kicker={t('land.howKicker')} title={t('land.howTitle')} />
        <div className="relative mt-12">
        <div className="pointer-events-none absolute top-14 right-[16%] left-[16%] hidden h-px border-t-2 border-dashed border-primary/25 md:block" aria-hidden />
        <ol className="relative grid gap-4 md:grid-cols-3 md:gap-6">
          {[1, 2, 3].map((n) => (
            <li key={n} className="land-reveal relative rounded-3xl border border-border bg-card p-6 card-shadow">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-display text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                {n}
              </span>
              <h3 className="mt-5 text-lg font-extrabold tracking-tight">{t(`land.s${n}Title`)}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t(`land.s${n}Text`)}</p>
            </li>
          ))}
        </ol>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const t = useT();
  const items: { n: number; icon: LucideIcon }[] = [
    { n: 1, icon: BadgePercent },
    { n: 2, icon: Landmark },
    { n: 3, icon: ShieldCheck },
  ];
  return (
    <section aria-label={`${t('land.b1Title')}, ${t('land.b2Title')}, ${t('land.b3Title')}`} className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ul className="land-reveal grid divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card card-shadow md:grid-cols-3 md:divide-x md:divide-y-0">
          {items.map(({ n, icon: Icon }) => (
            <li key={n} className="flex items-start gap-4 p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">{t(`land.b${n}Title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`land.b${n}Text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const FAQ_COUNT = 6;

function Faq() {
  const t = useT();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: Array.from({ length: FAQ_COUNT }, (_, i) => ({
      '@type': 'Question',
      name: t(`land.q${i + 1}`),
      acceptedAnswer: { '@type': 'Answer', text: t(`land.a${i + 1}`) },
    })),
  };
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 pb-16 sm:pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading id="faq-title" kicker={t('land.faqKicker')} title={t('land.faqTitle')} />
        <Accordion type="single" collapsible className="land-reveal mt-10 rounded-3xl border border-border bg-card px-5 card-shadow sm:px-7">
          {Array.from({ length: FAQ_COUNT }, (_, i) => (
            <AccordionItem key={i} value={`q${i + 1}`}>
              <AccordionTrigger className="min-h-14 items-center py-4 text-base font-bold hover:no-underline">
                {t(`land.q${i + 1}`)}
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">
                {t(`land.a${i + 1}`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </section>
  );
}

function FinalCta() {
  const t = useT();
  return (
    <section aria-labelledby="final-title" className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="land-reveal relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-brand-gradient px-6 py-14 text-center text-white shadow-2xl shadow-primary/20 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-25" />
        <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative">
          <h2 id="final-title" className="mx-auto max-w-2xl font-display text-[1.75rem] leading-tight font-semibold text-balance sm:text-4xl">{t('land.finalTitle')}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">{t('land.finalText')}</p>
          <FinalButton />
          <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-white/75">
            <Lock className="h-3.5 w-3.5" /> {t('land.heroNote')}
          </p>
        </div>
      </div>
    </section>
  );
}

function FinalButton() {
  const { href, label } = useCta();
  return (
    <Link
      href={href}
      className="group mt-8 inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-base font-bold text-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] dark:text-background"
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SiteFooter() {
  const t = useT();
  const { signedIn } = useCta();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo markClassName="h-9 w-9" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{t('land.footerTagline')}</p>
          <LanguageSwitcher className="mt-5" />
        </div>
        <nav aria-label={t('land.footerProduct')}>
          <h2 className="text-sm font-bold">{t('land.footerProduct')}</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li><a href="#features" className="inline-block py-1.5 hover:text-foreground">{t('land.navFeatures')}</a></li>
            <li><a href="#how" className="inline-block py-1.5 hover:text-foreground">{t('land.navHow')}</a></li>
            <li><a href="#faq" className="inline-block py-1.5 hover:text-foreground">{t('land.navFaq')}</a></li>
          </ul>
        </nav>
        <nav aria-label={t('land.footerAccount')}>
          <h2 className="text-sm font-bold">{t('land.footerAccount')}</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {signedIn ? (
              <li><Link href="/dashboard" className="inline-block py-1.5 hover:text-foreground">{t('land.openApp')}</Link></li>
            ) : (
              <>
                <li><Link href="/login" className="inline-block py-1.5 hover:text-foreground">{t('land.login')}</Link></li>
                <li><Link href="/register" className="inline-block py-1.5 hover:text-foreground">{t('land.start')}</Link></li>
              </>
            )}
          </ul>
        </nav>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:px-6">
          {t('land.footerRights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const t = useT();
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <style>{MOTION_CSS}</style>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t('land.skipToContent')}
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Benefits />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
