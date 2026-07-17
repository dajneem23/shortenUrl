import { createUrl, listUrls, deleteUrl, type UrlItem } from '../api';

export async function renderHome(container: HTMLElement) {
  container.innerHTML = `
    <div class="space-y-10">
      <!-- Hero -->
      <div class="text-center space-y-4">
        <h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Shorten your <span class="text-indigo-400">URLs</span>
        </h1>
        <p class="text-lg text-gray-400 max-w-xl mx-auto">
          Paste a long URL, get a short link. Track clicks, countries, and referrers with built-in analytics.
        </p>
      </div>

      <!-- Form -->
      <div class="max-w-xl mx-auto">
        <form id="url-form" class="flex gap-3">
          <input
            id="url-input"
            type="url"
            placeholder="https://example.com/very/long/url"
            required
            class="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 whitespace-nowrap"
          >
            Shorten
          </button>
        </form>
        <p id="form-error" class="mt-2 text-sm text-red-400 hidden"></p>
        <p id="form-success" class="mt-2 text-sm text-emerald-400 hidden">
          Short URL created! <span id="form-result" class="font-mono"></span>
          <button id="copy-btn" class="ml-2 text-indigo-400 hover:underline">Copy</button>
        </p>
      </div>

      <!-- Recent URLs -->
      <div>
        <h2 class="text-xl font-semibold text-white mb-4">Recent URLs</h2>
        <div id="url-list" class="space-y-2">
          <p class="text-gray-500">Loading...</p>
        </div>
      </div>
    </div>
  `;

  // Bind form
  const form = document.getElementById('url-form') as HTMLFormElement;
  const input = document.getElementById('url-input') as HTMLInputElement;
  const errorEl = document.getElementById('form-error')!;
  const successEl = document.getElementById('form-success')!;
  const resultEl = document.getElementById('form-result')!;
  const copyBtn = document.getElementById('copy-btn')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    try {
      const item = await createUrl(input.value);
      input.value = '';
      resultEl.textContent = item.shortUrl;
      successEl.classList.remove('hidden');
      loadUrlList(); // refresh list
    } catch (err: any) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(resultEl.textContent || '');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
  });

  // Load URL list
  async function loadUrlList() {
    const list = document.getElementById('url-list')!;
    try {
      const { items } = await listUrls(1);
      if (items.length === 0) {
        list.innerHTML = '<p class="text-gray-500">No URLs yet — create one above!</p>';
        return;
      }
      list.innerHTML = items
        .map(
          (u: UrlItem) => `
          <div class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 transition">
            <div class="min-w-0 flex-1">
              <a href="/${u.shortCode}" class="text-indigo-400 font-mono text-sm hover:underline">${u.shortUrl}</a>
              <p class="text-gray-500 text-sm truncate">${escapeHtml(u.originalUrl)}</p>
            </div>
            <div class="flex items-center gap-4 ml-4">
              <span class="text-gray-500 text-xs">${u.clicks} clicks</span>
              <a href="/${u.shortCode}/analytics" class="text-gray-400 hover:text-white text-xs">Analytics</a>
              <button data-delete="${u.shortCode}" class="text-red-400 hover:text-red-300 text-xs">Delete</button>
            </div>
          </div>
        `,
        )
        .join('');

      // Bind delete buttons
      list.querySelectorAll('[data-delete]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const code = (btn as HTMLElement).dataset.delete!;
          await deleteUrl(code);
          loadUrlList();
        });
      });
    } catch {
      list.innerHTML = '<p class="text-red-400">Failed to load URLs</p>';
    }
  }

  loadUrlList();
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
