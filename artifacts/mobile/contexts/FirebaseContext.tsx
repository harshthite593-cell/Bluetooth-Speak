import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  firebaseRegister,
  firebaseLogin,
  firebaseLogout,
  onFirebaseAuthStateChanged,
  savePhraseToCloud,
  getPhrasesFromCloud,
  deletePhraseFromCloud,
  subscribeToUserPhrases,
  saveUserProfileToCloud,
  getUserProfileFromCloud,
} from "@/lib/firebase";
import type { CloudPhrase } from "@/lib/firebase";
import type { UserProfile } from "@/contexts/AuthContext";

interface FirebaseContextValue {
  firebaseUser: User | null;
  firebaseLoading: boolean;
  cloudPhrases: CloudPhrase[];
  cloudError: string | null;
  fbRegister: (name: string, email: string, password: string) => Promise<string | null>;
  fbLogin: (email: string, password: string) => Promise<string | null>;
  fbLogout: () => Promise<void>;
  fbSavePhrase: (phrase: Omit<CloudPhrase, "id" | "userId">) => Promise<string | null>;
  fbDeletePhrase: (id: string) => Promise<string | null>;
  fbSaveProfile: (profile: UserProfile) => Promise<string | null>;
  fbGetProfile: () => Promise<UserProfile | null>;
  isConnected: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);
  const [cloudPhrases, setCloudPhrases] = useState<CloudPhrase[]>([]);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsub = onFirebaseAuthStateChanged((user) => {
      setFirebaseUser(user);
      setFirebaseLoading(false);
      setIsConnected(!!user);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setCloudPhrases([]);
      return;
    }
    const unsub = subscribeToUserPhrases(firebaseUser.uid, (phrases) => {
      setCloudPhrases(phrases);
      setCloudError(null);
    });
    return unsub;
  }, [firebaseUser]);

  const fbRegister = useCallback(async (name: string, email: string, password: string) => {
    const { error } = await firebaseRegister(name, email, password);
    return error;
  }, []);

  const fbLogin = useCallback(async (email: string, password: string) => {
    const { error } = await firebaseLogin(email, password);
    return error;
  }, []);

  const fbLogout = useCallback(async () => {
    await firebaseLogout();
  }, []);

  const fbSavePhrase = useCallback(async (phrase: Omit<CloudPhrase, "id" | "userId">) => {
    if (!firebaseUser) return "Not signed in to cloud.";
    const { error } = await savePhraseToCloud(firebaseUser.uid, phrase);
    if (error) setCloudError(error);
    return error;
  }, [firebaseUser]);

  const fbDeletePhrase = useCallback(async (id: string) => {
    const error = await deletePhraseFromCloud(id);
    if (error) setCloudError(error);
    return error;
  }, []);

  const fbSaveProfile = useCallback(async (profile: UserProfile) => {
    if (!firebaseUser) return "Not signed in to cloud.";
    return saveUserProfileToCloud(firebaseUser.uid, profile);
  }, [firebaseUser]);

  const fbGetProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!firebaseUser) return null;
    const { profile } = await getUserProfileFromCloud(firebaseUser.uid);
    return profile;
  }, [firebaseUser]);

  return (
    <FirebaseContext.Provider value={{
      firebaseUser,
      firebaseLoading,
      cloudPhrases,
      cloudError,
      fbRegister,
      fbLogin,
      fbLogout,
      fbSavePhrase,
      fbDeletePhrase,
      fbSaveProfile,
      fbGetProfile,
      isConnected,
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) throw new Error("useFirebase must be used inside FirebaseProvider");
  return ctx;
}
