export { firebaseApp } from "./config";
export {
  firebaseAuth,
  firebaseRegister,
  firebaseLogin,
  firebaseLogout,
  firebaseGoogleSignIn,
  firebaseSendOTP,
  firebaseConfirmOTP,
  firebaseCancelOTP,
  onFirebaseAuthStateChanged,
} from "./auth";
export {
  db,
  savePhraseToCloud,
  savePhrasesToCloud,
  getPhrasesFromCloud,
  deletePhraseFromCloud,
  subscribeToUserPhrases,
} from "./phrases";
export { saveUserProfileToCloud, getUserProfileFromCloud } from "./userProfile";
export type { CloudPhrase } from "./phrases";
export {
  rtdb,
  rtdbSavePhrase,
  rtdbSetUserPresence,
  rtdbUpdateLastSeen,
  rtdbSubscribeToUserPhrases,
  rtdbSubscribeToUserStatus,
  rtdbSaveUserProfile,
} from "./realtimeDb";
export type { RtdbPhrase, UserPresence } from "./realtimeDb";
