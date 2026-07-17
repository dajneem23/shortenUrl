// ──────────────────────────────────────────────────────────────────────────
// K6 Load Test — shortenUrl Traffic Simulation
//
// Simulates realistic URL shortener traffic:
//   1. Create short URLs (ramp-up phase)
//   2. Redirect clicks from many IPs (sustained load)
//   3. Analytics queries (periodic, lighter weight)
//   4. Trending endpoint checks
//
// Usage:
//   # Smoke test (5 VUs, 30s)
//   k6 run --vus 5 --duration 30s k6/smoke.js
//
//   # Load test (50 VUs, 5min)
//   k6 run --vus 50 --duration 5m k6/load.js
//
//   # Stress test (200 VUs, 10min, ramp)
//   k6 run k6/stress.js
// ──────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep, group, trend } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────

const urlsCreated = new Counter('urls_created');
const redirectsTotal = new Counter('redirects_total');
const redirectsFailed = new Counter('redirects_failed');
const analyticsCalls = new Counter('analytics_calls');
const trendingCalls = new Counter('trending_calls');
const redirectLatency = new Trend('redirect_latency_ms');
const createLatency = new Trend('create_latency_ms');

// ── Config ────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const TARGET_URLS = [
  'https://www.example.com/very/long/path/to/some/page?id=12345',
  'https://news.ycombinator.com/item?id=42424242',
  'https://github.com/nestjs/nest/blob/master/packages/core/README.md',
  'https://www.npmjs.com/package/prom-client',
  'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
  'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch',
  'https://redis.io/docs/latest/develop/data-types/probabilistic/',
  'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/',
];

// Store created short codes for redirect simulation.
const shortCodes = [];
const MAX_STORED_CODES = 200;

// Pool of fake IPs for simulating diverse visitors.
const FAKE_IPS = Array.from({ length: 100 }, (_, i) => {
  const a = Math.floor(Math.random() * 223) + 1; // 1–223
  const b = Math.floor(Math.random() * 256);
  const c = Math.floor(Math.random() * 256);
  const d = Math.floor(Math.random() * 254) + 1;
  return `${a}.${b}.${c}.${d}`;
});

// ── Setup — pre-create a batch of URLs ─────────────────────────────────

export function setup() {
  console.log(`[setup] Creating seed URLs against ${BASE_URL}...`);

  const created = [];
  for (const targetUrl of TARGET_URLS) {
    const res = http.post(
      `${BASE_URL}/api/urls`,
      JSON.stringify({ original_url: targetUrl }),
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (res.status === 201 || res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        created.push(body.shortCode);
        console.log(`  ✓ Created /${body.shortCode} → ${targetUrl.substring(0, 50)}...`);
      } catch {
        console.log(`  ✗ Parse error: ${res.body.substring(0, 80)}`);
      }
    } else {
      console.log(`  ✗ ${res.status}: ${res.body.substring(0, 80)}`);
    }
  }

  console.log(`[setup] ${created.length}/${TARGET_URLS.length} seed URLs created.\n`);
  return { seedCodes: created };
}

// ── Default export — VU loop ──────────────────────────────────────────

export default function (data) {
  // Seed the local short codes store from setup phase.
  if (shortCodes.length === 0 && data.seedCodes) {
    shortCodes.push(...data.seedCodes);
  }

  // Decide what this iteration does: 70 % redirect, 20 % create, 5 % analytics, 5 % trending.
  const roll = Math.random();

  if (roll < 0.70) {
    performRedirect();
  } else if (roll < 0.90) {
    performCreate();
  } else if (roll < 0.95) {
    performAnalytics();
  } else {
    performTrending();
  }

  sleep(0.1 + Math.random() * 0.5);
}

// ── Actions ─────────────────────────────────────────────────────────────

function performRedirect() {
  if (shortCodes.length === 0) return;

  const code = shortCodes[Math.floor(Math.random() * shortCodes.length)];
  const ip = FAKE_IPS[Math.floor(Math.random() * FAKE_IPS.length)];

  const start = Date.now();
  const res = http.get(`${BASE_URL}/${code}`, {
    headers: {
      'X-Forwarded-For': ip,
      'User-Agent': randomUserAgent(),
      'Referer': randomReferer(),
    },
    redirects: 0, // Don't follow redirect — we want the 302.
  });
  redirectLatency.add(Date.now() - start);

  const ok = check(res, {
    'redirect status 302': (r) => r.status === 302,
    'has Location header': (r) => r.headers['Location'] !== undefined,
  });

  if (ok) {
    redirectsTotal.add(1);
  } else {
    redirectsFailed.add(1);
  }
}

function performCreate() {
  const targetUrl = TARGET_URLS[Math.floor(Math.random() * TARGET_URLS.length)];
  const variant = Math.random().toString(36).substring(7);
  const url = `${targetUrl}?v=${variant}`;

  const start = Date.now();
  const res = http.post(
    `${BASE_URL}/api/urls`,
    JSON.stringify({ original_url: url }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  createLatency.add(Date.now() - start);

  const ok = check(res, {
    'create status 201 or 200': (r) => r.status === 201 || r.status === 200,
    'has shortCode': (r) => {
      try { return !!JSON.parse(r.body).shortCode; } catch { return false; }
    },
  });

  if (ok) {
    urlsCreated.add(1);
    const body = JSON.parse(res.body);
    shortCodes.push(body.shortCode);
    // Cap the local store.
    if (shortCodes.length > MAX_STORED_CODES) {
      shortCodes.splice(0, shortCodes.length - MAX_STORED_CODES);
    }
  }
}

function performAnalytics() {
  if (shortCodes.length === 0) return;

  const code = shortCodes[Math.floor(Math.random() * shortCodes.length)];
  const res = http.get(`${BASE_URL}/api/urls/${code}/clicks?days=1`);
  analyticsCalls.add(1);

  check(res, {
    'analytics status 200': (r) => r.status === 200,
    'has totalClicks': (r) => {
      try { return typeof JSON.parse(r.body).totalClicks === 'number'; } catch { return false; }
    },
    'has uniqueIps': (r) => {
      try { return typeof JSON.parse(r.body).uniqueIps === 'number'; } catch { return false; }
    },
    'has byCountry': (r) => {
      try { return Array.isArray(JSON.parse(r.body).byCountry); } catch { return false; }
    },
    'has byIp': (r) => {
      try { return Array.isArray(JSON.parse(r.body).byIp); } catch { return false; }
    },
  });
}

function performTrending() {
  const windows = ['1h', '24h', '7d'];
  const w = windows[Math.floor(Math.random() * windows.length)];
  const res = http.get(`${BASE_URL}/api/urls/trending?window=${w}`);
  trendingCalls.add(1);

  check(res, {
    'trending status 200': (r) => r.status === 200,
    'has window': (r) => {
      try { return JSON.parse(r.body).window === w; } catch { return false; }
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

function randomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
    'curl/8.4.0',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function randomReferer(): string {
  const referers = [
    'https://www.google.com/search?q=url+shortener',
    'https://twitter.com/',
    'https://www.reddit.com/',
    'https://t.co/',
    'https://news.ycombinator.com/',
    '',
    '',
    '', // empty = direct traffic (weighted)
  ];
  return referers[Math.floor(Math.random() * referers.length)];
}

// ── Teardown ────────────────────────────────────────────────────────────

export function teardown(data) {
  console.log('\n[teardown] Load test complete.');
}
