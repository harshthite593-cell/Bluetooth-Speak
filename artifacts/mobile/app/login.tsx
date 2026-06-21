import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
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

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const err =
      mode === "login"
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);

    setLoading(false);

    if (err) {
      setError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    }
  };

  const s = makeStyles(colors, topPad, bottomPad);

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + title */}
        <View style={s.logoWrap}>
          <Image
            source={require("../assets/images/logo.png")}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.appName}>Type Talk</Text>
          <Text style={s.tagline}>Your voice, amplified</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </Text>

          {mode === "register" && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>Name</Text>
              <View style={s.inputRow}>
                <Feather name="user" size={16} color={colors.mutedForeground} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>
          )}

          <View style={s.fieldWrap}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color="#FF6B6B" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={s.submitBtnText}>
                {mode === "login" ? "Sign in" : "Create account"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            <Text style={s.switchText}>
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text style={s.switchLink}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingTop: topPad + 24,
      paddingBottom: bottomPad + 24,
      paddingHorizontal: 20,
      justifyContent: "center",
    },
    logoWrap: {
      alignItems: "center",
      marginBottom: 36,
    },
    logo: {
      width: 72,
      height: 72,
      marginBottom: 12,
    },
    appName: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 20,
    },
    fieldWrap: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.mutedForeground,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input ?? colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
    },
    eyeBtn: {
      padding: 4,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#FF6B6B20",
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 13,
      color: "#FF6B6B",
      flex: 1,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryForeground ?? "#000",
    },
    switchBtn: {
      alignItems: "center",
      marginTop: 16,
    },
    switchText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    switchLink: {
      color: colors.primary,
      fontWeight: "600",
    },
  });
}
