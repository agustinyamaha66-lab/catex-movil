import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  AppState,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import { supabase } from "../../supabase";
import { Brand } from "../../constants/brand";
import { registerPushToken, sendLocalNotification } from "../../lib/notifications";

const TABLA_CHAT = "mensajes_chat";
const BUCKET = "chat-images";

type Remitente = "chofer" | "admin";

type MensajeChat = {
  id: number;
  created_at?: string;
  patente: string;
  remitente: Remitente;
  contenido: string;
  url_imagen?: string | null;
};

const fechaChile = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

function formatHora(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const router = useRouter();

  const [mensaje, setMensaje] = useState("");
  const [patenteActiva, setPatenteActiva] = useState<string>("");
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(false);
  const [enviandoTexto, setEnviandoTexto] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const channelRef = useRef<any>(null);

  const cerrarCanal = useCallback(async () => {
    try {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    } catch {
      // noop
    }
  }, []);

  const validarSesion = useCallback(async () => {
    const patente = await AsyncStorage.getItem("patente_sesion");
    if (patente) {
      setPatenteActiva(patente);
      return;
    }
    router.replace("/login");
  }, [router]);

  const fetchMensajes = useCallback(async (patente: string) => {
    setLoadingInicial(true);
    try {
      const { data, error } = await supabase
        .from(TABLA_CHAT)
        .select("*")
        .eq("patente", patente)
        .order("id", { ascending: false })
        .limit(150);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setMensajes((data as MensajeChat[]) || []);
    } finally {
      setLoadingInicial(false);
    }
  }, []);

  useEffect(() => {
    validarSesion();
  }, [validarSesion]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") validarSesion();
    });
    return () => sub.remove();
  }, [validarSesion]);

  useEffect(() => {
    if (!patenteActiva) return;

    fetchMensajes(patenteActiva);

    (async () => {
      await cerrarCanal();

      const ch = supabase
        .channel(`chat-${patenteActiva}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: TABLA_CHAT,
            filter: `patente=eq.${patenteActiva}`,
          },
          (payload: any) => {
            const nuevo: MensajeChat | undefined = payload?.new;
            if (!nuevo?.id) return;

            setMensajes((prev) => {
              if (prev.some((m) => m.id === nuevo.id)) return prev;
              return [nuevo, ...prev];
            });

            if (nuevo?.remitente === "admin") {
              const resumen = nuevo.contenido || "Tienes un nuevo mensaje.";
              sendLocalNotification("Nuevo mensaje de central", resumen, { target: "chat" });
            }
          }
        )
        .subscribe();

      channelRef.current = ch;
    })();

    return () => {
      cerrarCanal();
    };
  }, [patenteActiva, fetchMensajes, cerrarCanal]);

  useEffect(() => {
    if (!patenteActiva) return;
    registerPushToken(patenteActiva);
  }, [patenteActiva]);

  const menuTitle = useMemo(() => "Chat con central", []);

  const enviarMensaje = useCallback(async () => {
    if (!patenteActiva) return;

    const texto = mensaje.trim();
    if (!texto) return;

    setEnviandoTexto(true);
    try {
      const { error } = await supabase.from(TABLA_CHAT).insert([
        {
          patente: patenteActiva,
          contenido: texto,
          remitente: "chofer",
          url_imagen: null,
        },
      ]);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      setMensaje("");
    } finally {
      setEnviandoTexto(false);
    }
  }, [mensaje, patenteActiva]);

  const subirImagenYEnviar = useCallback(
    async (uri: string) => {
      if (!patenteActiva) return;

      setEnviandoFoto(true);
      try {
        const storagePath = `${patenteActiva}/${Date.now()}.jpg`;

        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: (FileSystem as any).EncodingType?.Base64 ?? ("base64" as any),
        });

        const bytes = Uint8Array.from(Buffer.from(base64, "base64"));

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });

        if (upErr) {
          Alert.alert(
            "Error de almacenamiento",
            `${upErr.message}\n\nRevisa:\n1) Bucket: "${BUCKET}".\n2) Mismo proyecto Supabase.\n3) Policies de Storage.\n`
          );
          return;
        }

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
        const publicUrl = pub?.publicUrl;

        if (!publicUrl) {
          Alert.alert("Error", "No se pudo obtener URL pública.");
          return;
        }

        const { error: insertError } = await supabase.from(TABLA_CHAT).insert([
          {
            patente: patenteActiva,
            url_imagen: publicUrl,
            remitente: "chofer",
            contenido: "Foto enviada",
          },
        ]);

        if (insertError) Alert.alert("Error", insertError.message);
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Falló la subida de imagen.");
      } finally {
        setEnviandoFoto(false);
      }
    },
    [patenteActiva]
  );

  const tomarFoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted")
      return Alert.alert("Permisos", "Se necesitan permisos de cámara.");

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.65,
      allowsEditing: false,
    });
    if (!result.canceled) await subirImagenYEnviar(result.assets[0].uri);
  }, [subirImagenYEnviar]);

  const elegirDeGaleria = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted")
      return Alert.alert("Permisos", "Se necesitan permisos de galería.");

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.75,
      allowsEditing: false,
      mediaTypes: ["images"] as any,
    });

    if (!result.canceled) await subirImagenYEnviar(result.assets[0].uri);
  }, [subirImagenYEnviar]);

  const abrirAdjunto = useCallback(() => {
    if (!patenteActiva) return;

    Alert.alert(
      "Enviar imagen",
      "Elige una opción",
      [
        { text: "Tomar foto", onPress: () => tomarFoto() },
        { text: "Elegir de galería", onPress: () => elegirDeGaleria() },
        { text: "Cancelar", style: "cancel" },
      ],
      { cancelable: true }
    );
  }, [patenteActiva, tomarFoto, elegirDeGaleria]);

  const disabledSend = enviandoTexto || enviandoFoto || !patenteActiva;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: "padding", android: "height" })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}
    >
      <View style={styles.backgroundGlow} />
      <View style={styles.backgroundOrb} />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.topTitle}>{menuTitle}</Text>
          <Text style={styles.topSubtitle}>
            {patenteActiva ? `Patente ${patenteActiva} • ${fechaChile()}` : "Sin patente activa"}
          </Text>
        </View>
      </View>

      {loadingInicial ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="white" />
          <Text style={styles.loadingText}>Cargando mensajes...</Text>
        </View>
      ) : (
        <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <FlatList
            data={mensajes}
            inverted
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 12, paddingBottom: 18 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => <MessageRow item={item} />}
            ListEmptyComponent={
              <View style={{ padding: 18, alignItems: "center" }}>
                <Text style={styles.emptyText}>
                  {patenteActiva ? "Sin mensajes aún." : "Sin patente activa."}
                </Text>
              </View>
            }
          />
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          onPress={abrirAdjunto}
          style={[
            styles.btnAttach,
            disabledSend && styles.btnDisabled,
            (enviandoFoto || enviandoTexto) && styles.btnAttachBusy,
          ]}
          disabled={disabledSend}
        >
          <Ionicons
            name={enviandoFoto ? "time-outline" : "attach-outline"}
            size={18}
            color="white"
          />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={mensaje}
          onChangeText={setMensaje}
          placeholder={patenteActiva ? "Escribe un mensaje..." : "Sin patente activa"}
          placeholderTextColor={"rgba(255,255,255,0.55)"}
          editable={!disabledSend}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => {
            if (Platform.OS === "ios") enviarMensaje();
          }}
        />

        <TouchableOpacity
          onPress={enviarMensaje}
          style={[styles.btnEnviar, (disabledSend || !mensaje.trim()) && styles.btnDisabled]}
          disabled={disabledSend || !mensaje.trim()}
        >
          {enviandoTexto ? (
            <ActivityIndicator color="white" />
          ) : (
            <Ionicons name="send" size={16} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {(enviandoFoto || enviandoTexto) && (
        <View style={styles.sendingBar}>
          <ActivityIndicator color="white" />
          <Text style={styles.sendingText}>
            {enviandoFoto ? "Enviando foto..." : "Enviando mensaje..."}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageRow({ item }: { item: MensajeChat }) {
  const esChofer = item.remitente === "chofer";
  const hora = formatHora(item.created_at);

  return (
    <View style={[styles.msgBubble, esChofer ? styles.msgChofer : styles.msgAdmin]}>
      <Text style={styles.msgText}>{item.contenido}</Text>
      {!!item.url_imagen && (
        <Image source={{ uri: item.url_imagen }} style={styles.imgMsg} resizeMode="cover" />
      )}
      {!!hora && <Text style={styles.msgHora}>{hora}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.colors.navy },
  backgroundGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(20,184,166,0.15)",
    top: -180,
    right: -140,
  },
  backgroundOrb: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(37,99,235,0.15)",
    bottom: -120,
    left: -120,
  },
  topBar: {
    paddingTop: 55,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#0E1E3A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  topTitle: { color: "white", fontFamily: Brand.fonts.display, fontSize: 17 },
  topSubtitle: { color: "rgba(255,255,255,0.7)", marginTop: 4, fontSize: 12 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 8, color: "rgba(255,255,255,0.7)" },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0F254A",
  },
  btnAttach: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "rgba(20,184,166,0.2)",
    borderWidth: 1,
    borderColor: "rgba(20,184,166,0.4)",
  },
  btnAttachBusy: {
    backgroundColor: "rgba(245,158,11,0.2)",
    borderColor: "rgba(245,158,11,0.4)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    fontFamily: Brand.fonts.body,
  },
  btnEnviar: {
    marginLeft: 10,
    backgroundColor: Brand.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  msgBubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 6,
    maxWidth: "86%",
    borderWidth: 1,
  },
  msgChofer: {
    alignSelf: "flex-end",
    backgroundColor: "#E6FFFB",
    borderColor: "#5EEAD4",
  },
  msgAdmin: {
    alignSelf: "flex-start",
    backgroundColor: "#E2E8F0",
    borderColor: "#CBD5E1",
  },
  msgText: { fontSize: 15, color: Brand.colors.ink, lineHeight: 20, fontFamily: Brand.fonts.body },
  msgHora: {
    marginTop: 6,
    fontSize: 11,
    color: Brand.colors.muted,
    alignSelf: "flex-end",
    fontFamily: Brand.fonts.label,
  },
  imgMsg: { width: 240, height: 240, borderRadius: 14, marginTop: 10 },
  sendingBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 78,
    backgroundColor: "rgba(17,24,39,0.92)",
    padding: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sendingText: { color: "white", fontFamily: Brand.fonts.label },
  emptyText: { color: "rgba(255,255,255,0.75)", fontFamily: Brand.fonts.label },
});
