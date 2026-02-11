import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabase";
import { Brand } from "../../constants/brand";

export default function LoginScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [patente, setPatente] = useState("");
  const [loading, setLoading] = useState(false);
  const enterAnim = useRef(new Animated.Value(0)).current;

  const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

  useEffect(() => {
    const verificar = async () => {
      const p = await AsyncStorage.getItem("patente_sesion");
      if (p && p.trim()) router.replace("/(tabs)/ruta");
    };
    verificar();
  }, [router]);

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

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

      await AsyncStorage.setItem("nombre_usuario", nombre.trim());
      await AsyncStorage.setItem("patente_sesion", patenteKey);
      router.replace("/(tabs)/ruta");
    } catch (err: any) {
      Alert.alert("Error de conexión", err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: "padding", android: "height" })}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity: enterAnim,
              transform: [
                {
                  translateY: enterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="car-outline" size={22} color={Brand.colors.primary} />
            </View>
            <View>
              <Text style={styles.brandTitle}>CATEX</Text>
              <Text style={styles.brandSubtitle}>Control de acceso</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Ingreso de chofer</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={Brand.colors.subtle} />
              <TextInput
                style={styles.input}
                placeholder="Escribe tu nombre"
                placeholderTextColor={Brand.colors.subtle}
                value={nombre}
                onChangeText={setNombre}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Patente</Text>
            <View style={styles.inputRow}>
              <Ionicons name="car-sport-outline" size={18} color={Brand.colors.subtle} />
              <TextInput
                style={styles.input}
                placeholder="Ej: AB1234"
                placeholderTextColor={Brand.colors.subtle}
                value={patente}
                onChangeText={setPatente}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.btnLogin} onPress={manejarLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Brand.colors.surface} />
            ) : (
              <Text style={styles.btnText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>

          <View style={styles.helperRow}>
            <Ionicons name="calendar-outline" size={14} color={Brand.colors.muted} />
            <Text style={styles.footerText}>Solo acceso para repartos vigentes hoy ({fechaHoy})</Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  orbOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Brand.colors.primarySoft,
    top: -60,
    right: -50,
    opacity: 0.7,
  },
  orbTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Brand.colors.accentSoft,
    bottom: -70,
    left: -40,
    opacity: 0.6,
  },
  card: {
    backgroundColor: Brand.colors.surface,
    padding: 24,
    borderRadius: Brand.radius.xl,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    ...Brand.shadow.float,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Brand.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 22,
    letterSpacing: 2,
    color: Brand.colors.ink,
    fontFamily: Brand.fonts.display,
  },
  brandSubtitle: {
    fontSize: 13,
    color: Brand.colors.muted,
    fontFamily: Brand.fonts.body,
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 16,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Brand.colors.inkSoft,
    fontFamily: Brand.fonts.label,
  },
  inputGroup: { marginBottom: 14 },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Brand.colors.muted,
    marginBottom: 6,
    fontFamily: Brand.fonts.label,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: Brand.radius.md,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    backgroundColor: "#F8FAFC",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Brand.colors.ink,
    fontFamily: Brand.fonts.body,
  },
  btnLogin: {
    backgroundColor: Brand.colors.primary,
    paddingVertical: 14,
    borderRadius: Brand.radius.md,
    alignItems: "center",
    marginTop: 6,
  },
  btnText: {
    color: Brand.colors.surface,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: Brand.fonts.label,
  },
  helperRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: Brand.colors.muted,
    fontFamily: Brand.fonts.body,
  },
});
