'use client';

import { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { getClicksAnalytics, type ClicksAnalytics } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6',
];

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  color: '#9ca3af',
  plugins: { legend: { labels: { color: '#9ca3af' } } },
  scales: {
    x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
    y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' }, beginAtZero: true },
  },
};

export function AnalyticsClient({
  code,
  initialData,
}: {
  code: string;
  initialData: ClicksAnalytics;
}) {
  const [data, setData] = useState(initialData);
  const [days, setDays] = useState(7);

  async function changeDays(d: number) {
    setDays(d);
    try {
      const fresh = await getClicksAnalytics(code, d);
      setData(fresh);
    } catch {}
  }

  return (
    <>
      <div className="flex justify-center gap-2">
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            onClick={() => changeDays(d)}
            className={`rounded-lg px-3 py-1 text-xs font-medium border transition ${
              d === days
                ? 'bg-gray-800 text-white border-gray-700'
                : 'border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Clicks over time */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            📈 Clicks Over Time
          </h2>
          <div className="h-64">
            <Line
              data={{
                labels: data.timeSeries.map((p) => p.date),
                datasets: [
                  {
                    label: 'Clicks',
                    data: data.timeSeries.map((p) => p.count),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    fill: true,
                    tension: 0.3,
                  },
                ],
              }}
              options={chartDefaults as any}
            />
          </div>
        </div>

        {/* By Country */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            🌍 By Country
          </h2>
          <div className="h-64">
            {data.byCountry.length > 0 ? (
              <Doughnut
                data={{
                  labels: data.byCountry.map((c) => c.country || 'Unknown'),
                  datasets: [
                    {
                      data: data.byCountry.map((c) => c.count),
                      backgroundColor: CHART_COLORS,
                    },
                  ],
                }}
                options={{
                  ...chartDefaults,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#9ca3af', padding: 12 },
                    },
                  },
                } as any}
              />
            ) : (
              <p className="text-gray-500 text-center pt-20">No country data yet</p>
            )}
          </div>
        </div>

        {/* By Referrer */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            🔗 By Referrer
          </h2>
          <div className="h-64">
            {data.byReferrer.length > 0 ? (
              <Bar
                data={{
                  labels: data.byReferrer.map((r) =>
                    safeHostname(r.referer),
                  ),
                  datasets: [
                    {
                      label: 'Clicks',
                      data: data.byReferrer.map((r) => r.count),
                      backgroundColor: CHART_COLORS,
                    },
                  ],
                }}
                options={{
                  ...chartDefaults,
                  indexAxis: 'y',
                  plugins: { legend: { display: false } },
                } as any}
              />
            ) : (
              <p className="text-gray-500 text-center pt-20">No referrer data yet</p>
            )}
          </div>
        </div>

        {/* By IP */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            🖥️ By IP (anonymised /24)
          </h2>
          <div className="h-64">
            {data.byIp.length > 0 ? (
              <Bar
                data={{
                  labels: data.byIp.map((ip) => ip.ipPrefix),
                  datasets: [
                    {
                      label: 'Clicks',
                      data: data.byIp.map((ip) => ip.count),
                      backgroundColor: CHART_COLORS,
                    },
                  ],
                }}
                options={{
                  ...chartDefaults,
                  indexAxis: 'y',
                  plugins: { legend: { display: false } },
                } as any}
              />
            ) : (
              <p className="text-gray-500 text-center pt-20">No IP data yet</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.substring(0, 40);
  }
}
