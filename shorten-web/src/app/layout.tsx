import type { Metadata } from 'next';
import './globals.css';
import { WebSiteSchema } from '@/components/JsonLd';

const SITE_URL = 'https://short.sugoiweb3.uk';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ShortenUrl — Free URL Shortener with Analytics',
    template: '%s | ShortenUrl',
  },
  description:
    'Shorten long URLs, track clicks, see country & referrer analytics. Built with Nest.js, Redis, Grafana, and Next.js.',
  keywords: [
    // Core dev intent
    'url shortener', 'url shortener api', 'shorten url api', 'link shortener api', 'short link', 'link shortener',
    // Self-hosted wedge
    'self-hosted url shortener', 'open source url shortener', 'url shortener docker', 'self hosted link shortener',
    // Alternative / comparison
    'bitly alternative', 'bitly alternative api', 'yourls alternative', 'free url shortener',
    // Long-tail technical
    'url shortener system design', 'url shortener database schema', 'click tracking', 'url analytics',
    // Bulk / ops
    'bulk url shortener api', 'custom domain url shortener', 'url shortener with analytics', 'link management',
  ],
  authors: [{ name: 'ShortenUrl' }],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'ShortenUrl — Free URL Shortener with Analytics',
    description: 'Shorten long URLs, track clicks, and see detailed analytics.',
    url: SITE_URL,
    siteName: 'ShortenUrl',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShortenUrl — Free URL Shortener with Analytics',
    description: 'Shorten long URLs, track clicks, and see detailed analytics.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-gray-950">
      <head>
        <WebSiteSchema url={SITE_URL} />
        <link rel="canonical" href={SITE_URL} />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔗</text></svg>" />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-4">
            <a href="/" className="text-xl font-bold tracking-tight text-indigo-400">
              ShortenUrl
            </a>
            <nav className="space-x-4 text-sm">
              <a href="/" className="text-gray-400 hover:text-white transition">
                Home
              </a>
              <a href="/dashboard" className="text-gray-400 hover:text-white transition">
                Dashboard
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>

        <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-600">
          ShortenUrl &mdash; Nest.js + Next.js + Traefik + Tailwind CSS
        </footer>
      </body>
    </html>
  );
}
