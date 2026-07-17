// Server-side: use internal Docker hostname to reach the API.
// Client-side: use relative URLs (Traefik routes /api/* to the API).
const isServer = typeof window === 'undefined';
const API_BASE = isServer
  ? (process.env.API_URL || 'http://shorten-api:3000')
  : '';

const log = (msg: string, data?: Record<string, unknown>) => {
  if (isServer) {
    console.log(`[api:server] ${msg}`, data ? JSON.stringify(data) : '');
  } else {
    console.debug(`[api:client] ${msg}`, data || '');
  }
};

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}/api${path}`;
  const method = options?.method || 'GET';

  log(`${method} ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: controller.signal,
    });

    const ms = Date.now() - start;
    log(`${method} ${url} → ${res.status} (${ms}ms)`);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log(`ERROR ${method} ${url} → ${res.status}`, { body: body.substring(0, 200) });
      throw new Error(`API error: ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    const ms = Date.now() - start;
    log(`FAIL ${method} ${url} (${ms}ms)`, { error: err.message });
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export interface UrlItem {
  id: number;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
  topCountries?: { country: string; count: number }[];
  topReferrers?: { referer: string; count: number }[];
}

export interface ClicksAnalytics {
  shortCode: string;
  totalClicks: number;
  uniqueIps: number;
  timeSeries: { date: string; count: number }[];
  byCountry: { country: string; count: number }[];
  byReferrer: { referer: string; count: number }[];
  byIp: { ipPrefix: string; count: number }[];
}

export async function createUrl(originalUrl: string): Promise<UrlItem> {
  return fetchApi<UrlItem>('/urls', {
    method: 'POST',
    body: JSON.stringify({ original_url: originalUrl }),
  });
}

export async function listUrls(page = 1): Promise<{ items: UrlItem[]; total: number }> {
  return fetchApi(`/urls?page=${page}&limit=20`);
}

export async function getUrl(code: string): Promise<UrlItem> {
  return fetchApi<UrlItem>(`/urls/${code}`);
}

export async function getClicksAnalytics(code: string, days = 7): Promise<ClicksAnalytics> {
  return fetchApi<ClicksAnalytics>(`/urls/${code}/clicks?days=${days}`);
}

export async function getTrending(window = '1h'): Promise<{ window: string; top: { shortCode: string; clicks: number }[] }> {
  return fetchApi(`/urls/trending?window=${window}`);
}
