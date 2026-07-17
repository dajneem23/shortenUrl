import { getUrl, type UrlDetail } from '../api';

export async function renderDetail(container: HTMLElement, code: string) {
  container.innerHTML = `
    <div class="space-y-6">
      <a href="/" class="text-gray-400 hover:text-white text-sm">&larr; Back</a>
      <div id="detail-content" class="text-center text-gray-500">Loading...</div>
    </div>
  `;

  const content = document.getElementById('detail-content')!;

  try {
    const url: UrlDetail = await getUrl(code);

    content.innerHTML = `
      <div class="space-y-8">
        <!-- URL Card -->
        <div class="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center space-y-4">
          <div class="text-6xl">🔗</div>
          <h1 class="text-2xl font-bold text-white break-all">${escapeHtml(url.shortUrl)}</h1>
          <p class="text-gray-400 break-all">${escapeHtml(url.originalUrl)}</p>
          <div class="flex items-center justify-center gap-4">
            <button id="copy-detail-btn" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Copy Link
            </button>
            <a href="/${url.shortCode}/analytics" class="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">
              View Analytics
            </a>
          </div>
          <div class="flex justify-center gap-8 text-sm text-gray-400">
            <span>🔢 <strong class="text-white">${url.clicks}</strong> clicks</span>
            <span>📅 ${new Date(url.createdAt).toLocaleDateString()}</span>
            ${url.expiresAt ? `<span>⏳ Expires: ${new Date(url.expiresAt).toLocaleDateString()}</span>` : ''}
          </div>
        </div>

        <!-- Top Countries -->
        ${url.topCountries?.length ? `
        <div class="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 class="text-lg font-semibold text-white mb-4">🌍 Top Countries</h2>
          <div class="space-y-2">
            ${url.topCountries.map((c) => `
              <div class="flex justify-between text-sm">
                <span class="text-gray-300">${flagEmoji(c.country)} ${c.country}</span>
                <span class="text-gray-400">${c.count} clicks</span>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

        <!-- Top Referrers -->
        ${url.topReferrers?.length ? `
        <div class="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 class="text-lg font-semibold text-white mb-4">🔗 Top Referrers</h2>
          <div class="space-y-2">
            ${url.topReferrers.map((r) => `
              <div class="flex justify-between text-sm">
                <span class="text-gray-300 truncate">${escapeHtml(r.referer || 'Direct')}</span>
                <span class="text-gray-400">${r.count} clicks</span>
              </div>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
    `;

    // Bind copy button
    document.getElementById('copy-detail-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(url.shortUrl);
      const btn = document.getElementById('copy-detail-btn')!;
      btn.textContent = 'Copied!';
      setTimeout(() => (btn.textContent = 'Copy Link'), 2000);
    });
  } catch {
    content.innerHTML = `
      <div class="text-center space-y-4">
        <div class="text-6xl">❌</div>
        <h1 class="text-2xl font-bold text-white">URL Not Found</h1>
        <p class="text-gray-400">The short link <code class="text-indigo-400">/${escapeHtml(code)}</code> doesn't exist.</p>
        <a href="/" class="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Go Home</a>
      </div>
    `;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((c) => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}
