import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { pickAndUploadImage, removeStorageFile, useSignedUrl } from "@/lib/storage";
import type { BoardGame } from "@/lib/types";

import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Heading } from "@/components/ui/heading";
import { Button, ButtonText, ButtonIcon } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Image } from "@/components/ui/image";
import { Input, InputField } from "@/components/ui/input";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";

export default function GameDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<BoardGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [tutorialUrl, setTutorialUrl] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [owners, setOwners] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const tempUploadsRef = useRef<string[]>([]);

  const imageDisplayUrl = useSignedUrl("game-images", imagePath);

  const populateForm = useCallback((g: BoardGame) => {
    setName(g.name);
    setDescription(g.description ?? "");
    setGenre(g.genre ?? "");
    setMinPlayers(g.min_players?.toString() ?? "");
    setMaxPlayers(g.max_players?.toString() ?? "");
    setTutorialUrl(g.tutorial_url ?? "");
    setSpotifyUrl(g.spotify_playlist_url ?? "");
    setOwners(g.owners?.join(", ") ?? "");
    setImagePath(g.image_url);
  }, []);

  const fetchGame = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from("board_games")
        .select("*")
        .eq("id", id)
        .single();
      if (data) {
        const g = data as BoardGame;
        setGame(g);
        populateForm(g);
      }
    } catch (e) {
      console.error("Failed to fetch game:", e);
    } finally {
      setLoading(false);
    }
  }, [id, populateForm]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGame();
    setRefreshing(false);
  }, [fetchGame]);

  const handlePickImage = async () => {
    const path = await pickAndUploadImage("game-images", id ?? "game");
    if (path) {
      tempUploadsRef.current.push(path);
      setImagePath(path);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.validation"), t("games.nameRequired"));
      return;
    }
    const parsedMin = minPlayers ? parseInt(minPlayers, 10) : null;
    const parsedMax = maxPlayers ? parseInt(maxPlayers, 10) : null;
    if (minPlayers && (isNaN(parsedMin!) || parsedMin! < 1)) {
      Alert.alert(t("common.validation"), t("games.minPlayersPositive"));
      return;
    }
    if (maxPlayers && (isNaN(parsedMax!) || parsedMax! < 1)) {
      Alert.alert(t("common.validation"), t("games.maxPlayersPositive"));
      return;
    }
    if (parsedMin != null && parsedMax != null && parsedMin > parsedMax) {
      Alert.alert(t("common.validation"), t("games.minExceedsMax"));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("board_games")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          genre: genre.trim() || null,
          min_players: parsedMin,
          max_players: parsedMax,
          tutorial_url: tutorialUrl.trim() || null,
          spotify_playlist_url: spotifyUrl.trim() || null,
          owners: owners.trim()
            ? owners
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : null,
          image_url: imagePath,
        })
        .eq("id", id!);

      if (error) {
        Alert.alert(t("common.error"), error.message);
        return;
      }
      if (game?.image_url && game.image_url !== imagePath) {
        await removeStorageFile("game-images", game.image_url);
      }
      const kept = imagePath;
      for (const p of tempUploadsRef.current) {
        if (p !== kept) await removeStorageFile("game-images", p);
      }
      tempUploadsRef.current = [];
      setEditing(false);
      fetchGame();
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message ?? t("games.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t("games.deleteGame"),
      t("games.deleteConfirm", { name: game?.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              if (game?.image_url) {
                await removeStorageFile("game-images", game.image_url);
              }
              const { error } = await supabase.from("board_games").delete().eq("id", id!);
              if (error) {
                Alert.alert(t("common.error"), error.message);
                return;
              }
              router.back();
            } catch (e: any) {
              Alert.alert(t("common.error"), e?.message ?? t("games.failedDelete"));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Spinner />
      </Center>
    );
  }

  if (!game) {
    return (
      <Center className="flex-1 bg-stone-50">
        <Text className="text-stone-500">{t("games.notFound")}</Text>
      </Center>
    );
  }

  if (editing) {
    return (
      <ScrollView
        className="flex-1 bg-stone-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={handlePickImage} className="mb-4">
          {imageDisplayUrl ? (
            <Image
              source={{ uri: imageDisplayUrl }}
              className="w-full h-48 rounded-xl"
              resizeMode="cover"
            />
          ) : (
            <Center className="w-full h-48 rounded-xl bg-stone-200">
              <Ionicons name="camera-outline" size={32} color="#a8a29e" />
              <Text className="text-stone-400 mt-1">{t("games.tapToAddImage")}</Text>
            </Center>
          )}
        </Pressable>

        <VStack space="md">
          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-700">{t("games.nameLabel")}</Text>
            <Input>
              <InputField value={name} onChangeText={setName} placeholder={t("games.namePlaceholder")} />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-700">{t("games.description")}</Text>
            <Input>
              <InputField
                value={description}
                onChangeText={setDescription}
                placeholder={t("games.descriptionPlaceholder")}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-700">{t("games.genre")}</Text>
            <Input>
              <InputField
                value={genre}
                onChangeText={setGenre}
                placeholder={t("games.genrePlaceholder")}
              />
            </Input>
          </VStack>

          <HStack space="md">
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium text-stone-700">{t("games.minPlayers")}</Text>
              <Input>
                <InputField
                  value={minPlayers}
                  onChangeText={setMinPlayers}
                  placeholder="2"
                  keyboardType="numeric"
                />
              </Input>
            </VStack>
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium text-stone-700">{t("games.maxPlayers")}</Text>
              <Input>
                <InputField
                  value={maxPlayers}
                  onChangeText={setMaxPlayers}
                  placeholder="6"
                  keyboardType="numeric"
                />
              </Input>
            </VStack>
          </HStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-700">{t("games.tutorialUrl")}</Text>
            <Input>
              <InputField
                value={tutorialUrl}
                onChangeText={setTutorialUrl}
                placeholder="https://youtube.com/..."
                autoCapitalize="none"
                keyboardType="url"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-700">{t("games.spotifyUrl")}</Text>
            <Input>
              <InputField
                value={spotifyUrl}
                onChangeText={setSpotifyUrl}
                placeholder="https://open.spotify.com/..."
                autoCapitalize="none"
                keyboardType="url"
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-700">{t("games.ownersLabel")}</Text>
            <Input>
              <InputField
                value={owners}
                onChangeText={setOwners}
                placeholder={t("games.ownersPlaceholder")}
              />
            </Input>
          </VStack>

          <VStack space="md" className="mt-3">
            <Button action="primary" isDisabled={saving} onPress={handleSave}>
              <ButtonText>{saving ? t("common.saving") : t("common.saveChanges")}</ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              onPress={async () => {
                for (const p of tempUploadsRef.current) {
                  await removeStorageFile("game-images", p);
                }
                tempUploadsRef.current = [];
                populateForm(game);
                setEditing(false);
              }}
            >
              <ButtonText>{t("common.cancel")}</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-stone-50"
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {imageDisplayUrl ? (
        <Image
          source={{ uri: imageDisplayUrl }}
          className="w-full h-56"
          resizeMode="cover"
        />
      ) : (
        <Center className="w-full h-40 bg-stone-200">
          <Ionicons name="dice-outline" size={48} color="#d6d3d1" />
        </Center>
      )}

      <VStack space="md" className="p-5">
        <Heading size="2xl">{game.name}</Heading>

        {game.genre && (
          <Badge action="info">
            <BadgeText action="info">{game.genre}</BadgeText>
          </Badge>
        )}

        {(game.min_players != null || game.max_players != null) && (
          <HStack space="xs" className="items-center">
            <Ionicons name="people" size={16} color="#78716c" />
            <Text className="text-stone-600">
              {game.min_players ?? "?"} - {game.max_players ?? "?"} {t("common.players")}
            </Text>
          </HStack>
        )}

        {game.description && (
          <Text className="text-stone-600 leading-6">{game.description}</Text>
        )}

        {game.owners?.length ? (
          <VStack space="xs">
            <Text size="sm" className="font-medium text-stone-500">{t("games.owners")}</Text>
            <Text className="text-stone-700">{game.owners.join(", ")}</Text>
          </VStack>
        ) : null}

        <VStack space="md" className="mt-2">
          {game.tutorial_url && (
            <Button
              variant="outline"
              action="negative"
              onPress={() => Linking.openURL(game.tutorial_url!)}
              className="bg-red-50 border-0"
            >
              <ButtonIcon as={Ionicons} name="play-circle-outline" size={22} />
              <ButtonText className="text-red-700 ml-2">{t("games.watchTutorial")}</ButtonText>
            </Button>
          )}
          {game.spotify_playlist_url && (
            <Button
              variant="outline"
              action="positive"
              onPress={() => Linking.openURL(game.spotify_playlist_url!)}
              className="bg-green-50 border-0"
            >
              <ButtonIcon as={Ionicons} name="musical-notes-outline" size={22} />
              <ButtonText className="text-green-700 ml-2">{t("games.spotifyPlaylist")}</ButtonText>
            </Button>
          )}
        </VStack>

        <VStack space="md" className="mt-3">
          <Button action="primary" onPress={() => setEditing(true)}>
            <ButtonText>{t("games.editGame")}</ButtonText>
          </Button>
          <Button
            variant="outline"
            action="negative"
            isDisabled={deleting}
            onPress={handleDelete}
          >
            <ButtonText>{deleting ? t("games.deleting") : t("games.deleteGame")}</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
