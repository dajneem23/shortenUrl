import client from 'prom-client';

// ── Registry ─────────────────────────────────────────────────────────────
const register = new client.Registry();
register.setDefaultLabels({
  app: process.env.OTEL_SERVICE_NAME || 'shorten-api',
});

// ── Default metrics — CPU, memory, event loop, GC, etc. ──────────────────
client.collectDefaultMetrics({ register });

// ── HTTP metrics ─────────────────────────────────────────────────────────
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
register.registerMetric(httpRequestDuration);

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestTotal);

// ── URL shortener metrics ────────────────────────────────────────────────
const urlRedirectsTotal = new client.Counter({
  name: 'url_redirects_total',
  help: 'Total number of URL redirects (clicks)',
  labelNames: ['short_code'],
});
register.registerMetric(urlRedirectsTotal);

const urlCreatedTotal = new client.Counter({
  name: 'url_created_total',
  help: 'Total number of short URLs created',
});
register.registerMetric(urlCreatedTotal);

// ── IP analytics metrics ─────────────────────────────────────────────────
// Per-country redirect count for geo-distribution dashboards.
const urlRedirectsByCountry = new client.Counter({
  name: 'url_redirects_by_country_total',
  help: 'Total redirects grouped by country (GeoIP)',
  labelNames: ['country', 'short_code'],
});
register.registerMetric(urlRedirectsByCountry);

// Unique IPs redirected (approximate via counter cardinality).
const urlRedirectsByIp = new client.Counter({
  name: 'url_redirects_by_ip_total',
  help: 'Redirects keyed by anonymised IP prefix (/24)',
  labelNames: ['ip_prefix'],
});
register.registerMetric(urlRedirectsByIp);

// Unique visitors — incremented only when Bloom filter says IP is new.
const uniqueVisitorsTotal = new client.Counter({
  name: 'unique_visitors_total',
  help: 'Total unique IP visitors (deduped by Bloom filter)',
  labelNames: ['short_code'],
});
register.registerMetric(uniqueVisitorsTotal);

// Count-Min Sketch estimation error (track over-estimation ratio).
const cmsEstimatesTotal = new client.Counter({
  name: 'cms_estimates_total',
  help: 'Total Count-Min Sketch estimation requests',
  labelNames: ['sketch'],
});
register.registerMetric(cmsEstimatesTotal);

// ── Metric helpers ───────────────────────────────────────────────────────

export function observeHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSec: number,
) {
  const labels = { method, route, status_code: String(statusCode) };
  httpRequestDuration.observe(labels, durationSec);
  httpRequestTotal.inc(labels);
}

export function trackRedirect(shortCode: string) {
  urlRedirectsTotal.inc({ short_code: shortCode });
}

export function trackUrlCreated() {
  urlCreatedTotal.inc();
}

export function trackRedirectByCountry(shortCode: string, country: string) {
  if (country) {
    urlRedirectsByCountry.inc({ country, short_code: shortCode });
  }
}

export function trackUniqueVisitor(shortCode: string) {
  uniqueVisitorsTotal.inc({ short_code: shortCode });
}

export function trackCmsEstimate(sketch: string) {
  cmsEstimatesTotal.inc({ sketch });
}

export function trackRedirectByIp(ipAddress: string) {
  // Anonymise to /24 prefix to avoid storing full IPs in metric labels.
  const prefix = ipToPrefix24(ipAddress);
  urlRedirectsByIp.inc({ ip_prefix: prefix });
}

function ipToPrefix24(ip: string): string {
  if (ip === 'unknown') return 'unknown';
  // IPv4: keep first 3 octets. IPv6: keep first 4 groups.
  const parts = ip.includes('.') ? ip.split('.') : ip.split(':');
  return parts.slice(0, ip.includes('.') ? 3 : 4).join(ip.includes('.') ? '.' : ':');
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export { register };
