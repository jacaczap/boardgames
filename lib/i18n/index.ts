import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./en";
import pl from "./pl";

const LANGUAGE_KEY = "app_language";

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "en";
const defaultLang = deviceLocale === "pl" ? "pl" : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pl: { translation: pl },
  },
  lng: defaultLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
  if (saved && saved !== i18n.language) {
    i18n.changeLanguage(saved);
  }
});

export async function setLanguagePreference(lang: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export function getDateLocale(): string {
  return i18n.language === "pl" ? "pl-PL" : "en-GB";
}

export default i18n;
