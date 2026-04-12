import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import localFont from "next/font/local";
import '@mantine/core/styles.css';
import "react-jewish-datepicker/dist/index.css";
import "../globals.scss";
import { Providers } from "../providers";
import {routing} from '@/i18n/routing';
import AccessibilityWidget from '../components/AccessibilityWidget';

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const pingFont = localFont({
  src: [
    {
      path: "../fonts/PingHL-Heavy.woff2",
      weight: '800',
      style: 'normal',
    },
    {
      path: "../fonts/PingHL-Bold.woff2",
      weight: '700',
      style: 'normal',
    },
    {
      path: "../fonts/PingHL-Medium.woff2",
      weight: '500',
      style: 'normal',
    },
    {
      path: "../fonts/PingHL-Regular.woff2",
      weight: '400',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-ping'
});

const locales = routing.locales;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  // Ensure locale is supported
  if (!locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();
  const direction = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          ${pingFont.variable}
          antialiased
        `}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <MantineProvider withGlobalStyles withNormalizeCSS>
              {children}
              <AccessibilityWidget />
            </MantineProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
