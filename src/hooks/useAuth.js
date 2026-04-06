import { useState, useEffect } from 'react';
import { auth } from '../firebase-config';
import {
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import { initialAuthToken } from '../config';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialAuthToken) {
      signInWithCustomToken(auth, initialAuthToken).catch(() => {});
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch {
          // ignore
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
