-- ============================================================
-- Terminal Comparator Platform
-- Complete Database Migration
-- Run with: psql -U comparator_user -d comparator_db -f 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role_enum       AS ENUM ('admin', 'manager', 'analyst', 'viewer');
CREATE TYPE merchant_size_enum   AS ENUM ('SMB', 'Enterprise', 'Both');
CREATE TYPE channel_enum         AS ENUM ('Online', 'In-Store', 'Omnichannel', 'Mobile');
CREATE TYPE competitor_type_enum AS ENUM ('PSP', 'Acquirer', 'PSP_Acquirer', 'Terminal_Mfr', 'Supplier', 'Other');
CREATE TYPE impact_rating_enum   AS ENUM ('Critical', 'High', 'Medium', 'Low');
CREATE TYPE priority_enum        AS ENUM ('Critical', 'High', 'Medium', 'Low');

-- ============================================================
-- MASTER TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  role          user_role_enum NOT NULL DEFAULT 'viewer',
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  last_login    TIMESTAMPTZ
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);

-- ============================================================
-- CHILD TABLE: user_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  user_agent  TEXT,
  ip_address  INET
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_hash ON user_sessions(token_hash);

-- ============================================================
-- MASTER TABLE: countries
-- ============================================================
CREATE TABLE IF NOT EXISTS countries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(3)  UNIQUE NOT NULL,  -- ISO 3166-1 alpha-2/3
  name        VARCHAR(100) NOT NULL,
  region      VARCHAR(50),                  -- EU, APAC, Americas, MEA
  flag_emoji  VARCHAR(10),
  is_active   BOOLEAN     DEFAULT TRUE
);

-- ============================================================
-- MASTER TABLE: verticals
-- ============================================================
CREATE TABLE IF NOT EXISTS verticals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  is_active   BOOLEAN     DEFAULT TRUE
);

-- ============================================================
-- MASTER TABLE: offer_types
-- ============================================================
CREATE TABLE IF NOT EXISTS offer_types (
  id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL
);

-- ============================================================
-- MASTER TABLE: vas_types (Value-Added Services)
-- ============================================================
CREATE TABLE IF NOT EXISTS vas_types (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  category    VARCHAR(100),  -- 'Payment', 'Finance', 'AI', 'Loyalty', 'Other'
  description TEXT
);

-- ============================================================
-- MASTER TABLE: pricing_structures
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_structures (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT
);

-- ============================================================
-- MASTER TABLE: payment_interfaces
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_interfaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  category    VARCHAR(50),   -- 'Card', 'Mobile', 'Biometric', 'QR'
  description TEXT
);

-- ============================================================
-- MASTER TABLE: software_ecosystems
-- ============================================================
CREATE TABLE IF NOT EXISTS software_ecosystems (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT
);

-- ============================================================
-- MASTER TABLE: terminal_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS terminal_categories (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 VARCHAR(50) UNIQUE NOT NULL,  -- e.g. "SMART_POS"
  name                 VARCHAR(150) NOT NULL,
  description          TEXT,
  target_merchant_size merchant_size_enum NOT NULL DEFAULT 'Both',
  channel              channel_enum NOT NULL DEFAULT 'In-Store',
  is_active            BOOLEAN     DEFAULT TRUE,
  sort_order           INT         DEFAULT 0,
  created_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MASTER TABLE: competitors
-- ============================================================
CREATE TABLE IF NOT EXISTS competitors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(150) NOT NULL,
  logo_url        TEXT,
  logo_color_hex  VARCHAR(7),
  competitor_type competitor_type_enum NOT NULL,
  hq_country_id   UUID        REFERENCES countries(id),
  founded_year    SMALLINT,
  website_url     TEXT,
  description     TEXT,
  is_active       BOOLEAN     DEFAULT TRUE,
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_competitors_type    ON competitors(competitor_type);
CREATE INDEX idx_competitors_country ON competitors(hq_country_id);

-- ============================================================
-- CHILD TABLE: terminals
-- ============================================================
CREATE TABLE IF NOT EXISTS terminals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id          UUID        NOT NULL REFERENCES terminal_categories(id),
  competitor_id        UUID        NOT NULL REFERENCES competitors(id),
  model_name           VARCHAR(200) NOT NULL,
  model_code           VARCHAR(100),
  announced_year       SMALLINT,
  image_url            TEXT,
  -- Physical dimensions
  width_mm             NUMERIC(6,2),
  height_mm            NUMERIC(6,2),
  depth_mm             NUMERIC(6,2),
  weight_g             NUMERIC(6,1),
  -- Connectivity
  has_wifi             BOOLEAN     DEFAULT FALSE,
  has_bluetooth        BOOLEAN     DEFAULT FALSE,
  has_4g_lte           BOOLEAN     DEFAULT FALSE,
  has_ethernet         BOOLEAN     DEFAULT FALSE,
  -- Power
  battery_mah          INT,
  battery_standby_hrs  NUMERIC(5,1),
  -- Peripherals
  has_printer          BOOLEAN     DEFAULT FALSE,
  printer_paper_mm     SMALLINT,
  display_size_inch    NUMERIC(4,1),
  display_type         VARCHAR(50), -- 'LCD', 'IPS', 'OLED', 'E-Ink'
  has_customer_display BOOLEAN     DEFAULT FALSE,
  -- Software
  os_name              VARCHAR(100),
  os_version           VARCHAR(50),
  dual_system          BOOLEAN     DEFAULT FALSE,
  is_active            BOOLEAN     DEFAULT TRUE,
  created_by           UUID        REFERENCES users(id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_terminals_category   ON terminals(category_id);
CREATE INDEX idx_terminals_competitor ON terminals(competitor_id);

-- ============================================================
-- CHILD TABLE: terminal_payment_interfaces (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS terminal_payment_interfaces (
  terminal_id          UUID REFERENCES terminals(id) ON DELETE CASCADE,
  payment_interface_id UUID REFERENCES payment_interfaces(id) ON DELETE CASCADE,
  PRIMARY KEY (terminal_id, payment_interface_id)
);

-- ============================================================
-- CHILD TABLE: competitor_offers
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_offers (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id         UUID        NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  offer_type_id         UUID        REFERENCES offer_types(id),
  is_omnichannel        BOOLEAN     DEFAULT FALSE,
  omnichannel_detail    TEXT,
  has_packaged_offer    BOOLEAN     DEFAULT FALSE,
  packaged_offer_name   VARCHAR(200),
  packaged_offer_detail TEXT,
  target_size           merchant_size_enum DEFAULT 'Both',
  notes                 TEXT,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_competitor_offers_competitor ON competitor_offers(competitor_id);

-- ============================================================
-- CHILD TABLE: competitor_verticals (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_verticals (
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  vertical_id   UUID REFERENCES verticals(id) ON DELETE CASCADE,
  notes         TEXT,
  PRIMARY KEY (competitor_id, vertical_id)
);

-- ============================================================
-- CHILD TABLE: competitor_hardware (summary link)
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_hardware (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  category_id   UUID NOT NULL REFERENCES terminal_categories(id),
  notes         TEXT
);

-- ============================================================
-- CHILD TABLE: competitor_vas
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_vas (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID  NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  vas_type_id   UUID  NOT NULL REFERENCES vas_types(id),
  is_available  BOOLEAN DEFAULT TRUE,
  provider_name VARCHAR(200),
  detail        TEXT
);

CREATE INDEX idx_competitor_vas_competitor ON competitor_vas(competitor_id);

-- ============================================================
-- CHILD TABLE: competitor_pricing
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_pricing (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id        UUID         NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  terminal_id          UUID         REFERENCES terminals(id),
  pricing_structure_id UUID         REFERENCES pricing_structures(id),
  amount_eur           NUMERIC(10,2),
  percentage_rate      NUMERIC(5,4),
  flat_fee_eur         NUMERIC(8,4),
  description          TEXT,
  valid_from           DATE,
  valid_to             DATE
);

CREATE INDEX idx_competitor_pricing_competitor ON competitor_pricing(competitor_id);

-- ============================================================
-- CHILD TABLE: competitor_software
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_software (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id        UUID    NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  has_merchant_portal  BOOLEAN DEFAULT FALSE,
  portal_features      TEXT[],
  has_mobile_app       BOOLEAN DEFAULT FALSE,
  mobile_app_platforms TEXT[],
  has_tms              BOOLEAN DEFAULT FALSE,
  tms_features         TEXT[],
  has_local_ecr        BOOLEAN DEFAULT FALSE,
  has_cloud_api        BOOLEAN DEFAULT FALSE,
  api_protocols        TEXT[],
  has_app_marketplace  BOOLEAN DEFAULT FALSE,
  marketplace_name     VARCHAR(200),
  notes                TEXT
);

CREATE UNIQUE INDEX idx_competitor_software_competitor ON competitor_software(competitor_id);

-- ============================================================
-- CHILD TABLE: competitor_countries (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_countries (
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  country_id    UUID REFERENCES countries(id) ON DELETE CASCADE,
  PRIMARY KEY (competitor_id, country_id)
);

-- ============================================================
-- CHILD TABLE: market_trends
-- ============================================================
CREATE TABLE IF NOT EXISTS market_trends (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID         REFERENCES competitors(id) ON DELETE SET NULL,
  country_id    UUID         REFERENCES countries(id),
  trend_type    VARCHAR(50)  NOT NULL,  -- 'PSP_Acquirer' or 'Supplier'
  title         VARCHAR(300) NOT NULL,
  description   TEXT,
  source_url    TEXT,
  trend_date    DATE,
  impact_rating impact_rating_enum DEFAULT 'Medium',
  tags          TEXT[],
  created_by    UUID         REFERENCES users(id),
  created_at    TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_market_trends_competitor ON market_trends(competitor_id);
CREATE INDEX idx_market_trends_country    ON market_trends(country_id);

-- ============================================================
-- CHILD TABLE: gap_analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS gap_analysis (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id   UUID         REFERENCES competitors(id) ON DELETE SET NULL,
  country_id      UUID         REFERENCES countries(id),
  gap_type        VARCHAR(50),  -- 'BestPractice','CompetitorStrength','OurAdvantage','MarketGap','Recommendation'
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  priority        priority_enum DEFAULT 'Medium',
  owner           VARCHAR(200),
  target_quarter  VARCHAR(10),  -- e.g. 'Q3-2025'
  status          VARCHAR(50)  DEFAULT 'Open',  -- 'Open','In Progress','Done'
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_gap_analysis_competitor ON gap_analysis(competitor_id);
CREATE INDEX idx_gap_analysis_status     ON gap_analysis(status);

-- ============================================================
-- CHILD TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50)  NOT NULL,  -- INSERT, UPDATE, DELETE
  table_name  VARCHAR(100) NOT NULL,
  record_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user         ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at   ON audit_logs(created_at DESC);
