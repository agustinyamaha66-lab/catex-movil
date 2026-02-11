import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";

let initialized = false;

export const initNotifications = async () => {
  if (initialized) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1D4ED8",
    });
  }

  initialized = true;
};

export const registerPushToken = async (patente?: string) => {
  if (!patente) return null;
  await initNotifications();

  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await AsyncStorage.setItem("expo_push_token", token);

  try {
    await supabase
      .from("device_tokens")
      .upsert(
        {
          patente,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );
  } catch {
    // Ignore if the table doesn't exist yet.
  }

  return token;
};

export const sendLocalNotification = async (
  title: string,
  body: string,
  data?: Record<string, any>
) => {
  await initNotifications();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: "default" },
    trigger: null,
  });
};

export const addNotificationResponseListener = (
  handler: (data?: Record<string, any>) => void
) => {
  const onResponse = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const data = response.notification.request.content.data as Record<string, any>;
    handler(data);
  };

  Notifications.getLastNotificationResponseAsync().then(onResponse);
  const subscription = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => subscription.remove();
};
