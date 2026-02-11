import { Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function TabsLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const check = async () => {
      const patente = await AsyncStorage.getItem("patente_sesion");
      const ok = !!(patente && patente.trim());
      setHasSession(ok);
      setReady(true);

      if (!ok) router.replace("/login");
    };

    check();
  }, [router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasSession) {
    // Importante: no renderizar tabs si no hay sesión
    return null;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="ruta" options={{ title: "Mi Ruta" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="devolucion" options={{ title: "Devolución" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
    </Tabs>
  );
}
