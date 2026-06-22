import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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

import { useAuth } from "@/contexts/AuthContext";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";
type AuthFlow = "email" | "phone-enter" | "phone-otp";

const RECAPTCHA_ID = "recaptcha-container";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register, continueAsGuest } = useAuth();
  const { fbGoogleSignIn, fbSendOTP, fbConfirmOTP, fbCancelOTP } = useFirebase();

  const [mode, setMode] = useState<Mode>("login");
  const [authFlow, setAuthFlow] = useState<AuthFlow>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("+1");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const otpInputRef = useRef<TextInput>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const s = makeStyles(colors, topPad, bottomPad);

  const handlePostLogin = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/profile-setup");
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) { setError("Please fill in all fields"); return; }
    if (mode === "register" && !name.trim()) { setError("Please enter your name"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const err = mode === "login"
      ? await login(email.trim(), password)
      : await register(name.trim(), email.trim(), password);
    setLoading(false);

    if (err) {
      setError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      handlePostLogin();
    }
  };

  const handleGuest = async () => {
    setGuestLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await continueAsGuest();
    setGuestLoading(false);
    router.replace("/profile-setup");
  };

  const handleGoogle = async () => {
    if (Platform.OS !== "web") {
      setError("Google Sign-In is available in the web version.");
      return;
    }
    setGoogleLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const err = await fbGoogleSignIn();
    setGoogleLoading(false);
    if (err) {
      if (err) setError(err);
    } else {
      handlePostLogin();
    }
  };

  const openPhoneModal = () => {
    setPhone("+1");
    setOtpCode("");
    setOtpSent(false);
    setError(null);
    setPhoneModalVisible(true);
  };

  const closePhoneModal = () => {
    fbCancelOTP();
    setOtpSent(false);
    setOtpCode("");
    setPhone("+1");
    setError(null);
    setPhoneModalVisible(false);
  };

  const handleSendOTP = async () => {
    if (Platform.OS !== "web") {
      setError("Phone sign-in is available in the web version.");
      return;
    }
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 8) {
      setError("Enter a valid phone number in international format (+1234567890).");
      return;
    }
    setOtpSending(true);
    setError(null);
    const err = await fbSendOTP(trimmed, RECAPTCHA_ID);
    setOtpSending(false);
    if (err) {
      setError(err);
    } else {
      setOtpSent(true);
      setTimeout(() => otpInputRef.current?.focus(), 300);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length < 6) { setError("Enter the 6-digit code from your SMS."); return; }
    setOtpVerifying(true);
    setError(null);
    const { error: err } = await fbConfirmOTP(otpCode);
    setOtpVerifying(false);
    if (err) {
      setError(err);
    } else {
      setPhoneModalVisible(false);
      handlePostLogin();
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Invisible reCAPTCHA anchor (web only) */}
      {Platform.OS === "web" && <View nativeID={RECAPTCHA_ID} style={s.recaptchaAnchor} />}

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <Image source={require("../assets/images/logo.png")} style={s.logo} resizeMode="contain" />
          <Text style={s.tagline}>Your voice, amplified</Text>
        </View>

        {/* Email/Password Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{mode === "login" ? "Welcome back" : "Create account"}</Text>

          {mode === "register" && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>Name</Text>
              <View style={s.inputRow}>
                <Feather name="user" size={16} color={colors.mutedForeground} style={s.inputIcon} />
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name"
                  placeholderTextColor={colors.mutedForeground} autoCapitalize="words" autoCorrect={false} returnKeyType="next" />
              </View>
            </View>
          )}

          <View style={s.fieldWrap}>
            <Text style={s.label}>Email</Text>
            <View style={s.inputRow}>
              <Feather name="mail" size={16} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground} keyboardType="email-address"
                autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
            </View>
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Feather name="lock" size={16} color={colors.mutedForeground} style={s.inputIcon} />
              <TextInput style={[s.input, { flex: 1 }]} value={password} onChangeText={setPassword}
                placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                placeholderTextColor={colors.mutedForeground} secureTextEntry={!showPassword}
                autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={handleSubmit} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {error && authFlow === "email" && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={14} color="#FF6B6B" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.submitBtn, loading && s.disabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#000" size="small" /> : (
              <Text style={s.submitBtnText}>{mode === "login" ? "Sign in" : "Create account"}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.switchBtn} onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
            <Text style={s.switchText}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={s.switchLink}>{mode === "login" ? "Sign up" : "Sign in"}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or continue with</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Social / alternative auth */}
        <View style={s.altAuthRow}>
          {/* Google */}
          <TouchableOpacity style={[s.altBtn, googleLoading && s.disabled]} onPress={handleGoogle} disabled={googleLoading} activeOpacity={0.8}>
            {googleLoading ? <ActivityIndicator color={colors.foreground} size="small" /> : (
              <View style={s.altBtnInner}>
                <Text style={s.googleG}>G</Text>
                <Text style={s.altBtnText}>Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Phone */}
          <TouchableOpacity style={s.altBtn} onPress={openPhoneModal} activeOpacity={0.8}>
            <View style={s.altBtnInner}>
              <Feather name="phone" size={17} color={colors.foreground} />
              <Text style={s.altBtnText}>Phone</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Guest */}
        <TouchableOpacity style={[s.guestBtn, guestLoading && s.disabled]} onPress={handleGuest} disabled={guestLoading} activeOpacity={0.8}>
          {guestLoading ? <ActivityIndicator color={colors.mutedForeground} size="small" /> : (
            <>
              <Feather name="user-x" size={18} color={colors.mutedForeground} />
              <Text style={s.guestBtnText}>Continue without account</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={s.guestNote}>Guest mode — your data stays on this device only</Text>

      </ScrollView>

      {/* Phone OTP Modal */}
      <Modal visible={phoneModalVisible} transparent animationType="slide" onRequestClose={closePhoneModal}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{otpSent ? "Enter verification code" : "Sign in with phone"}</Text>
              <TouchableOpacity onPress={closePhoneModal} style={s.modalClose}>
                <Feather name="x" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {!otpSent ? (
              <>
                <Text style={s.modalSubtitle}>We'll send a one-time code to your number.</Text>
                <View style={s.fieldWrap}>
                  <Text style={s.label}>Phone number</Text>
                  <View style={s.inputRow}>
                    <Feather name="phone" size={16} color={colors.mutedForeground} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+1 555 000 0000"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                {error && (
                  <View style={s.errorBox}>
                    <Feather name="alert-circle" size={14} color="#FF6B6B" />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity style={[s.submitBtn, otpSending && s.disabled]} onPress={handleSendOTP} disabled={otpSending} activeOpacity={0.85}>
                  {otpSending ? <ActivityIndicator color="#000" size="small" /> : (
                    <Text style={s.submitBtnText}>Send verification code</Text>
                  )}
                </TouchableOpacity>
                <Text style={s.modalHint}>Use international format: +1 for US, +44 for UK, etc.</Text>
              </>
            ) : (
              <>
                <Text style={s.modalSubtitle}>A 6-digit code was sent to {phone}.</Text>
                <View style={s.fieldWrap}>
                  <Text style={s.label}>Verification code</Text>
                  <View style={s.otpRow}>
                    <TextInput
                      ref={otpInputRef}
                      style={s.otpInput}
                      value={otpCode}
                      onChangeText={(v) => setOtpCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                </View>

                {error && (
                  <View style={s.errorBox}>
                    <Feather name="alert-circle" size={14} color="#FF6B6B" />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity style={[s.submitBtn, otpVerifying && s.disabled]} onPress={handleVerifyOTP} disabled={otpVerifying} activeOpacity={0.85}>
                  {otpVerifying ? <ActivityIndicator color="#000" size="small" /> : (
                    <Text style={s.submitBtnText}>Verify & sign in</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={s.switchBtn} onPress={() => { setOtpSent(false); setOtpCode(""); setError(null); }}>
                  <Text style={s.switchText}>
                    Wrong number? <Text style={s.switchLink}>Change it</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number, bottomPad: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    recaptchaAnchor: { position: "absolute", width: 0, height: 0, opacity: 0 },
    scroll: { flexGrow: 1, paddingTop: topPad + 16, paddingBottom: bottomPad + 24, paddingHorizontal: 20, justifyContent: "center" },
    logoWrap: { alignItems: "center", marginBottom: 28 },
    logo: { width: 160, height: 134, marginBottom: 6 },
    tagline: { fontSize: 13, color: colors.mutedForeground, marginTop: 3 },
    card: { backgroundColor: colors.card, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border },
    cardTitle: { fontSize: 19, fontWeight: "700", color: colors.foreground, marginBottom: 18 },
    fieldWrap: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
    inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, height: 46 },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 15, color: colors.foreground },
    eyeBtn: { padding: 4 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FF6B6B20", borderRadius: 10, padding: 10, marginBottom: 10 },
    errorText: { fontSize: 13, color: "#FF6B6B", flex: 1 },
    submitBtn: { backgroundColor: colors.primary, borderRadius: 13, height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
    disabled: { opacity: 0.6 },
    submitBtnText: { fontSize: 15, fontWeight: "700", color: "#000" },
    switchBtn: { alignItems: "center", marginTop: 14 },
    switchText: { fontSize: 13, color: colors.mutedForeground },
    switchLink: { color: colors.primary, fontWeight: "600" },
    dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 18, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontSize: 12, color: colors.mutedForeground },
    altAuthRow: { flexDirection: "row", gap: 12 },
    altBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.border, borderRadius: 13, height: 48,
      backgroundColor: colors.card,
    },
    altBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    googleG: { fontSize: 18, fontWeight: "800", color: "#4285F4" },
    altBtnText: { fontSize: 15, fontWeight: "600", color: colors.foreground },
    guestBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 13, height: 48 },
    guestBtnText: { fontSize: 15, color: colors.mutedForeground, fontWeight: "500" },
    guestNote: { textAlign: "center", fontSize: 11, color: colors.mutedForeground, marginTop: 8, opacity: 0.7 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
    modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    modalClose: { padding: 4 },
    modalSubtitle: { fontSize: 13, color: colors.mutedForeground, marginBottom: 20 },
    modalHint: { fontSize: 11, color: colors.mutedForeground, textAlign: "center", marginTop: 10, opacity: 0.8 },
    otpRow: { flexDirection: "row", justifyContent: "center" },
    otpInput: {
      flex: 1, height: 56, borderRadius: 12, borderWidth: 1, borderColor: colors.primary,
      backgroundColor: colors.background, textAlign: "center",
      fontSize: 28, fontWeight: "700", color: colors.foreground, letterSpacing: 12,
    },
  });
}
