import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/$'],
        disallow: ['/go/', '/api/', '/dashboard/', '/metrics', '/health'],
      },
    ],
    sitemap: 'https://short.sugoiweb3.uk/sitemap.xml',
  };
}
