import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useSignedUrls } from "@/lib/storage";
import type { BoardGame } from "@/lib/types";

const GameRow = React.memo(function GameRow({
  item,
  imageUri,
  onPress,
}: {
  item: BoardGame;
  imageUri: string | undefined;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="bg-white rounded-xl mx-4 mb-3 overflow-hidden border border-gray-100"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row">
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="w-20 h-20 rounded-l-xl"
            resizeMode="cover"
          />
        ) : (
          <View className="w-20 h-20 bg-gray-100 items-center justify-center rounded-l-xl">
            <Ionicons name="dice-outline" size={28} color="#d1d5db" />
          </View>
        )}
        <View className="flex-1 p-3 justify-center">
          <Text className="text-base font-semibold text-gray-900">
            {item.name}
          </Text>
          {item.genre && (
            <Text className="text-sm text-gray-500 mt-0.5">{item.genre}</Text>
          )}
          <View className="flex-row items-center mt-1 gap-3">
            {(item.min_players != null || item.max_players != null) && (
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={14} color="#9ca3af" />
                <Text className="text-xs text-gray-400 ml-1">
                  {item.min_players ?? "?"}-{item.max_players ?? "?"} players
                </Text>
              </View>
            )}
            {item.owners?.length ? (
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {item.owners.join(", ")}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="justify-center pr-3">
          <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function GamesListScreen() {
  const router = useRouter();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const imagePaths = games
    .map((g) => g.image_url)
    .filter((p): p is string => !!p);
  const imageUrls = useSignedUrls("game-images", imagePaths);

  const fetchGames = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("board_games")
        .select("*")
        .order("name");
      setGames((data as BoardGame[]) ?? []);
    } catch (e) {
      console.error("Failed to fetch games:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGames();
    }, [fetchGames]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  }, [fetchGames]);

  const filtered = games.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.genre?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 border border-gray-200">
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-900"
            placeholder="Search games..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GameRow
            item={item}
            imageUri={item.image_url ? imageUrls.get(item.image_url) : undefined}
            onPress={() => router.push(`/(tabs)/games/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name="dice-outline" size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-3">
              {search ? "No games match your search" : "No board games yet"}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-lg"
        onPress={() => router.push("/(tabs)/games/new")}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
