import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import {
  listGroups,
  onMembershipChanged,
  roleCanApprove,
  type GroupMembership,
} from "./groups";

const CURRENT_GROUP_KEY = "current_group_id";

interface GroupContextValue {
  currentGroupId: string | null;
  currentGroup: GroupMembership | null;
  groups: GroupMembership[];
  loading: boolean;
  canApprove: boolean;
  setCurrentGroup: (groupId: string) => void;
  refresh: () => Promise<void>;
}

const GroupContext = createContext<GroupContextValue | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  // Reload the membership list and reconcile the current selection: keep it if
  // still valid, otherwise fall back to the persisted choice, otherwise the
  // first (oldest) group.
  const load = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) {
      setGroups([]);
      setCurrentGroupId(null);
      setLoading(false);
      return;
    }
    try {
      const [list, stored] = await Promise.all([
        listGroups(userId),
        AsyncStorage.getItem(CURRENT_GROUP_KEY),
      ]);
      setGroups(list);
      setCurrentGroupId((prev) => {
        const desired = prev ?? stored;
        if (desired && list.some((g) => g.groupId === desired)) return desired;
        return list[0]?.groupId ?? null;
      });
    } catch {
      // Leave the previous state untouched on a transient failure.
    } finally {
      setLoading(false);
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
      setLoading(true);
      load();
    });

    return () => subscription.unsubscribe();
  }, [load]);

  // A create/join elsewhere signals membership changed — pull the fresh list.
  useEffect(() => onMembershipChanged(load), [load]);

  useEffect(() => {
    if (currentGroupId) AsyncStorage.setItem(CURRENT_GROUP_KEY, currentGroupId);
  }, [currentGroupId]);

  const setCurrentGroup = useCallback((groupId: string) => {
    setCurrentGroupId(groupId);
  }, []);

  const currentGroup = useMemo(
    () => groups.find((g) => g.groupId === currentGroupId) ?? null,
    [groups, currentGroupId],
  );

  const canApprove = useMemo(
    () => roleCanApprove(currentGroup?.role),
    [currentGroup?.role],
  );

  const value = useMemo<GroupContextValue>(
    () => ({
      currentGroupId,
      currentGroup,
      groups,
      loading,
      canApprove,
      setCurrentGroup,
      refresh: load,
    }),
    [currentGroupId, currentGroup, groups, loading, canApprove, setCurrentGroup, load],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return ctx;
}
