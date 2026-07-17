'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listUrls, getTrending, type UrlItem } from '@/lib/api';

interface TrendingItem {
  shortCode: string;
  clicks: number;
}

export default function DashboardPage() {
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [{ items }, t] = await Promise.all([
          listUrls(1),
          getTrending('24h'),
        ]);
        setUrls(items);
        setTrending(t.top || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalClicks = urls.reduce((sum, u) => sum + u.clicks, 0);

  const statCards = [
    { label: 'Total URLs', value: urls.length, icon: '🔗', color: 'text-indigo-400' },
    { label: 'Total Clicks', value: totalClicks, icon: '👆', color: 'text-emerald-400' },
    {
      label: 'Avg Clicks/URL',
      value: urls.length > 0 ? Math.round(totalClicks / urls.length) : 0,
      icon: '📊',
      color: 'text-amber-400',
    },
    { label: 'Trending (24h)', value: trending.length, icon: '🔥', color: 'text-rose-400' },
  ];

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-2xl font-bold text-white">Dashboard Unavailable</h1>
        <p className="text-gray-400">{error}</p>
        <Link href="/" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Overview of your shortened URLs and analytics.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          + New URL
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-800 bg-gray-900 p-5"
          >
            <p className="text-gray-500 text-xs uppercase tracking-wider">
              {stat.label}
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`text-2xl font-bold ${stat.color}`}>
                {stat.value.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4">
            🔥 Trending (24h)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Short Code</th>
                  <th className="px-4 py-3 font-medium text-right">Est. Clicks</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {trending.map((t, i) => (
                  <tr key={t.shortCode} className="hover:bg-gray-900/50 transition">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${t.shortCode}`}
                        className="text-indigo-400 font-mono hover:underline"
                      >
                        /{t.shortCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{t.clicks}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${t.shortCode}/analytics`}
                        className="text-gray-500 hover:text-white text-xs"
                      >
                        Analytics →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* All URLs */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">All URLs</h2>
        {urls.length === 0 ? (
          <p className="text-gray-500">No URLs yet.</p>
        ) : (
          <div className="space-y-2">
            {urls.map((url) => (
              <div
                key={url.shortCode}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/${url.shortCode}`}
                      className="text-indigo-400 font-mono text-sm hover:underline"
                    >
                      /{url.shortCode}
                    </Link>
                    <span className="text-gray-600 text-xs">
                      {new Date(url.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm truncate mt-0.5">
                    {url.originalUrl}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <span className="text-gray-500 text-xs">{url.clicks} clicks</span>
                  <Link
                    href={`/${url.shortCode}/analytics`}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    Analytics
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
