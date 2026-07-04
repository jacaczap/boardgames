-- =============================================================================
-- app_config: remote-controlled minimum supported app version (force-update)
-- =============================================================================
-- Native builds check this on startup and hard-block if their running version
-- is below min_version, so a breaking backend/RLS/schema change can lock out
-- old installs without shipping a new release. One row per platform. Publicly
-- readable (checked before login), writable only via service_role / dashboard.
-- Web is exempt (always current on Vercel) and never reads this.
-- =============================================================================

create table public.app_config (
  platform text primary key,
  min_version text not null,
  store_url text,
  updated_at timestamptz not null default now()
);

-- Public read: the gate runs before authentication, so anon must see it too.
grant select on public.app_config to anon, authenticated, service_role;
-- Writes stay server-side (dashboard / service_role); no client grant for those.
grant insert, update, delete on public.app_config to service_role;

alter table public.app_config enable row level security;

create policy "app_config public read"
  on public.app_config for select
  to anon, authenticated
  using (true);

insert into public.app_config (platform, min_version, store_url) values
  ('android', '1.0.0', 'https://play.google.com/store/apps/details?id=com.jacaczap.boardgames'),
  ('ios', '1.0.0', null);
