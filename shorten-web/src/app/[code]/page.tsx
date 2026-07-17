import { Metadata } from 'next';
import Link from 'next/link';
import { getUrl, type UrlItem } from '@/lib/api';
import { DetailClient } from './detail-client';
import { DetailPageSchema } from '@/components/JsonLd';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://short.sugoiweb3.uk';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;

  try {
    const url = await getUrl(code);
    const pageUrl = `${SITE_URL}/${code}`;
    const title = `${url.shortCode} — Short Link Preview`;
    const description = `Short link /${url.shortCode} redirects to ${url.originalUrl.substring(0, 100)}. ${url.clicks} clicks tracked.`;

    return {
      title,
      description,
      alternates: { canonical: pageUrl },
      openGraph: {
        title,
        description,
        type: 'article',
        url: pageUrl,
        siteName: 'ShortenUrl',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return {
      title: 'URL Not Found',
      description: 'This short link does not exist.',
    };
  }
}

export default async function DetailPage({ params }: Props) {
  const { code } = await params;

  let url: UrlItem;
  try {
    url = await getUrl(code);
  } catch {
    return <NotFound code={code} />;
  }

  const pageUrl = `${SITE_URL}/${code}`;

  return (
    <>
      <DetailPageSchema
        pageUrl={pageUrl}
        originalUrl={url.originalUrl}
        shortCode={url.shortCode}
        title={`${url.shortCode} — Short Link Preview`}
        description={`Short link /${url.shortCode} redirects to ${url.originalUrl.substring(0, 100)}. ${url.clicks} clicks tracked.`}
        datePublished={url.createdAt}
      />
      <div className="space-y-6">
        <Link href="/" className="text-gray-400 hover:text-white text-sm">
          &larr; Back
        </Link>

      <div className="space-y-8">
        {/* URL Card */}
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center space-y-4">
          <div className="text-6xl">🔗</div>
          <h1 className="text-2xl font-bold text-white break-all">
            {url.shortUrl}
          </h1>
          <p className="text-gray-400 break-all text-sm bg-gray-800 rounded-lg px-4 py-2 inline-block max-w-full">
            &rarr; {url.originalUrl}
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href={`/go/${url.shortCode}`}
              className="rounded-lg bg-emerald-600 px-8 py-3 text-base font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/30"
            >
              🚀 Visit Link
            </a>
            <DetailClient shortUrl={url.shortUrl} />
            <Link
              href={`/${url.shortCode}/analytics`}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              View Analytics
            </Link>
          </div>

          <div className="flex justify-center gap-8 text-sm text-gray-400">
            <span>
              🔢 <strong className="text-white">{url.clicks}</strong> clicks
            </span>
            <span>
              📅 {new Date(url.createdAt).toLocaleDateString()}
            </span>
            {url.expiresAt && (
              <span>
                ⏳ Expires: {new Date(url.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </section>

        {/* Top Countries */}
        {url.topCountries && url.topCountries.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              🌍 Top Countries
            </h2>
            <div className="space-y-2">
              {url.topCountries.map((c) => (
                <div key={c.country} className="flex justify-between text-sm">
                  <span className="text-gray-300">
                    {flagEmoji(c.country)} {c.country}
                  </span>
                  <span className="text-gray-400">{c.count} clicks</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Referrers */}
        {url.topReferrers && url.topReferrers.length > 0 && (
          <section className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              🔗 Top Referrers
            </h2>
            <div className="space-y-2">
              {url.topReferrers.map((r) => (
                <div key={r.referer} className="flex justify-between text-sm">
                  <span className="text-gray-300 truncate">
                    {r.referer ? safeHostname(r.referer) : 'Direct'}
                  </span>
                  <span className="text-gray-400">{r.count} clicks</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
    </>
  );
}

function NotFound({ code }: { code: string }) {
  return (
    <div className="text-center space-y-4">
      <div className="text-6xl">❌</div>
      <h1 className="text-2xl font-bold text-white">URL Not Found</h1>
      <p className="text-gray-400">
        The short link{' '}
        <code className="text-indigo-400">/{code}</code> doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        Go Home
      </Link>
    </div>
  );
}

function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.substring(0, 40);
  }
}
