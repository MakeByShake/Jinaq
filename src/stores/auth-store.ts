'use client';

import { create } from 'zustand';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile as updateAuthProfile, deleteUser as deleteAuthUser,
} from 'firebase/auth';
import { deleteDoc, deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { AppUser, Locale } from '@/lib/types';

type AuthResult = { success: true } | { success: false, error: AuthErrorKey };

/** Translation keys in the `auth` namespace. */
export type AuthErrorKey =
  | 'errInvalid' | 'errExists' | 'errWeak' | 'errEmail' | 'errBlocked' | 'errTooMany' | 'errPopup'
  | 'errGoogleDisabled' | 'errRecentLogin' | 'errGeneric';

function mapError(err: unknown): AuthErrorKey {
  const code = (err as { code?: string })?.code ?? '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(code)) return 'errInvalid';
  if (code.includes('email-already-in-use')) return 'errExists';
  if (code.includes('weak-password')) return 'errWeak';
  if (code.includes('invalid-email')) return 'errEmail';
  if (code.includes('too-many-requests')) return 'errTooMany';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'errPopup';
  if (code.includes('operation-not-allowed')) return 'errGoogleDisabled';
  if (code.includes('requires-recent-login')) return 'errRecentLogin';
  return 'errGeneric';
}

export function newProfile(id: string, name: string, email: string, locale: Locale): AppUser {
  return {
    id, name: name || email.split('@')[0], email, role: 'user', currency: 'KZT', locale,
    createdAt: new Date().toISOString(), onboarded: false,
  };
}

interface AuthStore {
  currentUser: AppUser | null;
  isLoading: boolean;
  setCurrentUser: (user: AppUser | null) => void;
  setIsLoading: (v: boolean) => void;

  login: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: (locale: Locale) => Promise<AuthResult>;
  register: (name: string, email: string, password: string, locale: Locale) => Promise<AuthResult>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updateProfile: (updates: Partial<AppUser>) => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  currentUser: null,
  isLoading: true,

  setCurrentUser: (user) => set({ currentUser: user, isLoading: false }),
  setIsLoading: (v) => set({ isLoading: v }),

  login: async (email, password) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (snap.exists() && (snap.data() as AppUser).blocked) {
        await signOut(auth);
        return { success: false, error: 'errBlocked' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: mapError(err) };
    }
  },

  loginWithGoogle: async (locale) => {
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const userRef = doc(db, 'users', cred.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const profile = newProfile(cred.user.uid, cred.user.displayName ?? '', cred.user.email ?? '', locale);
        await setDoc(userRef, profile);
      } else if ((snap.data() as AppUser).blocked) {
        await signOut(auth);
        return { success: false, error: 'errBlocked' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: mapError(err) };
    }
  },

  register: async (name, email, password, locale) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateAuthProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      const profile = newProfile(cred.user.uid, name.trim(), email.trim(), locale);
      await setDoc(doc(db, 'users', cred.user.uid), profile);
      set({ currentUser: profile });
      return { success: true };
    } catch (err) {
      return { success: false, error: mapError(err) };
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ currentUser: null });
  },

  sendPasswordReset: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err) {
      return { success: false, error: mapError(err) };
    }
  },

  updateProfile: async (updates) => {
    const user = get().currentUser;
    if (!user) return;
    const fsUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) fsUpdates[k] = v === undefined ? deleteField() : v;
    // Role and blocked flags are admin-only (enforced by security rules too).
    delete fsUpdates.role;
    delete fsUpdates.blocked;
    set({ currentUser: { ...user, ...updates, role: user.role } });
    await updateDoc(doc(db, 'users', user.id), fsUpdates);
  },

  deleteAccount: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return { success: false, error: 'errGeneric' };
    try {
      const { wipeUserData } = await import('@/lib/actions');
      await wipeUserData();
      await deleteDoc(doc(db, 'users', fbUser.uid));
      await deleteAuthUser(fbUser);
      set({ currentUser: null });
      return { success: true };
    } catch (err) {
      return { success: false, error: mapError(err) };
    }
  },
}));
