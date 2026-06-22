import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const PROFILE_KEY = "typetalk_profile";
const PROFILE_SEEN_KEY = "typetalk_profile_seen";

const _domain = process.env["EXPO_PUBLIC_DOMAIN"];
export const API_BASE: string =
  Platform.OS === "web"
    ? "/api"
    : _domain
      ? `https://${_domain}/api`
      : (process.env["EXPO_PUBLIC_API_BASE_URL"] ?? "http://localhost:8080/api");

export interface UserProfile {
  name: string;
  age: number;
  gender: string;
  birthDate: string;
  bio?: string;
}

interface AuthState {
  profile: UserProfile | null;
  profileSeen: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  updateProfile: (profile: UserProfile) => Promise<void>;
  skipProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    profile: null,
    profileSeen: false,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const [profileRaw, seenRaw] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(PROFILE_SEEN_KEY),
        ]);
        const profile: UserProfile | null = profileRaw ? JSON.parse(profileRaw) : null;
        const profileSeen = seenRaw === "true" || !!profile;
        setState({ profile, profileSeen, loading: false });
      } catch {
        setState({ profile: null, profileSeen: false, loading: false });
      }
    })();
  }, []);

  const updateProfile = useCallback(async (profile: UserProfile) => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    await AsyncStorage.setItem(PROFILE_SEEN_KEY, "true");
    setState(prev => ({ ...prev, profile, profileSeen: true }));
  }, []);

  const skipProfile = useCallback(async () => {
    await AsyncStorage.setItem(PROFILE_SEEN_KEY, "true");
    setState(prev => ({ ...prev, profileSeen: true }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, updateProfile, skipProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
