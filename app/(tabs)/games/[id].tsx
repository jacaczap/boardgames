import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { pickAndUploadImage, removeStorageFile, useSignedUrl } from "@/lib/storage";
import type { BoardGame } from "@/lib/types";

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
    setSaving(false);

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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!game) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Game not found</Text>
      </View>
    );
  }

  if (editing) {
    return (
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={handlePickImage} className="mb-4">
          {imageDisplayUrl ? (
            <Image
              source={{ uri: imageDisplayUrl }}
              className="w-full h-48 rounded-xl"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-48 rounded-xl bg-gray-100 items-center justify-center">
              <Ionicons name="camera-outline" size={32} color="#9ca3af" />
              <Text className="text-gray-400 mt-1">Tap to add image</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text className="text-sm font-medium text-gray-700 mb-1">Name *</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base mb-3"
          value={name}
          onChangeText={setName}
          placeholder="Game name"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Description
        </Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base mb-3"
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 80 }}
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Genre</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base mb-3"
          value={genre}
          onChangeText={setGenre}
          placeholder="e.g. Strategy, Party"
        />

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Min Players
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base"
              value={minPlayers}
              onChangeText={setMinPlayers}
              placeholder="2"
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-gray-700 mb-1">
              Max Players
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base"
              value={maxPlayers}
              onChangeText={setMaxPlayers}
              placeholder="6"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Tutorial URL
        </Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base mb-3"
          value={tutorialUrl}
          onChangeText={setTutorialUrl}
          placeholder="https://youtube.com/..."
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Spotify Playlist URL
        </Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base mb-3"
          value={spotifyUrl}
          onChangeText={setSpotifyUrl}
          placeholder="https://open.spotify.com/..."
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Owners (comma-separated)
        </Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base mb-6"
          value={owners}
          onChangeText={setOwners}
          placeholder="Alice, Bob"
        />

        <View className="gap-3">
          <TouchableOpacity
            className={`rounded-xl py-3 items-center ${saving ? "bg-blue-400" : "bg-blue-600"}`}
            onPress={handleSave}
            disabled={saving}
          >
            <Text className="text-white font-semibold text-base">
              {saving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl py-3 items-center"
            onPress={async () => {
              for (const p of tempUploadsRef.current) {
                await removeStorageFile("game-images", p);
              }
              tempUploadsRef.current = [];
              populateForm(game);
              setEditing(false);
            }}
          >
            <Text className="text-gray-600 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
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
        <View className="w-full h-40 bg-gray-100 items-center justify-center">
          <Ionicons name="dice-outline" size={48} color="#d1d5db" />
        </View>
      )}

      <View className="p-5">
        <Text className="text-2xl font-bold text-gray-900">{game.name}</Text>

        {game.genre && (
          <View className="mt-2 self-start bg-blue-50 rounded-full px-3 py-1">
            <Text className="text-blue-700 text-sm font-medium">
              {game.genre}
            </Text>
          </View>
        )}

        {(game.min_players != null || game.max_players != null) && (
          <View className="flex-row items-center mt-3">
            <Ionicons name="people" size={16} color="#6b7280" />
            <Text className="text-gray-600 ml-1">
              {game.min_players ?? "?"} - {game.max_players ?? "?"} players
            </Text>
          </View>
        )}

        {game.description && (
          <Text className="text-gray-600 mt-4 leading-6">
            {game.description}
          </Text>
        )}

        {game.owners?.length ? (
          <View className="mt-4">
            <Text className="text-sm font-medium text-gray-500 mb-1">
              Owners
            </Text>
            <Text className="text-gray-700">{game.owners.join(", ")}</Text>
          </View>
        ) : null}

        <View className="mt-5 gap-3">
          {game.tutorial_url && (
            <TouchableOpacity
              className="flex-row items-center bg-red-50 rounded-xl px-4 py-3"
              onPress={() => Linking.openURL(game.tutorial_url!)}
            >
              <Ionicons
                name="play-circle-outline"
                size={22}
                color="#dc2626"
              />
              <Text className="text-red-700 font-medium ml-2">
                Watch Tutorial
              </Text>
            </TouchableOpacity>
          )}
          {game.spotify_playlist_url && (
            <TouchableOpacity
              className="flex-row items-center bg-green-50 rounded-xl px-4 py-3"
              onPress={() => Linking.openURL(game.spotify_playlist_url!)}
            >
              <Ionicons
                name="musical-notes-outline"
                size={22}
                color="#16a34a"
              />
              <Text className="text-green-700 font-medium ml-2">
                Spotify Playlist
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-6 gap-3">
          <TouchableOpacity
            className="bg-blue-600 rounded-xl py-3 items-center"
            onPress={() => setEditing(true)}
          >
            <Text className="text-white font-semibold">Edit Game</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`border border-red-300 rounded-xl py-3 items-center ${deleting ? "opacity-50" : ""}`}
            onPress={handleDelete}
            disabled={deleting}
          >
            <Text className="text-red-600 font-semibold">
              {deleting ? "Deleting..." : "Delete Game"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
