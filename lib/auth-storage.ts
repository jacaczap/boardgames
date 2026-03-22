import AsyncStorage from "@react-native-async-storage/async-storage";

const STAY_LOGGED_IN_KEY = "stay_logged_in";

export async function getStayLoggedIn(): Promise<boolean> {
  const value = await AsyncStorage.getItem(STAY_LOGGED_IN_KEY);
  return value !== "false";
}

export async function setStayLoggedIn(value: boolean): Promise<void> {
  await AsyncStorage.setItem(STAY_LOGGED_IN_KEY, value.toString());
}
