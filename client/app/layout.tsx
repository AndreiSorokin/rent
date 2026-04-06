import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";
import { DialogProvider } from "@/components/dialog/DialogProvider";
import { ToastProvider } from "@/components/toast/ToastProvider";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://palaci.ru'),
  title: "Palaci",
  description: "Store and pavilion management",
  verification: {
    yandex: 'b21ff933b81d7751',
  },
  icons: {
    icon: '/logo1.png',
    shortcut: '/logo1.png',
    apple: '/logo1.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
