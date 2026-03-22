import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<BoardGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handlePickImage = async () => {
    const path = await pickAndUploadImage("game-images", id ?? "game");
    if (path) {
      tempUploadsRef.current.push(path);
      setImagePath(path);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Game name is required");
      return;
    }
    const parsedMin = minPlayers ? parseInt(minPlayers, 10) : null;
    const parsedMax = maxPlayers ? parseInt(maxPlayers, 10) : null;
    if (minPlayers && (isNaN(parsedMin!) || parsedMin! < 1)) {
      Alert.alert("Validation", "Min players must be a positive number");
      return;
    }
    if (maxPlayers && (isNaN(parsedMax!) || parsedMax! < 1)) {
      Alert.alert("Validation", "Max players must be a positive number");
      return;
    }
    if (parsedMin != null && parsedMax != null && parsedMin > parsedMax) {
      Alert.alert("Validation", "Min players cannot exceed max players");
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
        Alert.alert("Error", error.message);
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
      Alert.alert("Error", e?.message ?? "Failed to save game");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Game",
      `Are you sure you want to delete "${game?.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              if (game?.image_url) {
                await removeStorageFile("game-images", game.image_url);
              }
              const { error } = await supabase.from("board_games").delete().eq("id", id!);
              if (error) {
                Alert.alert("Error", error.message);
                return;
              }
              router.back();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to delete game");
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
      <Center className="flex-1 bg-white">
        <Spinner />
      </Center>
    );
  }

  if (!game) {
    return (
      <Center className="flex-1 bg-white">
        <Text className="text-gray-500">Game not found</Text>
      </Center>
    );
  }

  if (editing) {
    return (
      <ScrollView
        className="flex-1 bg-white"
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
            <Center className="w-full h-48 rounded-xl bg-gray-100">
              <Ionicons name="camera-outline" size={32} color="#9ca3af" />
              <Text className="text-gray-400 mt-1">Tap to add image</Text>
            </Center>
          )}
        </Pressable>

        <VStack space="md">
          <VStack space="xs">
            <Text size="sm" className="font-medium text-gray-700">Name *</Text>
            <Input>
              <InputField value={name} onChangeText={setName} placeholder="Game name" />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-gray-700">Description</Text>
            <Input>
              <InputField
                value={description}
                onChangeText={setDescription}
                placeholder="Description"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 80 }}
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium text-gray-700">Genre</Text>
            <Input>
              <InputField
                value={genre}
                onChangeText={setGenre}
                placeholder="e.g. Strategy, Party"
              />
            </Input>
          </VStack>

          <HStack space="md">
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium text-gray-700">Min Players</Text>
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
              <Text size="sm" className="font-medium text-gray-700">Max Players</Text>
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
            <Text size="sm" className="font-medium text-gray-700">Tutorial URL</Text>
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
            <Text size="sm" className="font-medium text-gray-700">Spotify Playlist URL</Text>
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
            <Text size="sm" className="font-medium text-gray-700">Owners (comma-separated)</Text>
            <Input>
              <InputField
                value={owners}
                onChangeText={setOwners}
                placeholder="Alice, Bob"
              />
            </Input>
          </VStack>

          <VStack space="md" className="mt-3">
            <Button action="primary" isDisabled={saving} onPress={handleSave}>
              <ButtonText>{saving ? "Saving..." : "Save Changes"}</ButtonText>
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
              <ButtonText>Cancel</ButtonText>
            </Button>
          </VStack>
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {imageDisplayUrl ? (
        <Image
          source={{ uri: imageDisplayUrl }}
          className="w-full h-56"
          resizeMode="cover"
        />
      ) : (
        <Center className="w-full h-40 bg-gray-100">
          <Ionicons name="dice-outline" size={48} color="#d1d5db" />
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
            <Ionicons name="people" size={16} color="#6b7280" />
            <Text className="text-gray-600">
              {game.min_players ?? "?"} - {game.max_players ?? "?"} players
            </Text>
          </HStack>
        )}

        {game.description && (
          <Text className="text-gray-600 leading-6">{game.description}</Text>
        )}

        {game.owners?.length ? (
          <VStack space="xs">
            <Text size="sm" className="font-medium text-gray-500">Owners</Text>
            <Text className="text-gray-700">{game.owners.join(", ")}</Text>
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
              <ButtonText className="text-red-700 ml-2">Watch Tutorial</ButtonText>
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
              <ButtonText className="text-green-700 ml-2">Spotify Playlist</ButtonText>
            </Button>
          )}
        </VStack>

        <VStack space="md" className="mt-3">
          <Button action="primary" onPress={() => setEditing(true)}>
            <ButtonText>Edit Game</ButtonText>
          </Button>
          <Button
            variant="outline"
            action="negative"
            isDisabled={deleting}
            onPress={handleDelete}
          >
            <ButtonText>{deleting ? "Deleting..." : "Delete Game"}</ButtonText>
          </Button>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
