import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useSignedUrls } from "@/lib/storage";
import type { BoardGame } from "@/lib/types";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Spinner } from "@/components/ui/spinner";
import { Image } from "@/components/ui/image";
import { Pressable } from "@/components/ui/pressable";
import { Input, InputField, InputSlot, InputIcon } from "@/components/ui/input";
import { Fab, FabIcon } from "@/components/ui/fab";

const GameRow = React.memo(function GameRow({
  item,
  imageUri,
  onPress,
  playersLabel,
}: {
  item: BoardGame;
  imageUri: string | undefined;
  onPress: () => void;
  playersLabel: string;
}) {
  return (
    <Pressable
      className="bg-amber-50 rounded-xl mx-4 mb-3 overflow-hidden border border-stone-200"
      onPress={onPress}
    >
      <HStack>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="w-20 h-20 rounded-l-xl"
            resizeMode="cover"
          />
        ) : (
          <Center className="w-20 h-20 bg-stone-200 rounded-l-xl">
            <Ionicons name="dice-outline" size={28} color="#d6d3d1" />
          </Center>
        )}
        <VStack className="flex-1 p-3 justify-center">
          <Text className="font-semibold text-stone-900">
            {item.name}
          </Text>
          {item.genre && (
            <Text size="sm" className="text-stone-500 mt-0.5">
              {item.genre}
            </Text>
          )}
          <HStack space="md" className="items-center mt-1">
            {(item.min_players != null || item.max_players != null) && (
              <HStack space="xs" className="items-center">
                <Ionicons name="people-outline" size={14} color="#a8a29e" />
                <Text size="xs" className="text-stone-400">
                  {item.min_players ?? "?"}-{item.max_players ?? "?"} {playersLabel}
                </Text>
              </HStack>
            )}
            {item.owners?.length ? (
              <Text size="xs" className="text-stone-400" numberOfLines={1}>
                {item.owners.join(", ")}
              </Text>
            ) : null}
          </HStack>
        </VStack>
        <Center className="pr-3">
          <Ionicons name="chevron-forward" size={20} color="#d6d3d1" />
        </Center>
      </HStack>
    </Pressable>
  );
});

export default function GamesListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const imagePaths = useMemo(
    () => games.map((g) => g.image_url).filter((p): p is string => !!p),
    [games],
  );
  const imageUrls = useSignedUrls("game-images", imagePaths);
  const imageUrlsRef = useRef(imageUrls);
  imageUrlsRef.current = imageUrls;

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

  const playersLabel = t("common.players");

  const renderGameRow = useCallback(
    ({ item }: { item: BoardGame }) => (
      <GameRow
        item={item}
        imageUri={item.image_url ? imageUrlsRef.current.get(item.image_url) : undefined}
        onPress={() => router.push(`/(tabs)/games/${item.id}`)}
        playersLabel={playersLabel}
      />
    ),
    [router, playersLabel],
  );

  const filtered = games.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.genre?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-100">
        <Spinner />
      </Center>
    );
  }

  return (
    <Box className="flex-1 bg-stone-100">
      <Box className="px-4 pt-3 pb-2">
        <Input variant="outline" className="rounded-xl">
          <InputSlot className="ml-3">
            <InputIcon as={Ionicons} name="search" />
          </InputSlot>
          <InputField
            className="ml-2"
            placeholder={t("games.searchPlaceholder")}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <InputSlot className="mr-3">
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#a8a29e" />
              </TouchableOpacity>
            </InputSlot>
          )}
        </Input>
      </Box>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderGameRow}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Center className="py-20">
            <Ionicons name="dice-outline" size={48} color="#d6d3d1" />
            <Text className="text-stone-400 mt-3">
              {search ? t("games.noMatch") : t("games.noGames")}
            </Text>
          </Center>
        }
      />

      <Fab onPress={() => router.push("/(tabs)/games/new")}>
        <FabIcon as={Ionicons} name="add" />
      </Fab>
    </Box>
  );
}
