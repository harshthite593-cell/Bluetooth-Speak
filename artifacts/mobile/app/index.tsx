import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
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

import WaveformAnimation from "@/components/WaveformAnimation";
import { useColors } from "@/hooks/useColors";

const HISTORY_KEY = "tts_history_v1";
const SETTINGS_KEY = "tts_settings_v1";
const SAVED_PHRASES_KEY = "tts_saved_phrases_v1";

interface SavedPhrase {
  id: string;
  text: string;
  savedAt: string;
}

const LANGUAGES = [
  { code: "en-US", label: "English (US)", flag: "🇺🇸" },
  { code: "en-GB", label: "English (UK)", flag: "🇬🇧" },
  { code: "es-ES", label: "Español", flag: "🇪🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "de-DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "it-IT", label: "Italiano", flag: "🇮🇹" },
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
  { code: "ja-JP", label: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "ar-SA", label: "العربية", flag: "🇸🇦" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ko-KR", label: "한국어", flag: "🇰🇷" },
];

interface HistoryEntry {
  id: string;
  text: string;
  timestamp: number;
}

type Panel = "main" | "settings" | "history";

export default function TTSScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>("main");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [language, setLanguage] = useState("en-US");
  const [showLangPicker, setShowLangPicker] = useState(false);

  // ── Saved Phrases (ADDITIVE) ──────────────────────────────────
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      try {
        const [savedSettings, savedHistory, savedPhrasesRaw] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
          AsyncStorage.getItem(SAVED_PHRASES_KEY),
        ]);
        if (savedSettings) {
          const s = JSON.parse(savedSettings);
          setRate(s.rate ?? 1.0);
          setPitch(s.pitch ?? 1.0);
          setLanguage(s.language ?? "en-US");
        }
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        }
        if (savedPhrasesRaw) {
          setSavedPhrases(JSON.parse(savedPhrasesRaw));
        }
      } catch {}
    })();

    const t = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(t);
  }, []);

  const persistSettings = useCallback(
    async (r: number, p: number, l: string) => {
      try {
        await AsyncStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({ rate: r, pitch: p, language: l })
        );
      } catch {}
    },
    []
  );

  const speak = useCallback(
    async (textToSpeak: string) => {
      const trimmed = textToSpeak.trim();
      if (!trimmed) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Keyboard.dismiss();

      try {
        await Speech.stop();
      } catch {}

      const entry: HistoryEntry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        text: trimmed,
        timestamp: Date.now(),
      };
      const newHistory = [entry, ...history].slice(0, 60);
      setHistory(newHistory);
      try {
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      } catch {}

      Speech.speak(trimmed, {
        rate,
        pitch,
        language,
        onStart: () => setIsSpeaking(true),
        onDone: () => {
          setIsSpeaking(false);
          setTimeout(() => inputRef.current?.focus(), 100);
        },
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [rate, pitch, language, history]
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSubmitEditing = useCallback(() => {
    speak(text);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [text, speak]);

  const nudgeRate = (delta: number) => {
    const newRate =
      Math.round(Math.max(0.25, Math.min(2.0, rate + delta)) * 4) / 4;
    setRate(newRate);
    persistSettings(newRate, pitch, language);
  };

  const nudgePitch = (delta: number) => {
    const newPitch =
      Math.round(Math.max(0.5, Math.min(2.0, pitch + delta)) * 4) / 4;
    setPitch(newPitch);
    persistSettings(rate, newPitch, language);
  };

  const pickLanguage = (code: string) => {
    setLanguage(code);
    setShowLangPicker(false);
    persistSettings(rate, pitch, code);
  };

  const clearHistory = async () => {
    setHistory([]);
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Save current phrase (ADDITIVE) ───────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const saveCurrentPhrase = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      showToast("Type something first to save");
      return;
    }
    const isDuplicate = savedPhrases.some(
      (p) => p.text.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      showToast("This phrase is already saved");
      return;
    }
    const entry: SavedPhrase = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      text: trimmed,
      savedAt: new Date().toISOString(),
    };
    const updated = [entry, ...savedPhrases];
    setSavedPhrases(updated);
    try {
      await AsyncStorage.setItem(SAVED_PHRASES_KEY, JSON.stringify(updated));
    } catch {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Phrase saved! ✅");
  }, [text, savedPhrases, showToast]);

  const switchPanel = (panel: Panel) => {
    if (activePanel === panel) {
      setActivePanel("main");
      setTimeout(() => inputRef.current?.focus(), 200);
    } else {
      setActivePanel(panel);
    }
  };

  const s = makeStyles(colors, topPad, bottomPad);

  const currentLang = LANGUAGES.find((l) => l.code === language);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.btDot} />
          <Text style={s.appTitle}>SpeakIt</Text>
        </View>
        <View style={s.headerRight}>
          {/* My Phrases button (ADDITIVE) */}
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => router.push("/saved-phrases")}
          >
            <Feather name="bookmark" size={20} color="#4ECDC4" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => switchPanel("history")}
          >
            <Feather
              name="clock"
              size={20}
              color={
                activePanel === "history"
                  ? colors.primary
                  : colors.mutedForeground
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => switchPanel("settings")}
          >
            <Feather
              name="sliders"
              size={20}
              color={
                activePanel === "settings"
                  ? colors.primary
                  : colors.mutedForeground
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Panels ── */}
      {activePanel === "history" ? (
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Text style={s.panelTitle}>History</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Text style={s.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>
          {history.length === 0 ? (
            <View style={s.emptyState}>
              <Feather name="clock" size={36} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No history yet</Text>
              <Text style={s.emptySubtext}>
                Spoken phrases will appear here
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.historyItem}
                  onPress={() => {
                    setText(item.text);
                    setActivePanel("main");
                    speak(item.text);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.historyText} numberOfLines={2}>
                    {item.text}
                  </Text>
                  <View style={s.historyMeta}>
                    <Text style={s.historyTime}>
                      {formatTime(item.timestamp)}
                    </Text>
                    <Feather
                      name="volume-2"
                      size={14}
                      color={colors.primary}
                    />
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={s.separator} />}
            />
          )}
        </View>
      ) : activePanel === "settings" ? (
        <ScrollView
          style={s.panel}
          contentContainerStyle={{ paddingBottom: bottomPad + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.panelTitle}>Voice Settings</Text>

          {/* Speed */}
          <View style={s.settingCard}>
            <View style={s.settingLabelRow}>
              <Feather name="zap" size={15} color={colors.primary} />
              <Text style={s.settingLabel}>Speed</Text>
            </View>
            <View style={s.adjuster}>
              <TouchableOpacity
                style={s.adjBtn}
                onPress={() => nudgeRate(-0.25)}
              >
                <Feather name="minus" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={s.adjValue}>{rate.toFixed(2)}×</Text>
              <TouchableOpacity
                style={s.adjBtn}
                onPress={() => nudgeRate(0.25)}
              >
                <Feather name="plus" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={s.speedTrack}>
              {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[s.speedPip, rate >= v && s.speedPipActive]}
                  onPress={() => {
                    setRate(v);
                    persistSettings(v, pitch, language);
                  }}
                />
              ))}
            </View>
            <View style={s.speedLabels}>
              <Text style={s.speedLabel}>Slow</Text>
              <Text style={s.speedLabel}>Fast</Text>
            </View>
          </View>

          {/* Pitch */}
          <View style={s.settingCard}>
            <View style={s.settingLabelRow}>
              <Feather name="activity" size={15} color={colors.accent} />
              <Text style={s.settingLabel}>Pitch</Text>
            </View>
            <View style={s.adjuster}>
              <TouchableOpacity
                style={s.adjBtn}
                onPress={() => nudgePitch(-0.25)}
              >
                <Feather name="minus" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={s.adjValue}>{pitch.toFixed(2)}</Text>
              <TouchableOpacity
                style={s.adjBtn}
                onPress={() => nudgePitch(0.25)}
              >
                <Feather name="plus" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={s.speedTrack}>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[s.speedPip, pitch >= v && s.pitchPipActive]}
                  onPress={() => {
                    setPitch(v);
                    persistSettings(rate, v, language);
                  }}
                />
              ))}
            </View>
            <View style={s.speedLabels}>
              <Text style={s.speedLabel}>Low</Text>
              <Text style={s.speedLabel}>High</Text>
            </View>
          </View>

          {/* Language */}
          <View style={s.settingCard}>
            <View style={s.settingLabelRow}>
              <Feather name="globe" size={15} color={colors.mutedForeground} />
              <Text style={s.settingLabel}>Language</Text>
            </View>
            <TouchableOpacity
              style={s.langBtn}
              onPress={() => setShowLangPicker(!showLangPicker)}
            >
              <Text style={s.langBtnText}>
                {currentLang?.flag} {currentLang?.label ?? language}
              </Text>
              <Feather
                name={showLangPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {showLangPicker && (
              <View style={s.langList}>
                {LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      s.langOption,
                      language === lang.code && s.langOptionActive,
                    ]}
                    onPress={() => pickLanguage(lang.code)}
                  >
                    <Text style={s.langOptionText}>
                      {lang.flag} {lang.label}
                    </Text>
                    {language === lang.code && (
                      <Feather
                        name="check"
                        size={14}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Reset */}
          <TouchableOpacity
            style={s.resetBtn}
            onPress={() => {
              setRate(1.0);
              setPitch(1.0);
              setLanguage("en-US");
              persistSettings(1.0, 1.0, "en-US");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={s.resetBtnText}>Reset to defaults</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* ── Main TTS Panel ── */
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={topPad}
        >
          <View style={s.mainContent}>
            {/* Bluetooth badge */}
            <View style={s.btBadge}>
              <Feather name="bluetooth" size={12} color={colors.primary} />
              <Text style={s.btBadgeText}>
                Bluetooth keyboard supported — just type
              </Text>
            </View>

            {/* Text input */}
            <View style={s.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={s.textInput}
                value={text}
                onChangeText={(newText) => {
                  if (newText.endsWith("\n")) {
                    const trimmed = newText.slice(0, -1);
                    setText(trimmed);
                    if (trimmed.trim()) speak(trimmed);
                    setTimeout(() => inputRef.current?.focus(), 150);
                    return;
                  }
                  setText(newText);
                }}
                placeholder="Type here or connect a Bluetooth keyboard..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                blurOnSubmit={false}
                autoFocus
                autoCorrect={false}
                autoCapitalize="sentences"
                textAlignVertical="top"
              />
              {text.length > 0 && (
                <TouchableOpacity
                  style={s.clearTextBtn}
                  onPress={() => {
                    setText("");
                    inputRef.current?.focus();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather
                    name="x-circle"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Char count + current settings */}
            <View style={s.metaRow}>
              <Text style={s.charCount}>{text.length} chars</Text>
              <TouchableOpacity
                style={s.settingsPill}
                onPress={() => setActivePanel("settings")}
              >
                <Feather
                  name="sliders"
                  size={11}
                  color={colors.mutedForeground}
                />
                <Text style={s.settingsPillText}>
                  {rate.toFixed(2)}× · {pitch.toFixed(2)} · {currentLang?.flag}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Waveform */}
            {isSpeaking && (
              <View style={s.waveformRow}>
                <WaveformAnimation isActive={isSpeaking} color={colors.primary} />
              </View>
            )}

            {/* Speak / Stop button */}
            <TouchableOpacity
              style={[s.speakBtn, isSpeaking && s.speakBtnStop]}
              onPress={isSpeaking ? stopSpeaking : () => speak(text)}
              activeOpacity={0.85}
              disabled={!isSpeaking && text.trim().length === 0}
            >
              <Feather
                name={isSpeaking ? "square" : "volume-2"}
                size={26}
                color="#FFFFFF"
              />
              <Text style={s.speakBtnText}>
                {isSpeaking ? "Stop" : "Speak"}
              </Text>
            </TouchableOpacity>

            <Text style={s.hint}>
              {isSpeaking
                ? "Speaking…"
                : "Press Enter on keyboard or tap Speak"}
            </Text>

            {/* ── Save button row (ADDITIVE) ─────────────────── */}
            <View style={s.saveRow}>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={saveCurrentPhrase}
                activeOpacity={0.8}
              >
                <Feather name="bookmark" size={20} color="#FFFFFF" />
                <Text style={s.saveBtnText}>Save phrase</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.myPhrasesBtn}
                onPress={() => router.push("/saved-phrases")}
                activeOpacity={0.8}
              >
                <Feather name="list" size={18} color="#4ECDC4" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast overlay (ADDITIVE) */}
          {toast && (
            <View style={s.toast} pointerEvents="none">
              <Feather name="check-circle" size={14} color="#FFFFFF" />
              <Text style={s.toastText}>{toast}</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString();
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: topPad + 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    btDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#4F8EF7",
    },
    appTitle: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.5,
    },
    headerRight: {
      flexDirection: "row",
      gap: 4,
    },
    headerBtn: {
      padding: 8,
      borderRadius: 8,
    },

    // Panels
    panel: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    panelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    panelTitle: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
    },
    clearAllText: {
      fontSize: 14,
      color: colors.destructive,
      fontFamily: "Inter_500Medium",
    },

    // History
    historyItem: {
      paddingVertical: 14,
    },
    historyText: {
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 22,
      marginBottom: 6,
    },
    historyMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    historyTime: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },

    // Empty state
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingBottom: 80,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },

    // Settings
    settingCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius as number,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    settingLabel: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    adjuster: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      marginBottom: 16,
    },
    adjBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    adjValue: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      minWidth: 72,
      textAlign: "center",
    },
    speedTrack: {
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      marginBottom: 8,
    },
    speedPip: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    speedPipActive: {
      backgroundColor: colors.primary,
    },
    pitchPipActive: {
      backgroundColor: colors.accent,
    },
    speedLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    speedLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    langBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.secondary,
      borderRadius: 10,
    },
    langBtnText: {
      fontSize: 15,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
    },
    langList: {
      marginTop: 8,
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    langOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
    },
    langOptionActive: {
      backgroundColor: colors.secondary,
    },
    langOptionText: {
      fontSize: 14,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
    },
    resetBtn: {
      alignItems: "center",
      paddingVertical: 14,
      marginTop: 4,
    },
    resetBtnText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
    },

    // Main TTS view
    mainContent: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: bottomPad + 20,
    },
    btBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 100,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginBottom: 14,
    },
    btBadgeText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    inputWrapper: {
      flex: 1,
      position: "relative",
      minHeight: 120,
      maxHeight: 280,
      backgroundColor: colors.card,
      borderRadius: colors.radius as number,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    textInput: {
      flex: 1,
      padding: 16,
      fontSize: 18,
      color: colors.foreground,
      fontFamily: "Inter_400Regular",
      lineHeight: 26,
      paddingRight: 44,
    },
    clearTextBtn: {
      position: "absolute",
      top: 12,
      right: 12,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    charCount: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    settingsPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.card,
      borderRadius: 100,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingsPillText: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    waveformRow: {
      marginBottom: 16,
    },
    speakBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 18,
      marginBottom: 12,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    speakBtnStop: {
      backgroundColor: colors.destructive,
      shadowColor: colors.destructive,
    },
    speakBtnText: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_700Bold",
    },
    hint: {
      textAlign: "center",
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 14,
    },

    // ── Saved phrases additions ───────────────────────────────
    saveRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    saveBtn: {
      flex: 1,
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: "#4ECDC4",
      borderRadius: 12,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#FFFFFF",
      fontFamily: "Inter_600SemiBold",
    },
    myPhrasesBtn: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#4ECDC4",
    },
    toast: {
      position: "absolute",
      bottom: bottomPad + 20,
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
