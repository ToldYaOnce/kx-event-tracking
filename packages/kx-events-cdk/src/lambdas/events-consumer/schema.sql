CREATE TABLE IF NOT EXISTS events (
  event_id          UUID PRIMARY KEY,
  client_id         VARCHAR(128) NOT NULL,
  previous_event_id UUID NULL,
  user_id           VARCHAR(128),
  entity_id         VARCHAR(128),
  entity_type       VARCHAR(48),
  event_type        VARCHAR(48) NOT NULL,
  source            VARCHAR(32),
  campaign_id       VARCHAR(128),
  points_awarded    INTEGER,
  session_id        VARCHAR(128),
  occurred_at       TIMESTAMPTZ NOT NULL,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_events_previous
    FOREIGN KEY (previous_event_id) REFERENCES events(event_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_client_time
  ON events (client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_user_time
  ON events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_type_time
  ON events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_campaign_time
  ON events (campaign_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_prev
  ON events (previous_event_id);

CREATE INDEX IF NOT EXISTS idx_events_metadata_gin
  ON events USING GIN (metadata);

