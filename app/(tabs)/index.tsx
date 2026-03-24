import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  Linking,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { consumeVoteSignal } from "@/lib/voteSignal";
import { getDateLocale } from "@/lib/i18n";
import { useSignedUrl, useSignedUrls } from "@/lib/storage";
import type { Meeting, BoardGame, Profile } from "@/lib/types";

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
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
  AvatarGroup,
} from "@/components/ui/avatar";

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [game, setGame] = useState<BoardGame | null>(null);
  const [attendees, setAttendees] = useState<Profile[]>([]);
  const [voterCount, setVoterCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [nextSurveyDate, setNextSurveyDate] = useState<Date | null>(null);

  const gameImageUrl = useSignedUrl("game-images", game?.image_url);
  const avatarPaths = attendees
    .map((p) => p.avatar_url)
    .filter((u): u is string => !!u);
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
      }

      if (m.status === "voting") {
        setGame(null);
        setAttendees([]);
        const { count } = await supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("meeting_id", m.id);
        setVoterCount(count ?? 0);

        const { count: userCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });
        setTotalUsers(userCount ?? 0);
      }
    } catch (e) {
      console.error("Failed to fetch home data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const meetingRef = useRef<Meeting | null>(null);
  meetingRef.current = meeting;

  useFocusEffect(
    useCallback(() => {
      const increment = consumeVoteSignal();
      if (increment > 0) {
        setVoterCount((prev) => prev + increment);
      }
      fetchData();
    }, [fetchData]),
  );

  useEffect(() => {
    const channel = supabase
      .channel("home-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        async (payload) => {
          const m = meetingRef.current;
          if (!m || m.status !== "voting") return;
          const meetingId =
            payload.new && typeof payload.new === "object" && "meeting_id" in payload.new
              ? (payload.new as { meeting_id: string }).meeting_id
              : payload.old && typeof payload.old === "object" && "meeting_id" in payload.old
                ? (payload.old as { meeting_id: string }).meeting_id
                : null;
          if (meetingId && meetingId !== m.id) return;
          const { count } = await supabase
            .from("votes")
            .select("*", { count: "exact", head: true })
            .eq("meeting_id", m.id);
          setVoterCount(count ?? 0);
        },
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

  const handleAddToCalendar = async () => {
    if (!meeting?.chosen_date || addingToCalendar) return;
    setAddingToCalendar(true);
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("home.permissionDenied"), t("home.calendarAccessRequired"));
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
        Alert.alert(t("common.error"), t("home.noCalendarFound"));
        return;
      }

      const title = game?.name
        ? t("home.calendarTitle", { game: game.name })
        : t("home.calendarTitleDefault");
      const startDate = new Date(meeting.chosen_date + "T00:00:00");
      const endDate = new Date(meeting.chosen_date + "T23:59:59");

      await Calendar.createEventAsync(calendarId, {
        title,
        startDate,
        endDate,
        allDay: true,
      });

      Alert.alert(t("home.calendarDone"), t("home.calendarAdded"));
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
        <Card variant="filled" className="bg-amber-100 p-6 w-full max-w-md">
          <VStack space="md" className="items-center">
            <Ionicons name="clipboard-outline" size={48} color="#b45309" />
            <Heading size="xl" className="text-amber-900">
              {t("home.surveyNumber", { number: meeting.number })}
            </Heading>
            <Text className="text-amber-700">{t("home.votingOpen")}</Text>
          </VStack>

          <HStack space="sm" className="items-center justify-center my-6">
            <Ionicons name="people-outline" size={20} color="#78716c" />
            <Text className="text-stone-600">
              {t("home.votedCount", { count: voterCount, total: totalUsers })}
            </Text>
          </HStack>

          <VStack space="md">
            <Button
              action="primary"
              size="lg"
              onPress={() => router.push(`/survey/${meeting.id}`)}
            >
              <ButtonText className="text-lg">{t("home.voteNow")}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="positive"
              size="lg"
              onPress={() => router.push(`/approve/${meeting.id}`)}
            >
              <ButtonText className="text-lg">{t("home.approveMeeting")}</ButtonText>
            </Button>
          </VStack>
        </Card>
      </ScrollView>
    );
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
                {attendees.map((p) => {
                  const signedAvatar = p.avatar_url
                    ? avatarUrls.get(p.avatar_url)
                    : undefined;
                  return (
                    <VStack key={p.id} space="xs" className="items-center">
                      <Avatar size="md">
                        {signedAvatar ? (
                          <AvatarImage source={{ uri: signedAvatar }} />
                        ) : (
                          <AvatarFallbackText>
                            {(p.name?.[0] ?? "").toUpperCase()}
                            {(p.surname?.[0] ?? "").toUpperCase()}
                          </AvatarFallbackText>
                        )}
                      </Avatar>
                      <Text size="xs" className="text-stone-500">
                        {p.name}
                      </Text>
                    </VStack>
                  );
                })}
              </AvatarGroup>
            </VStack>
          )}

          <VStack space="md" className="mt-2">
            <Button
              action="primary"
              onPress={() => router.push(`/approve/${meeting.id}`)}
            >
              <ButtonText>{t("home.viewDetails")}</ButtonText>
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
