---
name: No-auth architecture
description: Auth was removed; app auto-signs in via Firebase Anonymous Auth; user progress stored in PostgreSQL; guardian still uses Firebase RTDB.
---

## Rule
There is no login screen. Users are identified by their Firebase Anonymous Auth UID, which persists across sessions without any user interaction.

**Why:** User explicitly removed all email/password/Google/Phone auth to make the app "normal" — open straight to the TTS screen.

## How to apply
- `FirebaseProvider` calls `firebaseSignInAnonymously()` automatically when no session exists.
- `AuthContext` now only stores a local profile (name, age, gender, birthDate, bio) in AsyncStorage — no token, no email, no JWT.
- Phrases are stored in PostgreSQL (`phrases` table, `user_id` = Firebase anonymous uid) via `/api/phrases` GET/POST/DELETE.
- Firebase RTDB is still used for: guardian real-time phrase streaming, presence, emergency alerts, role storage, 6-char linking codes.
- Firebase Firestore (`phrases` collection) is still wired up but PostgreSQL is the primary store going forward.
- `login.tsx` is still on disk but is never navigated to — the Stack.Screen for it was removed from `_layout.tsx`.

## First-launch flow
1. Firebase anonymous sign-in fires automatically.
2. `_layout.tsx` checks for role (stored in AsyncStorage + RTDB). If none → `/role-select`.
3. After role set to "user" → `/profile-setup` (name required for all users now).
4. After profile saved → `/` (main TTS screen).
5. Guardian role → `/guardian`.
