import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Brand } from "../../constants/brand";

export default function ExploreScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Centro de ayuda</Text>
          <Text style={styles.title}>Operación diaria</Text>
          <Text style={styles.subtitle}>
            Guía rápida para completar rutas, comunicarte con central y confirmar devoluciones.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="navigate-outline" size={18} color={Brand.colors.primary} />
            <Text style={styles.cardTitle}>Ruta</Text>
          </View>
          <Text style={styles.cardText}>Revisa tus vueltas y registra los hitos en orden.</Text>
          <Text style={styles.cardItem}>- Marca llegada, salida y fin en cada vuelta.</Text>
          <Text style={styles.cardItem}>
            - Inicia la siguiente vuelta solo cuando el fin esté registrado.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="chatbubbles-outline" size={18} color={Brand.colors.accent} />
            <Text style={styles.cardTitle}>Chat con central</Text>
          </View>
          <Text style={styles.cardText}>Envía mensajes y evidencia fotográfica cuando sea necesario.</Text>
          <Text style={styles.cardItem}>
            - Usa el clip para adjuntar una foto desde cámara o galería.
          </Text>
          <Text style={styles.cardItem}>- Mantén la patente activa para recibir respuestas.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="cube-outline" size={18} color={Brand.colors.warning} />
            <Text style={styles.cardTitle}>Devoluciones</Text>
          </View>
          <Text style={styles.cardText}>Confirma el Identificador Ruta con evidencia fotográfica.</Text>
          <Text style={styles.cardItem}>- Máximo 5 fotos por ruta.</Text>
          <Text style={styles.cardItem}>- Verifica que el manifiesto sea legible.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Brand.colors.success} />
            <Text style={styles.cardTitle}>Buenas prácticas</Text>
          </View>
          <Text style={styles.cardText}>
            Mantén datos y evidencias consistentes para evitar reprocesos.
          </Text>
          <Text style={styles.cardItem}>- Activa ubicación y permisos antes de salir.</Text>
          <Text style={styles.cardItem}>- Notifica incidencias por chat lo antes posible.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.colors.background },
  content: { padding: 20, paddingBottom: 40 },
  orbOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Brand.colors.primarySoft,
    top: -90,
    right: -120,
    opacity: 0.6,
  },
  orbTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Brand.colors.accentSoft,
    bottom: -90,
    left: -90,
    opacity: 0.6,
  },
  header: { marginBottom: 18 },
  kicker: {
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Brand.colors.muted,
    fontSize: 11,
    fontFamily: Brand.fonts.label,
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    color: Brand.colors.ink,
    fontFamily: Brand.fonts.display,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Brand.colors.muted,
    lineHeight: 20,
    fontFamily: Brand.fonts.body,
  },
  card: {
    backgroundColor: Brand.colors.surface,
    borderRadius: Brand.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    marginBottom: 14,
    ...Brand.shadow.card,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 16, color: Brand.colors.ink, fontFamily: Brand.fonts.label },
  cardText: { color: Brand.colors.inkSoft, fontFamily: Brand.fonts.body, marginBottom: 8 },
  cardItem: { color: Brand.colors.muted, fontFamily: Brand.fonts.body, marginBottom: 4 },
});
