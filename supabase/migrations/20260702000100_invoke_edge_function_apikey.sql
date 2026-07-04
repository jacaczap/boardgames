-- =============================================================================
-- invoke_edge_function: send the API key via the `apikey` header
-- =============================================================================
-- New Supabase API keys (sb_publishable_… / sb_secret_…) are NOT JWTs, so they
-- cannot be sent as `Authorization: Bearer`. The correct transport is the
-- `apikey` header. Cron-invoked functions all run with verify_jwt = false
-- (see supabase/config.toml), so the header is only about identifying the
-- caller / matching the new key format — it works with legacy service_role
-- keys too. The Vault secret name stays `service_role_key` so PROD (which
-- already has it) does not need its Vault touched; store the DEV/PROD secret
-- key under that name.
-- =============================================================================

create or replace function extensions.invoke_edge_function(
  function_name text,
  payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;

  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'service_role_key' limit 1;

  return net.http_post(
    url := v_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_key
    ),
    body := payload
  );
end;
$$;
