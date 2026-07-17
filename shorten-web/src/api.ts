const BASE = ''; // relative URLs — Traefik routes /api to shorten-api

export interface UrlItem {
  id: number;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface UrlDetail extends UrlItem {
  topCountries: { country: string; count: number }[];
  topReferrers: { referer: string; count: number }[];
}

export interface ClicksAnalytics {
  shortCode: string;
  totalClicks: number;
  timeSeries: { date: string; count: number }[];
  byCountry: { country: string; count: number }[];
  byReferrer: { referer: string; count: number }[];
  byIp: { ipPrefix: string; count: number }[];
}

export async function createUrl(originalUrl: string): Promise<UrlItem> {
  const res = await fetch('/api/urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original_url: originalUrl }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create URL');
  }
  return res.json();
}

export async function listUrls(page = 1): Promise<{ items: UrlItem[]; total: number }> {
  const res = await fetch(`/api/urls?page=${page}&limit=20`);
  return res.json();
}

export async function getUrl(code: string): Promise<UrlDetail> {
  const res = await fetch(`/api/urls/${code}`);
  if (!res.ok) throw new Error('URL not found');
  return res.json();
}

export async function deleteUrl(code: string): Promise<void> {
  await fetch(`/api/urls/${code}`, { method: 'DELETE' });
}

export async function getClicksAnalytics(code: string, days = 7): Promise<ClicksAnalytics> {
  const res = await fetch(`/api/urls/${code}/clicks?days=${days}`);
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}
