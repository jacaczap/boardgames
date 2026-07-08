import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "./supabase";

export type ReportContentType = "board_game" | "profile" | "group";

export type ReportReason =
  | "spam"
  | "offensive"
  | "harassment"
  | "inappropriate_image"
  | "other";

export const REPORT_REASONS: ReportReason[] = [
  "spam",
  "offensive",
  "harassment",
  "inappropriate_image",
  "other",
];

export type ReportStatus = "open" | "resolved" | "dismissed";

export interface ContentReport {
  id: string;
  reporterId: string;
  reporterName: string | null;
  groupId: string;
  contentType: ReportContentType;
  contentId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}

// --- Reporting ---------------------------------------------------------------

export async function reportContent(params: {
  groupId: string;
  contentType: ReportContentType;
  contentId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    group_id: params.groupId,
    content_type: params.contentType,
    content_id: params.contentId,
    reason: params.reason,
    details: params.details?.trim() || null,
  });
  if (error) throw error;
}

// --- Admin moderation --------------------------------------------------------

export async function listOpenReports(
  groupId: string,
): Promise<ContentReport[]> {
  const { data, error } = await supabase
    .from("content_reports")
    .select(
      "id, reporter_id, group_id, content_type, content_id, reason, details, status, created_at, reporter:profiles!reporter_id(name, surname)",
    )
    .eq("group_id", groupId)
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any): ContentReport => {
    const p = Array.isArray(row.reporter) ? row.reporter[0] : row.reporter;
    const name = [p?.name, p?.surname].filter(Boolean).join(" ") || null;
    return {
      id: row.id,
      reporterId: row.reporter_id,
      reporterName: name,
      groupId: row.group_id,
      contentType: row.content_type,
      contentId: row.content_id,
      reason: row.reason,
      details: row.details ?? null,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

export async function resolveReport(
  reportId: string,
  status: Exclude<ReportStatus, "open">,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("content_reports")
    .update({
      status,
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (error) throw error;
}

// --- User blocks -------------------------------------------------------------

export interface BlockedProfile {
  userId: string;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
}

export async function listBlockedProfiles(): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, blocked:profiles!blocked_id(name, surname, avatar_url)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any): BlockedProfile => {
    const p = Array.isArray(row.blocked) ? row.blocked[0] : row.blocked;
    return {
      userId: row.blocked_id,
      name: p?.name ?? null,
      surname: p?.surname ?? null,
      avatarUrl: p?.avatar_url ?? null,
    };
  });
}

async function insertBlock(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  if (error) throw error;
}

async function deleteBlock(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

// --- Block context (app-wide masking of blocked users) -----------------------

interface BlockContextValue {
  blockedIds: Set<string>;
  isBlocked: (userId: string | null | undefined) => boolean;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const BlockContext = createContext<BlockContextValue | undefined>(undefined);

export function BlockProvider({ children }: { children: React.ReactNode }) {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const userIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!userIdRef.current) {
      setBlockedIds(new Set());
      return;
    }
    try {
      const { data } = await supabase.from("user_blocks").select("blocked_id");
      setBlockedIds(new Set((data ?? []).map((r: any) => r.blocked_id)));
    } catch {
      // Leave the previous state on a transient failure.
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      userIdRef.current = data.session?.user?.id ?? null;
      load();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newId = session?.user?.id ?? null;
      if (newId === userIdRef.current) return;
      userIdRef.current = newId;
      load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const block = useCallback(
    async (userId: string) => {
      await insertBlock(userId);
      setBlockedIds((prev) => new Set(prev).add(userId));
    },
    [],
  );

  const unblock = useCallback(async (userId: string) => {
    await deleteBlock(userId);
    setBlockedIds((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const value = useMemo<BlockContextValue>(
    () => ({
      blockedIds,
      isBlocked: (id) => (id ? blockedIds.has(id) : false),
      block,
      unblock,
      refresh: load,
    }),
    [blockedIds, block, unblock, load],
  );

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

export function useBlocks(): BlockContextValue {
  const ctx = useContext(BlockContext);
  if (!ctx) throw new Error("useBlocks must be used within a BlockProvider");
  return ctx;
}
