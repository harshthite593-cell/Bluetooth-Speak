import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export const SAVED_PHRASES_KEY = "tts_saved_phrases_v1";

export interface SavedPhrase {
  id: string;
  text: string;
  savedAt: string;
}

export default function SavedPhrasesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [phrases, setPhrases] = useState<SavedPhrase[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPhrases();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      Speech.stop();
    };
  }, []);

  const loadPhrases = async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_PHRASES_KEY);
      if (raw) setPhrases(JSON.parse(raw));
    } catch {}
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const speakPhrase = useCallback(async (phrase: SavedPhrase) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Speech.stop();
    } catch {}
    setSpeakingId(phrase.id);
    Speech.speak(phrase.text, {
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeakingId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const deletePhrase = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = phrases.filter((p) => p.id !== id);
      setPhrases(updated);
      try {
        await AsyncStorage.setItem(SAVED_PHRASES_KEY, JSON.stringify(updated));
      } catch {}
      showToast("Phrase deleted");
    },
    [phrases, showToast]
  );

  const s = makeStyles(colors, topPad, bottomPad);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            Speech.stop();
            router.back();
          }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.title}>My Phrases</Text>
        <View style={s.backBtn} />
      </View>

      {/* List */}
      {phrases.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Feather name="bookmark" size={36} color="#4ECDC4" />
          </View>
          <Text style={s.emptyTitle}>No saved phrases yet</Text>
          <Text style={s.emptySubtext}>
            Save your favorites by tapping the{"\n"}bookmark icon on the main
            screen
          </Text>
        </View>
      ) : (
        <FlatList
          data={phrases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            s.listContent,
            { paddingBottom: bottomPad + 24 },
          ]}
          renderItem={({ item }) => {
            const isActive = speakingId === item.id;
            return (
              <View style={s.phraseCard}>
                <Text style={s.phraseText}>{item.text}</Text>
                <Text style={s.phraseDate}>
                  Saved {formatDate(item.savedAt)}
                </Text>
                <View style={s.phraseActions}>
                  <TouchableOpacity
                    style={[s.actionBtn, s.speakBtn, isActive && s.speakBtnActive]}
                    onPress={isActive ? stopSpeaking : () => speakPhrase(item)}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={isActive ? "square" : "volume-2"}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={s.speakBtnText}>
                      {isActive ? "Stop" : "Speak"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, s.deleteBtn]}
                    onPress={() => deletePhrase(item.id)}
                    activeOpacity={0.8}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* Toast */}
      {toast && (
        <View style={s.toast} pointerEvents="none">
          <Feather name="check-circle" size={14} color="#FFFFFF" />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function makeStyles(
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>,
  topPad: number,
  bottomPad: number
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: topPad + 12,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    phraseCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    phraseText: {
      fontSize: 18,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 26,
      marginBottom: 6,
    },
    phraseDate: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 14,
    },
    phraseActions: {
      flexDirection: "row",
      gap: 10,
    },
    actionBtn: {
      height: 48,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    speakBtn: {
      flex: 1,
      flexDirection: "row",
      gap: 8,
      backgroundColor: colors.primary,
    },
    speakBtnActive: {
      backgroundColor: colors.destructive,
    },
    speakBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_600SemiBold",
    },
    deleteBtn: {
      width: 48,
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Empty state
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingBottom: 80,
      paddingHorizontal: 32,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "rgba(78,205,196,0.12)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      textAlign: "center",
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 21,
    },

    // Toast
    toast: {
      position: "absolute",
      bottom: bottomPad + 32,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#1E2338",
      borderRadius: 100,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toastText: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
  });
}
