import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const staticConfig = {
  authDomain: "solenterprises-58215.firebaseapp.com",
  projectId: "solenterprises-58215",
  storageBucket: "solenterprises-58215.firebasestorage.app",
  messagingSenderId: "287667620838",
  appId: "1:287667620838:web:dd53eaf1712cb0175e2427",
  measurementId: "G-JLW0GMK1CJ"
};

async function loadFirebaseConfig() {
  if (typeof window !== "undefined") {
    const existing = window.SOLE_FIREBASE_CONFIG;
    if (existing && existing.apiKey) return existing;
  }

  let apiKey = typeof window !== "undefined" ? window.FIREBASE_API_KEY : undefined;
  if (!apiKey) {
    const res = await fetch("/.netlify/functions/firebase-config", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Firebase config fetch failed: ${res.status}`);
    }
    const data = await res.json();
    apiKey = data && data.apiKey;
  }

  if (!apiKey) {
    throw new Error("Missing FIREBASE_API_KEY");
  }

  const config = Object.assign({ apiKey }, staticConfig);
  if (typeof window !== "undefined") {
    window.SOLE_FIREBASE_CONFIG = config;
    window.FIREBASE_API_KEY = apiKey;
  }
  return config;
}

const firebaseConfig = await loadFirebaseConfig();

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
