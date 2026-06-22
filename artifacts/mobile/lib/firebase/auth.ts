import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
} from "firebase/auth";
import { firebaseApp } from "./config";

export const firebaseAuth = getAuth(firebaseApp);

export async function firebaseRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    await updateProfile(cred.user, { displayName: name });
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    return { user: null, error: firebaseErrorMessage(e) };
  }
}

export async function firebaseLogin(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  try {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    return { user: null, error: firebaseErrorMessage(e) };
  }
}

export async function firebaseLogout(): Promise<void> {
  await signOut(firebaseAuth);
}

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}

function firebaseErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code: string }).code;
    switch (code) {
      case "auth/email-already-in-use": return "Email is already registered.";
      case "auth/invalid-email": return "Invalid email address.";
      case "auth/weak-password": return "Password must be at least 6 characters.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential": return "Invalid email or password.";
      case "auth/too-many-requests": return "Too many attempts. Try again later.";
      case "auth/network-request-failed": return "Network error. Check your connection.";
      default: return "Authentication failed. Please try again.";
    }
  }
  return "Authentication failed. Please try again.";
}
