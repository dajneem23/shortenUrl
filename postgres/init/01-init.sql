-- URL shortener — schema init
-- This runs once when the postgres container starts fresh.

CREATE TABLE IF NOT EXISTS urls (
    id          SERIAL PRIMARY KEY,
    short_code  VARCHAR(8)  NOT NULL UNIQUE,
    original_url TEXT       NOT NULL,
    clicks      INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls (short_code);
CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls (created_at DESC);

CREATE TABLE IF NOT EXISTS clicks (
    id          SERIAL PRIMARY KEY,
    url_id      INTEGER     NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    referer     TEXT,
    country     VARCHAR(2),
    city        VARCHAR(128),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON clicks (url_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON clicks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks (country);
