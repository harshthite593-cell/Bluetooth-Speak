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
  firebaseSignInAnonymously,
  onFirebaseAuthStateChanged,
  firebaseErrorMessage,
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
export {
  rtdbSetRole,
  rtdbGetRole,
  rtdbRegisterUserCode,
  rtdbGetUserCode,
  rtdbLinkGuardianToUser,
  rtdbUnlinkGuardian,
  rtdbSubscribeToLinkedUsers,
  rtdbTriggerEmergency,
  rtdbResolveEmergency,
  rtdbGuardianRespond,
  rtdbSubscribeToMyEmergency,
} from "./guardian";
export type { EmergencyEvent, LinkedUser } from "./guardian";
