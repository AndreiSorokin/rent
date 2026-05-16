import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthGuard } from '@/components/AuthGuard';
import { DialogProvider } from '@/components/dialog/DialogProvider';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { SiteFooter } from '@/components/SiteFooter';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://rendlify.com'),
  title: {
    default: 'Rendlify — контроль торгового объекта в реальном времени',
    template: '%s | Rendlify',
  },
  description:
    'Rendlify помогает собственнику и управляющему контролировать павильоны, арендаторов, платежи, доходы, расходы и состояние торгового объекта в одном интерфейсе.',
  keywords: [
    'контроль торгового объекта',
    'программа для торгового дома',
    'управление павильонами',
    'контроль арендаторов и платежей',
    'учет доходов и расходов объекта',
  ],
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
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#f6f1eb] text-[#111111] antialiased`}
      >
        <DialogProvider>
          <ToastProvider>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">
                <AuthGuard>{children}</AuthGuard>
              </div>
              <SiteFooter />
              <CookieConsentBanner />
            </div>
          </ToastProvider>
        </DialogProvider>
      </body>
    </html>
  );
}
