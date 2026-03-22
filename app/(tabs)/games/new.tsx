import React, { useState, useRef, useEffect } from "react";
import { ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { pickAndUploadImage, removeStorageFile, useSignedUrl } from "@/lib/storage";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Center } from "@/components/ui/center";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";

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
  const savedRef = useRef(false);
  const imagePathRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (!savedRef.current && imagePathRef.current) {
        removeStorageFile("game-images", imagePathRef.current);
      }
    };
  }, []);

  const imageDisplayUrl = useSignedUrl("game-images", imagePath);

  const handlePickImage = async () => {
    const path = await pickAndUploadImage("game-images", "new");
    if (path) {
      if (imagePath) {
        await removeStorageFile("game-images", imagePath);
      }
      setImagePath(path);
      imagePathRef.current = path;
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
      const { error } = await supabase.from("board_games").insert({
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
      });

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      savedRef.current = true;
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add game");
    } finally {
      setSaving(false);
    }
  };

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
          <Center className="w-full h-48 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300">
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

        <Button
          action="primary"
          isDisabled={saving}
          onPress={handleSave}
          className="mt-3"
        >
          <ButtonText>{saving ? "Saving..." : "Add Game"}</ButtonText>
        </Button>
      </VStack>
    </ScrollView>
  );
}
