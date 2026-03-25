import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Linking,
  RefreshControl,
  Alert,
  Platform,
  AppState,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { getDateLocale } from "@/lib/i18n";
import { useSignedUrl, useSignedUrls } from "@/lib/storage";
import type { Meeting, BoardGame, Profile, Vote, VoteDate, VoteGame } from "@/lib/types";
import SurveyContent from "@/components/SurveyContent";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText, ButtonIcon } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Image } from "@/components/ui/image";
import { Card } from "@/components/ui/card";
import { Box } from "@/components/ui/box";
import { AvatarGroup } from "@/components/ui/avatar";
import UserAvatar from "@/components/UserAvatar";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [game, setGame] = useState<BoardGame | null>(null);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [joiningMeeting, setJoiningMeeting] = useState(false);
  const [nextSurveyDate, setNextSurveyDate] = useState<Date | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chosenDateOptionId, setChosenDateOptionId] = useState<string | null>(null);
  const [allVoterProfiles, setAllVoterProfiles] = useState<Profile[]>([]);
  const [votingResults, setVotingResults] = useState<{
    dates: { date: string; count: number; isChosen: boolean; voters: Profile[] }[];
    games: { name: string; count: number; isChosen: boolean; voters: Profile[] }[];
    totalVotes: number;
  } | null>(null);

  const gameImageUrl = useSignedUrl("game-images", game?.image_url);
  const avatarPaths = useMemo(() => {
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const p of [...attendees, ...allVoterProfiles]) {
      if (p.avatar_url && !seen.has(p.avatar_url)) {
        seen.add(p.avatar_url);
        paths.push(p.avatar_url);
      }
    }
    return paths;
  }, [attendees, allVoterProfiles]);
  const avatarUrls = useSignedUrls("avatars", avatarPaths);

  const fetchData = useCallback(async () => {
    try {
      const { data: meetings } = await supabase
        .from("meetings")
        .select("*")
        .in("status", ["voting", "approved"])
        .order("number", { ascending: false })
        .limit(1);

      const m = (meetings?.[0] as Meeting) ?? null;
      setMeeting(m);

      if (!m) {
        setGame(null);
        setAttendees([]);
        setAllVoterProfiles([]);
        setVotingResults(null);

        const { data: lastCompleted } = await supabase
          .from("meetings")
          .select("chosen_date")
          .eq("status", "completed")
          .order("number", { ascending: false })
          .limit(1);

        if (lastCompleted?.[0]?.chosen_date) {
          const [y, mo, d] = lastCompleted[0].chosen_date.split("-").map(Number);
          const surveyAvail = new Date(Date.UTC(y, mo - 1, d + 7));
          setNextSurveyDate(surveyAvail);
        } else {
          setNextSurveyDate(null);
        }
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      if (m.status === "approved" && m.chosen_game_id) {
        const { data: gameData } = await supabase
          .from("board_games")
          .select("*")
          .eq("id", m.chosen_game_id)
          .single();
        setGame(gameData as BoardGame | null);

        if (m.chosen_date) {
          const { data: dateOpt } = await supabase
            .from("date_options")
            .select("id")
            .eq("meeting_id", m.id)
            .eq("date", m.chosen_date)
            .single();

          setChosenDateOptionId(dateOpt?.id ?? null);

          if (dateOpt) {
            const { data: vds } = await supabase
              .from("vote_dates")
              .select("vote_id")
              .eq("date_option_id", dateOpt.id);

            if (vds?.length) {
              const { data: votes } = await supabase
                .from("votes")
                .select("user_id")
                .in(
                  "id",
                  vds.map((v) => v.vote_id),
                );

              if (votes?.length) {
                const { data: profiles } = await supabase
                  .from("profiles")
                  .select("id, name, surname, avatar_url")
                  .in(
                    "id",
                    votes.map((v) => v.user_id),
                  );
                setAttendees((profiles as Profile[]) ?? []);
              }
            }
          }
        }

        const [dateOptsRes, votesRes, voteDatesRes, voteGamesRes, allGamesRes, profilesRes] =
          await Promise.all([
            supabase.from("date_options").select("id, date").eq("meeting_id", m.id).order("date"),
            supabase.from("votes").select("id, user_id").eq("meeting_id", m.id),
            supabase
              .from("vote_dates")
              .select("date_option_id, vote_id, votes!inner(meeting_id)")
              .eq("votes.meeting_id", m.id),
            supabase
              .from("vote_games")
              .select("game_id, vote_id, votes!inner(meeting_id)")
              .eq("votes.meeting_id", m.id),
            supabase.from("board_games").select("id, name"),
            supabase.from("profiles").select("id, name, surname, avatar_url"),
          ]);

        const voteUserMap = new Map(
          ((votesRes.data ?? []) as { id: string; user_id: string }[]).map((v) => [v.id, v.user_id]),
        );
        const profileMap = new Map(
          ((profilesRes.data ?? []) as Profile[]).map((p) => [p.id, p]),
        );

        const voterUserIds = new Set(
          ((votesRes.data ?? []) as { id: string; user_id: string }[]).map((v) => v.user_id),
        );
        setAllVoterProfiles(
          [...voterUserIds].map((uid) => profileMap.get(uid)).filter((p): p is Profile => !!p),
        );

        const dateCountMap = new Map<string, number>();
        const dateVoterMap = new Map<string, Profile[]>();
        for (const vd of (voteDatesRes.data ?? []) as { date_option_id: string; vote_id: string }[]) {
          dateCountMap.set(vd.date_option_id, (dateCountMap.get(vd.date_option_id) ?? 0) + 1);
          const userId = voteUserMap.get(vd.vote_id);
          const profile = userId ? profileMap.get(userId) : undefined;
          if (profile) {
            const arr = dateVoterMap.get(vd.date_option_id) ?? [];
            arr.push(profile);
            dateVoterMap.set(vd.date_option_id, arr);
          }
        }
        const dateOpts = (dateOptsRes.data ?? []) as { id: string; date: string }[];
        const dateTallies = dateOpts
          .map((o) => ({ date: o.date, count: dateCountMap.get(o.id) ?? 0, isChosen: o.date === m.chosen_date, voters: dateVoterMap.get(o.id) ?? [] }))
          .filter((d) => d.count > 0)
          .sort((a, b) => b.count - a.count);

        const gameCountMap = new Map<string, number>();
        const gameVoterMap = new Map<string, Profile[]>();
        for (const vg of (voteGamesRes.data ?? []) as { game_id: string; vote_id: string }[]) {
          gameCountMap.set(vg.game_id, (gameCountMap.get(vg.game_id) ?? 0) + 1);
          const userId = voteUserMap.get(vg.vote_id);
          const profile = userId ? profileMap.get(userId) : undefined;
          if (profile) {
            const arr = gameVoterMap.get(vg.game_id) ?? [];
            arr.push(profile);
            gameVoterMap.set(vg.game_id, arr);
          }
        }
        const gameNameMap = new Map(
          ((allGamesRes.data ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]),
        );
        const gameTallies = [...gameCountMap.entries()]
          .map(([gid, count]) => ({ name: gameNameMap.get(gid) ?? "?", count, isChosen: gid === m.chosen_game_id, voters: gameVoterMap.get(gid) ?? [] }))
          .sort((a, b) => b.count - a.count);

        setVotingResults({ dates: dateTallies, games: gameTallies, totalVotes: votesRes.data?.length ?? 0 });
      }

      if (m.status === "voting") {
        setGame(null);
        setAttendees([]);
        setAllVoterProfiles([]);
        setVotingResults(null);
      }
    } catch (e) {
      console.error("Failed to fetch home data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

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
    const channel = supabase
      .channel("home-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings" },
        () => fetchData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const [unapproving, setUnapproving] = useState(false);

  const handleUnapprove = () => {
    if (!meeting || unapproving) return;
    Alert.alert(t("home.unapproveTitle"), t("home.unapproveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("home.unapprove"),
        style: "destructive",
        onPress: async () => {
          setUnapproving(true);
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
              .eq("id", meeting.id)
              .eq("status", "approved")
              .select();
            if (error) {
              Alert.alert(t("common.error"), error.message);
              return;
            }
            if (!data || data.length === 0) {
              Alert.alert(t("race.info"), t("race.alreadyVoting"));
              fetchData();
              return;
            }
            fetchData();
          } catch (e: any) {
            Alert.alert(t("common.error"), e?.message ?? t("home.failedUnapprove"));
          } finally {
            setUnapproving(false);
          }
        },
      },
    ]);
  };

  const handleCreateSurvey = async () => {
    if (creatingSurvey) return;
    setCreatingSurvey(true);
    try {
      const { count } = await supabase
        .from("meetings")
        .select("*", { count: "exact", head: true })
        .in("status", ["voting", "approved"]);
      if (count && count > 0) {
        Alert.alert(t("race.info"), t("home.surveyAlreadyExists"));
        fetchData();
        return;
      }

      const { error } = await supabase.rpc("create_next_survey");
      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      fetchData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("home.failedCreateSurvey"));
    } finally {
      setCreatingSurvey(false);
    }
  };

  const isAttending = attendees.some((p) => p.id === currentUserId);

  const handleLateJoin = async () => {
    if (!meeting || !currentUserId || !meeting.chosen_date || !meeting.chosen_game_id || !chosenDateOptionId) return;
    setJoiningMeeting(true);
    try {
      const { data: freshMeeting } = await supabase
        .from("meetings")
        .select("status")
        .eq("id", meeting.id)
        .single();
      if (freshMeeting?.status !== "approved") {
        Alert.alert(t("race.info"), t("home.noLongerApproved"));
        await fetchData();
        return;
      }

      const { data: existingVotes } = await supabase
        .from("votes")
        .select("id")
        .eq("meeting_id", meeting.id)
        .eq("user_id", currentUserId);

      if (existingVotes?.length) {
        await supabase.from("votes").delete().eq("id", existingVotes[0].id);
      }

      const { data: newVote, error: voteError } = await supabase
        .from("votes")
        .insert({ meeting_id: meeting.id, user_id: currentUserId })
        .select()
        .single();

      if (voteError || !newVote) {
        Alert.alert(t("common.error"), voteError?.message ?? t("home.failedJoin"));
        return;
      }

      await Promise.all([
        supabase.from("vote_dates").insert({ vote_id: newVote.id, date_option_id: chosenDateOptionId }),
        supabase.from("vote_games").insert({ vote_id: newVote.id, game_id: meeting.chosen_game_id }),
      ]);

      await fetchData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("home.failedJoin"));
    } finally {
      setJoiningMeeting(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!meeting?.chosen_date || addingToCalendar) return;
    setAddingToCalendar(true);
    try {
      const title = game?.name
        ? t("home.calendarTitle", { game: game.name })
        : t("home.calendarTitleDefault");

      if (Platform.OS === "android") {
        const startDate = new Date(meeting.chosen_date + "T00:00:00");
        const endDate = new Date(meeting.chosen_date + "T23:59:59");
        await IntentLauncher.startActivityAsync(
          "android.intent.action.INSERT",
          {
            data: "content://com.android.calendar/events",
            extra: {
              title,
              beginTime: startDate.getTime(),
              endTime: endDate.getTime(),
              allDay: true,
            },
          },
        );
      } else if (Platform.OS === "ios") {
        const dtstart = meeting.chosen_date.replace(/-/g, "");
        const nextDay = new Date(meeting.chosen_date + "T00:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        const dtend = nextDay.toISOString().slice(0, 10).replace(/-/g, "");

        const ics = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//BoardGames//EN",
          "BEGIN:VEVENT",
          `DTSTART;VALUE=DATE:${dtstart}`,
          `DTEND;VALUE=DATE:${dtend}`,
          `SUMMARY:${title}`,
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");

        const uri = FileSystem.cacheDirectory + "event.ics";
        await FileSystem.writeAsStringAsync(uri, ics);
        await Sharing.shareAsync(uri, {
          mimeType: "text/calendar",
          UTI: "com.apple.ical.ics",
        });
      }
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("home.failedCalendar"));
    } finally {
      setAddingToCalendar(false);
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  if (!meeting) {
    const locale = getDateLocale();
    return (
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Ionicons name="calendar-outline" size={64} color="#d6d3d1" />
        <Heading size="xl" className="mt-4 mb-2">
          {t("home.noUpcoming")}
        </Heading>
        {nextSurveyDate ? (
          nextSurveyDate <= new Date() ? (
            <Text className="text-stone-500 text-center mb-6">
              {t("home.surveyReady")}
            </Text>
          ) : (
            <Text className="text-stone-500 text-center mb-6">
              {t("home.nextSurveyAvailable", {
                date: nextSurveyDate.toLocaleDateString(locale, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }),
                days: Math.ceil(
                  (nextSurveyDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                ),
              })}
            </Text>
          )
        ) : (
          <Text className="text-stone-500 text-center mb-6">
            {t("home.surveyWillAppear")}
          </Text>
        )}
        <Button
          action="primary"
          isDisabled={creatingSurvey}
          onPress={handleCreateSurvey}
          className="px-6"
        >
          <ButtonText>
            {creatingSurvey ? t("home.creating") : t("home.createSurvey")}
          </ButtonText>
        </Button>
      </ScrollView>
    );
  }

  if (meeting.status === "voting") {
    return <SurveyContent key={meeting.id} meetingId={meeting.id} embedded />;
  }

  const locale = getDateLocale();

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ padding: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Card variant="filled" className="bg-green-50 w-full max-w-md self-center">
        {gameImageUrl && (
          <Image
            source={{ uri: gameImageUrl }}
            className="w-full h-48"
            resizeMode="cover"
          />
        )}
        <VStack space="md" className="p-5">
          <HStack space="xs" className="items-center">
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text className="text-green-700 font-medium">
              {t("home.meetingApproved")}
            </Text>
          </HStack>

          <Heading size="2xl" className="mt-1">
            {game?.name ?? t("home.noGameSelected")}
          </Heading>

          {meeting.chosen_date && (
            <HStack space="xs" className="items-center">
              <Ionicons name="calendar" size={16} color="#78716c" />
              <Text className="text-stone-600">
                {new Date(meeting.chosen_date + "T00:00:00").toLocaleDateString(
                  locale,
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </Text>
            </HStack>
          )}

          {game?.description && (
            <Text className="text-stone-600">{game.description}</Text>
          )}

          <HStack space="md" className="flex-wrap mt-1">
            {meeting.chosen_date && Platform.OS !== "web" && (
              <Button
                variant="outline"
                action="primary"
                size="sm"
                onPress={handleAddToCalendar}
                isDisabled={addingToCalendar}
                className="bg-amber-100 border-0"
              >
                <ButtonIcon as={Ionicons} name="calendar-outline" size={18} />
                <ButtonText className="text-amber-700 ml-1 text-sm">
                  {addingToCalendar ? t("home.addingToCalendar") : t("home.addToCalendar")}
                </ButtonText>
              </Button>
            )}
            {game?.tutorial_url && (
              <Button
                variant="outline"
                action="negative"
                size="sm"
                onPress={() => Linking.openURL(game.tutorial_url!)}
                className="bg-red-50 border-0"
              >
                <ButtonIcon
                  as={Ionicons}
                  name="play-circle-outline"
                  size={18}
                />
                <ButtonText className="text-red-700 ml-1 text-sm">
                  {t("home.tutorial")}
                </ButtonText>
              </Button>
            )}
            {game?.spotify_playlist_url && (
              <Button
                variant="outline"
                action="positive"
                size="sm"
                onPress={() => Linking.openURL(game.spotify_playlist_url!)}
                className="bg-green-100 border-0"
              >
                <ButtonIcon
                  as={Ionicons}
                  name="musical-notes-outline"
                  size={18}
                />
                <ButtonText className="text-green-700 ml-1 text-sm">
                  {t("home.playlist")}
                </ButtonText>
              </Button>
            )}
          </HStack>

          {attendees.length > 0 && (
            <VStack space="sm" className="mt-2">
              <Text size="sm" className="text-stone-500 font-medium">
                {t("home.attendees")}
              </Text>
              <AvatarGroup>
                {attendees.map((p) => (
                  <VStack key={p.id} space="xs" className="items-center">
                    <UserAvatar
                      profile={p}
                      avatarUrls={avatarUrls}
                      size="md"
                    />
                    <Text size="xs" className="text-stone-500">
                      {p.name}
                    </Text>
                  </VStack>
                ))}
              </AvatarGroup>
            </VStack>
          )}

          {votingResults && (votingResults.dates.length > 0 || votingResults.games.length > 0) && (
            <VStack space="sm" className="mt-3">
              <View className="h-px bg-green-200" />
              <HStack space="xs" className="items-center">
                <Ionicons name="bar-chart-outline" size={16} color="#78716c" />
                <Text size="sm" className="text-stone-500 font-medium">
                  {t("home.votingResults", { count: votingResults.totalVotes })}
                </Text>
              </HStack>

              {votingResults.dates.length > 0 && (
                <VStack space="xs">
                  <Text size="xs" className="text-stone-400 font-medium uppercase tracking-wide">
                    {t("home.topDates")}
                  </Text>
                  {votingResults.dates.slice(0, 5).map((d) => (
                    <HStack key={d.date} space="sm" className="items-center">
                      {d.isChosen ? (
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      ) : (
                        <View className="w-3.5" />
                      )}
                      <Text
                        size="sm"
                        className={d.isChosen ? "text-green-700 font-medium flex-1" : "text-stone-600 flex-1"}
                      >
                        {new Date(d.date + "T00:00:00").toLocaleDateString(locale, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </Text>
                      {d.voters.length > 0 && (
                        <HStack className="flex-row-reverse">
                          {d.voters.slice(0, 5).map((p) => (
                            <Box key={p.id} className="-ml-2">
                              <UserAvatar profile={p} avatarUrls={avatarUrls} size="xs" />
                            </Box>
                          ))}
                        </HStack>
                      )}
                      <Text size="xs" className="text-stone-400">
                        {d.count}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              )}

              {votingResults.games.length > 0 && (
                <VStack space="xs" className="mt-1">
                  <Text size="xs" className="text-stone-400 font-medium uppercase tracking-wide">
                    {t("home.topGames")}
                  </Text>
                  {votingResults.games.slice(0, 5).map((g) => (
                    <HStack key={g.name} space="sm" className="items-center">
                      {g.isChosen ? (
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                      ) : (
                        <View className="w-3.5" />
                      )}
                      <Text
                        size="sm"
                        className={g.isChosen ? "text-green-700 font-medium flex-1" : "text-stone-600 flex-1"}
                      >
                        {g.name}
                      </Text>
                      {g.voters.length > 0 && (
                        <HStack className="flex-row-reverse">
                          {g.voters.slice(0, 5).map((p) => (
                            <Box key={p.id} className="-ml-2">
                              <UserAvatar profile={p} avatarUrls={avatarUrls} size="xs" />
                            </Box>
                          ))}
                        </HStack>
                      )}
                      <Text size="xs" className="text-stone-400">
                        {g.count}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              )}
            </VStack>
          )}

          <VStack space="md" className="mt-2">
            {!isAttending && (
              <Button
                action="primary"
                isDisabled={joiningMeeting}
                onPress={handleLateJoin}
              >
                <ButtonText>
                  {joiningMeeting ? t("home.joining") : t("home.iWillAttend")}
                </ButtonText>
              </Button>
            )}
            <Button
              variant="outline"
              action="primary"
              onPress={() => router.push(`/approve/${meeting.id}?edit=1`)}
            >
              <ButtonText>{t("home.editMeeting")}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="negative"
              isDisabled={unapproving}
              onPress={handleUnapprove}
            >
              <ButtonText>{unapproving ? t("home.unapproving") : t("home.unapprove")}</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </Card>
    </ScrollView>
  );
}
