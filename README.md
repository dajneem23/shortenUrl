# ShortenUrl — URL Shortener with Analytics

Production-ready URL shortener built with **Next.js 15**, **Nest.js**, **Traefik**, **PostgreSQL**, **Redis Stack**, **Grafana + Prometheus**, and **Tailwind CSS 4**.

```
Cloudflare → Main Traefik → Internal Traefik
                                ├── shorten-web (Next.js SSR :80)
                                ├── shorten-api (Nest.js :3000)
                                ├── postgres (:5432)
                                ├── redis-stack (:6379)
                                ├── prometheus (:9090)
                                └── grafana (:3000)
```

## Features

- **Short URL creation** with optional custom codes and expiry
- **Preview page** — `/:code` shows destination URL, QR code, and click stats before redirecting
- **Go links** — `/go/:code` records the click (IP, country, referrer) then redirects to the original URL
- **Click analytics** — time series, country, referrer, anonymised IP breakdowns, unique visitor count
- **SEO optimised** — SSR with Next.js, robots.txt, sitemap.xml, JSON-LD structured data, Twitter cards, Open Graph, canonical URLs
- **QR code** on every detail page — scan to open the link on mobile
- **Dashboard** — `/dashboard` with stats, trending table, and all URLs
- **Redis Stack native** Bloom Filter (`BF.ADD`), Count-Min Sketch (`CMS.INCRBY`), Top-K (`TOPK.ADD`)
- **IP geolocation** via ip-api.com with real client IP from `CF-Connecting-IP` (Cloudflare → Traefik → API)
- **Grafana dashboard** — 12 panels: click rates, redirects by URL, geo, latency, memory, event-loop lag
- **K6 load testing** — smoke, load, and stress profiles
- **Structured logging** — NestJS Logger in all backend services, request-level logging in Next.js

## Quickstart

```bash
# Start all services
docker compose up -d --build

# Check health
curl http://localhost/health
```

| Service | URL |
|---|---|
| **Web UI** | http://localhost |
| **Dashboard** | http://localhost/dashboard |
| **API** | http://localhost/api/urls |
| **Metrics** | http://localhost/metrics |
| **Traefik** | http://localhost:8080/dashboard |
| **Grafana** | http://localhost/grafana |
| **Prometheus** | http://localhost/prometheus |

## Routing

| Path | Destination | Description |
|---|---|---|
| `/` | Next.js SPA | Home page — create URLs |
| `/dashboard` | Next.js SPA | Dashboard — stats + trending |
| `/:code` | Next.js SSR | Preview page — URL info + QR + analytics |
| `/:code/analytics` | Next.js SSR | Click charts + geo breakdown |
| `/go/:code` | Nest.js API | **Record click → 302 redirect** to original URL |
| `/api/*` | Nest.js API | REST endpoints |
| `/metrics` | Nest.js API | Prometheus metrics |
| `/grafana` | Grafana | Observability dashboard |
| `/robots.txt` | Next.js | Crawl rules |
| `/sitemap.xml` | Next.js | Dynamic URL listing |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/urls` | Create short URL |
| `GET` | `/api/urls` | List URLs (paginated) |
| `GET` | `/api/urls/trending` | Top-K trending (`?window=1h\|24h\|7d`) |
| `GET` | `/api/urls/:code` | Get URL details + geo stats |
| `DELETE` | `/api/urls/:code` | Delete a URL |
| `GET` | `/api/urls/:code/clicks` | Click analytics (`?days=7`) |
| `GET` | `/go/:code` | Record click → **302 redirect** |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/health` | Health check |

### Create a short URL

```bash
curl -X POST http://localhost/api/urls \
  -H "Content-Type: application/json" \
  -d '{"original_url":"https://example.com/very/long/url"}'

# Response:
# {"id":1,"shortCode":"aB3xK9m","shortUrl":"https://short.sugoiweb3.uk/go/aB3xK9m",...}
```

### Analytics (with unique IP count, geo, referrer)

```bash
curl http://localhost/api/urls/aB3xK9m/clicks?days=7
# { "totalClicks": 142, "uniqueIps": 89, "byCountry": [...], "byIp": [...] }
```

### Trending

```bash
curl http://localhost/api/urls/trending?window=1h
# { "window": "1h", "top": [{"shortCode":"aB3xK9m","clicks":42},...] }
```

## Click Tracking Flow

```
1. Shared link:  https://short.sugoiweb3.uk/go/abc123
2. API records:  IP (CF-Connecting-IP), country (ip-api.com), referrer, user-agent
3. Bloom filter: checks if IP is new → increments unique_visitors_total
4. Top-K:        adds to trending sketches (1h / 24h / 7d)
5. CMS:          increments click frequency estimate
6. 302 redirect: → https://example.com/original-url
```

## Redis Stack — Native Probabilistic Data Structures

Uses Redis Stack's C-level implementations — no manual hashing needed.

| Structure | Redis Command | Use |
|---|---|---|
| **Bloom Filter** | `BF.ADD` / `BF.RESERVE` | Unique IP dedup per short URL |
| **Count-Min Sketch** | `CMS.INCRBY` / `CMS.QUERY` | Click frequency estimation |
| **Top-K** | `TOPK.ADD` / `TOPK.LIST WITHCOUNT` | Trending URLs (1h / 24h / 7d) |

| Bloom Filter | Count-Min Sketch | Top-K |
|---|---|---|
| ε=0.001, cap=100k | w=2000, d=10 | k=50, w=8, d=7, decay=0.9 |
| ~175 KB per filter | ~80 KB per sketch | ~4 KB per sketch |

## SEO

| Feature | Implementation |
|---|---|
| **SSR** | `/[code]` and `/[code]/analytics` are server-rendered (Next.js `force-dynamic`) |
| **robots.txt** | `shorten-web/src/app/robots.ts` — allows `/`, `/:code`; disallows `/go/`, `/api/` |
| **sitemap.xml** | `shorten-web/src/app/sitemap.ts` — lists all short URLs |
| **JSON-LD** | `WebSite`, `BreadcrumbList`, `WebPage` schemas on detail pages |
| **Open Graph** | `og:title`, `og:description`, `og:type`, `og:url`, `og:site_name` |
| **Twitter Card** | `twitter:card: summary_large_image` on all pages |
| **Canonical** | `rel="canonical"` on layout + per-page via `metadataBase` |
| **Keywords** | 20+ keywords covering dev intent, self-hosted, alternatives, long-tail |

## Prometheus Metrics

| Metric | Type | Labels |
|---|---|---|
| `http_request_duration_seconds` | Histogram | method, route, status_code |
| `http_requests_total` | Counter | method, route, status_code |
| `url_redirects_total` | Counter | short_code |
| `url_created_total` | Counter | — |
| `unique_visitors_total` | Counter | short_code |
| `url_redirects_by_country_total` | Counter | country, short_code |
| `url_redirects_by_ip_total` | Counter | ip_prefix |
| `cms_estimates_total` | Counter | sketch |

## Grafana Dashboard

Access at `/grafana` (anonymous, no login). 12 panels:

- **Stat row**: Service Up, URLs Created, Total Redirects, Redirects Today, Redirects/min, Unique Visitors, Unique Countries, Unique IPs
- **Timeseries**: Redirects/sec by URL, Total Redirects by URL (cumulative), Redirects by Country, API p95 Latency, HTTP Status Breakdown, Unique Visitors by URL
- **Resource**: Resident Memory (RSS), Event-loop Lag

## Load Testing (K6)

```bash
brew install k6

# Smoke test
k6 run k6/smoke.js

# Load test (50 VUs, 5 minutes)
k6 run --vus 50 --duration 5m k6/load.js

# Stress test (ramp 0→200 VUs)
k6 run k6/stress.js
```

## Development

```bash
# Backend
cd shorten-api && npm install && npm run start:dev   # hot-reload on :3000

# Frontend
cd shorten-web && npm install && npm run dev          # Next.js dev on :5173
```

## Project Structure

```
shortenUrl/
├── docker-compose.yml
├── .env
├── README.md
├── traefik/
│   ├── traefik.yml                  # Static config (entryPoints, metrics, file provider)
│   └── dynamic/dynamic.yml          # Routers + services
├── observability/
│   ├── prometheus.yml               # Scrape configs
│   └── grafana/
│       ├── provisioning/            # Datasource + dashboard provider
│       └── dashboards/
│           └── shorten-url.json     # 12-panel dashboard
├── postgres/init/01-init.sql
├── k6/
│   ├── smoke.js
│   ├── load.js
│   └── stress.js
├── shorten-api/                     # Nest.js backend
│   ├── Dockerfile
│   └── src/
│       ├── main.ts                  # Bootstrap: helmet, rate-limit, trust proxy
│       ├── app.module.ts
│       ├── url/
│       │   ├── url.entity.ts
│       │   ├── url.service.ts       # CRUD + Redis caching + nanoid generator
│       │   ├── url.controller.ts    # /go/:code, /api/urls/*
│       │   └── dto/
│       ├── analytics/
│       │   ├── click.entity.ts
│       │   ├── analytics.service.ts # Click recording + IP geo lookup + aggregation
│       │   ├── bloom-filter.service.ts   # BF.ADD / BF.RESERVE
│       │   ├── count-min-sketch.service.ts # CMS.INCRBY / CMS.QUERY
│       │   └── top-k.service.ts     # TOPK.ADD / TOPK.LIST WITHCOUNT
│       ├── shared/
│       │   ├── redis/redis.module.ts
│       │   └── telemetry/           # prom-client setup + /metrics endpoint
│       └── common/
│           └── interceptors/        # HTTP metrics interceptor
└── shorten-web/                     # Next.js 15 frontend
    ├── Dockerfile                   # standalone output → node server.js
    └── src/
        ├── app/
        │   ├── layout.tsx           # Root layout + metadata + JSON-LD WebSite
        │   ├── page.tsx             # Home page (client)
        │   ├── robots.ts            # Crawl rules
        │   ├── sitemap.ts           # Dynamic sitemap
        │   ├── dashboard/page.tsx   # Dashboard (client)
        │   └── [code]/
        │       ├── page.tsx         # Detail page (SSR + SEO + QR)
        │       ├── detail-client.tsx
        │       └── analytics/
        │           ├── page.tsx     # Analytics page (SSR)
        │           └── analytics-client.tsx  # Chart.js charts
        ├── components/
        │   └── JsonLd.tsx           # Structured data schemas
        └── lib/
            └── api.ts               # API client (server + client)
```
