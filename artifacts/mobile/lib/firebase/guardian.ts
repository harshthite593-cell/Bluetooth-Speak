import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  serverTimestamp,
  DatabaseReference,
} from "firebase/database";
import { firebaseApp } from "./config";

const db = getDatabase(firebaseApp);

export interface EmergencyEvent {
  active: boolean;
  timestamp: number;
  message: string;
  lat?: number | null;
  lng?: number | null;
  userId: string;
  userName?: string;
}

export interface LinkedUser {
  uid: string;
  displayName: string;
  online: boolean;
  lastActive: number;
  lastPhrase?: string;
  lastPhraseTime?: number;
  emergency?: EmergencyEvent | null;
  guardianCode?: string;
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function uidToCode(uid: string): string {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) ^ uid.charCodeAt(i);
    hash = hash >>> 0;
  }
  let code = "";
  let n = hash;
  for (let i = 0; i < 6; i++) {
    code += CHARS[n % CHARS.length];
    n = Math.floor(n / CHARS.length);
  }
  return code;
}

export async function rtdbSetRole(userId: string, role: "user" | "guardian"): Promise<void> {
  await set(ref(db, `users/${userId}/role`), role);
}

export async function rtdbGetRole(userId: string): Promise<"user" | "guardian" | null> {
  const snap = await get(ref(db, `users/${userId}/role`));
  return snap.exists() ? (snap.val() as "user" | "guardian") : null;
}

export async function rtdbRegisterUserCode(userId: string): Promise<string> {
  const code = uidToCode(userId);
  await set(ref(db, `linkCodes/${code}`), userId);
  await set(ref(db, `users/${userId}/guardianCode`), code);
  return code;
}

export async function rtdbGetUserCode(userId: string): Promise<string | null> {
  const snap = await get(ref(db, `users/${userId}/guardianCode`));
  return snap.exists() ? (snap.val() as string) : null;
}

export async function rtdbLinkGuardianToUser(
  guardianId: string,
  guardianName: string,
  code: string
): Promise<{ userId: string | null; error: string | null }> {
  try {
    const codeSnap = await get(ref(db, `linkCodes/${code.toUpperCase().trim()}`));
    if (!codeSnap.exists()) return { userId: null, error: "Invalid code. Ask the user to share their code from their Guardian Code card." };
    const userId = codeSnap.val() as string;
    if (userId === guardianId) return { userId: null, error: "You cannot monitor yourself." };

    const userSnap = await get(ref(db, `users/${userId}/status`));
    const displayName = userSnap.exists() ? (userSnap.val().displayName ?? "Type Talk User") : "Type Talk User";

    await update(ref(db, `guardianLinks/${guardianId}/${userId}`), {
      displayName,
      linkedAt: Date.now(),
    });
    await update(ref(db, `userLinks/${userId}/${guardianId}`), {
      guardianName,
      linkedAt: Date.now(),
    });
    return { userId, error: null };
  } catch (e: unknown) {
    return { userId: null, error: e instanceof Error ? e.message : "Failed to link." };
  }
}

export async function rtdbUnlinkGuardian(guardianId: string, userId: string): Promise<void> {
  await remove(ref(db, `guardianLinks/${guardianId}/${userId}`));
  await remove(ref(db, `userLinks/${userId}/${guardianId}`));
}

export function rtdbSubscribeToLinkedUsers(
  guardianId: string,
  onUpdate: (users: LinkedUser[]) => void
): () => void {
  const linksRef: DatabaseReference = ref(db, `guardianLinks/${guardianId}`);
  const unsubscribers: Array<() => void> = [];
  const cache: Record<string, LinkedUser> = {};

  const emit = () => onUpdate(Object.values(cache));

  const linksHandler = onValue(linksRef, async (snap) => {
    if (!snap.exists()) { onUpdate([]); return; }
    const links = snap.val() as Record<string, { displayName: string }>;

    unsubscribers.slice(1).forEach((u) => u());
    unsubscribers.splice(1);

    for (const userId of Object.keys(links)) {
      cache[userId] = {
        uid: userId,
        displayName: links[userId]?.displayName ?? "User",
        online: false,
        lastActive: 0,
      };

      const statusRef: DatabaseReference = ref(db, `users/${userId}/status`);
      const sh = onValue(statusRef, (s) => {
        const d = s.val() ?? {};
        cache[userId] = { ...cache[userId], online: !!d.online, lastActive: d.lastActive ?? 0, displayName: d.displayName ?? cache[userId].displayName };
        emit();
      });
      unsubscribers.push(() => off(statusRef, "value", sh));

      const phraseRef: DatabaseReference = ref(db, `users/${userId}/phrases`);
      const ph = onValue(phraseRef, (s) => {
        if (!s.exists()) return;
        const val = s.val() as Record<string, { text: string; timestamp: number }>;
        const entries = Object.values(val).sort((a, b) => b.timestamp - a.timestamp);
        if (entries.length > 0) {
          cache[userId] = { ...cache[userId], lastPhrase: entries[0].text, lastPhraseTime: entries[0].timestamp };
          emit();
        }
      });
      unsubscribers.push(() => off(phraseRef, "value", ph));

      const emergRef: DatabaseReference = ref(db, `users/${userId}/emergency`);
      const eh = onValue(emergRef, (s) => {
        cache[userId] = { ...cache[userId], emergency: s.exists() && s.val()?.active ? { ...s.val(), userId } : null };
        emit();
      });
      unsubscribers.push(() => off(emergRef, "value", eh));

      const codeRef: DatabaseReference = ref(db, `users/${userId}/guardianCode`);
      const ch = onValue(codeRef, (s) => {
        if (s.exists()) cache[userId] = { ...cache[userId], guardianCode: s.val() as string };
        emit();
      });
      unsubscribers.push(() => off(codeRef, "value", ch));
    }
    emit();
  });
  unsubscribers.push(() => off(linksRef, "value", linksHandler));

  return () => unsubscribers.forEach((u) => u());
}

export async function rtdbTriggerEmergency(
  userId: string,
  message: string,
  lat?: number | null,
  lng?: number | null
): Promise<void> {
  await set(ref(db, `users/${userId}/emergency`), {
    active: true,
    timestamp: Date.now(),
    message,
    lat: lat ?? null,
    lng: lng ?? null,
  });
}

export async function rtdbResolveEmergency(userId: string): Promise<void> {
  await set(ref(db, `users/${userId}/emergency`), { active: false, timestamp: Date.now(), message: "" });
}

export async function rtdbGuardianRespond(userId: string, guardianId: string, guardianName: string): Promise<void> {
  const resp = { guardianId, guardianName, respondedAt: Date.now() };
  await push(ref(db, `users/${userId}/emergencyResponders`), resp);
}

export function rtdbSubscribeToMyEmergency(
  userId: string,
  onUpdate: (ev: EmergencyEvent | null) => void
): () => void {
  const emergRef: DatabaseReference = ref(db, `users/${userId}/emergency`);
  const handler = onValue(emergRef, (snap) => {
    if (!snap.exists() || !snap.val()?.active) { onUpdate(null); return; }
    onUpdate({ ...snap.val() as EmergencyEvent, userId });
  });
  return () => off(emergRef, "value", handler);
}
