import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../supabase";

export default function LoginScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [patente, setPatente] = useState("");
  const [loading, setLoading] = useState(false);

  const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

  useEffect(() => {
    const verificar = async () => {
      const p = await AsyncStorage.getItem("patente_sesion");
      if (p && p.trim()) router.replace("/(tabs)/ruta");
    };
    verificar();
  }, [router]);

  const manejarLogin = async () => {
    if (!nombre.trim() || !patente.trim()) {
      return Alert.alert("Error", "Por favor completa tu nombre y la patente.");
    }

    setLoading(true);
    const patenteKey = patente.trim().toUpperCase();

    try {
      const { data, error } = await supabase
        .from("asignaciones_transporte")
        .select("id")
        .eq("patente", patenteKey)
        .eq("fecha", fechaHoy)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        await AsyncStorage.setItem("nombre_usuario", nombre.trim());
        await AsyncStorage.setItem("patente_sesion", patenteKey);
        router.replace("/(tabs)/ruta");
      } else {
        Alert.alert("Acceso Denegado", "Esta patente no tiene repartos asignados para el día de hoy.");
      }
    } catch (err: any) {
      Alert.alert("Error de conexión", err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🚚 CATEX</Text>
        <Text style={styles.welcome}>Control de Acceso</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre del Chofer:</Text>
          <TextInput style={styles.input} placeholder="Escribe tu nombre" value={nombre} onChangeText={setNombre} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clave (Patente del Camión):</Text>
          <TextInput
            style={styles.input}
            placeholder="EJ: AB1234"
            value={patente}
            onChangeText={setPatente}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity style={styles.btnLogin} onPress={manejarLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>INICIAR SESIÓN</Text>}
        </TouchableOpacity>

        <Text style={styles.footerText}>Solo acceso para repartos vigentes hoy ({fechaHoy})</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e3c72", justifyContent: "center", padding: 20 },
  card: { backgroundColor: "white", padding: 30, borderRadius: 25, elevation: 10 },
  logo: { fontSize: 32, fontWeight: "900", color: "#1e3c72", textAlign: "center", marginBottom: 5 },
  welcome: { fontSize: 16, color: "#666", textAlign: "center", marginBottom: 30 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 8 },
  input: { backgroundColor: "#f5f5f5", padding: 15, borderRadius: 10, borderWidth: 1, borderColor: "#ddd", fontSize: 16 },
  btnLogin: { backgroundColor: "#d63384", padding: 18, borderRadius: 15, alignItems: "center", marginTop: 10 },
  btnText: { color: "white", fontWeight: "bold", fontSize: 18 },
  footerText: { marginTop: 20, textAlign: "center", fontSize: 12, color: "#999" },
});
