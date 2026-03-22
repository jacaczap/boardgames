-- =============================================================================
-- Notifications: pg_cron jobs, new-user trigger, push_tokens delete policy
-- =============================================================================
--
-- Prerequisites: store these secrets in Supabase Vault (run in SQL Editor):
--   SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
-- =============================================================================

-- Extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Allow users to delete their own push token (needed for logout cleanup)
create policy "push_tokens_delete" on public.push_tokens
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Helper: invoke an Edge Function from SQL using Vault secrets
-- ---------------------------------------------------------------------------

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
      'Authorization', 'Bearer ' || v_key
    ),
    body := payload
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cron: create-survey daily at 08:00 UTC
-- ---------------------------------------------------------------------------

select cron.schedule(
  'create-survey-daily',
  '0 8 * * *',
  $$select extensions.invoke_edge_function('create-survey');$$
);

-- ---------------------------------------------------------------------------
-- Cron: survey-reminder daily at 09:00 UTC
-- ---------------------------------------------------------------------------

select cron.schedule(
  'survey-reminder-daily',
  '0 9 * * *',
  $$select extensions.invoke_edge_function('survey-reminder');$$
);

-- ---------------------------------------------------------------------------
-- Cron: meeting-reminder daily at 07:00 UTC
-- ---------------------------------------------------------------------------

select cron.schedule(
  'meeting-reminder-daily',
  '0 7 * * *',
  $$select extensions.invoke_edge_function('meeting-reminder');$$
);

-- ---------------------------------------------------------------------------
-- Trigger: notify all users when a new profile is created
-- ---------------------------------------------------------------------------

create or replace function public.notify_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform extensions.invoke_edge_function(
    'new-user-notification',
    jsonb_build_object('user_id', new.id::text)
  );
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.notify_new_user();
