import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { getDateLocale } from "@/lib/i18n";
import { useSignedUrl, useSignedUrls } from "@/lib/storage";
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
import { Button, ButtonText, ButtonIcon } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";
import { Badge, BadgeText } from "@/components/ui/badge";
import { View } from "react-native";

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function formatDateLong(dateStr: string, locale: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isPast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + "T00:00:00") < today;
}

type Mode = "approve" | "approved" | "editing";

export default function ApproveScreen() {
  const { t } = useTranslation();
  const locale = getDateLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

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

  const chosenGame = useMemo(
    () => (meeting?.chosen_game_id ? games.find((g) => g.id === meeting.chosen_game_id) ?? null : null),
    [meeting, games],
  );
  const chosenGameImageUrl = useSignedUrl("game-images", chosenGame?.image_url);

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

  const attendees = useMemo(() => {
    if (!meeting?.chosen_date) return [];
    const chosenDateOpt = dateOptions.find((o) => o.date === meeting.chosen_date);
    if (!chosenDateOpt) return [];
    return dateVoterProfiles.get(chosenDateOpt.id) ?? [];
  }, [meeting, dateOptions, dateVoterProfiles]);

  const currentUserHasVoteForChosenDate = useMemo(() => {
    if (!currentUserId || !meeting?.chosen_date) return false;
    const chosenDateOpt = dateOptions.find((o) => o.date === meeting.chosen_date);
    if (!chosenDateOpt) return false;
    const voters = dateVoterProfiles.get(chosenDateOpt.id) ?? [];
    return voters.some((p) => p.id === currentUserId);
  }, [currentUserId, meeting, dateOptions, dateVoterProfiles]);

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

      if (m?.status === "approved") {
        setMode("approved");
      } else if (m?.status === "voting") {
        setMode("approve");
      }
    } catch (e) {
      console.error("Failed to fetch approve data:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

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
      const { error } = await supabase
        .from("meetings")
        .update({
          status: "approved",
          chosen_date: dateOpt.date,
          chosen_game_id: selectedGameId,
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      await fetchData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("approve.failedApprove"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnapprove = () => {
    if (!meeting) return;
    Alert.alert(t("approve.unapproveTitle"), t("approve.unapproveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("approve.unapprove"),
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("meetings")
              .update({
                status: "voting",
                chosen_date: null,
                chosen_game_id: null,
                approved_by: null,
                approved_at: null,
              })
              .eq("id", meeting.id);
            if (error) {
              Alert.alert(t("common.error"), error.message);
              return;
            }
            setSelectedDateId(null);
            setSelectedGameId(null);
            await fetchData();
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.message ?? t("approve.failedUnapprove"));
          }
        },
      },
    ]);
  };

  const handleLateJoin = async () => {
    if (!meeting || !currentUserId || !meeting.chosen_date || !meeting.chosen_game_id) return;

    const chosenDateOpt = dateOptions.find((o) => o.date === meeting.chosen_date);
    if (!chosenDateOpt) {
      Alert.alert(t("common.error"), t("approve.failedJoin"));
      return;
    }

    setSubmitting(true);
    try {
      const existingVote = allVotes.find((v) => v.user_id === currentUserId);
      if (existingVote) {
        await supabase.from("votes").delete().eq("id", existingVote.id);
      }

      const { data: newVote, error: voteError } = await supabase
        .from("votes")
        .insert({ meeting_id: meeting.id, user_id: currentUserId })
        .select()
        .single();

      if (voteError || !newVote) {
        Alert.alert(t("common.error"), voteError?.message ?? t("approve.failedJoin"));
        return;
      }

      const [dRes, gRes] = await Promise.all([
        supabase.from("vote_dates").insert({
          vote_id: newVote.id,
          date_option_id: chosenDateOpt.id,
        }),
        supabase.from("vote_games").insert({
          vote_id: newVote.id,
          game_id: meeting.chosen_game_id,
        }),
      ]);

      if (dRes.error) {
        Alert.alert(t("common.error"), dRes.error.message);
        return;
      }
      if (gRes.error) {
        Alert.alert(t("common.error"), gRes.error.message);
        return;
      }

      await fetchData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("approve.failedJoin"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditMeeting = () => {
    if (!meeting) return;
    const chosenDateOpt = dateOptions.find((o) => o.date === meeting.chosen_date);
    setSelectedDateId(chosenDateOpt?.id ?? null);
    setSelectedGameId(meeting.chosen_game_id ?? null);
    setMode("editing");
  };

  const handleSaveEdit = async () => {
    if (!id || !selectedDateId || !selectedGameId || !currentUserId) return;
    const dateOpt = dateOptions.find((o) => o.id === selectedDateId);
    if (!dateOpt) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({
          chosen_date: dateOpt.date,
          chosen_game_id: selectedGameId,
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      await fetchData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("approve.failedSave"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedDateId(null);
    setSelectedGameId(null);
    setMode("approved");
  };

  const handleAddToCalendar = async () => {
    if (!meeting?.chosen_date || addingToCalendar) return;
    setAddingToCalendar(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("approve.permissionDenied"), t("approve.calendarAccessRequired"));
        return;
      }

      let calendarId: string | undefined;
      if (Platform.OS === "ios") {
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        calendarId = defaultCal.id;
      } else if (Platform.OS === "android") {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const primary = calendars.find(
          (c) => c.isPrimary || c.accessLevel === Calendar.CalendarAccessLevel.OWNER,
        );
        calendarId = primary?.id ?? calendars[0]?.id;
      }

      if (!calendarId) {
        Alert.alert(t("common.error"), t("approve.noCalendarFound"));
        return;
      }

      const title = chosenGame?.name
        ? t("approve.calendarTitle", { game: chosenGame.name })
        : t("approve.calendarTitleDefault");
      const startDate = new Date(meeting.chosen_date + "T00:00:00");
      const endDate = new Date(meeting.chosen_date + "T23:59:59");

      await Calendar.createEventAsync(calendarId, {
        title,
        startDate,
        endDate,
        allDay: true,
      });
      Alert.alert(t("approve.calendarDone"), t("approve.calendarAdded"));
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("approve.failedCalendar"));
    } finally {
      setAddingToCalendar(false);
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-white">
        <Spinner />
      </Center>
    );
  }

  if (!meeting) {
    return (
      <Center className="flex-1 bg-white">
        <Text className="text-gray-500">{t("approve.notFound")}</Text>
      </Center>
    );
  }

  if (mode === "approved" && meeting.status === "approved") {
    return (
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <VStack space="lg">
          <Card variant="filled" className="bg-green-50 overflow-hidden">
            {chosenGameImageUrl && (
              <Image
                source={{ uri: chosenGameImageUrl }}
                className="w-full h-48"
                resizeMode="cover"
              />
            )}
            <VStack space="md" className="p-5">
              <HStack space="xs" className="items-center">
                <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                <Text className="text-green-700 font-medium">
                  {t("approve.meetingApproved", { number: meeting.number })}
                </Text>
              </HStack>

              <Heading size="2xl">
                {chosenGame?.name ?? t("approve.noGameSelected")}
              </Heading>

              {meeting.chosen_date && (
                <HStack space="xs" className="items-center">
                  <Ionicons name="calendar" size={16} color="#6b7280" />
                  <Text className="text-gray-600">
                    {formatDateLong(meeting.chosen_date, locale)}
                  </Text>
                </HStack>
              )}

              {chosenGame?.description && (
                <Text className="text-gray-600">{chosenGame.description}</Text>
              )}

              <HStack space="md" className="flex-wrap mt-1">
                {meeting.chosen_date && Platform.OS !== "web" && (
                  <Button
                    variant="outline"
                    action="primary"
                    size="sm"
                    onPress={handleAddToCalendar}
                    isDisabled={addingToCalendar}
                    className="bg-blue-50 border-0"
                  >
                    <ButtonIcon as={Ionicons} name="calendar-outline" size={18} />
                    <ButtonText className="text-blue-700 ml-1 text-sm">
                      {addingToCalendar ? t("approve.addingToCalendar") : t("approve.addToCalendar")}
                    </ButtonText>
                  </Button>
                )}
                {chosenGame?.tutorial_url && (
                  <Button
                    variant="outline"
                    action="negative"
                    size="sm"
                    onPress={() => Linking.openURL(chosenGame.tutorial_url!)}
                    className="bg-red-50 border-0"
                  >
                    <ButtonIcon as={Ionicons} name="play-circle-outline" size={18} />
                    <ButtonText className="text-red-700 ml-1 text-sm">{t("approve.tutorial")}</ButtonText>
                  </Button>
                )}
                {chosenGame?.spotify_playlist_url && (
                  <Button
                    variant="outline"
                    action="positive"
                    size="sm"
                    onPress={() => Linking.openURL(chosenGame.spotify_playlist_url!)}
                    className="bg-green-100 border-0"
                  >
                    <ButtonIcon as={Ionicons} name="musical-notes-outline" size={18} />
                    <ButtonText className="text-green-700 ml-1 text-sm">{t("approve.playlist")}</ButtonText>
                  </Button>
                )}
              </HStack>
            </VStack>
          </Card>

          {attendees.length > 0 && (
            <VStack space="sm">
              <Heading size="md">{t("approve.attendeesCount", { count: attendees.length })}</Heading>
              <HStack space="md" className="flex-wrap">
                {attendees.map((p) => (
                  <VStack key={p.id} space="xs" className="items-center">
                    <SmallAvatar profile={p} avatarUrls={avatarUrls} />
                    <Text size="xs" className="text-gray-500">{p.name}</Text>
                  </VStack>
                ))}
              </HStack>
            </VStack>
          )}

          <View className="h-px bg-gray-200" />

          {!currentUserHasVoteForChosenDate && (
            <Button
              action="primary"
              size="lg"
              isDisabled={submitting}
              onPress={handleLateJoin}
            >
              <ButtonText>
                {submitting ? t("approve.joining") : t("approve.iWillAttend")}
              </ButtonText>
            </Button>
          )}

          <Button
            variant="outline"
            action="primary"
            onPress={handleEditMeeting}
          >
            <ButtonText>{t("approve.editMeeting")}</ButtonText>
          </Button>

          <Button
            variant="outline"
            action="negative"
            onPress={handleUnapprove}
          >
            <ButtonText>{t("approve.unapprove")}</ButtonText>
          </Button>
        </VStack>
      </ScrollView>
    );
  }

  const isEditing = mode === "editing";

  return (
    <ScrollView
      className="flex-1 bg-white"
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
          <Text className="text-gray-500">
            {t("approve.votesSubmitted", { count: allVotes.length })}
          </Text>
        </VStack>

        {/* Step 1: Pick a date */}
        <VStack space="md">
          <Heading size="lg">
            <Ionicons name="calendar-outline" size={18} /> {t("approve.pickDate")}
          </Heading>
          {sortedDates.length === 0 && (
            <Text className="text-gray-400">{t("approve.noFutureDates")}</Text>
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
                  className={`p-3 ${
                    selected
                      ? "bg-blue-100 border-2 border-blue-500"
                      : "bg-gray-50"
                  }`}
                >
                  <HStack space="sm" className="items-center justify-between">
                    <HStack space="sm" className="items-center flex-1">
                      <Ionicons
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={22}
                        color={selected ? "#2563eb" : "#9ca3af"}
                      />
                      <VStack>
                        <HStack space="xs" className="items-center">
                          <Text className="font-medium text-gray-800">
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
                        <Text size="xs" className="text-gray-500">
                          {t("approve.voteCount", { count: voteCount })}
                        </Text>
                      </VStack>
                    </HStack>
                    {voters.length > 0 && (
                      <HStack space="xs" className="items-center">
                        <HStack className="flex-row-reverse">
                          {voters.slice(0, 5).map((p) => (
                            <Box key={p.id} className="-ml-2">
                              <SmallAvatar profile={p} avatarUrls={avatarUrls} />
                            </Box>
                          ))}
                        </HStack>
                        {voters.length > 5 && (
                          <Text size="xs" className="text-gray-400">
                            +{voters.length - 5}
                          </Text>
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
            <View className="h-px bg-gray-200" />
            <Heading size="lg">
              <Ionicons name="game-controller-outline" size={18} /> {t("approve.pickGame")}
            </Heading>
            <Text size="sm" className="text-gray-500">
              {t("approve.sortedByVotes")}
            </Text>
            {sortedGames.map((game) => {
              const selected = selectedGameId === game.id;
              const voteCount = gameVoteCountsForDate.get(game.id) ?? 0;
              const voters = gameVoterProfilesForDate.get(game.id) ?? [];
              const imgUrl = game.image_url ? gameImageUrls.get(game.image_url) : undefined;

              return (
                <Pressable key={game.id} onPress={() => setSelectedGameId(game.id)}>
                  <Card
                    variant="filled"
                    className={`overflow-hidden ${
                      selected
                        ? "bg-blue-100 border-2 border-blue-500"
                        : "bg-gray-50"
                    }`}
                  >
                    <HStack space="md" className="items-center p-3">
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          className="w-14 h-14 rounded-lg"
                          resizeMode="cover"
                        />
                      ) : (
                        <Center className="w-14 h-14 rounded-lg bg-gray-200">
                          <Ionicons name="dice-outline" size={22} color="#9ca3af" />
                        </Center>
                      )}
                      <VStack className="flex-1" space="xs">
                        <HStack space="sm" className="items-center">
                          <Ionicons
                            name={selected ? "radio-button-on" : "radio-button-off"}
                            size={22}
                            color={selected ? "#2563eb" : "#9ca3af"}
                          />
                          <Text className="font-semibold text-gray-800 flex-1">
                            {game.name}
                          </Text>
                        </HStack>
                        <HStack space="sm" className="items-center flex-wrap">
                          {game.genre && (
                            <Badge action="info">
                              <BadgeText action="info">{game.genre}</BadgeText>
                            </Badge>
                          )}
                          {(game.min_players != null || game.max_players != null) && (
                            <Text size="xs" className="text-gray-500">
                              {game.min_players ?? "?"}-{game.max_players ?? "?"} {t("common.players")}
                            </Text>
                          )}
                          <Text size="xs" className="text-gray-500">
                            {t("approve.voteCount", { count: voteCount })}
                          </Text>
                        </HStack>
                      </VStack>
                      {voters.length > 0 && (
                        <VStack space="xs" className="items-center">
                          {voters.slice(0, 3).map((p) => (
                            <SmallAvatar key={p.id} profile={p} avatarUrls={avatarUrls} />
                          ))}
                          {voters.length > 3 && (
                            <Text size="xs" className="text-gray-400">
                              +{voters.length - 3}
                            </Text>
                          )}
                        </VStack>
                      )}
                    </HStack>
                  </Card>
                </Pressable>
              );
            })}
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

interface SmallAvatarProps {
  profile: Profile;
  avatarUrls: Map<string, string>;
}

const SmallAvatar: React.FC<SmallAvatarProps> = React.memo(({ profile, avatarUrls }) => {
  const uri = profile.avatar_url ? avatarUrls.get(profile.avatar_url) : undefined;
  return (
    <Avatar size="sm">
      {uri ? (
        <AvatarImage source={{ uri }} />
      ) : (
        <AvatarFallbackText>
          {(profile.name?.[0] ?? "").toUpperCase()}
          {(profile.surname?.[0] ?? "").toUpperCase()}
        </AvatarFallbackText>
      )}
    </Avatar>
  );
});
