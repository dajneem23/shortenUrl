export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** WebSite schema for the layout. */
export function WebSiteSchema({ url }: { url: string }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'ShortenUrl',
        url,
        description: 'Shorten long URLs, track clicks, see country & referrer analytics.',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${url}/{short_code}`,
          },
          'query-input': 'required name=short_code',
        },
      }}
    />
  );
}

/** BreadcrumbList + WebPage schema for detail pages. */
export function DetailPageSchema({
  pageUrl,
  originalUrl,
  shortCode,
  title,
  description,
  datePublished,
}: {
  pageUrl: string;
  originalUrl: string;
  shortCode: string;
  title: string;
  description: string;
  datePublished: string;
}) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: new URL('/', pageUrl).origin,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: `${shortCode} — Short Link Preview`,
                item: pageUrl,
              },
            ],
          },
          {
            '@type': 'WebPage',
            url: pageUrl,
            name: title,
            description,
            about: { '@type': 'WebPage', url: originalUrl },
            datePublished,
          },
        ],
      }}
    />
  );
}
