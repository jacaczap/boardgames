import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { pickAndUploadImage, useSignedUrl } from "@/lib/storage";

export default function NewGameScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [tutorialUrl, setTutorialUrl] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [owners, setOwners] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);

  const imageDisplayUrl = useSignedUrl("game-images", imagePath);

  const handlePickImage = async () => {
    const path = await pickAndUploadImage("game-images", "new");
    if (path) setImagePath(path);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation", "Game name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("board_games").insert({
      name: name.trim(),
      description: description.trim() || null,
      genre: genre.trim() || null,
      min_players: minPlayers ? parseInt(minPlayers, 10) : null,
      max_players: maxPlayers ? parseInt(maxPlayers, 10) : null,
      tutorial_url: tutorialUrl.trim() || null,
      spotify_playlist_url: spotifyUrl.trim() || null,
      owners: owners.trim()
        ? owners
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : null,
      image_url: imagePath,
    });
    setSaving(false);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    router.back();
  };

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
          <View className="w-full h-48 rounded-xl bg-gray-100 items-center justify-center border-2 border-dashed border-gray-300">
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

      <TouchableOpacity
        className={`rounded-xl py-3 items-center ${saving ? "bg-blue-400" : "bg-blue-600"}`}
        onPress={handleSave}
        disabled={saving}
      >
        <Text className="text-white font-semibold text-base">
          {saving ? "Saving..." : "Add Game"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
