import { Tabs, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Pressable,
  Text,
  Animated,
  Alert,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Brand } from "../../constants/brand";
import { supabase } from "../../supabase";

type MenuItem = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const MENU_ITEMS: MenuItem[] = [
  { route: "ruta", label: "Ruta", icon: "navigate-outline" },
  { route: "chat", label: "Chat", icon: "chatbubbles-outline" },
  { route: "devolucion", label: "Devoluciones", icon: "cube-outline" },
  { route: "explore", label: "Ayuda", icon: "help-circle-outline" },
];

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
  }, [router, setHasSession]);

  const handleLogout = useCallback(() => {
    Alert.alert("Cerrar sesión", "Se cerrará tu sesión y volverás al inicio.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove(["patente_sesion", "nombre_usuario"]);
            await supabase.auth.signOut().catch(() => null);
            setHasSession(false);
            router.replace("/login");
          } catch (error: any) {
            Alert.alert("Error", error?.message || "No se pudo cerrar la sesión.");
          }
        },
      },
    ]);
  }, [router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasSession) {
    return null;
  }

  return (
    <Tabs
      initialRouteName="ruta"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingMenu {...props} onLogout={handleLogout} />}
    >
      <Tabs.Screen name="ruta" options={{ title: "Ruta" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="devolucion" options={{ title: "Devolución" }} />
      <Tabs.Screen name="explore" options={{ title: "Ayuda" }} />
    </Tabs>
  );
}

function FloatingMenu({
  state,
  navigation,
  onLogout,
}: BottomTabBarProps & { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const currentRoute = state.routeNames[state.index];
  const menuItems = useMemo(() => MENU_ITEMS, []);

  const setMenuOpen = useCallback(
    (next: boolean) => {
      setOpen(next);
      Animated.timing(anim, {
        toValue: next ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    },
    [anim]
  );

  const toggleMenu = useCallback(() => {
    setMenuOpen(!open);
  }, [open, setMenuOpen]);

  const handleNavigate = useCallback(
    (routeName: string) => {
      setMenuOpen(false);
      navigation.navigate(routeName as never);
    },
    [navigation, setMenuOpen]
  );

  const handleLogoutPress = useCallback(() => {
    setMenuOpen(false);
    onLogout();
  }, [onLogout, setMenuOpen]);

  const menuStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  return (
    <View style={styles.menuContainer}>
      {open && <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />}

      <Animated.View
        style={[styles.menuCard, menuStyle]}
        pointerEvents={open ? "auto" : "none"}
      >
        {menuItems.map((item) => {
          const isActive = currentRoute === item.route;
          return (
            <Pressable
              key={item.route}
              onPress={() => handleNavigate(item.route)}
              style={[styles.menuItem, isActive && styles.menuItemActive]}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={isActive ? Brand.colors.primary : Brand.colors.muted}
              />
              <Text style={[styles.menuText, isActive && styles.menuTextActive]}>{item.label}</Text>
            </Pressable>
          );
        })}

        <View style={styles.menuDivider} />

        <Pressable style={[styles.menuItem, styles.menuItemDanger]} onPress={handleLogoutPress}>
          <Ionicons name="log-out-outline" size={18} color={Brand.colors.danger} />
          <Text style={[styles.menuText, styles.menuTextDanger]}>Cerrar sesión</Text>
        </Pressable>
      </Animated.View>

      <TouchableOpacity style={styles.fab} onPress={toggleMenu} activeOpacity={0.9}>
        <Ionicons name={open ? "close" : "menu"} size={22} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 54,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.2)",
  },
  menuCard: {
    position: "absolute",
    right: 16,
    top: 110,
    width: 220,
    backgroundColor: Brand.colors.surface,
    borderRadius: Brand.radius.lg,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    ...Brand.shadow.float,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  menuItemActive: {
    backgroundColor: Brand.colors.primarySoft,
  },
  menuItemDanger: {
    backgroundColor: Brand.colors.dangerSoft,
  },
  menuText: {
    fontSize: 14,
    color: Brand.colors.ink,
    fontFamily: Brand.fonts.label,
  },
  menuTextActive: {
    color: Brand.colors.primary,
  },
  menuTextDanger: {
    color: Brand.colors.danger,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Brand.colors.border,
    marginVertical: 6,
    marginHorizontal: 14,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    ...Brand.shadow.float,
  },
});
