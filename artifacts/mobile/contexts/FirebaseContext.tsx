import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  firebaseSignInAnonymously,
  onFirebaseAuthStateChanged,
  savePhraseToCloud,
  deletePhraseFromCloud,
  subscribeToUserPhrases,
  saveUserProfileToCloud,
  getUserProfileFromCloud,
  rtdbSavePhrase,
  rtdbSetUserPresence,
  rtdbSaveUserProfile,
  rtdbSetRole,
  rtdbGetRole,
  rtdbRegisterUserCode,
  rtdbGetUserCode,
  rtdbTriggerEmergency,
  rtdbResolveEmergency,
} from "@/lib/firebase";
import type { CloudPhrase, RtdbPhrase, EmergencyEvent } from "@/lib/firebase";
import type { UserProfile } from "@/contexts/AuthContext";

const ROLE_KEY = "typetalk_role";

interface FirebaseContextValue {
  firebaseUser: User | null;
  firebaseLoading: boolean;
  cloudPhrases: CloudPhrase[];
  cloudError: string | null;
  isConnected: boolean;
  role: "user" | "guardian" | null;
  roleLoading: boolean;
  guardianCode: string | null;
  fbSavePhrase: (phrase: Omit<CloudPhrase, "id" | "userId">) => Promise<string | null>;
  fbDeletePhrase: (id: string) => Promise<string | null>;
  fbSaveProfile: (profile: UserProfile) => Promise<string | null>;
  fbGetProfile: () => Promise<UserProfile | null>;
  rtdbPushPhrase: (phrase: Omit<RtdbPhrase, "id">) => Promise<void>;
  setRole: (role: "user" | "guardian") => Promise<void>;
  triggerEmergency: (message: string, lat?: number | null, lng?: number | null) => Promise<void>;
  resolveEmergency: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseLoading, setFirebaseLoading] = useState(true);
  const [cloudPhrases, setCloudPhrases] = useState<CloudPhrase[]>([]);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [role, setRoleState] = useState<"user" | "guardian" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [guardianCode, setGuardianCode] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onFirebaseAuthStateChanged(async (user) => {
      if (user) {
        setFirebaseUser(user);
        setFirebaseLoading(false);

        rtdbSetUserPresence(
          user.uid,
          user.displayName ?? "Type Talk User",
          user.photoURL ?? undefined
        ).catch(() => {});

        const [savedRole, remoteRole, code] = await Promise.all([
          AsyncStorage.getItem(ROLE_KEY),
          rtdbGetRole(user.uid),
          rtdbGetUserCode(user.uid),
        ]);

        const resolvedRole = (savedRole ?? remoteRole) as "user" | "guardian" | null;
        setRoleState(resolvedRole);
        setRoleLoading(false);

        if (code) {
          setGuardianCode(code);
        } else {
          const newCode = await rtdbRegisterUserCode(user.uid);
          setGuardianCode(newCode);
        }

        if (resolvedRole) {
          await rtdbSetRole(user.uid, resolvedRole).catch(() => {});
        }
      } else {
        // No session — auto sign in anonymously (no login screen needed)
        firebaseSignInAnonymously().catch(() => {
          setFirebaseLoading(false);
          setRoleLoading(false);
        });
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

  const setRole = useCallback(async (r: "user" | "guardian") => {
    setRoleState(r);
    await AsyncStorage.setItem(ROLE_KEY, r);
    if (firebaseUser) {
      await rtdbSetRole(firebaseUser.uid, r).catch(() => {});
    }
  }, [firebaseUser]);

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
      rtdbSaveUserProfile(firebaseUser.uid, { name: profile.name, age: profile.age, gender: profile.gender, bio: profile.bio }).catch(() => {});
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

  const triggerEmergency = useCallback(async (message: string, lat?: number | null, lng?: number | null) => {
    if (!firebaseUser) return;
    await rtdbTriggerEmergency(firebaseUser.uid, message, lat, lng);
  }, [firebaseUser]);

  const resolveEmergency = useCallback(async () => {
    if (!firebaseUser) return;
    await rtdbResolveEmergency(firebaseUser.uid);
  }, [firebaseUser]);

  return (
    <FirebaseContext.Provider value={{
      firebaseUser, firebaseLoading,
      cloudPhrases, cloudError,
      isConnected: !!firebaseUser,
      role, roleLoading, guardianCode,
      fbSavePhrase, fbDeletePhrase, fbSaveProfile, fbGetProfile,
      rtdbPushPhrase, setRole,
      triggerEmergency, resolveEmergency,
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) throw new Error("useFirebase must be inside FirebaseProvider");
  return ctx;
}
