// ──────────────────────────────────────────────────────────────────────────
// K6 Smoke Test — quick sanity check of all endpoints.
//
// Usage:
//   k6 run k6/smoke.js
// ──────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
let createdCodes = [];

export default function () {
  // 1. Create a URL
  const createRes = http.post(
    `${BASE_URL}/api/urls`,
    JSON.stringify({ original_url: 'https://example.com/test-' + Date.now() }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(createRes, {
    'POST /api/urls returns 200': (r) => r.status === 200 || r.status === 201,
  });

  if (createRes.status === 200 || createRes.status === 201) {
    const body = JSON.parse(createRes.body);
    const code = body.shortCode;

    // 2. Redirect
    const redirRes = http.get(`${BASE_URL}/${code}`, {
      headers: { 'X-Forwarded-For': '203.0.113.42' },
      redirects: 0,
    });
    check(redirRes, {
      'GET /:code returns 302': (r) => r.status === 302,
    });

    // 3. Get detail
    const detailRes = http.get(`${BASE_URL}/api/urls/${code}`);
    check(detailRes, {
      'GET /api/urls/:code returns 200': (r) => r.status === 200,
      'has clicks >= 0': (r) => JSON.parse(r.body).clicks >= 0,
    });

    // 4. Analytics
    const analyticsRes = http.get(`${BASE_URL}/api/urls/${code}/clicks`);
    check(analyticsRes, {
      'GET /api/urls/:code/clicks returns 200': (r) => r.status === 200,
      'has uniqueIps': (r) => typeof JSON.parse(r.body).uniqueIps === 'number',
    });

    // 5. Health
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'GET /health returns ok': (r) => r.status === 200 && JSON.parse(r.body).status === 'ok',
    });

    // 6. Metrics
    const metricsRes = http.get(`${BASE_URL}/metrics`);
    check(metricsRes, {
      'GET /metrics returns text': (r) => r.headers['Content-Type'].includes('text/plain'),
    });

    // 7. Trending
    const trendingRes = http.get(`${BASE_URL}/api/urls/trending?window=1h`);
    check(trendingRes, {
      'GET /api/urls/trending returns 200': (r) => r.status === 200,
    });
  }

  sleep(0.5);
}
