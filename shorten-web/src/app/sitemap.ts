import type { MetadataRoute } from 'next';

async function fetchAllUrls(): Promise<
  { shortCode: string; createdAt: string }[]
> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(`${API_BASE}/api/urls?page=1&limit=100`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://short.sugoiweb3.uk';
  const urls = await fetchAllUrls();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.5,
    },
  ];

  const dynamicPages: MetadataRoute.Sitemap = urls.map((u) => ({
    url: `${baseUrl}/${u.shortCode}`,
    lastModified: new Date(u.createdAt),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...dynamicPages];
}
