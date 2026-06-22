import {
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type User,
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { firebaseApp } from "./config";

export const firebaseAuth =
  Platform.OS === "web"
    ? getAuth(firebaseApp)
    : initializeAuth(firebaseApp, {
        persistence: getReactNativePersistence(AsyncStorage),
      });

export async function firebaseSignInAnonymously(): Promise<{ user: User | null; error: string | null }> {
  try {
    const cred = await signInAnonymously(firebaseAuth);
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    return { user: null, error: "Failed to initialize session." };
  }
}

export async function firebaseLogout(): Promise<void> {
  await signOut(firebaseAuth);
}

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}
