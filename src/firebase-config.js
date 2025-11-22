import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: window.env?.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: window.env?.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: window.env?.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: window.env?.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: window.env?.VITE_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: window.env?.VITE_FIREBASE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const GEMINI_API_KEY = window.env?.VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
