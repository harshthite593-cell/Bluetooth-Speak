import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { firebaseApp } from "./config";

export const db = getFirestore(firebaseApp);

export interface CloudPhrase {
  id: string;
  text: string;
  category?: string;
  isFavorite?: boolean;
  spokenAt?: Date;
  voiceRate?: number;
  voicePitch?: number;
  userId: string;
}

export async function savePhrasesToCloud(
  userId: string,
  phrases: Omit<CloudPhrase, "id" | "userId">[]
): Promise<string | null> {
  try {
    const col = collection(db, "phrases");
    for (const phrase of phrases) {
      await addDoc(col, {
        ...phrase,
        userId,
        updatedAt: serverTimestamp(),
      });
    }
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Failed to save phrases.";
  }
}

export async function savePhraseToCloud(
  userId: string,
  phrase: Omit<CloudPhrase, "id" | "userId">
): Promise<{ id: string | null; error: string | null }> {
  try {
    const col = collection(db, "phrases");
    const docRef = await addDoc(col, {
      ...phrase,
      userId,
      spokenAt: serverTimestamp(),
    });
    return { id: docRef.id, error: null };
  } catch (e: unknown) {
    return { id: null, error: e instanceof Error ? e.message : "Failed to save phrase." };
  }
}

export async function getPhrasesFromCloud(
  userId: string
): Promise<{ phrases: CloudPhrase[]; error: string | null }> {
  try {
    const col = collection(db, "phrases");
    const q = query(col, where("userId", "==", userId), orderBy("spokenAt", "desc"));
    const snap = await getDocs(q);
    const phrases = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: data.text ?? "",
        category: data.category,
        isFavorite: data.isFavorite ?? false,
        spokenAt: data.spokenAt instanceof Timestamp ? data.spokenAt.toDate() : undefined,
        voiceRate: data.voiceRate,
        voicePitch: data.voicePitch,
        userId: data.userId,
      } as CloudPhrase;
    });
    return { phrases, error: null };
  } catch (e: unknown) {
    return { phrases: [], error: e instanceof Error ? e.message : "Failed to load phrases." };
  }
}

export async function deletePhraseFromCloud(phraseId: string): Promise<string | null> {
  try {
    await deleteDoc(doc(db, "phrases", phraseId));
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Failed to delete phrase.";
  }
}

export function subscribeToUserPhrases(
  userId: string,
  onUpdate: (phrases: CloudPhrase[]) => void
): () => void {
  const col = collection(db, "phrases");
  const q = query(col, where("userId", "==", userId), orderBy("spokenAt", "desc"));
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const phrases = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        text: data.text ?? "",
        category: data.category,
        isFavorite: data.isFavorite ?? false,
        spokenAt: data.spokenAt instanceof Timestamp ? data.spokenAt.toDate() : undefined,
        voiceRate: data.voiceRate,
        voicePitch: data.voicePitch,
        userId: data.userId,
      } as CloudPhrase;
    });
    onUpdate(phrases);
  });
}
