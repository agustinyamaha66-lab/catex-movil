import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabase";
import { Brand } from "../../constants/brand";
import { registerPushToken, sendLocalNotification } from "../../lib/notifications";

interface Viaje {
  id: number;
  created_at?: string;
  fecha: string;
  patente: string;
  nodo: string;
  local?: string | null;
  hora_citacion: string;
  numero_vuelta: number;
  hora_llegada?: string | null;
  hora_salida?: string | null;
  hora_fin_reparto?: string | null;
  gps_llegada_lat?: string | null;
  gps_llegada_lon?: string | null;
  mensaje_admin?: string | null;
  comentario?: string | null;
  estado?: string | null;
  chofer?: string | null;
  user_id?: string | null;
}

const TABLA = "asignaciones_transporte";

const fechaHoyLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const formatHora = (v?: string | null) => {
  if (!v) return "--";
  if (/^\d{2}:\d{2}/.test(v)) return v.slice(0, 5);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export default function RutaScreen() {
  const [patente, setPatente] = useState("");
  const [patenteActiva, setPatenteActiva] = useState<string>("");
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState("");

  const channelRef = useRef<any>(null);
  const contentAnim = useRef(new Animated.Value(0)).current;
  const prevRouteCount = useRef(0);

  const fecha = fechaHoyLocal();

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  useEffect(() => {
    if (!patenteActiva) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const filterPatente = `patente=eq.${patenteActiva}`;

    const ch = supabase
      .channel(`alertas-chofer-${patenteActiva}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLA, filter: filterPatente },
        (payload: any) => {
          const nuevoMensaje = payload?.new?.mensaje_admin;
          const anteriorMensaje = payload?.old?.mensaje_admin;
          if (nuevoMensaje && nuevoMensaje !== anteriorMensaje) {
            Alert.alert("Mensaje de central", String(nuevoMensaje));
          }

          const nuevoComentario = payload?.new?.comentario;
          const anteriorComentario = payload?.old?.comentario;
          if (nuevoComentario && nuevoComentario !== anteriorComentario) {
            Alert.alert("Nuevo comentario", String(nuevoComentario));
          }

          buscarPatente(patenteActiva);
        }
      )
      .subscribe();

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [patenteActiva]);

  useEffect(() => {
    if (!patenteActiva) return;
    registerPushToken(patenteActiva);
  }, [patenteActiva]);

  useEffect(() => {
    if (!patenteActiva) return;
    if (viajes.length > 0 && prevRouteCount.current === 0) {
      sendLocalNotification(
        "Ruta disponible",
        `La ruta para la patente ${patenteActiva} ya está cargada.`,
        { target: "ruta" }
      );
    }
    prevRouteCount.current = viajes.length;
  }, [viajes, patenteActiva]);

  const buscarPatente = async (patenteOverride?: string) => {
    const patenteRaw = (patenteOverride ?? patente).trim();
    if (!patenteRaw) return Alert.alert("Falta información", "Por favor ingresa tu patente.");

    setLoading(true);
    setViajes([]);
    setEmptyMessage("");

    const patenteKey = patenteRaw.toUpperCase();

    try {
      const { data, error } = await supabase
        .from(TABLA)
        .select("*")
        .eq("patente", patenteKey)
        .eq("fecha", fecha)
        .order("numero_vuelta", { ascending: true })
        .order("hora_citacion", { ascending: true });

      if (error) throw error;

      await AsyncStorage.setItem("patente_sesion", patenteKey);
      setPatenteActiva(patenteKey);

      if (data && data.length > 0) {
        setViajes(data as Viaje[]);
        setEmptyMessage("");
      } else {
        setEmptyMessage("Ruta aún no cargada. Vuelve a intentar en unos minutos.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Error consultando Supabase");
      setEmptyMessage("No se pudo cargar la ruta. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cargarRutaAutomatica = async () => {
      try {
        const p = await AsyncStorage.getItem("patente_sesion");
        if (p) {
          const patenteKey = p.trim().toUpperCase();
          setPatente(patenteKey);
          await buscarPatente(patenteKey);
        }
      } catch (e) {}
    };
    cargarRutaAutomatica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcarAccion = async (id: number, etapa: "LLEGADA" | "SALIDA" | "FIN") => {
    setLocationLoading(true);
    const ahoraISO = new Date().toISOString();

    let updates: Record<string, any> = {};

    try {
      if (etapa === "LLEGADA") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          throw new Error("Permiso de ubicación denegado. Actívalo en ajustes.");
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        updates = {
          hora_llegada: ahoraISO,
          gps_llegada_lat: String(location.coords.latitude),
          gps_llegada_lon: String(location.coords.longitude),
        };
      }

      if (etapa === "SALIDA") updates = { hora_salida: ahoraISO };
      if (etapa === "FIN") updates = { hora_fin_reparto: ahoraISO };

      const { error } = await supabase.from(TABLA).update(updates).eq("id", id);
      if (error) throw error;

      Alert.alert("Registro exitoso", `Se ha marcado ${etapa} correctamente.`);
      await buscarPatente();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo actualizar el estado.");
    } finally {
      setLocationLoading(false);
    }
  };

  const maxVuelta = (list: Viaje[]) => {
    if (!list?.length) return 1;
    return Math.max(...list.map((o) => Number(o.numero_vuelta || 1)));
  };

  const crearSiguienteVuelta = async (viajeOriginal: Viaje) => {
    const siguienteNumero = (viajeOriginal.numero_vuelta || 1) + 1;

    Alert.alert(
      `Iniciar vuelta #${siguienteNumero}`,
      "Se registrará la llegada (hora y GPS) de la vuelta nueva. ¿Confirmar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, iniciar",
          onPress: async () => {
            setLoading(true);
            setLocationLoading(true);

            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== "granted") {
                throw new Error("Permiso de ubicación denegado. Actívalo en ajustes.");
              }

              const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });

              const ahoraISO = new Date().toISOString();

              const horaHHMM = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

              const { error } = await supabase.from(TABLA).insert([
                {
                  fecha: viajeOriginal.fecha,
                  patente: viajeOriginal.patente,
                  nodo: viajeOriginal.nodo,
                  local: viajeOriginal.local ?? null,
                  hora_citacion: horaHHMM,
                  numero_vuelta: siguienteNumero,
                  estado: "pendiente",
                  hora_llegada: ahoraISO,
                  gps_llegada_lat: String(location.coords.latitude),
                  gps_llegada_lon: String(location.coords.longitude),
                  hora_salida: null,
                  hora_fin_reparto: null,
                },
              ]);

              if (error) throw error;

              Alert.alert("Éxito", `Vuelta #${siguienteNumero} creada (llegada registrada).`);
              await buscarPatente(viajeOriginal.patente);
            } catch (error: any) {
              Alert.alert("Error", error?.message || "No se pudo crear la vuelta.");
            } finally {
              setLocationLoading(false);
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundGlow} />
      <View style={styles.backgroundOrb} />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandBadge}>
            <Ionicons name="navigate-outline" size={14} color="white" />
            <Text style={styles.brandBadgeText}>CATEX Ruta</Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>Gestión de ruta</Text>
        <Text style={styles.headerSubtitle}>
          Actualiza cada hito de tu vuelta en tiempo real.
        </Text>

        <View style={styles.headerMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={14} color="white" />
            <Text style={styles.metaText}>{fecha}</Text>
          </View>
          {!!patenteActiva && (
            <View style={styles.metaChip}>
              <Ionicons name="car-outline" size={14} color="white" />
              <Text style={styles.metaText}>{patenteActiva}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.scrollInner,
            {
              opacity: contentAnim,
              transform: [
                {
                  translateY: contentAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.searchCard}>
            <Text style={styles.sectionLabel}>Patente</Text>
            <View style={styles.inputRow}>
              <Ionicons name="car-sport-outline" size={18} color={Brand.colors.subtle} />
              <TextInput
                style={styles.input}
                value={patente}
                onChangeText={setPatente}
                placeholder="Ej: AB1234"
                placeholderTextColor={Brand.colors.subtle}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.btnPrimary} onPress={() => buscarPatente()} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={Brand.colors.surface} />
              ) : (
                <Text style={styles.btnPrimaryText}>Buscar rutas</Text>
              )}
            </TouchableOpacity>
          </View>

          {viajes.map((viaje) => (
            <View key={viaje.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>VUELTA #{viaje.numero_vuelta}</Text>
                </View>
                <Text style={styles.hora}>Inicio: {viaje.hora_citacion}</Text>
              </View>

              <Text style={styles.infoText}>Nodo: {viaje.nodo}</Text>
              {!!viaje.local && <Text style={styles.infoText}>Local: {viaje.local}</Text>}

              {!!viaje.comentario && (
                <View style={styles.commentBox}>
                  <Text style={styles.commentLabel}>Comentario de central</Text>
                  <Text style={styles.commentText}>{viaje.comentario}</Text>
                </View>
              )}

              <View style={styles.statusGrid}>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Llegada</Text>
                  <Text style={styles.statusValue}>{formatHora(viaje.hora_llegada)}</Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Salida</Text>
                  <Text style={styles.statusValue}>{formatHora(viaje.hora_salida)}</Text>
                </View>
                <View style={styles.statusItem}>
                  <Text style={styles.statusLabel}>Fin</Text>
                  <Text style={styles.statusValue}>{formatHora(viaje.hora_fin_reparto)}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                {!viaje.hora_llegada && (
                  <View style={styles.actionBlock}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnGreen]}
                      onPress={() => marcarAccion(viaje.id, "LLEGADA")}
                      disabled={locationLoading}
                    >
                      <Text style={styles.btnText}>{locationLoading ? "Ubicando..." : "Marcar llegada"}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {viaje.hora_llegada && !viaje.hora_salida && (
                  <View style={styles.actionBlock}>
                    <Text style={[styles.actionNote, styles.actionSuccess]}>
                      Llegada registrada: {formatHora(viaje.hora_llegada)}
                    </Text>

                    <TouchableOpacity
                      style={[styles.btn, styles.btnBlue]}
                      onPress={() => marcarAccion(viaje.id, "SALIDA")}
                      disabled={locationLoading}
                    >
                      <Text style={styles.btnText}>Marcar salida</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {viaje.hora_salida && !viaje.hora_fin_reparto && (
                  <View style={styles.actionBlock}>
                    <Text style={[styles.actionNote, styles.actionSuccess]}>
                      Salida registrada: {formatHora(viaje.hora_salida)}
                    </Text>

                    <TouchableOpacity
                      style={[styles.btn, styles.btnOrange]}
                      onPress={() => marcarAccion(viaje.id, "FIN")}
                      disabled={locationLoading}
                    >
                      <Text style={styles.btnText}>Marcar fin</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {viaje.numero_vuelta === maxVuelta(viajes) && (
                  <View>
                    {viaje.hora_fin_reparto ? (
                      <Text style={[styles.actionNote, styles.actionSuccess]}>
                        Fin registrado: {formatHora(viaje.hora_fin_reparto)}
                      </Text>
                    ) : (
                      <Text style={styles.actionNote}>
                        Para iniciar la siguiente vuelta, primero marca fin en esta vuelta.
                      </Text>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.btnTeal,
                        !viaje.hora_fin_reparto && styles.btnDisabled,
                      ]}
                      onPress={() => crearSiguienteVuelta(viaje)}
                      disabled={!viaje.hora_fin_reparto || loading || locationLoading}
                    >
                      <Text style={styles.btnText}>Iniciar vuelta #{maxVuelta(viajes) + 1}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}

          {!loading && viajes.length === 0 && patente !== "" && (
            <Text style={styles.emptyText}>
              {emptyMessage || "No se encontraron datos."}
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.colors.background },
  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Brand.colors.primarySoft,
    top: -160,
    right: -140,
    opacity: 0.7,
  },
  backgroundOrb: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Brand.colors.accentSoft,
    bottom: -120,
    left: -90,
    opacity: 0.6,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Brand.colors.navy,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  brandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  brandBadgeText: {
    color: "white",
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: Brand.fonts.label,
  },
  headerTitle: {
    color: "white",
    fontSize: 22,
    fontFamily: Brand.fonts.display,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 6,
    fontSize: 13,
    fontFamily: Brand.fonts.body,
  },
  headerMeta: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  metaText: { color: "white", fontSize: 12, fontFamily: Brand.fonts.label },
  scrollContent: { padding: 16, paddingBottom: 90 },
  scrollInner: { gap: 16 },
  searchCard: {
    backgroundColor: Brand.colors.surface,
    padding: 16,
    borderRadius: Brand.radius.lg,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    ...Brand.shadow.card,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: Brand.colors.muted,
    fontFamily: Brand.fonts.label,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  btnPrimary: {
    marginTop: 12,
    backgroundColor: Brand.colors.primary,
    paddingVertical: 12,
    borderRadius: Brand.radius.md,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: Brand.colors.surface,
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    fontFamily: Brand.fonts.label,
  },
  card: {
    backgroundColor: Brand.colors.surface,
    padding: 16,
    borderRadius: Brand.radius.lg,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    ...Brand.shadow.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    backgroundColor: Brand.colors.navy,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "white",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: Brand.fonts.label,
  },
  hora: { color: Brand.colors.muted, fontFamily: Brand.fonts.label },
  infoText: { marginTop: 6, color: Brand.colors.ink, fontFamily: Brand.fonts.body },
  commentBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Brand.colors.primarySoft,
    borderLeftWidth: 4,
    borderLeftColor: Brand.colors.primary,
    borderRadius: Brand.radius.md,
  },
  commentLabel: {
    fontSize: 11,
    fontFamily: Brand.fonts.label,
    color: Brand.colors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: Brand.colors.inkSoft,
    fontFamily: Brand.fonts.body,
    lineHeight: 20,
  },
  statusGrid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusItem: {
    flex: 1,
    minWidth: 92,
    backgroundColor: "#F8FAFC",
    borderRadius: Brand.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Brand.colors.border,
  },
  statusLabel: {
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: Brand.colors.muted,
    fontFamily: Brand.fonts.label,
  },
  statusValue: {
    marginTop: 6,
    fontSize: 14,
    color: Brand.colors.ink,
    fontFamily: Brand.fonts.label,
  },
  actions: { marginTop: 14, gap: 10 },
  actionBlock: { gap: 10 },
  actionNote: { color: Brand.colors.muted, fontFamily: Brand.fonts.body },
  actionSuccess: { color: Brand.colors.success, fontFamily: Brand.fonts.label },
  btn: {
    paddingVertical: 12,
    borderRadius: Brand.radius.md,
    alignItems: "center",
  },
  btnGreen: { backgroundColor: Brand.colors.success },
  btnBlue: { backgroundColor: Brand.colors.primary },
  btnOrange: { backgroundColor: Brand.colors.warning },
  btnTeal: { backgroundColor: Brand.colors.accent },
  btnText: {
    color: Brand.colors.surface,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: Brand.fonts.label,
  },
  btnDisabled: { opacity: 0.45 },
  emptyText: {
    textAlign: "center",
    marginTop: 10,
    color: Brand.colors.muted,
    fontFamily: Brand.fonts.body,
  },
});
