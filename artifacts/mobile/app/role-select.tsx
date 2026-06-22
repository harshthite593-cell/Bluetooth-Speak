import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFirebase } from "@/contexts/FirebaseContext";
import { useColors } from "@/hooks/useColors";

export default function RoleSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setRole } = useFirebase();
  const [selecting, setSelecting] = useState<"user" | "guardian" | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const s = makeStyles(colors, topPad, bottomPad);

  const handleSelect = async (role: "user" | "guardian") => {
    setSelecting(role);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setRole(role);
    setSelecting(null);
    if (role === "guardian") {
      router.replace("/guardian");
    } else {
      router.replace("/profile-setup");
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={s.top}>
        <Image
          source={require("../assets/images/logo.png")}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.title}>How are you using{"\n"}Type Talk?</Text>
        <Text style={s.subtitle}>Choose your role — you can change this later in settings.</Text>
      </View>

      <View style={s.cards}>
        {/* User card */}
        <TouchableOpacity
          style={s.card}
          onPress={() => handleSelect("user")}
          disabled={!!selecting}
          activeOpacity={0.85}
        >
          <View style={[s.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={s.roleEmoji}>🗣️</Text>
          </View>
          <Text style={s.cardTitle}>I'm a User</Text>
          <Text style={s.cardDesc}>
            I use Type Talk to communicate. Access the phrase board, voice settings, typing test, and emergency features.
          </Text>
          {selecting === "user" ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <View style={[s.pill, { backgroundColor: colors.primary }]}>
              <Text style={s.pillText}>Start communicating</Text>
              <Feather name="arrow-right" size={14} color="#000" />
            </View>
          )}
        </TouchableOpacity>

        {/* Guardian card */}
        <TouchableOpacity
          style={[s.card, s.guardianCard]}
          onPress={() => handleSelect("guardian")}
          disabled={!!selecting}
          activeOpacity={0.85}
        >
          <View style={[s.iconCircle, { backgroundColor: "#5B6EF520" }]}>
            <Text style={s.roleEmoji}>🛡️</Text>
          </View>
          <Text style={[s.cardTitle, { color: "#5B6EF5" }]}>I'm a Guardian</Text>
          <Text style={s.cardDesc}>
            I support a loved one who uses Type Talk. Monitor their activity, receive emergency alerts in real time, and respond instantly.
          </Text>
          {selecting === "guardian" ? (
            <ActivityIndicator color="#5B6EF5" style={{ marginTop: 12 }} />
          ) : (
            <View style={[s.pill, { backgroundColor: "#5B6EF5" }]}>
              <Text style={s.pillText}>Open Guardian Mode</Text>
              <Feather name="shield" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={[s.footer, { paddingBottom: bottomPad + 16 }]}>
        <Feather name="lock" size={12} color={colors.mutedForeground} />
        <Text style={s.footerText}>Your choice is saved securely to your account</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, _bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    top: { alignItems: "center", paddingTop: topPad + 24, paddingHorizontal: 24, paddingBottom: 20 },
    logo: { width: 80, height: 67, marginBottom: 20 },
    title: { fontSize: 26, fontWeight: "700", color: colors.foreground, textAlign: "center", lineHeight: 34, marginBottom: 8 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },
    cards: { flex: 1, paddingHorizontal: 20, gap: 14, justifyContent: "center" },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    guardianCard: { borderColor: "#5B6EF540" },
    iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    roleEmoji: { fontSize: 26 },
    cardTitle: { fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 8 },
    cardDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 20, marginBottom: 16 },
    pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 100, paddingHorizontal: 18, paddingVertical: 10, alignSelf: "flex-start" },
    pillText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 16 },
    footerText: { fontSize: 11, color: colors.mutedForeground },
  });
}
