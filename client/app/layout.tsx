import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import './globals.css';
import { AuthGuard } from '@/components/AuthGuard';
import { DialogProvider } from '@/components/dialog/DialogProvider';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('RootLayout');
  const locale = await getLocale();

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://rendlify.com'),
    title: {
      default: t('title'),
      template: t('titleTemplate'),
    },
    description: t('description'),
    keywords: t.raw('keywords'),
    verification: {
      yandex: 'b21ff933b81d7751',
    },
    icons: {
      icon: '/logo1.png',
      shortcut: '/logo1.png',
      apple: '/logo1.png',
    },
    openGraph: {
      siteName: 'Rendlify',
      locale: locale === 'en' ? 'en_US' : 'ru_RU',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#f6f1eb] text-[#111111] antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <DialogProvider>
            <ToastProvider>
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">
                  <AuthGuard>{children}</AuthGuard>
                </div>
                <SiteFooter />
                <CookieConsentBanner />
                <LanguageSwitcher />
              </div>
            </ToastProvider>
          </DialogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
