import { useEffect, useState, useRef, useCallback } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { supabase } from "./supabase";

const SIGNED_URL_EXPIRY = 3600;
const REFRESH_INTERVAL_MS = (SIGNED_URL_EXPIRY - 300) * 1000; // refresh 5 min before expiry

export function useSignedUrl(
  bucket: string,
  path: string | null | undefined,
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }

    let cancelled = false;

    const fetchUrl = () => {
      supabase.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_URL_EXPIRY)
        .then(({ data, error }) => {
          if (!cancelled && !error && data) setUrl(data.signedUrl);
        });
    };

    fetchUrl();
    timerRef.current = setInterval(fetchUrl, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [bucket, path]);

  return url;
}

export function useSignedUrls(
  bucket: string,
  paths: string[],
): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pathsKey = paths.join("\0");

  const fetchUrls = useCallback(async () => {
    if (!paths.length) {
      setUrls(new Map());
      return;
    }
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY);
    const map = new Map<string, string>();
    data?.forEach((item) => {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    });
    setUrls(map);
  }, [bucket, pathsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchUrls();
    timerRef.current = setInterval(fetchUrls, REFRESH_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchUrls]);

  return urls;
}

export async function removeStorageFile(
  bucket: string,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.warn(`Failed to remove ${bucket}/${path}:`, error.message);
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
