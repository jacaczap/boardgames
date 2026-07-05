import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

const PENDING_INVITE_KEY = "pending_invite_code";

export interface GroupPreview {
  groupId: string;
  groupName: string;
  expired: boolean;
}

export type GroupRole = "admin" | "approver" | "member";

export interface GroupMembership {
  groupId: string;
  groupName: string;
  role: GroupRole;
  tier: string;
  memberLimit: number;
}

export interface GroupMember {
  userId: string;
  role: GroupRole;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

export interface GroupInvite {
  code: string;
  expiresAt: string;
}

// admin/approver may approve meetings — mirrors the can_approve() RLS helper.
export function roleCanApprove(role: GroupRole | undefined | null): boolean {
  return role === "admin" || role === "approver";
}

// How many groups the current user belongs to. Drives the onboarding gate.
export async function getMembershipCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("group_members")
    .select("group_id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

// Every group the user belongs to, oldest membership first — feeds the group
// switcher and the currentGroupId selection.
export async function listGroups(userId: string): Promise<GroupMembership[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, joined_at, groups(id, name, tier, member_limit)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row: any) => {
      const g = Array.isArray(row.groups) ? row.groups[0] : row.groups;
      if (!g) return null;
      return {
        groupId: g.id as string,
        groupName: g.name as string,
        role: row.role as GroupRole,
        tier: g.tier as string,
        memberLimit: g.member_limit as number,
      };
    })
    .filter((m): m is GroupMembership => m !== null);
}

export async function createGroup(name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_group", { p_name: name });
  if (error) throw error;
  return data as string;
}

export async function previewGroupByCode(
  code: string,
): Promise<GroupPreview | null> {
  const { data, error } = await supabase.rpc("preview_group_by_code", {
    p_code: code,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    groupId: row.group_id,
    groupName: row.group_name,
    expired: row.expired,
  };
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_code: code,
  });
  if (error) throw error;
  return data as string;
}

// --- Group management (admin actions gated by RLS) --------------------------

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ name: name.trim() })
    .eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

// Remove the caller's own membership (leave a group).
export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, joined_at, user_id, profiles(id, name, surname, avatar_url)")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row: any): GroupMember => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        userId: row.user_id as string,
        role: row.role as GroupRole,
        name: (p?.name as string | null) ?? null,
        surname: (p?.surname as string | null) ?? null,
        avatarUrl: (p?.avatar_url as string | null) ?? null,
        joinedAt: row.joined_at as string,
      };
    })
    .filter((m) => !!m.userId);
}

export async function updateMemberRole(
  groupId: string,
  userId: string,
  role: GroupRole,
): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(
  groupId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

// The group's newest still-valid invite, or null.
export async function getActiveInvite(
  groupId: string,
): Promise<GroupInvite | null> {
  const { data, error } = await supabase
    .from("group_invites")
    .select("code, expires_at")
    .eq("group_id", groupId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { code: row.code as string, expiresAt: row.expires_at as string };
}

// Create a fresh invite for the group. The code is generated server-side by the
// create_group_invite RPC (admin-only, rate-limited).
export async function createInvite(groupId: string): Promise<GroupInvite> {
  const { data, error } = await supabase.rpc("create_group_invite", {
    p_group_id: groupId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Could not create invite");
  return { code: row.code as string, expiresAt: row.expires_at as string };
}

// Shareable invite URL for a group invite code (deep link + web).
export function buildInviteUrl(code: string): string {
  return Linking.createURL(`join/${code}`);
}

// Extract an invite code from an incoming deep link / URL, or null. Handles the
// custom scheme (boardgames://join/CODE, where "join" lands in hostname), web
// URLs (https://host/join/CODE) and the ?code= query form.
export function parseInviteCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    if (parsed.queryParams?.code) return String(parsed.queryParams.code);
    const segments = [parsed.hostname, parsed.path]
      .filter(Boolean)
      .join("/")
      .split("/")
      .filter(Boolean);
    const idx = segments.indexOf("join");
    if (idx >= 0 && segments[idx + 1]) {
      return decodeURIComponent(segments[idx + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

// A pending invite survives the register/login detour before joining.
export async function setPendingInviteCode(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, code);
}

export async function getPendingInviteCode(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_INVITE_KEY);
}

export async function clearPendingInviteCode(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY);
}

// Lightweight cross-screen signal so the root layout re-checks membership after
// a create/join without a full context provider.
type Listener = () => void;
const membershipListeners = new Set<Listener>();

export function signalMembershipChanged(): void {
  membershipListeners.forEach((fn) => fn());
}

export function onMembershipChanged(fn: Listener): () => void {
  membershipListeners.add(fn);
  return () => membershipListeners.delete(fn);
}
