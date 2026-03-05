-- ============================================================
-- Terminal Comparator Platform — Scraper Extension
-- Migration 002: Web Scraping Tables
-- Run with: psql -U comparator_user -d comparator_db -f 002_scraper_schema.sql
-- All tables are additive — no existing tables are modified.
-- ============================================================

-- ============================================================
-- ENUM: scrape status
-- ============================================================
CREATE TYPE scrape_status_enum AS ENUM ('success', 'blocked', 'error', 'partial', 'pending');

-- ============================================================
-- TABLE: competitor_scrape_meta
-- One row per competitor — rolling last-scrape summary.
-- Updated on each scrape attempt.
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_scrape_meta (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id     UUID         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_url        TEXT         NOT NULL,
  last_scraped_at   TIMESTAMPTZ,
  status            scrape_status_enum NOT NULL DEFAULT 'pending',
  http_status       SMALLINT,              -- last HTTP response code
  block_reason      TEXT,                  -- "robots.txt", "403 Forbidden", "captcha", etc.
  confidence_score  NUMERIC(4,3),          -- 0.000 – 1.000
  raw_html_path     TEXT,                  -- local file or S3 key
  screenshot_path   TEXT,                  -- Playwright screenshot (when blocked)
  scrape_method     VARCHAR(50),           -- 'requests' or 'playwright'
  user_agent        TEXT,
  error_message     TEXT,
  times_blocked     INT          DEFAULT 0,
  times_succeeded   INT          DEFAULT 0,
  next_scheduled_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT now(),
  updated_at        TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (competitor_id)                   -- one meta row per competitor
);

CREATE INDEX idx_scrape_meta_competitor ON competitor_scrape_meta(competitor_id);
CREATE INDEX idx_scrape_meta_status     ON competitor_scrape_meta(status);

-- ============================================================
-- TABLE: scrape_logs
-- One row per scrape ATTEMPT (immutable history).
-- ============================================================
CREATE TABLE IF NOT EXISTS scrape_logs (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id     UUID         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_url        TEXT         NOT NULL,
  scraped_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  status            scrape_status_enum NOT NULL,
  http_status       SMALLINT,
  response_headers  JSONB,                 -- stored for debugging
  block_reason      TEXT,
  raw_html_path     TEXT,
  screenshot_path   TEXT,
  scrape_method     VARCHAR(50),           -- 'requests' or 'playwright'
  confidence_score  NUMERIC(4,3),
  duration_ms       INT,                   -- how long the fetch took
  error_message     TEXT,
  triggered_by      UUID         REFERENCES users(id) ON DELETE SET NULL,  -- NULL = scheduler
  user_agent        TEXT,
  proxy_used        TEXT,                  -- masked or hashed
  parsed_data       JSONB                  -- snapshot of extracted fields
);

CREATE INDEX idx_scrape_logs_competitor ON scrape_logs(competitor_id);
CREATE INDEX idx_scrape_logs_status     ON scrape_logs(status);
CREATE INDEX idx_scrape_logs_scraped_at ON scrape_logs(scraped_at DESC);

-- ============================================================
-- TABLE: scraped_projects
-- Case studies / project references extracted from website.
-- ============================================================
CREATE TABLE IF NOT EXISTS scraped_projects (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  scrape_log_id UUID         REFERENCES scrape_logs(id) ON DELETE SET NULL,
  title         VARCHAR(300) NOT NULL,
  summary       TEXT,
  industries    TEXT[],                  -- ['finance', 'retail']
  client_name   VARCHAR(200),
  source_url    TEXT,
  published_at  DATE,
  created_at    TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_scraped_projects_competitor ON scraped_projects(competitor_id);

-- ============================================================
-- TABLE: client_reasons
-- "Why clients choose this company" bullet points.
-- ============================================================
CREATE TABLE IF NOT EXISTS client_reasons (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  scrape_log_id UUID         REFERENCES scrape_logs(id) ON DELETE SET NULL,
  reason_text   TEXT         NOT NULL,
  sort_order    INT          DEFAULT 0,
  created_at    TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_client_reasons_competitor ON client_reasons(competitor_id);

-- ============================================================
-- TABLE: scraped_a_to_z
-- Key-value store for A→Z structured company facts.
-- ============================================================
CREATE TABLE IF NOT EXISTS scraped_a_to_z (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  scrape_log_id UUID         REFERENCES scrape_logs(id) ON DELETE SET NULL,
  fact_key      VARCHAR(100) NOT NULL,  -- e.g. 'founding_year', 'business_model', 'competitors'
  fact_value    TEXT,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (competitor_id, fact_key)
);

CREATE INDEX idx_a_to_z_competitor ON scraped_a_to_z(competitor_id);
