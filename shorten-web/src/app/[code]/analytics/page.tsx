import { Metadata } from 'next';
import Link from 'next/link';
import { getUrl, getClicksAnalytics, type ClicksAnalytics } from '@/lib/api';
import { AnalyticsClient } from './analytics-client';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;

  try {
    const url = await getUrl(code);
    return {
      title: `Analytics for ${url.shortCode} — ${url.clicks} clicks`,
      description: `Click analytics for ${url.shortCode}: ${url.clicks} total clicks, top countries, referrers, and IP breakdown.`,
    };
  } catch {
    return { title: 'Analytics Not Available' };
  }
}

export default async function AnalyticsPage({ params }: Props) {
  const { code } = await params;

  let analytics: ClicksAnalytics;
  try {
    analytics = await getClicksAnalytics(code);
  } catch {
    return (
      <div className="text-center space-y-4">
        <div className="text-6xl">❌</div>
        <h1 className="text-2xl font-bold text-white">
          Analytics Not Available
        </h1>
        <p className="text-gray-400">
          Couldn&apos;t load analytics for{' '}
          <code className="text-indigo-400">/{code}</code>.
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

  return (
    <div className="space-y-6">
      <Link href={`/${code}`} className="text-gray-400 hover:text-white text-sm">
        &larr; Back to URL
      </Link>

      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            Analytics for{' '}
            <span className="text-indigo-400">/{code}</span>
          </h1>
          <p className="text-gray-400">
            Total: <strong className="text-white">{analytics.totalClicks}</strong>{' '}
            clicks ·{' '}
            <strong className="text-white">{analytics.uniqueIps}</strong> unique
            IPs
          </p>
        </div>

        <AnalyticsClient code={code} initialData={analytics} />
      </div>
    </div>
  );
}
