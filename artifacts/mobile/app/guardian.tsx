import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFirebase } from "@/contexts/FirebaseContext";
import { useColors } from "@/hooks/useColors";
import type { EmergencyEvent, LinkedUser } from "@/lib/firebase";
import {
  rtdbGuardianRespond,
  rtdbLinkGuardianToUser,
  rtdbSubscribeToLinkedUsers,
  rtdbUnlinkGuardian,
} from "@/lib/firebase";

function playAlarm() {
  if (Platform.OS !== "web") return;
  try {
    const ctx = new ((window as Record<string, unknown>).AudioContext as typeof AudioContext || (window as Record<string, unknown>).webkitAudioContext as typeof AudioContext)();
    const pattern = [0, 0.28, 0.56, 0.84, 1.12, 1.4, 1.68, 1.96, 2.24, 2.52];
    pattern.forEach((t, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = i % 2 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.22, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.24);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.27);
    });
  } catch {}
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function GuardianScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { firebaseUser, guardianCode, setRole } = useFirebase();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const s = makeStyles(colors, topPad, bottomPad);

  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [linkCode, setLinkCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [activeEmergency, setActiveEmergency] = useState<(EmergencyEvent & { userName: string }) | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevEmergencyUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = rtdbSubscribeToLinkedUsers(firebaseUser.uid, (users) => {
      setLinkedUsers(users);
      const emergUser = users.find((u) => u.emergency?.active);
      if (emergUser && emergUser.uid !== prevEmergencyUserId.current) {
        prevEmergencyUserId.current = emergUser.uid;
        setActiveEmergency({ ...emergUser.emergency!, userName: emergUser.displayName });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        playAlarm();
        if (alarmRef.current) clearInterval(alarmRef.current);
        alarmRef.current = setInterval(playAlarm, 3200);
        startPulse();
      } else if (!emergUser && prevEmergencyUserId.current) {
        prevEmergencyUserId.current = null;
        setActiveEmergency(null);
        if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null; }
        pulseAnim.stopAnimation();
      }
    });
    return () => {
      unsub();
      if (alarmRef.current) clearInterval(alarmRef.current);
    };
  }, [firebaseUser]);

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  const handleLink = async () => {
    if (!firebaseUser || !linkCode.trim()) return;
    setLinking(true);
    setLinkError(null);
    const displayName = firebaseUser.displayName ?? firebaseUser.email ?? "Guardian";
    const { error } = await rtdbLinkGuardianToUser(firebaseUser.uid, displayName, linkCode.trim());
    setLinking(false);
    if (error) { setLinkError(error); }
    else { setShowLinkModal(false); setLinkCode(""); }
  };

  const handleUnlink = (user: LinkedUser) => {
    if (!firebaseUser) return;
    Alert.alert(`Stop monitoring ${user.displayName}?`, "You can re-link anytime using their code.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unlink", style: "destructive", onPress: () => rtdbUnlinkGuardian(firebaseUser.uid, user.uid) },
    ]);
  };

  const handleRespond = async (emergency: EmergencyEvent & { userName: string }) => {
    if (!firebaseUser) return;
    setRespondingTo(emergency.userId);
    const guardianName = firebaseUser.displayName ?? firebaseUser.email ?? "Guardian";
    await rtdbGuardianRespond(emergency.userId, firebaseUser.uid, guardianName);
    setRespondingTo(null);
    setActiveEmergency(null);
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null; }
    if (emergency.lat && emergency.lng) {
      const url = `https://maps.google.com/?q=${emergency.lat},${emergency.lng}`;
      Linking.openURL(url).catch(() => {});
    }
    Alert.alert("Response sent ✅", `${emergency.userName} has been notified you're on your way.`);
  };

  const handleSwitchRole = () => {
    Alert.alert("Switch to User Mode?", "You'll be taken to the regular app screen.", [
      { text: "Cancel", style: "cancel" },
      { text: "Switch", onPress: async () => { await setRole("user"); router.replace("/"); } },
    ]);
  };

  const handleLogout = () => {
    Alert.alert("Log out?", "You'll return to the login screen.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => router.replace("/login") },
    ]);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerLeft}>
          <View style={s.shieldBadge}>
            <Feather name="shield" size={16} color="#5B6EF5" />
          </View>
          <View>
            <Text style={s.headerTitle}>Guardian Mode</Text>
            <Text style={s.headerSub}>{firebaseUser?.displayName ?? firebaseUser?.email ?? "Guardian"}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn} onPress={handleSwitchRole}>
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={handleLogout}>
            <Feather name="log-out" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Your code card */}
        <View style={s.codeCard}>
          <View>
            <Text style={s.codeLabel}>YOUR GUARDIAN CODE</Text>
            <Text style={s.codeValue}>{guardianCode ?? "Loading…"}</Text>
            <Text style={s.codeHint}>Share this code so users can link to you, or enter a user's code below to monitor them.</Text>
          </View>
          <Feather name="shield" size={32} color="#5B6EF540" />
        </View>

        {/* Add user */}
        <TouchableOpacity style={s.addBtn} onPress={() => setShowLinkModal(true)} activeOpacity={0.85}>
          <Feather name="user-plus" size={18} color="#5B6EF5" />
          <Text style={s.addBtnText}>Monitor a User</Text>
        </TouchableOpacity>

        {/* Section header */}
        <Text style={s.sectionTitle}>
          {linkedUsers.length === 0 ? "No users linked yet" : `Monitoring ${linkedUsers.length} user${linkedUsers.length > 1 ? "s" : ""}`}
        </Text>

        {linkedUsers.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>🔗</Text>
            <Text style={s.emptyTitle}>Link your first user</Text>
            <Text style={s.emptyDesc}>Ask the Type Talk user to open their app, go to Settings, and share their 6-character code with you.</Text>
          </View>
        )}

        {/* User cards */}
        {linkedUsers.map((user) => (
          <View key={user.uid} style={[s.userCard, user.emergency?.active && s.userCardEmergency]}>
            <View style={s.userCardTop}>
              <View style={s.userAvatarWrap}>
                <View style={s.userAvatar}>
                  <Text style={s.userAvatarText}>{(user.displayName ?? "?")[0].toUpperCase()}</Text>
                </View>
                <View style={[s.onlineDot, { backgroundColor: user.online ? "#4CAF50" : "#888" }]} />
              </View>
              <View style={s.userInfo}>
                <Text style={s.userName}>{user.displayName}</Text>
                <Text style={s.userStatus}>{user.online ? "● Online" : `Last seen ${timeAgo(user.lastActive)}`}</Text>
                {user.guardianCode && <Text style={s.userCode}>Code: {user.guardianCode}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleUnlink(user)} style={s.unlinkBtn}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {user.emergency?.active && (
              <View style={s.emergencyBanner}>
                <Text style={s.emergencyBannerText}>🚨 EMERGENCY ACTIVE</Text>
                <Text style={s.emergencyMsg}>{user.emergency.message || "Emergency alert triggered"}</Text>
                <Text style={s.emergencyTime}>{timeAgo(user.emergency.timestamp)}</Text>
              </View>
            )}

            {user.lastPhrase && !user.emergency?.active && (
              <View style={s.lastPhraseRow}>
                <Feather name="message-square" size={12} color={colors.mutedForeground} />
                <Text style={s.lastPhraseText} numberOfLines={1}>"{user.lastPhrase}"</Text>
                <Text style={s.lastPhraseTime}>{timeAgo(user.lastPhraseTime ?? 0)}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Link user modal */}
      <Modal visible={showLinkModal} transparent animationType="slide" onRequestClose={() => setShowLinkModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Enter User Code</Text>
              <TouchableOpacity onPress={() => { setShowLinkModal(false); setLinkCode(""); setLinkError(null); }}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalDesc}>Ask the Type Talk user to share their 6-character code from their app settings.</Text>

            <TextInput
              style={s.codeInput}
              value={linkCode}
              onChangeText={(v) => setLinkCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
            />

            {linkError && (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={14} color="#FF6B6B" />
                <Text style={s.errorText}>{linkError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.modalBtn, (linking || linkCode.length < 6) && s.modalBtnDisabled]}
              onPress={handleLink}
              disabled={linking || linkCode.length < 6}
              activeOpacity={0.85}
            >
              {linking ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={s.modalBtnText}>Link & Start Monitoring</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Emergency alert overlay */}
      {activeEmergency && (
        <Animated.View style={[s.emergencyOverlay, { transform: [{ scale: pulseAnim }] }]}>
          <View style={s.emergencyContent}>
            <Text style={s.emergencyOverlayEmoji}>🚨</Text>
            <Text style={s.emergencyOverlayTitle}>EMERGENCY ALERT</Text>
            <Text style={s.emergencyOverlayName}>{activeEmergency.userName}</Text>
            <Text style={s.emergencyOverlayMsg}>
              {activeEmergency.message || "Needs immediate assistance"}
            </Text>
            {activeEmergency.lat && (
              <Text style={s.emergencyOverlayCoords}>
                📍 Location available
              </Text>
            )}
            <Text style={s.emergencyOverlayTime}>{timeAgo(activeEmergency.timestamp)}</Text>

            <TouchableOpacity
              style={s.respondBtn}
              onPress={() => handleRespond(activeEmergency)}
              disabled={respondingTo === activeEmergency.userId}
              activeOpacity={0.85}
            >
              {respondingTo ? <ActivityIndicator color="#FF4444" size="small" /> : (
                <>
                  <Feather name="navigation" size={20} color="#FF4444" />
                  <Text style={s.respondBtnText}>I'm On My Way</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={s.dismissBtn} onPress={() => {
              setActiveEmergency(null);
              if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null; }
            }}>
              <Text style={s.dismissBtnText}>Dismiss alert (do not use if emergency is real)</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, _bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 20, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    headerRight: { flexDirection: "row", gap: 6 },
    shieldBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#5B6EF510", alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    headerSub: { fontSize: 12, color: colors.mutedForeground },
    headerBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, gap: 14 },

    codeCard: {
      backgroundColor: "#5B6EF510", borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: "#5B6EF530",
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    },
    codeLabel: { fontSize: 10, fontWeight: "700", color: "#5B6EF5", letterSpacing: 1.5, marginBottom: 6 },
    codeValue: { fontSize: 32, fontWeight: "800", color: "#5B6EF5", letterSpacing: 6, marginBottom: 6 },
    codeHint: { fontSize: 12, color: colors.mutedForeground, maxWidth: 220, lineHeight: 17 },

    addBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderRadius: 14, height: 48, borderWidth: 2, borderColor: "#5B6EF5",
      backgroundColor: "#5B6EF510",
    },
    addBtnText: { fontSize: 15, fontWeight: "700", color: "#5B6EF5" },

    sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.mutedForeground },

    emptyCard: { alignItems: "center", padding: 32, gap: 8 },
    emptyEmoji: { fontSize: 40 },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    emptyDesc: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },

    userCard: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 10 },
    userCardEmergency: { borderColor: "#FF4444", backgroundColor: "#FF444408" },
    userCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    userAvatarWrap: { position: "relative" },
    userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#5B6EF520", alignItems: "center", justifyContent: "center" },
    userAvatarText: { fontSize: 20, fontWeight: "700", color: "#5B6EF5" },
    onlineDot: { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.card },
    userInfo: { flex: 1, gap: 2 },
    userName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    userStatus: { fontSize: 12, color: colors.mutedForeground },
    userCode: { fontSize: 11, color: "#5B6EF5", fontWeight: "600" },
    unlinkBtn: { padding: 6 },

    emergencyBanner: { backgroundColor: "#FF444415", borderRadius: 10, padding: 12, gap: 4, borderWidth: 1, borderColor: "#FF444440" },
    emergencyBannerText: { fontSize: 13, fontWeight: "800", color: "#FF4444" },
    emergencyMsg: { fontSize: 13, color: colors.foreground },
    emergencyTime: { fontSize: 11, color: colors.mutedForeground },

    lastPhraseRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    lastPhraseText: { flex: 1, fontSize: 13, color: colors.mutedForeground, fontStyle: "italic" },
    lastPhraseTime: { fontSize: 11, color: colors.mutedForeground },

    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 14, borderWidth: 1, borderColor: colors.border },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    modalDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 19 },
    codeInput: {
      borderWidth: 2, borderColor: "#5B6EF5", borderRadius: 14, height: 60,
      textAlign: "center", fontSize: 28, fontWeight: "800", color: "#5B6EF5",
      letterSpacing: 12, backgroundColor: colors.background,
    },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF6B6B15", borderRadius: 10, padding: 10 },
    errorText: { fontSize: 13, color: "#FF6B6B", flex: 1 },
    modalBtn: { backgroundColor: "#5B6EF5", borderRadius: 13, height: 48, alignItems: "center", justifyContent: "center" },
    modalBtnDisabled: { opacity: 0.45 },
    modalBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

    emergencyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#FF0000EE",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    emergencyContent: { alignItems: "center", padding: 32, gap: 10, maxWidth: 340 },
    emergencyOverlayEmoji: { fontSize: 56 },
    emergencyOverlayTitle: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: 2 },
    emergencyOverlayName: { fontSize: 20, fontWeight: "700", color: "#fff" },
    emergencyOverlayMsg: { fontSize: 16, color: "rgba(255,255,255,0.9)", textAlign: "center", lineHeight: 22 },
    emergencyOverlayCoords: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
    emergencyOverlayTime: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
    respondBtn: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: "#fff", borderRadius: 16,
      paddingHorizontal: 28, paddingVertical: 14, marginTop: 8,
    },
    respondBtnText: { fontSize: 18, fontWeight: "800", color: "#FF4444" },
    dismissBtn: { marginTop: 6, padding: 8 },
    dismissBtnText: { fontSize: 11, color: "rgba(255,255,255,0.65)", textAlign: "center" },
  });
}
