// ─────────────────────────────────────────────
// CONFIGURATION FIREBASE
// Remplace les valeurs ci-dessous par celles
// de TON projet Firebase (voir guide d'installation)
// ─────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey:            "AIzaSyBTKCzwqVbwVU9qCJMd3S3NuopInaWzgko",
  authDomain:        "inventaire-famille.firebaseapp.com",
  projectId:         "inventaire-famille",
  storageBucket:     "inventaire-famille.firebasestorage.app",
  messagingSenderId: "662794095536",
  appId:             "1:662794095536:web:147c4a83d6318bca242475",
};

const app       = initializeApp(firebaseConfig);
export const db       = getFirestore(app);
export const storage  = getStorage(app);
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();
