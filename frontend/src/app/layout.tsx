import type { Metadata, Viewport } from 'next';
import { Inter, Merriweather } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { config } from '@/lib/config';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: config.appName,
    template: `%s · ${config.appShortName}`,
  },
  description:
    'Enterprise-grade Academy Management System for Silambam, Karate, Martial Arts and Multi-Sport academies.',
  applicationName: config.appShortName,
  authors: [{ name: 'TSKK Academy Platform' }],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#B91C1C' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${merriweather.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
