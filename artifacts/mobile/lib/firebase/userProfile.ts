import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseApp } from "./config";
import type { UserProfile } from "@/contexts/AuthContext";

const db = getFirestore(firebaseApp);

export async function saveUserProfileToCloud(
  userId: string,
  profile: UserProfile
): Promise<string | null> {
  try {
    await setDoc(doc(db, "userProfiles", userId), {
      ...profile,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Failed to save profile.";
  }
}

export async function getUserProfileFromCloud(
  userId: string
): Promise<{ profile: UserProfile | null; error: string | null }> {
  try {
    const snap = await getDoc(doc(db, "userProfiles", userId));
    if (!snap.exists()) return { profile: null, error: null };
    const data = snap.data();
    return {
      profile: {
        name: data.name ?? "",
        age: data.age ?? 0,
        gender: data.gender ?? "",
        birthDate: data.birthDate ?? "",
        bio: data.bio ?? "",
      },
      error: null,
    };
  } catch (e: unknown) {
    return { profile: null, error: e instanceof Error ? e.message : "Failed to load profile." };
  }
}
