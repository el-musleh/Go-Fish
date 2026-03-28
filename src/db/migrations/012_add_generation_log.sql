-- Track every AI generation attempt: timing, model, status, and errors
CREATE TABLE IF NOT EXISTS generation_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status         VARCHAR(20)  NOT NULL DEFAULT 'started',  -- started | success | failed
  model_used     VARCHAR(120),
  provider_used  VARCHAR(50),
  attempt_number INTEGER      NOT NULL DEFAULT 1,
  real_world_ms  INTEGER,   -- time spent fetching real-world data
  agent_ms       INTEGER,   -- time spent in the planning agent + finalizer
  duration_ms    INTEGER,   -- total wall-clock time for triggerGeneration
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS generation_log_event_id_idx  ON generation_log(event_id);
CREATE INDEX IF NOT EXISTS generation_log_started_at_idx ON generation_log(started_at DESC);
