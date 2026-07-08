import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface UserToken {
  user_id: string;
  token: string;
}

export async function getGroupName(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string> {
  const { data } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();
  return (data?.name as string) ?? "";
}

export async function getGroupMemberIds(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  return (data ?? []).map((m) => m.user_id as string);
}

export async function getGroupAdminIds(
  supabase: SupabaseClient,
  groupId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("role", "admin");
  return (data ?? []).map((m) => m.user_id as string);
}

export async function getTokensForUsers(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<UserToken[]> {
  if (!userIds.length) return [];
  const { data } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);
  return (data ?? []) as UserToken[];
}
