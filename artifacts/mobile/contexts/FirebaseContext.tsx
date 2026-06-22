import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  firebaseRegister,
  firebaseLogin,
  firebaseLogout,
  firebaseGoogleSignIn,
  firebaseSendOTP,
  firebaseConfirmOTP,
  firebaseCancelOTP,
  onFirebaseAuthStateChanged,
  savePhraseToCloud,
  deletePhraseFromCloud,
  subscribeToUserPhrases,
  saveUserProfileToCloud,
  getUserProfileFromCloud,
  rtdbSavePhrase,
  rtdbSetUserPresence,
  rtdbSaveUserProfile,
} from "@/lib/firebase";
import type { CloudPhrase, RtdbPhrase } from "@/lib/firebase";
import type { UserProfile } from "@/contexts/AuthContext";

interface FirebaseContextValue {
  firebaseUser: User | null;
  firebaseLoading: boolean;
  cloudPhrases: CloudPhrase[];
  cloudError: string | null;
  isConnected: boolean;
  fbRegister: (name: string, email: string, password: string) => Promise<string | null>;
  fbLogin: (email: string, password: string) => Promise<string | null>;
  fbGoogleSignIn: () => Promise<string | null>;
  fbSendOTP: (phone: string, containerId: string) => Promise<string | null>;
  fbConfirmOTP: (code: string) => Promise<{ user: User | null; error: string | null }>;
  fbCancelOTP: () => void;
  fbLogout: () => Promise<void>;
  fbSavePhrase: (phrase: Omit<CloudPhrase, "id" | "userId">) => Promise<string | null>;
  fbDeletePhrase: (id: string) => Promise<string | null>;
  fbSaveProfile: (profile: UserProfile) => Promise<string | null>;
  fbGetProfile: () => Promise<UserProfile | null>;
  rtdbPushPhrase: (phrase: Omit<RtdbPhrase, "id">) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);
  const [cloudPhrases, setCloudPhrases] = useState<CloudPhrase[]>([]);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onFirebaseAuthStateChanged((user) => {
      setFirebaseUser(user);
      setFirebaseLoading(false);
      if (user) {
        rtdbSetUserPresence(
          user.uid,
          user.displayName ?? user.email ?? "Type Talk User",
          user.photoURL ?? undefined
        ).catch(() => {});
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseUser) { setCloudPhrases([]); return; }
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

  const fbGoogleSignIn = useCallback(async () => {
    const { error } = await firebaseGoogleSignIn();
    return error;
  }, []);

  const fbSendOTP = useCallback(async (phone: string, containerId: string) => {
    const { error } = await firebaseSendOTP(phone, containerId);
    return error;
  }, []);

  const fbConfirmOTP = useCallback(async (code: string) => {
    return firebaseConfirmOTP(code);
  }, []);

  const fbCancelOTP = useCallback(() => { firebaseCancelOTP(); }, []);

  const fbLogout = useCallback(async () => { await firebaseLogout(); }, []);

  const fbSavePhrase = useCallback(async (phrase: Omit<CloudPhrase, "id" | "userId">) => {
    if (!firebaseUser) return null;
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
    if (!firebaseUser) return null;
    const err = await saveUserProfileToCloud(firebaseUser.uid, profile);
    if (!err) {
      rtdbSaveUserProfile(firebaseUser.uid, {
        name: profile.name,
        age: profile.age,
        gender: profile.gender,
        bio: profile.bio,
      }).catch(() => {});
    }
    return err;
  }, [firebaseUser]);

  const fbGetProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!firebaseUser) return null;
    const { profile } = await getUserProfileFromCloud(firebaseUser.uid);
    return profile;
  }, [firebaseUser]);

  const rtdbPushPhrase = useCallback(async (phrase: Omit<RtdbPhrase, "id">) => {
    if (!firebaseUser) return;
    rtdbSavePhrase(firebaseUser.uid, phrase).catch(() => {});
  }, [firebaseUser]);

  return (
    <FirebaseContext.Provider value={{
      firebaseUser,
      firebaseLoading,
      cloudPhrases,
      cloudError,
      isConnected: !!firebaseUser,
      fbRegister,
      fbLogin,
      fbGoogleSignIn,
      fbSendOTP,
      fbConfirmOTP,
      fbCancelOTP,
      fbLogout,
      fbSavePhrase,
      fbDeletePhrase,
      fbSaveProfile,
      fbGetProfile,
      rtdbPushPhrase,
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
