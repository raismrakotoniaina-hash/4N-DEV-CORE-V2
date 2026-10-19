-- Record cached-read and cache-write input tokens for billing audits and usage history.
BEGIN;
ALTER TABLE usage_records
  ADD COLUMN IF NOT EXISTS cached_input_tokens BIGINT NOT NULL DEFAULT 0
  CHECK (cached_input_tokens >= 0),
  ADD COLUMN IF NOT EXISTS cache_write_input_tokens BIGINT NOT NULL DEFAULT 0
  CHECK (cache_write_input_tokens >= 0);
COMMIT;
