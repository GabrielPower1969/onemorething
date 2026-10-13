-- onemorething.today — initial schema (docs/PLAN.md §5.1).
-- Rule: within a release, migrations only add (expand); removals happen a release later (contract).

CREATE TABLE posts (
  id            TEXT PRIMARY KEY,                 -- crypto.randomUUID()
  slug          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL,                    -- 'text' | 'video' | 'audio' (validated in code)
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  cover_key     TEXT,                             -- R2 key in MEDIA, served at /media/<key>
  youtube_id    TEXT,
  media_url     TEXT,
  published_at  TEXT,                             -- ISO-8601 UTC
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX posts_status_pub ON posts (status, published_at DESC);

CREATE TABLE post_i18n (
  post_id            TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  lang               TEXT NOT NULL CHECK (lang IN ('en', 'zh')),
  title              TEXT NOT NULL DEFAULT '',
  summary            TEXT NOT NULL DEFAULT '',
  body_md            TEXT NOT NULL DEFAULT '',
  body_html          TEXT NOT NULL DEFAULT '',
  sanitizer_version  INTEGER NOT NULL DEFAULT 0,
  cover_alt          TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (post_id, lang)
);

CREATE TABLE media (
  key           TEXT PRIMARY KEY,
  content_type  TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  created_at    TEXT NOT NULL
);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL                            -- JSON
);

-- Analytics. Deliberately no secondary indexes: every index costs one more written row (D1 quota).
CREATE TABLE events (
  id        INTEGER PRIMARY KEY,
  ts        INTEGER NOT NULL,                     -- unix ms
  type      TEXT NOT NULL,
  path      TEXT,
  lang      TEXT,
  ref       TEXT,                                 -- referrer host only
  campaign  TEXT,
  target    TEXT,
  section   TEXT,
  value     INTEGER,                              -- engage seconds, read depth
  country   TEXT,
  device    TEXT,
  app       TEXT,
  visitor   TEXT,                                 -- sha256(daily_salt | ip | ua)[0:16]
  version   TEXT                                  -- Worker version id
);

-- One random salt per New Zealand day; rows older than 48 hours are deleted.
CREATE TABLE daily_salt (
  day   TEXT PRIMARY KEY,
  salt  TEXT NOT NULL
);
