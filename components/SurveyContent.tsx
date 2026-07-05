import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  AppState,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { showAlert } from "@/lib/alert";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useGroup } from "@/lib/groupContext";
import { getDateLocale } from "@/lib/i18n";
import { useSignedUrls } from "@/lib/storage";
import { signalVoteCast } from "@/lib/voteSignal";
import type {
  Meeting,
  BoardGame,
  Profile,
  DateOption,
  Vote,
  VoteDate,
  VoteGame,
} from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";

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
import VoterListModal from "@/components/VoterListModal";

let surveyChannelSeq = 0;

interface VoterInfo {
  dateVoters: Map<string, Profile[]>;
  gameVoters: Map<string, Profile[]>;
}

interface SurveyContentProps {
  meetingId: string;
  embedded?: boolean;
}

function formatDate(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

const SurveyContent: React.FC<SurveyContentProps> = ({ meetingId, embedded = false }) => {
  const { t } = useTranslation();
  const locale = getDateLocale();
  const router = useRouter();
  const { currentGroupId, canApprove } = useGroup();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingDate, setAddingDate] = useState(false);

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
  const [meetingApprovedByOther, setMeetingApprovedByOther] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showVoterList, setShowVoterList] = useState(false);
  const isEditingRef = useRef(false);
  const hasHydratedSelectionsRef = useRef(false);
  const showSummaryRef = useRef(showSummary);
  useEffect(() => {
    showSummaryRef.current = showSummary;
  }, [showSummary]);

  const votedProfiles = useMemo(() => {
    const voterIds = new Set(allVotes.map((v) => v.user_id));
    return profiles.filter((p) => voterIds.has(p.id));
  }, [allVotes, profiles]);

  const notVotedProfiles = useMemo(() => {
    const voterIds = new Set(allVotes.map((v) => v.user_id));
    return profiles.filter((p) => !voterIds.has(p.id));
  }, [allVotes, profiles]);

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

  const dateVoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vd of allVoteDates) {
      counts.set(vd.date_option_id, (counts.get(vd.date_option_id) ?? 0) + 1);
    }
    return counts;
  }, [allVoteDates]);

  const topDates = useMemo(() => {
    return dateOptions
      .map((opt) => ({ ...opt, voteCount: dateVoteCounts.get(opt.id) ?? 0 }))
      .filter((opt) => opt.voteCount > 0)
      .sort((a, b) => b.voteCount - a.voteCount || a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [dateOptions, dateVoteCounts]);

  const gameVoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vg of allVoteGames) {
      counts.set(vg.game_id, (counts.get(vg.game_id) ?? 0) + 1);
    }
    return counts;
  }, [allVoteGames]);

  const topGames = useMemo(() => {
    return games
      .map((g) => ({ ...g, voteCount: gameVoteCounts.get(g.id) ?? 0 }))
      .filter((g) => g.voteCount > 0)
      .sort((a, b) => b.voteCount - a.voteCount || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [games, gameVoteCounts]);

  const fetchData = useCallback(async (forceHydrateSelections = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const [meetingRes, dateOptsRes, gamesRes, profilesRes, votesRes, voteDatesRes, voteGamesRes] =
        await Promise.all([
          supabase.from("meetings").select("*").eq("id", meetingId).single(),
          supabase.from("date_options").select("*").eq("meeting_id", meetingId).order("date"),
          supabase.from("board_games").select("*").eq("group_id", currentGroupId).order("name"),
          supabase.from("profiles").select("*"),
          supabase.from("votes").select("*").eq("meeting_id", meetingId),
          supabase
            .from("vote_dates")
            .select("*, votes!inner(meeting_id)")
            .eq("votes.meeting_id", meetingId),
          supabase
            .from("vote_games")
            .select("*, votes!inner(meeting_id)")
            .eq("votes.meeting_id", meetingId),
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
        const shouldHydrateSelections =
          forceHydrateSelections ||
          !hasHydratedSelectionsRef.current ||
          showSummaryRef.current;
        if (myVote) {
          if (shouldHydrateSelections) {
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
          }
          if (!isEditingRef.current) setShowSummary(true);
        } else if (shouldHydrateSelections) {
          setNotParticipating(false);
          setSelectedDates(new Set());
          setSelectedGames(new Set());
        }
        hasHydratedSelectionsRef.current = true;
      }
    } catch (e) {
      console.error("Failed to fetch survey data:", e);
    } finally {
      setLoading(false);
    }
  }, [meetingId, currentGroupId]);

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
      .channel(`survey-${meetingId}-${surveyChannelSeq++}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meetings" },
        (payload) => {
          const row = payload.new as { id?: string; status?: string } | undefined;
          if (row?.id === meetingId && row?.status === "approved") {
            setMeetingApprovedByOther(true);
            if (!embedded) {
              showAlert(t("race.meetingApprovedTitle"), t("race.meetingApprovedBanner"));
            }
          }
        },
      )
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
          if (mid === meetingId) fetchData();
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
  }, [meetingId, fetchData, t, embedded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(true);
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
    const isSelecting = !selectedGames.has(gameId);

    if (count >= 3 && isSelecting) {
      showAlert(
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

    if (isSelecting) {
      let streakGameId: string | null = null;
      let streakCount = 0;
      consecutiveCounts.forEach((c, gId) => {
        if (c > 0 && c < 3 && c > streakCount) {
          streakGameId = gId;
          streakCount = c;
        }
      });
      if (streakGameId && streakGameId !== gameId) {
        const streakGame = games.find((g) => g.id === streakGameId);
        showAlert(
          t("survey.streakBreakTitle"),
          t("survey.streakBreakMessage", {
            name: streakGame?.name ?? "",
            count: streakCount,
          }),
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

  const handleAddCustomDate = useCallback(async (dateStr: string) => {
    if (addingDate) return;
    setAddingDate(true);
    try {
      const { error } = await supabase.from("date_options").insert({
        meeting_id: meetingId,
        date: dateStr,
        is_custom: true,
        added_by: currentUserId,
      });
      if (error) {
        showAlert(t("common.error"), error.message);
        return;
      }
      await fetchData();
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("survey.failedAddDate"));
    } finally {
      setAddingDate(false);
    }
  }, [addingDate, meetingId, currentUserId, t, fetchData]);

  const handleSubmit = async () => {
    if (!currentUserId || !meetingId) return;
    if (!notParticipating && selectedDates.size === 0) {
      showAlert(t("survey.selectDatesTitle"), t("survey.selectDatesMessage"));
      return;
    }
    if (!notParticipating && selectedGames.size === 0) {
      showAlert(t("survey.selectGamesTitle"), t("survey.selectGamesMessage"));
      return;
    }

    setSubmitting(true);
    try {
      const { data: freshMeeting } = await supabase
        .from("meetings")
        .select("status")
        .eq("id", meetingId)
        .single();
      const wasApprovedDuringVote = freshMeeting?.status === "approved";

      if (existingVote) {
        const { error: delError } = await supabase
          .from("votes")
          .delete()
          .eq("id", existingVote.id);
        if (delError) {
          showAlert(t("common.error"), delError.message);
          return;
        }
      }

      const { data: newVote, error: voteError } = await supabase
        .from("votes")
        .insert({ meeting_id: meetingId, user_id: currentUserId })
        .select()
        .single();

      if (voteError || !newVote) {
        showAlert(t("common.error"), voteError?.message ?? t("survey.failedCreateVote"));
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
          showAlert(t("common.error"), dRes.error.message);
          return;
        }
        if (gRes.error) {
          showAlert(t("common.error"), gRes.error.message);
          return;
        }
      }

      signalVoteCast(!existingVote);
      isEditingRef.current = false;

      if (wasApprovedDuringVote) {
        showAlert(
          t("race.meetingApprovedTitle"),
          t("race.meetingApprovedWhileVoting"),
        );
      }
      await fetchData(true);
      setShowSummary(true);
    } catch (e: any) {
      showAlert(t("common.error"), e?.message ?? t("survey.failedSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  if (!meeting || (meeting.status !== "voting" && !meetingApprovedByOther)) {
    if (embedded) {
      return (
        <Center className="flex-1 bg-stone-50">
          <Spinner />
        </Center>
      );
    }
    return (
      <Center className="flex-1 bg-stone-50">
        <Text className="text-stone-500">{t("survey.notAvailable")}</Text>
      </Center>
    );
  }

  const isWeb = Platform.OS === "web";

  if (showSummary && existingVote) {
    return (
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <VStack space="lg">
          <VStack space="xs">
            <Heading size="xl">{t("survey.surveyNumber", { number: meeting.number })}</Heading>
            <Pressable onPress={() => setShowVoterList(true)} hitSlop={6}>
              <HStack space="sm" className="items-center">
                <Ionicons name="people-outline" size={16} color="#78716c" />
                <Text className="text-stone-500 underline">
                  {t("home.votedCount", { count: allVotes.length, total: profiles.length })}
                </Text>
              </HStack>
            </Pressable>
          </VStack>

          <Card variant="filled" className="bg-green-50 p-4">
            <HStack space="sm" className="items-center">
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text className="text-green-700 font-medium">
                {t("survey.voteRecorded")}
              </Text>
            </HStack>
          </Card>

          {meetingApprovedByOther && (
            <Card variant="filled" className="bg-orange-100 p-4">
              <HStack space="sm" className="items-center">
                <Ionicons name="warning-outline" size={20} color="#ea580c" />
                <Text className="text-orange-800 flex-1">
                  {t("race.meetingApprovedBanner")}
                </Text>
              </HStack>
            </Card>
          )}

          {/* Top Dates */}
          <VStack space="sm">
            <Heading size="md">
              <Ionicons name="calendar-outline" size={16} /> {t("survey.topDates")}
            </Heading>
            {topDates.length === 0 ? (
              <Text className="text-stone-400">{t("survey.noVotesYet")}</Text>
            ) : (
              topDates.map((opt) => {
                const voters = voterInfo.dateVoters.get(opt.id) ?? [];
                return (
                  <Card key={opt.id} variant="filled" className="bg-stone-100 p-3">
                    <HStack space="sm" className="items-center justify-between">
                      <VStack className="flex-1">
                        <Text className={isWeb ? "font-medium text-stone-800 text-lg" : "font-medium text-stone-800"}>
                          {formatDate(opt.date, locale)}
                        </Text>
                        <Text size="sm" className="text-stone-600 font-medium">
                          {t("survey.voteCount", { count: opt.voteCount })}
                        </Text>
                      </VStack>
                      {voters.length > 0 && (
                        <HStack className="flex-row-reverse items-center shrink-0 ml-2">
                          {voters.slice(0, isWeb ? 10 : 5).map((p) => (
                            <Box key={p.id} className="-ml-2">
                              <UserAvatar profile={p} avatarUrls={avatarUrls} size={isWeb ? "md" : "sm"} />
                            </Box>
                          ))}
                          {voters.length > (isWeb ? 10 : 5) && (
                            <View
                              className={`-ml-2 rounded-full bg-stone-300 items-center justify-center border-2 border-stone-100 ${isWeb ? "w-10 h-10" : "w-8 h-8"}`}
                            >
                              <Text size="xs" className="text-stone-600 font-bold">
                                +{voters.length - (isWeb ? 10 : 5)}
                              </Text>
                            </View>
                          )}
                        </HStack>
                      )}
                    </HStack>
                  </Card>
                );
              })
            )}
          </VStack>

          <View className="h-px bg-stone-200" />

          {/* Top Games */}
          <VStack space="sm">
            <Heading size="md">
              <Ionicons name="game-controller-outline" size={16} /> {t("survey.topGames")}
            </Heading>
            {topGames.length === 0 ? (
              <Text className="text-stone-400">{t("survey.noVotesYet")}</Text>
            ) : (
              <View className="flex-row flex-wrap gap-3">
                {topGames.map((game) => {
                  const voters = voterInfo.gameVoters.get(game.id) ?? [];
                  const imgUrl = game.image_url ? gameImageUrls.get(game.image_url) : undefined;
                  const maxGameAvatars = isWeb ? 8 : 4;
                  const avatarSize = isWeb ? "sm" : "xs";
                  return (
                    <Card key={game.id} variant="filled" className="bg-stone-100 overflow-hidden" style={{ width: "48%" }}>
                      <VStack space="sm" className="items-center p-4">
                        {imgUrl ? (
                          <View className={isWeb ? "self-stretch rounded-xl overflow-hidden" : "self-stretch rounded-lg overflow-hidden"} style={{ aspectRatio: 16 / 9 }}>
                            <Image
                              source={{ uri: imgUrl, cacheKey: game.image_url ?? undefined }}
                              className="w-full h-full"
                              contentFit="cover"
                            />
                          </View>
                        ) : (
                          <Center className={isWeb ? "self-stretch rounded-xl bg-stone-300" : "self-stretch rounded-lg bg-stone-300"} style={{ aspectRatio: 16 / 9 }}>
                            <Ionicons name="dice-outline" size={isWeb ? 56 : 28} color="#a8a29e" />
                          </Center>
                        )}
                        <Text className={isWeb ? "font-semibold text-stone-800 text-center text-lg" : "font-semibold text-stone-800 text-center"} numberOfLines={2}>
                          {game.name}
                        </Text>
                        <Text size="sm" className="text-stone-600 font-medium">
                          {t("survey.voteCount", { count: game.voteCount })}
                        </Text>
                        {voters.length > 0 && (
                          <HStack className="flex-row-reverse justify-center items-center">
                            {voters.slice(0, maxGameAvatars).map((p) => (
                              <Box key={p.id} className="-ml-2">
                                <UserAvatar profile={p} avatarUrls={avatarUrls} size={avatarSize} />
                              </Box>
                            ))}
                            {voters.length > maxGameAvatars && (
                              <View
                                className={`-ml-2 rounded-full bg-stone-300 items-center justify-center border-2 border-stone-100 ${isWeb ? "w-8 h-8" : "w-6 h-6"}`}
                              >
                                <Text size="2xs" className="text-stone-600 font-bold">
                                  +{voters.length - maxGameAvatars}
                                </Text>
                              </View>
                            )}
                          </HStack>
                        )}
                      </VStack>
                    </Card>
                  );
                })}
              </View>
            )}
          </VStack>

          {/* Actions */}
          <VStack space="md" className="mt-4">
            <Button
              action="primary"
              size="lg"
              onPress={() => {
                isEditingRef.current = true;
                setShowSummary(false);
              }}
            >
              <ButtonText className="text-lg">{t("survey.changeVote")}</ButtonText>
            </Button>
            {embedded ? (
              canApprove ? (
                <Button
                  variant="outline"
                  action="positive"
                  size="lg"
                  onPress={() => router.push(`/approve/${meetingId}`)}
                >
                  <ButtonText className="text-lg">{t("home.approveMeeting")}</ButtonText>
                </Button>
              ) : null
            ) : (
              <Button
                variant="outline"
                action="secondary"
                onPress={() => router.back()}
              >
                <ButtonText>{t("common.back")}</ButtonText>
              </Button>
            )}
          </VStack>
        </VStack>
        <VoterListModal
          visible={showVoterList}
          onClose={() => setShowVoterList(false)}
          voted={votedProfiles}
          notVoted={notVotedProfiles}
          avatarUrls={avatarUrls}
        />
      </ScrollView>
    );
  }

  const notParticipatingVoters = allVotes.filter((v) => {
    const hasDates = allVoteDates.some((vd) => vd.vote_id === v.id);
    const hasGames = allVoteGames.some((vg) => vg.vote_id === v.id);
    return !hasDates && !hasGames;
  });

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
      <ScrollView
        className="flex-1 bg-stone-50"
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
          <Pressable onPress={() => setShowVoterList(true)} hitSlop={6}>
            <HStack space="sm" className="items-center">
              <Ionicons name="people-outline" size={16} color="#78716c" />
              <Text className="text-stone-500 underline">
                {t("home.votedCount", { count: allVotes.length, total: profiles.length })}
              </Text>
            </HStack>
          </Pressable>
          {existingVote && (
            <Badge action="success" className="self-start">
              <BadgeText>{t("survey.alreadyVoted")}</BadgeText>
            </Badge>
          )}
        </VStack>

        {meetingApprovedByOther && (
          <Card variant="filled" className="bg-orange-100 p-4">
            <HStack space="sm" className="items-center">
              <Ionicons name="warning-outline" size={20} color="#ea580c" />
              <Text className="text-orange-800 flex-1">
                {t("race.meetingApprovedBanner")}
              </Text>
            </HStack>
          </Card>
        )}

        {/* Not Participating Toggle */}
        <Pressable onPress={toggleNotParticipating}>
          <Card
            variant="filled"
            className={`p-4 border-2 ${notParticipating ? "bg-orange-100 border-orange-400" : "bg-stone-100 border-transparent"}`}
          >
            <HStack space="sm" className="items-center">
              <Ionicons
                name={notParticipating ? "checkbox" : "square-outline"}
                size={24}
                color={notParticipating ? "#ea580c" : "#a8a29e"}
              />
              <VStack>
                <Text className={`font-medium ${notParticipating ? "text-orange-800" : "text-stone-700"}`}>
                  {t("survey.notParticipating")}
                </Text>
                <Text size="xs" className="text-stone-500">
                  {t("survey.notParticipatingDesc")}
                </Text>
              </VStack>
            </HStack>
          </Card>
        </Pressable>

        {/* Not participating voters */}
        {notParticipatingVoters.length > 0 && (
          <VStack space="xs">
            <Text size="sm" className="text-stone-500">{t("survey.notParticipatingLabel")}</Text>
            <HStack space="sm" className="flex-wrap">
              {notParticipatingVoters.map((v) => {
                const p = profiles.find((pr) => pr.id === v.user_id);
                if (!p) return null;
                return <UserAvatar key={v.id} profile={p} avatarUrls={avatarUrls} />;
              })}
            </HStack>
          </VStack>
        )}

        {/* Date Selection — Calendar */}
        <VStack space="md">
          <Heading size="lg">{t("survey.pickDates")}</Heading>
          <CalendarDatePicker
            dateOptions={dateOptions}
            selectedDates={selectedDates}
            onToggleDate={toggleDate}
            onAddCustomDate={handleAddCustomDate}
            disabled={notParticipating}
            dateVoters={voterInfo.dateVoters}
            avatarUrls={avatarUrls}
          />
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
                  className={`overflow-hidden border-2 ${
                    selected
                      ? "bg-amber-200 border-amber-600"
                      : "bg-stone-100 border-transparent"
                  } ${notParticipating ? "opacity-50" : ""}`}
                >
                  <HStack space="md" className="items-center p-3">
                    {imgUrl ? (
                      <Image
                        source={{ uri: imgUrl, cacheKey: game.image_url ?? undefined }}
                        className="w-16 h-16 rounded-lg"
                        contentFit="cover"
                      />
                    ) : (
                      <Center className="w-16 h-16 rounded-lg bg-stone-300">
                        <Ionicons name="dice-outline" size={24} color="#a8a29e" />
                      </Center>
                    )}
                    <VStack className="flex-1" space="xs">
                      <HStack space="sm" className="items-center">
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
                          size={22}
                          color={selected ? "#b45309" : "#a8a29e"}
                        />
                        <Text className="font-semibold text-stone-800 flex-1">
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
                          <Text size="xs" className="text-stone-500">
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
                      <VStack space="xs" className="items-center shrink-0 ml-2">
                        <Text size="xs" className="text-stone-500">{voters.length}</Text>
                        {voters.slice(0, 3).map((p) => (
                          <UserAvatar key={p.id} profile={p} avatarUrls={avatarUrls} size="sm" />
                        ))}
                        {voters.length > 3 && (
                          <View className="w-8 h-8 rounded-full bg-stone-300 items-center justify-center">
                            <Text size="xs" className="text-stone-600 font-bold">
                              +{voters.length - 3}
                            </Text>
                          </View>
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
                  ? t("survey.changeVote")
                  : t("survey.submitVote")}
            </ButtonText>
          </Button>
          {!embedded && (
            <Button
              variant="outline"
              action="secondary"
              onPress={() => router.back()}
            >
              <ButtonText>{t("common.cancel")}</ButtonText>
            </Button>
          )}
        </VStack>
      </VStack>
      </ScrollView>
      <VoterListModal
        visible={showVoterList}
        onClose={() => setShowVoterList(false)}
        voted={votedProfiles}
        notVoted={notVotedProfiles}
        avatarUrls={avatarUrls}
      />
    </KeyboardAvoidingView>
  );
};

export default SurveyContent;
