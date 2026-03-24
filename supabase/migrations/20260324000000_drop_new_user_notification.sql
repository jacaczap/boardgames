-- Drop the new-user-notification trigger and function (feature removed)

drop trigger if exists on_profile_created on public.profiles;
drop function if exists public.notify_new_user();
