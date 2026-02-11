import React from "react";
import { Stack } from "expo-router";

export default function RootLayout() {
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
