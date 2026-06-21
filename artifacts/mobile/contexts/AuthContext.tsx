import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const AUTH_TOKEN_KEY = "typetalk_auth_token";
const AUTH_USER_KEY = "typetalk_auth_user";

const API_BASE = (process.env["EXPO_PUBLIC_API_BASE_URL"] ?? "/api").replace(/\/$/, "");

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const [token, userRaw] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);
        if (token && userRaw) {
          setState({ user: JSON.parse(userRaw) as AuthUser, token, loading: false });
        } else {
          setState({ user: null, token: null, loading: false });
        }
      } catch {
        setState({ user: null, token: null, loading: false });
      }
    })();
  }, []);

  const persistAuth = useCallback(async (token: string, user: AuthUser) => {
    await Promise.all([
      AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)),
    ]);
    setState({ user, token, loading: false });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok) return data.error ?? "Login failed";
      await persistAuth(data.token!, data.user!);
      return null;
    } catch {
      return "Could not connect to server";
    }
  }, [persistAuth]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok) return data.error ?? "Registration failed";
      await persistAuth(data.token!, data.user!);
      return null;
    } catch {
      return "Could not connect to server";
    }
  }, [persistAuth]);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_USER_KEY),
    ]);
    setState({ user: null, token: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
