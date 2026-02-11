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
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../supabase";

interface Viaje {
  id: number;
  created_at?: string;

  fecha: string; // YYYY-MM-DD
  patente: string;
  nodo: string;
  local?: string | null;

  hora_citacion: string;
  numero_vuelta: number;

  hora_llegada?: string | null;      // TEXT (en tu tabla)
  hora_salida?: string | null;       // TIMESTAMPTZ
  hora_fin_reparto?: string | null;  // TIMESTAMPTZ

  gps_llegada_lat?: string | null;
  gps_llegada_lon?: string | null;

  mensaje_admin?: string | null;
  comentario?: string | null; // ✅ NUEVO: comentario desde la web
  estado?: string | null;

  chofer?: string | null;
  user_id?: string | null;
}

const TABLA = "asignaciones_transporte";

// ✅ Fecha local (evita desfase por UTC)
const fechaHoyLocal = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ✅ Formatea horas desde Supabase:
// - Si viene "HH:MM" o "HH:MM:SS" (TEXT o TIME), lo muestra HH:MM
// - Si viene ISO (TIMESTAMPTZ o TEXT con ISO), lo convierte a HH:MM local
const formatHora = (v?: string | null) => {
  if (!v) return "--";

  // "10:33" o "10:33:00"
  if (/^\d{2}:\d{2}/.test(v)) return v.slice(0, 5);

  // ISO o fecha parseable
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

  const channelRef = useRef<any>(null);

  const fecha = fechaHoyLocal();

  // ✅ Suscripción a mensajes Y comentarios (filtrada por patente)
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
              // ✅ Alerta para mensaje_admin
              const nuevoMensaje = payload?.new?.mensaje_admin;
              const anteriorMensaje = payload?.old?.mensaje_admin;
              if (nuevoMensaje && nuevoMensaje !== anteriorMensaje) {
                Alert.alert("📢 MENSAJE DE CENTRAL", String(nuevoMensaje));
              }

              // ✅ NUEVO: Alerta para comentario (opcional, o solo actualizar la UI)
              const nuevoComentario = payload?.new?.comentario;
              const anteriorComentario = payload?.old?.comentario;
              if (nuevoComentario && nuevoComentario !== anteriorComentario) {
                Alert.alert("💬 NUEVO COMENTARIO", String(nuevoComentario));
              }

              // ✅ Actualizar la lista de viajes en tiempo real
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

  const buscarPatente = async (patenteOverride?: string) => {
    const patenteRaw = (patenteOverride ?? patente).trim();
    if (!patenteRaw) return Alert.alert("Falta información", "Por favor ingresa tu patente.");

    setLoading(true);
    setViajes([]);

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

      if (data && data.length > 0) setViajes(data as Viaje[]);
      else Alert.alert("Sin Resultados", "No se encontraron rutas asignadas para hoy.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Error consultando Supabase");
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

  const cerrarSesion = async () => {
    Alert.alert(
        "Cerrar sesión",
        "Esto borrará la patente guardada y detendrá las alertas de Central. ¿Continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sí, cerrar",
            style: "destructive",
            onPress: async () => {
              await AsyncStorage.removeItem("patente_sesion");
              if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
              }
              setPatenteActiva("");
              setPatente("");
              setViajes([]);
              Alert.alert("Listo", "Sesión cerrada. Ingresa una nueva patente para continuar.");
            },
          },
        ]
    );
  };

  const marcarAccion = async (id: number, etapa: "LLEGADA" | "SALIDA" | "FIN") => {
    setLocationLoading(true);

    // ✅ TIMESTAMPTZ -> ISO
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

        // ✅ hora_llegada es TEXT: guardamos ISO (consistente y parseable)
        updates = {
          hora_llegada: ahoraISO,
          gps_llegada_lat: String(location.coords.latitude),
          gps_llegada_lon: String(location.coords.longitude),
        };
      }

      // ✅ hora_salida y hora_fin_reparto son TIMESTAMPTZ
      if (etapa === "SALIDA") updates = { hora_salida: ahoraISO };
      if (etapa === "FIN") updates = { hora_fin_reparto: ahoraISO };

      const { error } = await supabase.from(TABLA).update(updates).eq("id", id);
      if (error) throw error;

      Alert.alert("¡Registro Exitoso!", `Se ha marcado ${etapa} correctamente.`);
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
        `Iniciar Vuelta #${siguienteNumero}`,
        `Se registrará la LLEGADA (hora + GPS) de la vuelta nueva. ¿Confirmar?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sí, Iniciar",
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

                // hora_citacion: mantengo HH:MM (si tu columna es TIME o TEXT sirve)
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

                    // ✅ hora_llegada TEXT en ISO
                    hora_llegada: ahoraISO,
                    gps_llegada_lat: String(location.coords.latitude),
                    gps_llegada_lon: String(location.coords.longitude),

                    // ✅ TIMESTAMPTZ deben ir null o ISO
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚚 CATEX APP</Text>
          <Text style={styles.headerSubtitle}>Gestión de Ruta</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.searchBox}>
            <View style={styles.rowTop}>
              <Text style={styles.label}>PATENTE:</Text>
              <TouchableOpacity style={styles.logoutBtn} onPress={cerrarSesion}>
                <Text style={styles.logoutText}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>

            <TextInput
                style={styles.input}
                value={patente}
                onChangeText={setPatente}
                placeholder="Ej: AB1234"
                autoCapitalize="characters"
            />

            <TouchableOpacity style={styles.btnSearch} onPress={() => buscarPatente()} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>BUSCAR 🔎</Text>}
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

                {/* ✅ NUEVO: Mostrar comentario si existe */}
                {!!viaje.comentario && (
                    <View style={styles.commentBox}>
                      <Text style={styles.commentLabel}>💬 COMENTARIO DE CENTRAL:</Text>
                      <Text style={styles.commentText}>{viaje.comentario}</Text>
                    </View>
                )}

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>LLEGADA:</Text>
                  <Text style={styles.statusValue}>{formatHora(viaje.hora_llegada)}</Text>
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>SALIDA:</Text>
                  <Text style={styles.statusValue}>{formatHora(viaje.hora_salida)}</Text>
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>FIN:</Text>
                  <Text style={styles.statusValue}>{formatHora(viaje.hora_fin_reparto)}</Text>
                </View>

                <View style={styles.actions}>
                  {!viaje.hora_llegada && (
                      <View style={styles.actionBlock}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnGreen]}
                            onPress={() => marcarAccion(viaje.id, "LLEGADA")}
                            disabled={locationLoading}
                        >
                          <Text style={styles.btnText}>
                            {locationLoading ? "UBICANDO..." : "MARCAR LLEGADA 📍"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                  )}

                  {viaje.hora_llegada && !viaje.hora_salida && (
                      <View style={styles.actionBlock}>
                        <Text style={[styles.infoText, { color: "green", fontWeight: "bold" }]}>
                          ✅ LLEGADA: {formatHora(viaje.hora_llegada)}
                        </Text>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnBlue]}
                            onPress={() => marcarAccion(viaje.id, "SALIDA")}
                            disabled={locationLoading}
                        >
                          <Text style={styles.btnText}>MARCAR SALIDA 🕒</Text>
                        </TouchableOpacity>
                      </View>
                  )}

                  {viaje.hora_salida && !viaje.hora_fin_reparto && (
                      <View style={styles.actionBlock}>
                        <Text style={[styles.infoText, { color: "green", fontWeight: "bold" }]}>
                          ✅ SALIDA: {formatHora(viaje.hora_salida)}
                        </Text>

                        <TouchableOpacity
                            style={[styles.btn, styles.btnOrange]}
                            onPress={() => marcarAccion(viaje.id, "FIN")}
                            disabled={locationLoading}
                        >
                          <Text style={styles.btnText}>MARCAR EN RUTA 🚛</Text>
                        </TouchableOpacity>
                      </View>
                  )}

                  {viaje.numero_vuelta === maxVuelta(viajes) && (
                      <View>
                        {viaje.hora_fin_reparto ? (
                            <Text style={[styles.infoText, { color: "green", fontWeight: "bold" }]}>
                              ✨ FIN: {formatHora(viaje.hora_fin_reparto)}
                            </Text>
                        ) : (
                            <Text style={[styles.infoText, { color: "#666" }]}>
                              Para iniciar la siguiente vuelta, primero marca FIN en esta vuelta.
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[
                              styles.btn,
                              styles.btnPurple,
                              !viaje.hora_fin_reparto && { opacity: 0.45 },
                            ]}
                            onPress={() => crearSiguienteVuelta(viaje)}
                            disabled={!viaje.hora_fin_reparto || loading || locationLoading}
                        >
                          <Text style={styles.btnText}>🔄 INICIAR VUELTA #{maxVuelta(viajes) + 1}</Text>
                        </TouchableOpacity>
                      </View>
                  )}
                </View>
              </View>
          ))}

          {!loading && viajes.length === 0 && patente !== "" && (
              <Text style={{ textAlign: "center", marginTop: 20, color: "#888" }}>
                No se encontraron datos.
              </Text>
          )}
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: { padding: 20, backgroundColor: "#111827" },
  headerTitle: { color: "white", fontSize: 20, fontWeight: "bold" },
  headerSubtitle: { color: "#cbd5e1", marginTop: 5 },

  scrollContent: { padding: 16, paddingBottom: 80 },

  searchBox: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontWeight: "bold", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnSearch: {
    marginTop: 12,
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "white", fontWeight: "bold" },

  logoutBtn: { padding: 8, borderRadius: 10, backgroundColor: "#ef4444" },
  logoutText: { color: "white", fontWeight: "bold" },

  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "white", fontWeight: "bold" },
  hora: { color: "#374151", fontWeight: "600" },

  infoText: { marginTop: 6, color: "#111827" },

  // ✅ NUEVO: Estilos para el comentario
  commentBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#eff6ff",
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    borderRadius: 10,
  },
  commentLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1e40af",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: "#1e3a8a",
    fontWeight: "600",
    lineHeight: 20,
  },

  statusRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  statusLabel: { fontWeight: "bold", color: "#374151" },
  statusValue: { color: "#111827" },

  actions: { marginTop: 14, gap: 10 },
  actionBlock: { gap: 10 },

  btn: { padding: 12, borderRadius: 10, alignItems: "center" },
  btnGreen: { backgroundColor: "#16a34a" },
  btnBlue: { backgroundColor: "#2563eb" },
  btnOrange: { backgroundColor: "#f97316" },
  btnPurple: { backgroundColor: "#7c3aed" },
});