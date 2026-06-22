import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  off,
  serverTimestamp,
  onDisconnect,
  DatabaseReference,
} from "firebase/database";
import { firebaseApp } from "./config";

export const rtdb = getDatabase(firebaseApp);

export interface RtdbPhrase {
  id: string;
  text: string;
  timestamp: number;
  voiceRate?: number;
  voicePitch?: number;
  language?: string;
}

export interface UserPresence {
  online: boolean;
  lastActive: number | object;
  displayName?: string;
  photoURL?: string;
}

export async function rtdbSavePhrase(
  userId: string,
  phrase: Omit<RtdbPhrase, "id">
): Promise<{ id: string | null; error: string | null }> {
  try {
    const phrasesRef = ref(rtdb, `users/${userId}/phrases`);
    const newRef = await push(phrasesRef, {
      ...phrase,
      timestamp: phrase.timestamp ?? Date.now(),
    });
    return { id: newRef.key, error: null };
  } catch (e: unknown) {
    return { id: null, error: e instanceof Error ? e.message : "RTDB write failed." };
  }
}

export async function rtdbSetUserPresence(
  userId: string,
  displayName: string,
  photoURL?: string
): Promise<void> {
  try {
    const statusRef = ref(rtdb, `users/${userId}/status`);
    const presence: UserPresence = {
      online: true,
      lastActive: serverTimestamp(),
      displayName,
      photoURL: photoURL ?? "",
    };
    await set(statusRef, presence);
    onDisconnect(statusRef).update({ online: false, lastActive: serverTimestamp() });
  } catch {}
}

export async function rtdbUpdateLastSeen(userId: string): Promise<void> {
  try {
    const statusRef = ref(rtdb, `users/${userId}/status`);
    await set(statusRef, { online: true, lastActive: serverTimestamp() });
    onDisconnect(statusRef).update({ online: false, lastActive: serverTimestamp() });
  } catch {}
}

export function rtdbSubscribeToUserPhrases(
  userId: string,
  onUpdate: (phrases: RtdbPhrase[]) => void
): () => void {
  const phrasesRef = ref(rtdb, `users/${userId}/phrases`);
  const handler = onValue(phrasesRef, (snap) => {
    if (!snap.exists()) { onUpdate([]); return; }
    const val = snap.val() as Record<string, Omit<RtdbPhrase, "id">>;
    const phrases: RtdbPhrase[] = Object.entries(val)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    onUpdate(phrases);
  });
  return () => off(phrasesRef, "value", handler);
}

export function rtdbSubscribeToUserStatus(
  userId: string,
  onUpdate: (status: UserPresence | null) => void
): () => void {
  const statusRef: DatabaseReference = ref(rtdb, `users/${userId}/status`);
  const handler = onValue(statusRef, (snap) => {
    onUpdate(snap.exists() ? (snap.val() as UserPresence) : null);
  });
  return () => off(statusRef, "value", handler);
}

export async function rtdbSaveUserProfile(
  userId: string,
  profile: { name: string; age?: number; gender?: string; bio?: string }
): Promise<void> {
  try {
    await set(ref(rtdb, `users/${userId}/profile`), {
      ...profile,
      updatedAt: Date.now(),
    });
  } catch {}
}
