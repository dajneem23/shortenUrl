# ShortenUrl — URL Shortener

Production-ready URL shortener built with **Nest.js**, **Traefik**, **PostgreSQL**, **Redis**, **Grafana + Prometheus**, and **Tailwind CSS**.

```
                    ┌──────────────────────────────┐
                    │    Traefik :80 (edge)         │
                    └──────┬───────────┬───────────┘
                           │           │
              ┌────────────┘           └────────────┐
              ▼                                     ▼
    ┌─────────────────┐                   ┌─────────────────┐
    │  shorten-web    │                   │  shorten-api    │
    │  (httpd:alpine) │                   │  (NestJS :3000) │
    │  Tailwind UI    │                   │  URL CRUD +     │
    └─────────────────┘                   │  Redirect       │
                                          └────────┬────────┘
                                                   │
                                        ┌──────────┼──────────┐
                                        ▼          ▼          ▼
                                  ┌─────────┐ ┌───────┐ ┌─────────┐
                                  │postgres │ │ redis │ │prometheus│
                                  │   :5432 │ │ :6379 │ │  :9090   │
                                  └─────────┘ └───────┘ └────┬─────┘
                                                             │
                                                             ▼
                                                      ┌──────────┐
                                                      │ grafana  │
                                                      │  :3000   │
                                                      └──────────┘
```

## Features

- **Short URL creation** with optional custom codes and expiry
- **Instant redirects** cached in Redis (1h TTL)
- **Click analytics** — time series, country, referrer, IP breakdowns
- **Bloom filter** for unique visitor tracking (dedups IPs per URL)
- **Count-Min Sketch** for bounded-memory click frequency estimation
- **Top-K trending** URLs across 1h / 24h / 7d windows
- **IP geolocation** via ip-api.com (country + city)
- **Grafana dashboard** — click rates, latency, geo distribution, memory, event-loop lag
- **K6 load testing** scripts — smoke, load, and stress profiles
- **Traefik** edge routing with metrics, no Docker socket needed

## Quickstart

```bash
# Start core services (api + web + db + redis + traefik)
docker compose up -d --build

# Start with observability (Prometheus + Grafana)
docker compose --profile observability up -d

# Check health
curl http://localhost/health
```

| Service      | URL                              |
|------------- |----------------------------------|
| **Web UI**   | http://localhost                 |
| **API**      | http://localhost/api/urls        |
| **Metrics**  | http://localhost/metrics         |
| **Traefik**  | http://localhost:8080/dashboard  |
| **Grafana**  | http://localhost/grafana         |
| **Prometheus** | http://localhost/prometheus   |

## API

| Method | Path                     | Description                        |
|--------|--------------------------|------------------------------------|
| `POST` | `/api/urls`              | Create short URL                   |
| `GET`  | `/api/urls`              | List URLs (paginated)              |
| `GET`  | `/api/urls/trending`     | Top-K trending (`?window=1h`)      |
| `GET`  | `/api/urls/:code`        | Get URL details + geo stats        |
| `DELETE` | `/api/urls/:code`       | Delete a URL                       |
| `GET`  | `/api/urls/:code/clicks` | Click analytics (`?days=7`)        |
| `GET`  | `/:code`                 | **302 redirect** + record click    |
| `GET`  | `/metrics`               | Prometheus metrics                 |
| `GET`  | `/health`                | Health check                       |

### Create a short URL

```bash
curl -X POST http://localhost/api/urls \
  -H "Content-Type: application/json" \
  -d '{"original_url":"https://example.com/very/long/url"}'

# Response:
# {"id":1,"shortCode":"aB3xK9m","shortUrl":"http://localhost/aB3xK9m",...}
```

### Redirect

```bash
curl -v http://localhost/aB3xK9m
# HTTP/1.1 302 Found
# Location: https://example.com/very/long/url
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

## Probabilistic Data Structures

### Bloom Filter (IP dedup)

Tracks whether an IP has previously visited a short URL using a Redis-backed
Bloom filter (`SETBIT`/`GETBIT`, k=4 hashes, 2^20 bits). When an IP is first
seen, the `unique_visitors_total` Prometheus counter is incremented.

Each short_code gets its own filter (`bf:ip:{shortCode}`), auto-expiring after
30 days of inactivity.

### Count-Min Sketch (frequency estimation)

Estimates click frequencies with O(1) space per URL. Used by the Top-K trending
service to maintain leaderboards without storing every URL ever created.

| Parameter | Value | Meaning                              |
|---------- |------ |--------------------------------------|
| ε (epsilon) | 0.01 | 1% estimation error                 |
| δ (delta)   | 0.01 | 99% confidence                      |
| w (width)   | 272  | columns per row                     |
| d (depth)   | 5    | rows (hash functions)               |
| Memory      | ~1.3 KB | per window sketch              |

CMS sketches in Redis: `cms:clicks:{1h|24h|7d}:r{0..4}`

## Load Testing (K6)

```bash
# Install k6
brew install k6

# Smoke test (quick sanity check)
k6 run k6/smoke.js

# Load test (50 VUs, 5 minutes)
k6 run --vus 50 --duration 5m k6/load.js

# Stress test (ramp 0→200 VUs)
k6 run k6/stress.js
```

Custom metrics tracked: `urls_created`, `redirects_total`, `redirects_failed`,
`analytics_calls`, `trending_calls`, `redirect_latency_ms`, `create_latency_ms`.

## Prometheus Metrics

| Metric                             | Type      | Labels                  |
|----------------------------------- |---------- |-------------------------|
| `http_request_duration_seconds`    | Histogram | method, route, status   |
| `http_requests_total`              | Counter   | method, route, status   |
| `url_redirects_total`              | Counter   | short_code              |
| `url_created_total`                | Counter   | —                       |
| `unique_visitors_total`            | Counter   | short_code              |
| `url_redirects_by_country_total`   | Counter   | country, short_code     |
| `url_redirects_by_ip_total`        | Counter   | ip_prefix               |
| `cms_estimates_total`              | Counter   | sketch                  |

## Grafana Dashboard

Open http://localhost/grafana (anonymous access, no login needed).

Panels: Service Up, URLs Created, Total Redirects, Redirect Rate, Unique IPs,
Unique Countries, Redirects/sec by code, API p95 latency (edge), HTTP status
breakdown, Redirects by Country, Resident Memory, Event-loop Lag.

## Development

```bash
# Backend (shorten-api)
cd shorten-api
npm install
npm run start:dev    # hot-reload on :3000

# Frontend (shorten-web)
cd shorten-web
npm install
npm run dev          # Vite dev server on :5173
```

## Project Structure

```
shortenUrl/
├── docker-compose.yml
├── traefik/                    # Edge router config
│   ├── traefik.yml
│   └── dynamic/dynamic.yml
├── observability/              # Prometheus + Grafana (profile-gated)
│   ├── prometheus.yml
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/
├── postgres/init/01-init.sql
├── k6/                         # Load testing scripts
│   ├── smoke.js
│   ├── load.js
│   └── stress.js
├── shorten-api/                # Nest.js backend
│   ├── Dockerfile
│   └── src/
│       ├── url/                # URL CRUD + redirect
│       ├── analytics/          # Clicks, Bloom filter, CMS, Top-K
│       └── shared/             # Redis module, telemetry
└── shorten-web/                # Vite + Tailwind CSS UI
    ├── Dockerfile
    └── src/pages/              # Home, detail, analytics
```
