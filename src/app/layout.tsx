import type { Metadata, Viewport } from 'next';
import { Manrope, Unbounded } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-manrope',
  display: 'swap',
});

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-unbounded',
  display: 'swap',
});

// Public address of the site (used for link previews). Set NEXT_PUBLIC_SITE_URL on Vercel
// when the custom domain is connected, e.g. https://jinaqwallet.com
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://jinaq-jade.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Jinaq Wallet — личные финансы под контролем',
    template: '%s · Jinaq Wallet',
  },
  description:
    'Учёт расходов и доходов за 2 касания, бюджеты, цели и долги. Узнайте, сколько можно тратить сегодня. Бесплатно, на русском, казахском и английском.',
  applicationName: 'Jinaq Wallet',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jinaq Wallet',
  },
  icons: {
    icon: [
      { url: '/brand/logo-mark.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Jinaq Wallet — знай, сколько можно потратить сегодня',
    description: 'Учёт расходов за 2 касания, бюджеты, цели и долги. Бесплатно, на казахском, русском и английском.',
    type: 'website',
    siteName: 'Jinaq Wallet',
    locale: 'ru_RU',
    url: '/',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Jinaq Wallet — знай, сколько можно потратить сегодня' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jinaq Wallet — знай, сколько можно потратить сегодня',
    description: 'Учёт расходов за 2 касания, бюджеты, цели и долги. Бесплатно.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f8f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1512' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${manrope.variable} ${unbounded.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
