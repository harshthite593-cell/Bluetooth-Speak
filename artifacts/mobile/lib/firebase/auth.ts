import {
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  ConfirmationResult,
  User,
  getAuth,
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

let pendingConfirmation: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

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

export async function firebaseGoogleSignIn(): Promise<{ user: User | null; error: string | null }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    const cred = await signInWithPopup(firebaseAuth, provider);
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    return { user: null, error: firebaseErrorMessage(e) };
  }
}

export async function firebaseSendOTP(
  phoneNumber: string,
  containerId: string
): Promise<{ error: string | null }> {
  try {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
      size: "invisible",
      callback: () => {},
    });
    pendingConfirmation = await signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier);
    return { error: null };
  } catch (e: unknown) {
    if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; }
    return { error: firebaseErrorMessage(e) };
  }
}

export async function firebaseConfirmOTP(
  code: string
): Promise<{ user: User | null; error: string | null }> {
  if (!pendingConfirmation) {
    return { user: null, error: "No pending verification. Please request a code first." };
  }
  try {
    const cred = await pendingConfirmation.confirm(code);
    pendingConfirmation = null;
    if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; }
    return { user: cred.user, error: null };
  } catch (e: unknown) {
    return { user: null, error: firebaseErrorMessage(e) };
  }
}

export function firebaseCancelOTP() {
  pendingConfirmation = null;
  if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; }
}

export async function firebaseLogout(): Promise<void> {
  await signOut(firebaseAuth);
}

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}

export function firebaseErrorMessage(e: unknown): string {
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
      case "auth/invalid-phone-number": return "Invalid phone number. Use international format (+1234567890).";
      case "auth/missing-phone-number": return "Please enter your phone number.";
      case "auth/quota-exceeded": return "SMS quota exceeded. Try again later.";
      case "auth/invalid-verification-code": return "Invalid code. Please check and try again.";
      case "auth/code-expired": return "Code expired. Please request a new one.";
      case "auth/popup-closed-by-user": return "Sign-in popup was closed.";
      case "auth/popup-blocked": return "Popup blocked. Please allow popups for this site.";
      case "auth/cancelled-popup-request": return "";
      default: return "Authentication failed. Please try again.";
    }
  }
  return "Authentication failed. Please try again.";
}
