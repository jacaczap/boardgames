import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
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
import { Input, InputField } from "@/components/ui/input";
import {
  Avatar,
  AvatarImage,
  AvatarFallbackText,
} from "@/components/ui/avatar";
import { Badge, BadgeText } from "@/components/ui/badge";

interface VoterInfo {
  dateVoters: Map<string, Profile[]>;
  gameVoters: Map<string, Profile[]>;
}

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function isPast(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + "T00:00:00") < today;
}

export default function SurveyScreen() {
  const { t } = useTranslation();
  const locale = getDateLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingDate, setAddingDate] = useState(false);
  const [customDateInput, setCustomDateInput] = useState("");

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [games, setGames] = useState<BoardGame[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allVotes, setAllVotes] = useState<Vote[]>([]);
  const [allVoteDates, setAllVoteDates] = useState<VoteDate[]>([]);
  const [allVoteGames, setAllVoteGames] = useState<VoteGame[]>([]);
  const [consecutiveCounts, setConsecutiveCounts] = useState<Map<string, number>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [notParticipating, setNotParticipating] = useState(false);

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

  const existingVote = useMemo(
    () => (currentUserId ? allVotes.find((v) => v.user_id === currentUserId) ?? null : null),
    [allVotes, currentUserId],
  );

  const voterInfo = useMemo<VoterInfo>(() => {
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const voteUserMap = new Map(allVotes.map((v) => [v.id, v.user_id]));

    const dateVoters = new Map<string, Profile[]>();
    for (const vd of allVoteDates) {
      const userId = voteUserMap.get(vd.vote_id);
      if (!userId) continue;
      const profile = profileMap.get(userId);
      if (!profile) continue;
      const arr = dateVoters.get(vd.date_option_id) ?? [];
      arr.push(profile);
      dateVoters.set(vd.date_option_id, arr);
    }

    const gameVoters = new Map<string, Profile[]>();
    for (const vg of allVoteGames) {
      const userId = voteUserMap.get(vg.vote_id);
      if (!userId) continue;
      const profile = profileMap.get(userId);
      if (!profile) continue;
      const arr = gameVoters.get(vg.game_id) ?? [];
      arr.push(profile);
      gameVoters.set(vg.game_id, arr);
    }

    return { dateVoters, gameVoters };
  }, [profiles, allVotes, allVoteDates, allVoteGames]);

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
      const fetchedGames = (gamesRes.data as BoardGame[]) ?? [];
      setGames(fetchedGames);
      setProfiles((profilesRes.data as Profile[]) ?? []);

      const votes = (votesRes.data as Vote[]) ?? [];
      setAllVotes(votes);
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

      const counts = new Map<string, number>();
      await Promise.all(
        fetchedGames.map(async (g) => {
          const { data } = await supabase.rpc("get_consecutive_game_count", {
            p_game_id: g.id,
          });
          if (typeof data === "number") counts.set(g.id, data);
        }),
      );
      setConsecutiveCounts(counts);

      if (user?.id) {
        const myVote = votes.find((v) => v.user_id === user.id);
        if (myVote) {
          const myVoteDates = (voteDatesRes.data as (VoteDate & { votes: unknown })[])
            ?.filter((vd) => vd.vote_id === myVote.id)
            .map((vd) => vd.date_option_id);
          const myVoteGames = (voteGamesRes.data as (VoteGame & { votes: unknown })[])
            ?.filter((vg) => vg.vote_id === myVote.id)
            .map((vg) => vg.game_id);

          if (!myVoteDates?.length && !myVoteGames?.length) {
            setNotParticipating(true);
            setSelectedDates(new Set());
            setSelectedGames(new Set());
          } else {
            setNotParticipating(false);
            setSelectedDates(new Set(myVoteDates ?? []));
            setSelectedGames(new Set(myVoteGames ?? []));
          }
        } else {
          setNotParticipating(false);
          setSelectedDates(new Set());
          setSelectedGames(new Set());
        }
      }
    } catch (e) {
      console.error("Failed to fetch survey data:", e);
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
      .channel(`survey-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes" },
        (payload) => {
          const mid =
            payload.new && typeof payload.new === "object" && "meeting_id" in payload.new
              ? (payload.new as { meeting_id: string }).meeting_id
              : payload.old && typeof payload.old === "object" && "meeting_id" in payload.old
                ? (payload.old as { meeting_id: string }).meeting_id
                : null;
          if (mid === id) fetchData();
        },
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "date_options" },
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

  const toggleDate = (dateOptionId: string) => {
    if (notParticipating) return;
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateOptionId)) next.delete(dateOptionId);
      else next.add(dateOptionId);
      return next;
    });
  };

  const toggleGame = (gameId: string) => {
    if (notParticipating) return;
    const count = consecutiveCounts.get(gameId) ?? 0;
    if (count >= 3 && !selectedGames.has(gameId)) {
      Alert.alert(
        t("survey.playLimitTitle"),
        t("survey.playLimitMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("survey.selectAnyway"),
            onPress: () => {
              setSelectedGames((prev) => {
                const next = new Set(prev);
                next.add(gameId);
                return next;
              });
            },
          },
        ],
      );
      return;
    }

    setSelectedGames((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const toggleNotParticipating = () => {
    setNotParticipating((prev) => {
      if (!prev) {
        setSelectedDates(new Set());
        setSelectedGames(new Set());
      }
      return !prev;
    });
  };

  const dateRange = useMemo(() => {
    if (!dateOptions.length) return null;
    const sorted = [...dateOptions].sort((a, b) => a.date.localeCompare(b.date));
    return { min: sorted[0].date, max: sorted[sorted.length - 1].date };
  }, [dateOptions]);

  const handleAddCustomDate = async () => {
    const trimmed = customDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      Alert.alert(t("survey.invalidFormat"), t("survey.useFormat"));
      return;
    }
    const d = new Date(trimmed + "T00:00:00");
    if (isNaN(d.getTime())) {
      Alert.alert(t("survey.invalidDate"), t("survey.enterValidDate"));
      return;
    }
    if (isPast(trimmed)) {
      Alert.alert(t("survey.pastDate"), t("survey.cannotAddPast"));
      return;
    }
    if (dateRange && (trimmed < dateRange.min || trimmed > dateRange.max)) {
      Alert.alert(
        t("survey.outOfRange"),
        t("survey.dateRange", {
          min: formatDate(dateRange.min, locale),
          max: formatDate(dateRange.max, locale),
        }),
      );
      return;
    }
    if (dateOptions.some((o) => o.date === trimmed)) {
      Alert.alert(t("survey.duplicate"), t("survey.alreadyOption"));
      return;
    }

    setAddingDate(true);
    try {
      const { error } = await supabase.from("date_options").insert({
        meeting_id: id,
        date: trimmed,
        is_custom: true,
        added_by: currentUserId,
      });
      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      setCustomDateInput("");
      await fetchData();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("survey.failedAddDate"));
    } finally {
      setAddingDate(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentUserId || !id) return;
    if (!notParticipating && selectedDates.size === 0) {
      Alert.alert(t("survey.selectDatesTitle"), t("survey.selectDatesMessage"));
      return;
    }
    if (!notParticipating && selectedGames.size === 0) {
      Alert.alert(t("survey.selectGamesTitle"), t("survey.selectGamesMessage"));
      return;
    }

    setSubmitting(true);
    try {
      if (existingVote) {
        const { error: delError } = await supabase
          .from("votes")
          .delete()
          .eq("id", existingVote.id);
        if (delError) {
          Alert.alert(t("common.error"), delError.message);
          return;
        }
      }

      const { data: newVote, error: voteError } = await supabase
        .from("votes")
        .insert({ meeting_id: id, user_id: currentUserId })
        .select()
        .single();

      if (voteError || !newVote) {
        Alert.alert(t("common.error"), voteError?.message ?? t("survey.failedCreateVote"));
        return;
      }

      if (!notParticipating) {
        const voteDateRows = Array.from(selectedDates).map((doId) => ({
          vote_id: newVote.id,
          date_option_id: doId,
        }));
        const voteGameRows = Array.from(selectedGames).map((gId) => ({
          vote_id: newVote.id,
          game_id: gId,
        }));

        const [dRes, gRes] = await Promise.all([
          supabase.from("vote_dates").insert(voteDateRows),
          supabase.from("vote_games").insert(voteGameRows),
        ]);

        if (dRes.error) {
          Alert.alert(t("common.error"), dRes.error.message);
          return;
        }
        if (gRes.error) {
          Alert.alert(t("common.error"), gRes.error.message);
          return;
        }
      }

      router.back();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("survey.failedSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-white">
        <Spinner />
      </Center>
    );
  }

  if (!meeting || meeting.status !== "voting") {
    return (
      <Center className="flex-1 bg-white">
        <Text className="text-gray-500">{t("survey.notAvailable")}</Text>
      </Center>
    );
  }

  const notParticipatingVoters = allVotes.filter((v) => {
    const hasDates = allVoteDates.some((vd) => vd.vote_id === v.id);
    const hasGames = allVoteGames.some((vg) => vg.vote_id === v.id);
    return !hasDates && !hasGames;
  });

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <VStack space="lg">
        {/* Header */}
        <VStack space="xs">
          <Heading size="xl">{t("survey.surveyNumber", { number: meeting.number })}</Heading>
          <Text className="text-gray-500">
            {t("survey.votesSubmitted", { count: allVotes.length })}
          </Text>
          {existingVote && (
            <Badge action="success" className="self-start">
              <BadgeText>{t("survey.alreadyVoted")}</BadgeText>
            </Badge>
          )}
        </VStack>

        {/* Not Participating Toggle */}
        <Pressable onPress={toggleNotParticipating}>
          <Card
            variant="filled"
            className={`p-4 ${notParticipating ? "bg-orange-100 border-2 border-orange-400" : "bg-gray-50"}`}
          >
            <HStack space="sm" className="items-center">
              <Ionicons
                name={notParticipating ? "checkbox" : "square-outline"}
                size={24}
                color={notParticipating ? "#ea580c" : "#9ca3af"}
              />
              <VStack>
                <Text className={`font-medium ${notParticipating ? "text-orange-800" : "text-gray-700"}`}>
                  {t("survey.notParticipating")}
                </Text>
                <Text size="xs" className="text-gray-500">
                  {t("survey.notParticipatingDesc")}
                </Text>
              </VStack>
            </HStack>
          </Card>
        </Pressable>

        {/* Not participating voters */}
        {notParticipatingVoters.length > 0 && (
          <VStack space="xs">
            <Text size="sm" className="text-gray-500">{t("survey.notParticipatingLabel")}</Text>
            <HStack space="sm" className="flex-wrap">
              {notParticipatingVoters.map((v) => {
                const p = profiles.find((pr) => pr.id === v.user_id);
                if (!p) return null;
                return <VoterAvatar key={v.id} profile={p} avatarUrls={avatarUrls} />;
              })}
            </HStack>
          </VStack>
        )}

        {/* Date Selection */}
        <VStack space="md">
          <Heading size="lg">{t("survey.pickDates")}</Heading>
          {dateOptions.map((opt) => {
            const past = isPast(opt.date);
            const selected = selectedDates.has(opt.id);
            const holiday = isPolishHoliday(opt.date);
            const d = new Date(opt.date + "T00:00:00");
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const voters = voterInfo.dateVoters.get(opt.id) ?? [];

            return (
              <Pressable
                key={opt.id}
                onPress={() => !past && toggleDate(opt.id)}
                disabled={past || notParticipating}
              >
                <Card
                  variant="filled"
                  className={`p-3 ${
                    past
                      ? "bg-gray-100 opacity-50"
                      : selected
                        ? "bg-blue-100 border-2 border-blue-500"
                        : "bg-gray-50"
                  }`}
                >
                  <HStack space="sm" className="items-center justify-between">
                    <HStack space="sm" className="items-center flex-1">
                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={22}
                        color={past ? "#d1d5db" : selected ? "#2563eb" : "#9ca3af"}
                      />
                      <VStack>
                        <HStack space="xs" className="items-center">
                          <Text
                            className={`font-medium ${
                              past ? "text-gray-400" : "text-gray-800"
                            }`}
                          >
                            {formatDate(opt.date, locale)}
                          </Text>
                          {holiday && (
                            <Badge action="warning">
                              <BadgeText action="warning">{t("survey.holiday")}</BadgeText>
                            </Badge>
                          )}
                          {opt.is_custom && (
                            <Badge action="info">
                              <BadgeText action="info">{t("survey.custom")}</BadgeText>
                            </Badge>
                          )}
                          {isWeekend && !holiday && (
                            <Badge action="muted">
                              <BadgeText action="muted">
                                {d.getDay() === 6 ? t("survey.sat") : t("survey.sun")}
                              </BadgeText>
                            </Badge>
                          )}
                        </HStack>
                        {past && (
                          <Text size="xs" className="text-gray-400">{t("survey.past")}</Text>
                        )}
                      </VStack>
                    </HStack>
                    {voters.length > 0 && (
                      <HStack space="xs" className="items-center">
                        <Text size="xs" className="text-gray-500">{voters.length}</Text>
                        <HStack className="flex-row-reverse">
                          {voters.slice(0, 5).map((p) => (
                            <Box key={p.id} className="-ml-2">
                              <VoterAvatar profile={p} avatarUrls={avatarUrls} size="sm" />
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

          {/* Add custom date */}
          <Card variant="outline" className="p-3">
            <VStack space="sm">
              <Text size="sm" className="font-medium text-gray-600">
                {t("survey.addCustomDate")}
              </Text>
              <HStack space="sm">
                <Box className="flex-1">
                  <Input>
                    <InputField
                      value={customDateInput}
                      onChangeText={setCustomDateInput}
                      placeholder={t("survey.customDatePlaceholder")}
                      autoCapitalize="none"
                      keyboardType={Platform.OS === "web" ? "default" : "numbers-and-punctuation"}
                    />
                  </Input>
                </Box>
                <Button
                  action="primary"
                  size="sm"
                  isDisabled={addingDate || !customDateInput.trim()}
                  onPress={handleAddCustomDate}
                >
                  <ButtonText>{addingDate ? "..." : t("common.add")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </Card>
        </VStack>

        {/* Game Selection */}
        <VStack space="md">
          <Heading size="lg">{t("survey.pickGames")}</Heading>
          {games.map((game) => {
            const selected = selectedGames.has(game.id);
            const count = consecutiveCounts.get(game.id) ?? 0;
            const voters = voterInfo.gameVoters.get(game.id) ?? [];
            const imgUrl = game.image_url ? gameImageUrls.get(game.image_url) : undefined;

            return (
              <Pressable
                key={game.id}
                onPress={() => toggleGame(game.id)}
                disabled={notParticipating}
              >
                <Card
                  variant="filled"
                  className={`overflow-hidden ${
                    selected
                      ? "bg-blue-100 border-2 border-blue-500"
                      : "bg-gray-50"
                  } ${notParticipating ? "opacity-50" : ""}`}
                >
                  <HStack space="md" className="items-center p-3">
                    {imgUrl ? (
                      <Image
                        source={{ uri: imgUrl }}
                        className="w-16 h-16 rounded-lg"
                        resizeMode="cover"
                      />
                    ) : (
                      <Center className="w-16 h-16 rounded-lg bg-gray-200">
                        <Ionicons name="dice-outline" size={24} color="#9ca3af" />
                      </Center>
                    )}
                    <VStack className="flex-1" space="xs">
                      <HStack space="sm" className="items-center">
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
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
                        {count > 0 && (
                          <Badge action={count >= 3 ? "error" : "warning"}>
                            <BadgeText action={count >= 3 ? "error" : "warning"}>
                              {t("survey.inARow", { count })}
                            </BadgeText>
                          </Badge>
                        )}
                      </HStack>
                    </VStack>
                    {voters.length > 0 && (
                      <VStack space="xs" className="items-center">
                        <Text size="xs" className="text-gray-500">{voters.length}</Text>
                        {voters.slice(0, 3).map((p) => (
                          <VoterAvatar key={p.id} profile={p} avatarUrls={avatarUrls} size="sm" />
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

        {/* Submit */}
        <VStack space="md" className="mt-4">
          <Button
            action="primary"
            size="lg"
            isDisabled={submitting}
            onPress={handleSubmit}
          >
            <ButtonText className="text-lg">
              {submitting
                ? t("survey.submitting")
                : existingVote
                  ? t("survey.updateVote")
                  : t("survey.submitVote")}
            </ButtonText>
          </Button>
          <Button
            variant="outline"
            action="secondary"
            onPress={() => router.back()}
          >
            <ButtonText>{t("common.cancel")}</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </ScrollView>
  );
}

interface VoterAvatarProps {
  profile: Profile;
  avatarUrls: Map<string, string>;
  size?: "sm" | "md";
}

const VoterAvatar: React.FC<VoterAvatarProps> = React.memo(
  ({ profile, avatarUrls, size = "sm" }) => {
    const uri = profile.avatar_url ? avatarUrls.get(profile.avatar_url) : undefined;
    return (
      <Avatar size={size}>
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
  },
);
