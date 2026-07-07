-- =============================================================================
-- Add a customizable per-group icon (emoji stored as plain text).
-- Nullable and backward-compatible: older clients simply ignore it and fall
-- back to the default people icon. Admin-only writes are already covered by the
-- existing groups_update RLS policy.
-- =============================================================================

alter table public.groups add column icon text;
