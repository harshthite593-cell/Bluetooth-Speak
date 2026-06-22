export { firebaseApp } from "./config";
export { firebaseAuth, firebaseRegister, firebaseLogin, firebaseLogout, onFirebaseAuthStateChanged } from "./auth";
export { db, savePhraseToCloud, savePhrasesToCloud, getPhrasesFromCloud, deletePhraseFromCloud, subscribeToUserPhrases } from "./phrases";
export { saveUserProfileToCloud, getUserProfileFromCloud } from "./userProfile";
export type { CloudPhrase } from "./phrases";
