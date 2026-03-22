import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { supabase } from "./supabase";

const SIGNED_URL_EXPIRY = 3600;

export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY)
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  return url;
}

export async function getSignedUrls(
  bucket: string,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_EXPIRY);
  data?.forEach((item) => {
    if (item.signedUrl) map.set(item.path!, item.signedUrl);
  });
  return map;
}

export async function pickAndUploadImage(
  bucket: string,
  filePrefix: string,
): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const ext = asset.uri.split(".").pop() ?? "jpg";
  const fileName = `${filePrefix}_${Date.now()}.${ext}`;

  const response = await fetch(asset.uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from(bucket).upload(fileName, blob, {
    contentType: asset.mimeType ?? "image/jpeg",
    upsert: true,
  });

  if (error) {
    Alert.alert("Upload failed", error.message);
    return null;
  }

  return fileName;
}
