import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Calendar from "expo-calendar";
import { supabase } from "@/lib/supabase";
import { useSignedUrl, useSignedUrls } from "@/lib/storage";
import type { Meeting, BoardGame, Profile } from "@/lib/types";

export default function HomeScreen() {
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

  const handleUnapprove = async () => {
    if (!meeting) return;
    Alert.alert("Unapprove", "Revert this meeting back to voting?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unapprove",
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
              Alert.alert("Error", error.message);
              return;
            }
            fetchData();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to unapprove meeting");
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
        Alert.alert("Error", error.message);
        return;
      }
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create survey");
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
        Alert.alert("Permission denied", "Calendar access is required to create an event.");
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
        Alert.alert("Error", "No writable calendar found on this device.");
        return;
      }

      const title = game?.name
        ? `Board Games - ${game.name}`
        : "Board Games Meeting";
      const startDate = new Date(meeting.chosen_date + "T00:00:00");
      const endDate = new Date(meeting.chosen_date + "T23:59:59");

      await Calendar.createEventAsync(calendarId, {
        title,
        startDate,
        endDate,
        allDay: true,
      });

      Alert.alert("Done", "Event added to your calendar.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add calendar event");
    } finally {
      setAddingToCalendar(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!meeting) {
    return (
      <ScrollView
        className="flex-1 bg-white"
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
        <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
        <Text className="text-xl font-semibold text-gray-800 mt-4 mb-2">
          No upcoming meetings
        </Text>
        <Text className="text-gray-500 text-center mb-6">
          When a new survey is created, it will appear here.
        </Text>
        <TouchableOpacity
          className={`rounded-xl px-6 py-3 ${creatingSurvey ? "bg-blue-400" : "bg-blue-600"}`}
          onPress={handleCreateSurvey}
          disabled={creatingSurvey}
        >
          <Text className="text-white font-semibold">
            {creatingSurvey ? "Creating..." : "Create New Survey Now"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (meeting.status === "voting") {
    return (
      <ScrollView
        className="flex-1 bg-white"
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
        <View className="bg-blue-50 rounded-2xl p-6 w-full max-w-md">
          <View className="items-center mb-4">
            <Ionicons name="clipboard-outline" size={48} color="#2563eb" />
            <Text className="text-xl font-bold text-blue-900 mt-2">
              Survey #{meeting.number}
            </Text>
            <Text className="text-blue-700 mt-1">Voting is open!</Text>
          </View>

          <View className="flex-row items-center justify-center mb-6">
            <Ionicons name="people-outline" size={20} color="#6b7280" />
            <Text className="text-gray-600 ml-2">
              {voterCount} / {totalUsers} voted
            </Text>
          </View>

          <TouchableOpacity
            className="bg-blue-600 rounded-xl py-3 items-center"
            onPress={() => router.push(`/survey/${meeting.id}`)}
          >
            <Text className="text-white font-semibold text-lg">Vote Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="bg-green-50 rounded-2xl overflow-hidden w-full max-w-md self-center">
        {gameImageUrl && (
          <Image
            source={{ uri: gameImageUrl }}
            className="w-full h-48"
            resizeMode="cover"
          />
        )}
        <View className="p-5">
          <View className="flex-row items-center mb-1">
            <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
            <Text className="text-green-700 font-medium ml-1">
              Meeting Approved
            </Text>
          </View>

          <Text className="text-2xl font-bold text-gray-900 mt-2">
            {game?.name ?? "No game selected"}
          </Text>

          {meeting.chosen_date && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="calendar" size={16} color="#6b7280" />
              <Text className="text-gray-600 ml-1">
                {new Date(meeting.chosen_date + "T00:00:00").toLocaleDateString(
                  "en-GB",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </Text>
            </View>
          )}

          {game?.description && (
            <Text className="text-gray-600 mt-3">{game.description}</Text>
          )}

          <View className="flex-row flex-wrap mt-4 gap-3">
            {meeting.chosen_date && Platform.OS !== "web" && (
              <TouchableOpacity
                className="flex-row items-center bg-blue-50 rounded-lg px-3 py-2"
                onPress={handleAddToCalendar}
                disabled={addingToCalendar}
              >
                <Ionicons name="calendar-outline" size={18} color="#2563eb" />
                <Text className="text-blue-700 font-medium ml-1 text-sm">
                  {addingToCalendar ? "Adding..." : "Add to Calendar"}
                </Text>
              </TouchableOpacity>
            )}
            {game?.tutorial_url && (
              <TouchableOpacity
                className="flex-row items-center bg-red-50 rounded-lg px-3 py-2"
                onPress={() => Linking.openURL(game.tutorial_url!)}
              >
                <Ionicons
                  name="play-circle-outline"
                  size={18}
                  color="#dc2626"
                />
                <Text className="text-red-700 font-medium ml-1 text-sm">
                  Tutorial
                </Text>
              </TouchableOpacity>
            )}
            {game?.spotify_playlist_url && (
              <TouchableOpacity
                className="flex-row items-center bg-green-100 rounded-lg px-3 py-2"
                onPress={() => Linking.openURL(game.spotify_playlist_url!)}
              >
                <Ionicons
                  name="musical-notes-outline"
                  size={18}
                  color="#16a34a"
                />
                <Text className="text-green-700 font-medium ml-1 text-sm">
                  Playlist
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {attendees.length > 0 && (
            <View className="mt-5">
              <Text className="text-gray-500 text-sm font-medium mb-2">
                Attendees
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {attendees.map((p) => {
                  const signedAvatar = p.avatar_url
                    ? avatarUrls.get(p.avatar_url)
                    : undefined;
                  return (
                  <View key={p.id} className="items-center">
                    {signedAvatar ? (
                      <Image
                        source={{ uri: signedAvatar }}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-full bg-blue-200 items-center justify-center">
                        <Text className="text-blue-700 font-bold text-sm">
                          {(p.name?.[0] ?? "").toUpperCase()}
                          {(p.surname?.[0] ?? "").toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs text-gray-500 mt-1">
                      {p.name}
                    </Text>
                  </View>
                  );
                })}
              </View>
            </View>
          )}

          <View className="mt-5 gap-3">
            <TouchableOpacity
              className="bg-blue-600 rounded-xl py-3 items-center"
              onPress={() => router.push(`/approve/${meeting.id}`)}
            >
              <Text className="text-white font-semibold">View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="border border-red-300 rounded-xl py-3 items-center"
              onPress={handleUnapprove}
            >
              <Text className="text-red-600 font-semibold">Unapprove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
