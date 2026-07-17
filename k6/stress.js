// ──────────────────────────────────────────────────────────────────────────
// K6 Stress Test — ramp VUs from 0 to 200 over 10 minutes.
//
// Usage:
//   k6 run k6/stress.js
// ──────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // ramp to 50 VUs
    { duration: '3m', target: 100 },  // ramp to 100 VUs
    { duration: '3m', target: 200 },  // ramp to 200 VUs
    { duration: '2m', target: 0 },    // cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.2'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';
const TARGET_URLS = [
  'https://example.com/stress/a',
  'https://example.com/stress/b',
  'https://example.com/stress/c',
];

// Shared state across VUs.
const shortCodes = [];
const FAKE_IPS = Array.from({ length: 200 }, (_, i) => {
  const a = Math.floor(Math.random() * 223) + 1;
  return `${a}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;
});

export default function () {
  // Create + redirect + check trending in each iteration.
  const url = TARGET_URLS[Math.floor(Math.random() * TARGET_URLS.length)];

  // Create
  const createRes = http.post(
    `${BASE_URL}/api/urls`,
    JSON.stringify({ original_url: `${url}?t=${Date.now()}&vu=${__VU}` }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (createRes.status === 200 || createRes.status === 201) {
    try {
      const code = JSON.parse(createRes.body).shortCode;

      // Redirect with fake IP
      const ip = FAKE_IPS[Math.floor(Math.random() * FAKE_IPS.length)];
      http.get(`${BASE_URL}/${code}`, {
        headers: { 'X-Forwarded-For': ip },
        redirects: 0,
      });

      // Analytics
      http.get(`${BASE_URL}/api/urls/${code}/clicks`);
    } catch {}
  }

  // Trending check (every few iterations)
  if (Math.random() < 0.1) {
    http.get(`${BASE_URL}/api/urls/trending?window=1h`);
  }

  sleep(0.1 + Math.random() * 0.3);
}
