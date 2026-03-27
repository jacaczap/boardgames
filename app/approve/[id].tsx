import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ScrollView,
  RefreshControl,
  AppState,
  View,
  Platform,
} from "react-native";
import { showAlert } from "@/lib/alert";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { getDateLocale } from "@/lib/i18n";
import { useSignedUrls } from "@/lib/storage";
import { isPolishHoliday } from "@/lib/holidays";
import type {
  Meeting,
  BoardGame,
  Profile,
  DateOption,
  Vote,
  VoteDate,
  VoteGame,
} from "@/lib/types";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Badge, BadgeText } from "@/components/ui/badge";
import UserAvatar from "@/components/UserAvatar";

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function isPast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + "T00:00:00") < today;
}

type Mode = "approve" | "editing";

export default function ApproveScreen() {
  const { t } = useTranslation();
  const locale = getDateLocale();
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [allVoteDates, setAllVoteDates] = useState<VoteDate[]>([]);
  const [allVoteGames, setAllVoteGames] = useState<VoteGame[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("approve");

  const avatarPaths = useMemo(
    () => profiles.map((p) => p.avatar_url).filter((u): u is string => !!u),
    [profiles],
  );
  const avatarUrls = useSignedUrls("avatars", avatarPaths);

  const gameImagePaths = useMemo(
    () => games.map((g) => g.image_url).filter((u): u is string => !!u),
    [games],
  );
  const gameImageUrls = useSignedUrls("game-images", gameImagePaths);

  const voteUserMap = useMemo(
    () => new Map(allVotes.map((v) => [v.id, v.user_id])),
    [allVotes],
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const dateVoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vd of allVoteDates) {
      counts.set(vd.date_option_id, (counts.get(vd.date_option_id) ?? 0) + 1);
    }
    return counts;
  }, [allVoteDates]);

  const dateVoterProfiles = useMemo(() => {
    const map = new Map<string, Profile[]>();
    for (const vd of allVoteDates) {
      const userId = voteUserMap.get(vd.vote_id);
      if (!userId) continue;
      const p = profileMap.get(userId);
      if (!p) continue;
      const arr = map.get(vd.date_option_id) ?? [];
      arr.push(p);
      map.set(vd.date_option_id, arr);
    }
    return map;
  }, [allVoteDates, voteUserMap, profileMap]);

  const sortedDates = useMemo(() => {
    return dateOptions
      .filter((o) => !isPast(o.date))
      .sort((a, b) => {
        const ca = dateVoteCounts.get(a.id) ?? 0;
        const cb = dateVoteCounts.get(b.id) ?? 0;
        if (cb !== ca) return cb - ca;
        return a.date.localeCompare(b.date);
      });
  }, [dateOptions, dateVoteCounts]);

  const voterIdsForSelectedDate = useMemo(() => {
    if (!selectedDateId) return new Set<string>();
    const ids = new Set<string>();
    for (const vd of allVoteDates) {
      if (vd.date_option_id !== selectedDateId) continue;
      const userId = voteUserMap.get(vd.vote_id);
      if (userId) ids.add(userId);
    }
    return ids;
  }, [selectedDateId, allVoteDates, voteUserMap]);

  const gameVoteCountsForDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vg of allVoteGames) {
      const userId = voteUserMap.get(vg.vote_id);
      if (!userId || !voterIdsForSelectedDate.has(userId)) continue;
      counts.set(vg.game_id, (counts.get(vg.game_id) ?? 0) + 1);
    }
    return counts;
  }, [allVoteGames, voteUserMap, voterIdsForSelectedDate]);

  const gameVoterProfilesForDate = useMemo(() => {
    const map = new Map<string, Profile[]>();
    for (const vg of allVoteGames) {
      const userId = voteUserMap.get(vg.vote_id);
      if (!userId || !voterIdsForSelectedDate.has(userId)) continue;
      const p = profileMap.get(userId);
      if (!p) continue;
      const arr = map.get(vg.game_id) ?? [];
      arr.push(p);
      map.set(vg.game_id, arr);
    }
    return map;
  }, [allVoteGames, voteUserMap, voterIdsForSelectedDate, profileMap]);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const ca = gameVoteCountsForDate.get(a.id) ?? 0;
      const cb = gameVoteCountsForDate.get(b.id) ?? 0;
      if (cb !== ca) return cb - ca;
      return a.name.localeCompare(b.name);
    });
  }, [games, gameVoteCountsForDate]);

  const initialSelectionDone = useRef(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const [meetingRes, dateOptsRes, gamesRes, profilesRes, votesRes, voteDatesRes, voteGamesRes] =
        await Promise.all([
          supabase.from("meetings").select("*").eq("id", id).single(),
          supabase.from("date_options").select("*").eq("meeting_id", id).order("date"),
          supabase.from("board_games").select("*").order("name"),
          supabase.from("profiles").select("*"),
          supabase.from("votes").select("*").eq("meeting_id", id),
          supabase
            .from("vote_dates")
            .select("*, votes!inner(meeting_id)")
            .eq("votes.meeting_id", id),
          supabase
            .from("vote_games")
            .select("*, votes!inner(meeting_id)")
            .eq("votes.meeting_id", id),
        ]);

      const m = meetingRes.data as Meeting | null;
      setMeeting(m);
      setDateOptions((dateOptsRes.data as DateOption[]) ?? []);
      setGames((gamesRes.data as BoardGame[]) ?? []);
      setProfiles((profilesRes.data as Profile[]) ?? []);

      setAllVotes((votesRes.data as Vote[]) ?? []);
      setAllVoteDates(
        (voteDatesRes.data as (VoteDate & { votes: unknown })[])?.map(
          ({ votes: _, ...vd }) => vd,
        ) ?? [],
      );
      setAllVoteGames(
        (voteGamesRes.data as (VoteGame & { votes: unknown })[])?.map(
          ({ votes: _, ...vg }) => vg,
        ) ?? [],
      );

      if (m?.status === "approved" && edit) {
        setMode("editing");
        if (!initialSelectionDone.current) {
          initialSelectionDone.current = true;
          const chosenDateOpt = (dateOptsRes.data as DateOption[])?.find(
            (o) => o.date === m.chosen_date,
          );
          setSelectedDateId(chosenDateOpt?.id ?? null);
          setSelectedGameId(m.chosen_game_id ?? null);
        }
      } else if (m?.status === "voting") {
        setMode("approve");
      }
    } catch (e) {
      console.error("Failed to fetch approve data:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!loading && meeting?.status === "approved" && !edit) {
      router.replace("/(tabs)");
    }
  }, [loading, meeting?.status, edit, router]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchData();
    });
    return () => sub.remove();
  }, [fetchData]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`approve-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vote_dates" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vote_games" },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleApprove = async () => {
    if (!id || !selectedDateId || !selectedGameId || !currentUserId) return;
    const dateOpt = dateOptions.find((o) => o.id === selectedDateId);
    if (!dateOpt) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("meetings")
        .update({
          status: "approved",
          chosen_date: dateOpt.date,
          chosen_game_id: selectedGameId,
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "voting")
        .select();

      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      if (!data || data.length === 0) {
        showAlert(t("race.info"), t("approve.alreadyApproved"));
        await fetchData();
        return;
      }
      await fetchData();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("approve.failedApprove"));
    } finally {
      setSubmitting(false);
    }
  };

  const doUnapprove = async () => {
    try {
      const { data, error } = await supabase
        .from("meetings")
        .update({
          status: "voting",
          chosen_date: null,
          chosen_game_id: null,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", meeting!.id)
        .eq("status", "approved")
        .select();
      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      if (!data || data.length === 0) {
        showAlert(t("race.info"), t("approve.alreadyVoting"));
        await fetchData();
        return;
      }
      setSelectedDateId(null);
      setSelectedGameId(null);
      await fetchData();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("approve.failedUnapprove"));
    }
  };

  const handleUnapprove = () => {
    if (!meeting) return;
    showAlert(t("approve.unapproveTitle"), t("approve.unapproveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("approve.unapprove"), style: "destructive", onPress: doUnapprove },
    ]);
  };

  const handleSaveEdit = async () => {
    if (!id || !selectedDateId || !selectedGameId || !currentUserId) return;
    const dateOpt = dateOptions.find((o) => o.id === selectedDateId);
    if (!dateOpt) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("meetings")
        .update({
          chosen_date: dateOpt.date,
          chosen_game_id: selectedGameId,
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "approved")
        .select();

      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      if (!data || data.length === 0) {
        showAlert(t("race.info"), t("approve.noLongerApproved"));
        await fetchData();
        return;
      }
      router.back();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("approve.failedSave"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    router.back();
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  if (!meeting) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Text className="text-stone-500">{t("approve.notFound")}</Text>
      </Center>
    );
  }

  const isEditing = mode === "editing";

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <VStack space="lg">
        <VStack space="xs">
          <Heading size="xl">
            {isEditing
              ? t("approve.editMeetingNumber", { number: meeting.number })
              : t("approve.approveMeetingNumber", { number: meeting.number })}
          </Heading>
          <Text className="text-stone-500">
            {t("approve.votesSubmitted", { count: allVotes.length })}
          </Text>
        </VStack>

        {/* Step 1: Pick a date */}
        <VStack space="md">
          <Heading size="lg">
            <Ionicons name="calendar-outline" size={18} /> {t("approve.pickDate")}
          </Heading>
          {sortedDates.length === 0 && (
            <Text className="text-stone-400">{t("approve.noFutureDates")}</Text>
          )}
          {sortedDates.map((opt) => {
            const selected = selectedDateId === opt.id;
            const voteCount = dateVoteCounts.get(opt.id) ?? 0;
            const voters = dateVoterProfiles.get(opt.id) ?? [];
            const holiday = isPolishHoliday(opt.date);
            const d = new Date(opt.date + "T00:00:00");
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <Pressable key={opt.id} onPress={() => {
                setSelectedDateId(opt.id);
                setSelectedGameId(null);
              }}>
                <Card
                  variant="filled"
                  className={`p-3 border-2 ${
                    selected
                      ? "bg-amber-200 border-amber-600"
                      : "bg-stone-100 border-transparent"
                  }`}
                >
                  <HStack space="sm" className="items-center justify-between">
                    <HStack space="sm" className="items-center flex-1">
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color={selected ? "#b45309" : "#a8a29e"}
                      />
                      <VStack>
                        <HStack space="xs" className="items-center">
                          <Text className="font-medium text-stone-800">
                            {formatDate(opt.date, locale)}
                          </Text>
                          {holiday && (
                            <Badge action="warning">
                              <BadgeText action="warning">{t("approve.holiday")}</BadgeText>
                            </Badge>
                          )}
                          {opt.is_custom && (
                            <Badge action="info">
                              <BadgeText action="info">{t("approve.custom")}</BadgeText>
                            </Badge>
                          )}
                          {isWeekend && !holiday && (
                            <Badge action="muted">
                              <BadgeText action="muted">
                                {d.getDay() === 6 ? t("approve.sat") : t("approve.sun")}
                              </BadgeText>
                            </Badge>
                          )}
                        </HStack>
                        <Text size="xs" className="text-stone-500">
                          {t("approve.voteCount", { count: voteCount })}
                        </Text>
                      </VStack>
                    </HStack>
                    {voters.length > 0 && (
                      <HStack className="flex-row-reverse items-center shrink-0 ml-2">
                        {voters.slice(0, 5).map((p) => (
                          <Box key={p.id} className="-ml-2">
                            <UserAvatar profile={p} avatarUrls={avatarUrls} />
                          </Box>
                        ))}
                        {voters.length > 5 && (
                          <View className="-ml-2 w-8 h-8 rounded-full bg-stone-300 items-center justify-center border-2 border-stone-100">
                            <Text size="xs" className="text-stone-600 font-bold">
                              +{voters.length - 5}
                            </Text>
                          </View>
                        )}
                      </HStack>
                    )}
                  </HStack>
                </Card>
              </Pressable>
            );
          })}
        </VStack>

        {/* Step 2: Pick a game */}
        {selectedDateId && (
          <VStack space="md">
            <View className="h-px bg-stone-200" />
            <Heading size="lg">
              <Ionicons name="game-controller-outline" size={18} /> {t("approve.pickGame")}
            </Heading>
            <Text size="sm" className="text-stone-500">
              {t("approve.sortedByVotes")}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {sortedGames.map((game) => {
                const selected = selectedGameId === game.id;
                const voteCount = gameVoteCountsForDate.get(game.id) ?? 0;
                const voters = gameVoterProfilesForDate.get(game.id) ?? [];
                const imgUrl = game.image_url ? gameImageUrls.get(game.image_url) : undefined;

                return (
                  <Pressable key={game.id} onPress={() => setSelectedGameId(game.id)} style={{ width: "48.5%" }}>
                    <Card
                      variant="filled"
                      className={`overflow-hidden border-2 ${
                        selected
                          ? "bg-amber-200 border-amber-600"
                          : "bg-stone-100 border-transparent"
                      }`}
                    >
                      <VStack space="xs" className="items-center p-3">
                        <HStack className="w-full items-center" space="xs">
                          <Ionicons
                            name={selected ? "radio-button-on" : "radio-button-off"}
                            size={18}
                            color={selected ? "#b45309" : "#a8a29e"}
                          />
                          <View className="flex-1" />
                          {imgUrl ? (
                            <Image
                              source={{ uri: imgUrl, cacheKey: game.image_url ?? undefined }}
                              className="w-12 h-12 rounded-lg"
                              contentFit="cover"
                            />
                          ) : (
                            <Center className="w-12 h-12 rounded-lg bg-stone-300">
                              <Ionicons name="dice-outline" size={20} color="#a8a29e" />
                            </Center>
                          )}
                          <View className="flex-1" />
                        </HStack>
                        <Text className="font-semibold text-stone-800 text-center" numberOfLines={2}>
                          {game.name}
                        </Text>
                        <HStack space="xs" className="items-center flex-wrap justify-center">
                          {game.genre && (
                            <Badge action="info" size="sm">
                              <BadgeText action="info">{game.genre}</BadgeText>
                            </Badge>
                          )}
                          {(game.min_players != null || game.max_players != null) && (
                            <Text size="xs" className="text-stone-500">
                              {game.min_players ?? "?"}-{game.max_players ?? "?"}p
                            </Text>
                          )}
                        </HStack>
                        <Text size="xs" className="text-stone-500">
                          {t("approve.voteCount", { count: voteCount })}
                        </Text>
                        {voters.length > 0 && (
                          <HStack className="flex-row-reverse justify-center items-center">
                            {voters.slice(0, 4).map((p) => (
                              <Box key={p.id} className="-ml-2">
                                <UserAvatar key={p.id} profile={p} avatarUrls={avatarUrls} size="xs" />
                              </Box>
                            ))}
                            {voters.length > 4 && (
                              <View className="-ml-2 w-6 h-6 rounded-full bg-stone-300 items-center justify-center border-2 border-stone-100">
                                <Text size="2xs" className="text-stone-600 font-bold">
                                  +{voters.length - 4}
                                </Text>
                              </View>
                            )}
                          </HStack>
                        )}
                      </VStack>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </VStack>
        )}

        {/* Actions */}
        <VStack space="md" className="mt-4">
          <Button
            action="primary"
            size="lg"
            isDisabled={!selectedDateId || !selectedGameId || submitting}
            onPress={isEditing ? handleSaveEdit : handleApprove}
          >
            <ButtonText className="text-lg">
              {submitting
                ? t("common.saving")
                : isEditing
                  ? t("common.saveChanges")
                  : t("approve.approveMeeting")}
            </ButtonText>
          </Button>
          {isEditing ? (
            <Button variant="outline" action="secondary" onPress={handleCancelEdit}>
              <ButtonText>{t("common.cancel")}</ButtonText>
            </Button>
          ) : (
            <Button variant="outline" action="secondary" onPress={() => router.back()}>
              <ButtonText>{t("common.back")}</ButtonText>
            </Button>
          )}
        </VStack>
      </VStack>
    </ScrollView>
  );
}

