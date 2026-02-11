import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addNotificationResponseListener, initNotifications } from "../lib/notifications";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    initNotifications();
    const unsubscribe = addNotificationResponseListener(async (data) => {
      const patente = await AsyncStorage.getItem("patente_sesion");
      if (!patente || !patente.trim()) {
        router.replace("/login");
        return;
      }

      const target = data?.target;
      if (target === "ruta") router.replace("/(tabs)/ruta");
      else router.replace("/(tabs)/chat");
    });

    return unsubscribe;
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Login */}
      <Stack.Screen name="login" />
      {/* Tabs */}
      <Stack.Screen name="(tabs)" />
      {/* Modal si lo usas */}
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}
