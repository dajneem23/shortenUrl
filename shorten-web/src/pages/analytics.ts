import { Chart, registerables } from 'chart.js';
import { getClicksAnalytics, type ClicksAnalytics } from '../api';

Chart.register(...registerables);

export async function renderAnalytics(container: HTMLElement, code: string) {
  container.innerHTML = `
    <div class="space-y-6">
      <a href="/${code}" class="text-gray-400 hover:text-white text-sm">&larr; Back to URL</a>
      <div id="analytics-content" class="text-center text-gray-500">Loading analytics...</div>
    </div>
  `;

  const content = document.getElementById('analytics-content')!;

  try {
    const data: ClicksAnalytics = await getClicksAnalytics(code);

    content.innerHTML = `
      <div class="space-y-8">
        <!-- Header -->
        <div class="text-center">
          <h1 class="text-2xl font-bold text-white">Analytics for <span class="text-indigo-400">/${escapeHtml(code)}</span></h1>
          <p class="text-gray-400">Total: <strong class="text-white">${data.totalClicks}</strong> clicks</p>
          <div class="mt-3 flex justify-center gap-2">
            ${[1, 7, 30].map((d) => `
              <button data-days="${d}" class="days-btn rounded-lg px-3 py-1 text-xs font-medium border border-gray-700 text-gray-400 hover:bg-gray-800 ${d === 7 ? 'bg-gray-800 text-white' : ''}">${d}d</button>
            `).join('')}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Clicks over time chart -->
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 class="text-lg font-semibold text-white mb-4">📈 Clicks Over Time</h2>
            <div class="h-64"><canvas id="clicks-time-chart"></canvas></div>
          </div>

          <!-- Country breakdown chart -->
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 class="text-lg font-semibold text-white mb-4">🌍 By Country</h2>
            <div class="h-64"><canvas id="country-chart"></canvas></div>
          </div>

          <!-- Referrer breakdown chart -->
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 class="text-lg font-semibold text-white mb-4">🔗 By Referrer</h2>
            <div class="h-64"><canvas id="referrer-chart"></canvas></div>
          </div>

          <!-- IP breakdown chart -->
          <div class="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 class="text-lg font-semibold text-white mb-4">🖥️ By IP (anonymised /24)</h2>
            <div class="h-64"><canvas id="ip-chart"></canvas></div>
          </div>
        </div>
      </div>
    `;

    // Render charts
    renderTimeChart(data);
    renderCountryChart(data);
    renderReferrerChart(data);
    renderIpChart(data);

    // Day filter buttons
    content.querySelectorAll('.days-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const days = parseInt((btn as HTMLElement).dataset.days!, 10);
        // Update active state
        content.querySelectorAll('.days-btn').forEach((b) => {
          b.classList.remove('bg-gray-800', 'text-white');
        });
        btn.classList.add('bg-gray-800', 'text-white');
        // Reload with new range
        const newData = await getClicksAnalytics(code, days);
        renderTimeChart(newData);
      });
    });
  } catch {
    content.innerHTML = `
      <div class="text-center space-y-4">
        <div class="text-6xl">❌</div>
        <h1 class="text-2xl font-bold text-white">Analytics Not Available</h1>
        <p class="text-gray-400">Couldn't load analytics for <code class="text-indigo-400">/${escapeHtml(code)}</code>.</p>
        <a href="/" class="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Go Home</a>
      </div>
    `;
  }
}

// ── Chart helpers ──────────────────────────────────────────────────────

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6',
];

function chartDefaults(): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    color: '#9ca3af',
    plugins: { legend: { labels: { color: '#9ca3af' } } },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' }, beginAtZero: true },
    },
  };
}

function renderTimeChart(data: ClicksAnalytics) {
  const canvas = document.getElementById('clicks-time-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  // Destroy previous chart instance
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.timeSeries.map((p) => p.date),
      datasets: [{
        label: 'Clicks',
        data: data.timeSeries.map((p) => p.count),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: chartDefaults(),
  });
}

function renderCountryChart(data: ClicksAnalytics) {
  const canvas = document.getElementById('country-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.byCountry.map((c) => c.country || 'Unknown'),
      datasets: [{
        data: data.byCountry.map((c) => c.count),
        backgroundColor: CHART_COLORS,
      }],
    },
    options: {
      ...chartDefaults(),
      plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } },
    },
  });
}

function renderReferrerChart(data: ClicksAnalytics) {
  const canvas = document.getElementById('referrer-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.byReferrer.map((r) => r.referer ? new URL(r.referer).hostname : 'Direct'),
      datasets: [{
        label: 'Clicks',
        data: data.byReferrer.map((r) => r.count),
        backgroundColor: CHART_COLORS,
      }],
    },
    options: {
      ...chartDefaults(),
      indexAxis: 'y',
      plugins: { legend: { display: false } },
    },
  });
}

function renderIpChart(data: ClicksAnalytics) {
  const canvas = document.getElementById('ip-chart') as HTMLCanvasElement | null;
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.byIp.map((ip) => ip.ipPrefix),
      datasets: [{
        label: 'Clicks',
        data: data.byIp.map((ip) => ip.count),
        backgroundColor: CHART_COLORS,
      }],
    },
    options: {
      ...chartDefaults(),
      indexAxis: 'y',
      plugins: { legend: { display: false } },
    },
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
