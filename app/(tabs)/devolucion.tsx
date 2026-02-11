import React, { useMemo, useState } from "react";
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Image,
    ActivityIndicator,
    Modal,
    Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../supabase";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

function safeParseJSONList(v: any): string[] {
    try {
        const s = String(v ?? "").trim();
        if (!s) return [];
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x));
        return [];
    } catch {
        return String(v ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
    }
}

export default function DevolucionScreen() {
    const [rutaId, setRutaId] = useState("");
    const [record, setRecord] = useState<any>(null);

    const [imagenes, setImagenes] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [previewModal, setPreviewModal] = useState<string | null>(null);

    const IMAGEN_EJEMPLO_URL =
        "https://ceqqxyszrkbuzvlqnvfp.supabase.co/storage/v1/object/public/evidencias/ejemplo%20manifiesto.png";

    const sgList = useMemo(() => safeParseJSONList(record?.sg), [record?.sg]);

    const buscarRuta = async () => {
        const key = rutaId.trim();
        if (!key) return Alert.alert("Falta dato", "Ingresa el Identificador Ruta.");

        try {
            const { data, error } = await supabase
                .from("devoluciones_bodega")
                .select("*")
                .eq("key", key)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                setRecord(null);
                return Alert.alert(
                    "Ruta no encontrada",
                    "Esta ruta no está cargada desde CATEX. Importa el Excel primero."
                );
            }
            setRecord(data);
        } catch (e: any) {
            Alert.alert("Error", e?.message || "No se pudo buscar la ruta");
        }
    };

    const seleccionarFoto = async () => {
        if (imagenes.length >= 5) {
            return Alert.alert("Límite alcanzado", "Puedes subir máximo 5 fotos por ruta.");
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permiso denegado", "Necesitamos acceso a la galería para subir evidencia.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImagenes([...imagenes, result.assets[0].uri]);
        }
    };

    const tomarFoto = async () => {
        if (imagenes.length >= 5) {
            return Alert.alert("Límite alcanzado", "Puedes subir máximo 5 fotos por ruta.");
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permiso denegado", "Necesitamos acceso a la cámara.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled) {
            setImagenes([...imagenes, result.assets[0].uri]);
        }
    };

    const eliminarFoto = (index: number) => {
        Alert.alert("Eliminar foto", "¿Estás seguro de eliminar esta foto?", [
            { text: "Cancelar", style: "cancel" },
            {
                text: "Eliminar",
                style: "destructive",
                onPress: () => {
                    const nuevas = imagenes.filter((_, i) => i !== index);
                    setImagenes(nuevas);
                },
            },
        ]);
    };

    const confirmarDevolucion = async () => {
        const key = rutaId.trim();
        if (!record) return Alert.alert("Ruta", "Primero busca una ruta válida.");
        if (imagenes.length === 0) return Alert.alert("Falta evidencia", "Sube al menos una foto antes de confirmar.");

        setUploading(true);
        try {
            const urlsSubidas: string[] = [];

            for (let i = 0; i < imagenes.length; i++) {
                const nombreArchivo = `dev_${Date.now()}_${i}_${key.replace(/\s/g, "")}.jpg`;

                const formData = new FormData();
                formData.append("file", {
                    uri: imagenes[i],
                    name: nombreArchivo,
                    type: "image/jpeg",
                } as any);

                const { error: uploadError } = await supabase.storage
                    .from("evidencias")
                    .upload(nombreArchivo, formData, { contentType: "image/jpeg" });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from("evidencias").getPublicUrl(nombreArchivo);
                urlsSubidas.push(urlData.publicUrl);
            }

            const { error: updErr } = await supabase
                .from("devoluciones_bodega")
                .update({
                    status: "confirmada",
                    foto_url: urlsSubidas[0],
                    fotos_adicionales: JSON.stringify(urlsSubidas.slice(1)),
                    confirmed_at: new Date().toISOString(),
                    confirmed_source: "mobile",
                })
                .eq("key", key);

            if (updErr) throw updErr;

            Alert.alert("¡Éxito!", "Ruta confirmada con " + imagenes.length + " foto(s). Se asume paquete completo devuelto.");
            setImagenes([]);
            await buscarRuta();
        } catch (error: any) {
            Alert.alert("Error", "No se pudo confirmar: " + (error?.message || "desconocido"));
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Header con gradiente visual */}
            <View style={styles.header}>
                <View style={styles.headerGradient}>
                    <View style={styles.tagContainer}>
                        <Ionicons name="cube-outline" size={14} color="#fff" />
                        <Text style={styles.tagText}>Valdishopper • Operaciones CATEX</Text>
                    </View>
                    <Text style={styles.title}>Confirmar Devolución</Text>
                    <Text style={styles.desc}>
                        Confirma el <Text style={{ fontWeight: "900" }}>Identificador Ruta</Text> con evidencia fotográfica.
                        {"\n"}Se asume que incluye todos los SG del paquete.
                    </Text>
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.inputContainer}>
                    <Ionicons name="barcode-outline" size={20} color="#0F254A" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: 54795676"
                        placeholderTextColor="#aaa"
                        value={rutaId}
                        onChangeText={setRutaId}
                        keyboardType="numeric"
                    />
                </View>

                <TouchableOpacity style={styles.btnSearch} onPress={buscarRuta}>
                    <Ionicons name="search" size={18} color="#fff" />
                    <Text style={styles.btnSearchText}>Buscar Ruta</Text>
                </TouchableOpacity>

                {record && (
                    <View style={styles.infoBox}>
                        <View style={styles.infoHeader}>
                            <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
                            <Text style={styles.infoTitle}>Ruta encontrada</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={styles.infoBadge}>
                                <Ionicons name="car-outline" size={16} color="#0F254A" />
                                <Text style={styles.infoBadgeText}>{record.patente}</Text>
                            </View>
                            <View style={[styles.infoBadge, record.status === "confirmada" ? styles.badgeSuccess : styles.badgeWarning]}>
                                <Ionicons
                                    name={record.status === "confirmada" ? "checkmark-circle" : "time-outline"}
                                    size={16}
                                    color={record.status === "confirmada" ? "#16A34A" : "#D97706"}
                                />
                                <Text style={[styles.infoBadgeText, record.status === "confirmada" ? { color: "#16A34A" } : { color: "#D97706" }]}>
                                    {record.status}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.sgContainer}>
                            <Text style={styles.sgTitle}>
                                <Ionicons name="layers-outline" size={14} color="#0F254A" /> SG asociados: {sgList.length}
                            </Text>
                            <View style={styles.sgBox}>
                                {sgList.slice(0, 8).map((sg, idx) => (
                                    <View key={idx} style={styles.sgChip}>
                                        <Text style={styles.sgChipText}>{sg}</Text>
                                    </View>
                                ))}
                                {sgList.length > 8 && (
                                    <View style={[styles.sgChip, styles.sgChipMore]}>
                                        <Text style={styles.sgChipTextMore}>+{sgList.length - 8} más</Text>
                                    </View>
                                )}
                                {!sgList.length && (
                                    <Text style={styles.sgEmpty}>No hay SG cargados (reimporta el Excel).</Text>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>
                    <Ionicons name="camera-outline" size={16} color="#0F254A" /> Evidencia Fotográfica ({imagenes.length}/5)
                </Text>

                <TouchableOpacity style={styles.btnExample} onPress={() => setModalVisible(true)}>
                    <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
                    <Text style={styles.btnExampleText}>Ver ejemplo de foto válida</Text>
                </TouchableOpacity>

                <View style={styles.photoButtonsRow}>
                    <TouchableOpacity style={styles.btnPhoto} onPress={tomarFoto} disabled={imagenes.length >= 5}>
                        <Ionicons name="camera" size={22} color={imagenes.length >= 5 ? "#999" : "#fff"} />
                        <Text style={[styles.btnPhotoText, imagenes.length >= 5 && { color: "#999" }]}>Tomar Foto</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.btnPhoto} onPress={seleccionarFoto} disabled={imagenes.length >= 5}>
                        <Ionicons name="images" size={22} color={imagenes.length >= 5 ? "#999" : "#fff"} />
                        <Text style={[styles.btnPhotoText, imagenes.length >= 5 && { color: "#999" }]}>Galería</Text>
                    </TouchableOpacity>
                </View>

                {imagenes.length > 0 && (
                    <View style={styles.previewContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
                            {imagenes.map((img, idx) => (
                                <View key={idx} style={styles.previewWrapper}>
                                    <TouchableOpacity onPress={() => setPreviewModal(img)}>
                                        <Image source={{ uri: img }} style={styles.preview} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.deleteBtn} onPress={() => eliminarFoto(idx)}>
                                        <Ionicons name="close-circle" size={28} color="#EF4444" />
                                    </TouchableOpacity>
                                    <View style={styles.photoNumber}>
                                        <Text style={styles.photoNumberText}>{idx + 1}</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.btnPrimary, (!record || uploading || imagenes.length === 0) && styles.btnDisabled]}
                    onPress={confirmarDevolucion}
                    disabled={!record || uploading || imagenes.length === 0}
                >
                    {uploading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-done" size={20} color="#fff" />
                            <Text style={styles.btnPrimaryText}>Confirmar Ruta ({imagenes.length} foto{imagenes.length !== 1 ? "s" : ""})</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modal Ejemplo */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Ionicons name="images-outline" size={24} color="#0F254A" />
                            <Text style={styles.modalTitle}>Ejemplo de manifiesto</Text>
                        </View>
                        <Image source={{ uri: IMAGEN_EJEMPLO_URL }} style={styles.modalImg} resizeMode="contain" />
                        <TouchableOpacity style={styles.btnCloseModal} onPress={() => setModalVisible(false)}>
                            <Text style={styles.btnCloseModalText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal Preview de foto */}
            <Modal visible={!!previewModal} transparent animationType="fade">
                <View style={styles.modalBg}>
                    <View style={styles.previewModalCard}>
                        <Image source={{ uri: previewModal || "" }} style={styles.previewModalImg} resizeMode="contain" />
                        <TouchableOpacity style={styles.btnClosePreview} onPress={() => setPreviewModal(null)}>
                            <Ionicons name="close-circle" size={40} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F0F4F8" },
    header: { marginBottom: 20 },
    headerGradient: {
        backgroundColor: "#0F254A",
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    tagContainer: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(255,255,255,0.2)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    tagText: { color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 0.5 },
    title: { marginTop: 16, fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
    desc: { marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 20 },

    card: {
        marginHorizontal: 20,
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },

    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F6FF",
        borderRadius: 16,
        borderWidth: 2,
        borderColor: "#E0E7FF",
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontWeight: "700",
        fontSize: 16,
        color: "#1C2D4A",
    },

    btnSearch: {
        backgroundColor: "#3B82F6",
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        shadowColor: "#3B82F6",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    btnSearchText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    infoBox: {
        marginTop: 16,
        backgroundColor: "#F0FDF4",
        borderWidth: 2,
        borderColor: "#BBF7D0",
        borderRadius: 18,
        padding: 16,
    },
    infoHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    infoTitle: { fontWeight: "900", color: "#0F254A", fontSize: 16 },
    infoRow: { flexDirection: "row", gap: 10, marginBottom: 12, flexWrap: "wrap" },
    infoBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#fff",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "#E0E7FF",
    },
    badgeSuccess: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
    badgeWarning: { borderColor: "#FED7AA", backgroundColor: "#FFFBEB" },
    infoBadgeText: { fontWeight: "900", fontSize: 13, color: "#0F254A" },

    sgContainer: { marginTop: 8 },
    sgTitle: { fontWeight: "900", color: "#0F254A", fontSize: 13, marginBottom: 8 },
    sgBox: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    sgChip: {
        backgroundColor: "#fff",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#E0E7FF",
    },
    sgChipText: { fontWeight: "700", fontSize: 11, color: "#1E40AF" },
    sgChipMore: { backgroundColor: "#F3F4F6", borderColor: "#D1D5DB" },
    sgChipTextMore: { fontWeight: "900", fontSize: 11, color: "#6B7280" },
    sgEmpty: { color: "#9CA3AF", fontSize: 12, fontStyle: "italic" },

    divider: {
        height: 1,
        backgroundColor: "#E5E7EB",
        marginVertical: 20,
    },

    sectionTitle: {
        fontSize: 15,
        fontWeight: "900",
        color: "#0F254A",
        marginBottom: 12,
    },

    btnExample: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#EFF6FF",
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#BFDBFE",
        marginBottom: 14,
    },
    btnExampleText: { color: "#3B82F6", fontWeight: "800", fontSize: 13 },

    photoButtonsRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    btnPhoto: {
        flex: 1,
        backgroundColor: "#6366F1",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    btnPhotoText: { color: "#fff", fontWeight: "900", fontSize: 13 },

    previewContainer: {
        marginBottom: 16,
    },
    previewScroll: {
        gap: 12,
        paddingVertical: 4,
    },
    previewWrapper: {
        position: "relative",
    },
    preview: {
        width: 140,
        height: 180,
        borderRadius: 16,
        borderWidth: 3,
        borderColor: "#E0E7FF",
    },
    deleteBtn: {
        position: "absolute",
        top: -8,
        right: -8,
        backgroundColor: "#fff",
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    photoNumber: {
        position: "absolute",
        bottom: 8,
        left: 8,
        backgroundColor: "rgba(0,0,0,0.7)",
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    photoNumberText: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 12,
    },

    btnPrimary: {
        backgroundColor: "#16A34A",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        shadowColor: "#16A34A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    btnPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
    btnDisabled: { backgroundColor: "#D1D5DB", shadowOpacity: 0 },

    modalBg: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.75)",
        justifyContent: "center",
        padding: 20,
    },
    modalCard: {
        backgroundColor: "#fff",
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
    },
    modalTitle: { fontWeight: "900", fontSize: 18, color: "#0F254A" },
    modalImg: { width: "100%", height: 300, borderRadius: 16, backgroundColor: "#F3F4F6" },
    btnCloseModal: {
        marginTop: 16,
        backgroundColor: "#3B82F6",
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: "center",
    },
    btnCloseModalText: { color: "#fff", fontWeight: "900", fontSize: 15 },

    previewModalCard: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    previewModalImg: {
        width: width - 40,
        height: width * 1.3,
        borderRadius: 20,
    },
    btnClosePreview: {
        position: "absolute",
        top: 60,
        right: 20,
    },
});