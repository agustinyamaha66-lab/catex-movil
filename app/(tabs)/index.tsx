import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const go = async () => {
      const patente = await AsyncStorage.getItem("patente_sesion");
      if (patente && patente.trim()) {
        router.replace("/(tabs)/ruta");
      } else {
        router.replace("/login");
      }
    };
    go();
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
