---
name: Auth architecture
description: Type Talk uses dual auth — email/password (custom JWT via API) + Firebase (RTDB, Firestore, real-time). Login screen is the entry point.
---

## Rule
Auth is restored. The login screen is the entry point when no session exists. There are two auth layers working together:

1. **API auth** (`/api/auth/register`, `/api/auth/login`) — email/password → JWT token stored in AsyncStorage. Used for friends, profile PATCH, etc.
2. **Firebase auth** — Email/password, Google (web only), Phone OTP (web only), and continues as guest (local only). Firebase UID is used for real-time features.

**Why:** App needs both a JWT for the REST API (PostgreSQL features) and Firebase for real-time (guardian screen, phrase streaming, presence).

## Flow

- `FirebaseProvider` listens to `onAuthStateChanged`. If no Firebase user, redirect to `/login`.
- `AuthContext` reads JWT from AsyncStorage. Login/register hit the API server (`/api/auth/*`) and return a token.
- `continueAsGuest` — sets `typetalk_is_guest=true` in AsyncStorage, bypasses Firebase auth.
- First-time users: `/login` → (pick role at `/role-select`) → `/profile-setup` → `/`.
- Guardian role → redirected to `/guardian` from `_layout.tsx`.

## Identity layers
- `useAuth()` → JWT user (id, name, email), token, isGuest, profile, profileSeen.
- `useFirebase()` → Firebase user (uid), role, guardianCode, cloudPhrases.

## What NOT to confuse
- `isGuest` comes from `useAuth()`, not `useFirebase()`.
- `token` for API calls comes from `useAuth()`, NOT Firebase.
- `firebaseUser.uid` is used as the key for RTDB/Firestore, NOT the API user.id.
- Friends page shows a guest wall if `isGuest` — API calls need the JWT token.

## Files
- `contexts/AuthContext.tsx` — JWT auth, profile, isGuest.
- `contexts/FirebaseContext.tsx` — Firebase auth + RTDB + Firestore.
- `app/login.tsx` — Login/register screen with email/password, Google, Phone, Guest.
- `app/_layout.tsx` — Redirect logic: no Firebase user → `/login`, no role → `/role-select`, guardian → `/guardian`, no profile → `/profile-setup`.
- `app/guardian.tsx` — Guardian uses `fbLogout()` and redirects to `/login` on sign out.

## Phrases storage
- PostgreSQL `phrases` table (via `/api/phrases`) is the primary store going forward.
- Firebase Firestore `phrases` collection also exists but is secondary.
- Phrase user_id = Firebase anonymous uid OR Firebase email-auth uid.

## Metro proxy
`metro.config.js` forwards `/api/*` → `localhost:5000` so relative API calls work in web Expo dev.
For native, `API_BASE` uses `EXPO_PUBLIC_DOMAIN` env var or `EXPO_PUBLIC_API_BASE_URL`.
