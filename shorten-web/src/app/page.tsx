'use client';

import { useState, useEffect } from 'react';
import { createUrl, listUrls, type UrlItem } from '@/lib/api';

export default function HomePage() {
  const [urls, setUrls] = useState<UrlItem[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<UrlItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUrls(1)
      .then(({ items }) => setUrls(items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);

    try {
      const item = await createUrl(input);
      setInput('');
      setResult(item);
      setUrls((prev) => [item, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Failed to create URL');
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Shorten your <span className="text-indigo-400">URLs</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl mx-auto">
          Paste a long URL, get a short link. Track clicks, countries, and
          referrers with built-in analytics.
        </p>
      </section>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-xl mx-auto flex gap-3">
        <input
          type="url"
          placeholder="https://example.com/very/long/url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          required
          className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 whitespace-nowrap"
        >
          Shorten
        </button>
      </form>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {result && (
        <div className="max-w-xl mx-auto rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-center space-y-2">
          <p className="text-emerald-400 text-sm font-medium">Created!</p>
          <code className="text-lg text-white font-mono">{result.shortUrl}</code>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleCopy}
              className="text-sm text-indigo-400 hover:underline"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={`/${result.shortCode}`}
              className="text-sm text-gray-400 hover:underline"
            >
              Preview
            </a>
          </div>
        </div>
      )}

      {/* Recent URLs */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Recent URLs</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : urls.length === 0 ? (
          <p className="text-gray-500">No URLs yet — create one above!</p>
        ) : (
          <div className="space-y-2">
            {urls.map((url) => (
              <div
                key={url.shortCode}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 transition"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={`/${url.shortCode}`}
                    className="text-indigo-400 font-mono text-sm hover:underline"
                  >
                    {url.shortUrl}
                  </a>
                  <p className="text-gray-500 text-sm truncate">
                    {url.originalUrl}
                  </p>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <span className="text-gray-500 text-xs">{url.clicks} clicks</span>
                  <a
                    href={`/${url.shortCode}/analytics`}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    Analytics
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
