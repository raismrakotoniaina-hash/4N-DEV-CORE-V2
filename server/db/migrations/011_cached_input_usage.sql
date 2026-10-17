-- Record cached input tokens separately for transparent usage and billing audits.
BEGIN;
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS cached_input_tokens BIGINT NOT NULL DEFAULT 0
  CHECK (cached_input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS cache_write_input_tokens BIGINT NOT NULL DEFAULT 0
  CHECK (cache_write_input_tokens >= 0);
COMMIT;
