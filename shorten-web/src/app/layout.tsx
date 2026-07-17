import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ShortenUrl — Free URL Shortener with Analytics',
    template: '%s | ShortenUrl',
  },
  description:
    'Shorten long URLs, track clicks, see country & referrer analytics. Built with Nest.js, Redis, Grafana, and Next.js.',
  keywords: ['url shortener', 'link shortener', 'short link', 'click tracking', 'analytics'],
  openGraph: {
    title: 'ShortenUrl — Free URL Shortener with Analytics',
    description: 'Shorten long URLs, track clicks, and see detailed analytics.',
    type: 'website',
    siteName: 'ShortenUrl',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-gray-950">
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
