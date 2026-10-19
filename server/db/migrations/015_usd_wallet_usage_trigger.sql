-- Keep usage metering atomic with the USD wallet charge ledger.
-- The wallet repository writes the complete request metadata to the ledger;
-- this trigger records the corresponding usage row in the same transaction.

BEGIN;

CREATE OR REPLACE FUNCTION record_usd_wallet_charge_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  details JSONB;
  in_tokens BIGINT;
  cached_tokens BIGINT;
  cache_write_tokens BIGINT;
  out_tokens BIGINT;
BEGIN
  IF NEW.type <> 'charge' OR NEW.reference_type <> 'usd_wallet_reservation' THEN
    RETURN NEW;
  END IF;

  details := COALESCE(NEW.metadata, '{}'::jsonb);
  in_tokens := GREATEST(COALESCE(NULLIF(details->>'inputTokens', '')::BIGINT, 0), 0);
  cached_tokens := GREATEST(COALESCE(NULLIF(details->>'cachedInputTokens', '')::BIGINT, 0), 0);
  cache_write_tokens := GREATEST(COALESCE(NULLIF(details->>'cacheWriteInputTokens', '')::BIGINT, 0), 0);
  out_tokens := GREATEST(COALESCE(NULLIF(details->>'outputTokens', '')::BIGINT, 0), 0);

  INSERT INTO usage_records (
    workspace_id, api_key_id, service, model, public_model, provider, provider_model,
    credits, request_id, status, input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens,
    total_tokens, provider_cost_usd, margin_multiplier, charged_usd,
    reservation_credits, refunded_credits
  ) VALUES (
    NEW.workspace_id,
    NULLIF(details->>'apiKeyId', '')::UUID,
    COALESCE(NULLIF(details->>'service', ''), 'unknown'),
    NULLIF(details->>'publicModel', ''),
    NULLIF(details->>'publicModel', ''),
    NULLIF(details->>'provider', ''),
    NULLIF(details->>'providerModel', ''),
    0,
    NULLIF(details->>'requestId', ''),
    'success',
    in_tokens,
    LEAST(cached_tokens, in_tokens),
    LEAST(cache_write_tokens, GREATEST(in_tokens - LEAST(cached_tokens, in_tokens), 0)),
    out_tokens,
    in_tokens + out_tokens,
    GREATEST(COALESCE(NULLIF(details->>'providerCostUsd', '')::NUMERIC, 0), 0),
    GREATEST(COALESCE(NULLIF(details->>'marginMultiplier', '')::NUMERIC, 0), 0),
    ABS(NEW.amount_usd),
    0,
    0
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usd_wallet_charge_usage_trigger ON usd_wallet_ledger;
CREATE TRIGGER usd_wallet_charge_usage_trigger
AFTER INSERT ON usd_wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION record_usd_wallet_charge_usage();

COMMIT;
