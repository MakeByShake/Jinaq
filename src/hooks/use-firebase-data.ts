'use client';

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { useAuthStore, newProfile } from '@/stores/auth-store';
import { COLLECTIONS, useData } from '@/stores/data-store';
import { useLocaleStore } from '@/i18n';
import { normalizeCurrency } from '@/lib/defaults';
import type { AppUser, Plan } from '@/lib/types';

/** Subscribes to the signed-in user's profile and data. Mounted once in Providers. */
export function useFirebaseData() {
  useEffect(() => {
    if (!isFirebaseConfigured) {
      useAuthStore.getState().setCurrentUser(null);
      return;
    }
    let unsubs: Array<() => void> = [];
    const stop = () => {
      unsubs.forEach((u) => u());
      unsubs = [];
    };

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      stop();
      if (!fbUser) {
        useData.getState().reset();
        useAuthStore.getState().setCurrentUser(null);
        return;
      }

      const uid = fbUser.uid;
      const userRef = doc(db, 'users', uid);

      // Make sure a profile exists (e.g. accounts created before profiles were required).
      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, newProfile(uid, fbUser.displayName ?? '', fbUser.email ?? '', useLocaleStore.getState().locale));
        }
      } catch (e) {
        console.error('[profile]', e);
      }

      unsubs.push(
        onSnapshot(userRef, (snap) => {
          if (!snap.exists()) return;
          const raw = snap.data() as AppUser & { deleted?: boolean };
          if (raw.blocked || raw.deleted) {
            signOut(auth);
            return;
          }
          const user: AppUser = { ...raw, id: uid, currency: normalizeCurrency(raw.currency), locale: raw.locale ?? 'ru' };
          // Older profiles stored the currency symbol; migrate silently.
          if (raw.currency !== user.currency) updateDoc(userRef, { currency: user.currency }).catch(() => {});
          useAuthStore.getState().setCurrentUser(user);
        }),
      );

      // Remember when the user was last active (used by the admin panel).
      updateDoc(userRef, { lastSeenAt: new Date().toISOString() }).catch(() => {});

      for (const name of COLLECTIONS) {
        unsubs.push(
          onSnapshot(
            collection(db, 'users', uid, name),
            (snap) => {
              const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
              useData.getState().setCollection(name, items as never);
            },
            (err) => {
              console.error(`[snapshot ${name}]`, err);
              useData.getState().setCollection(name, [] as never);
            },
          ),
        );
      }

      unsubs.push(
        onSnapshot(doc(db, 'users', uid, 'meta', 'plan'), (snap) => {
          useData.getState().setPlan(snap.exists() ? (snap.data() as Plan) : null);
        }, () => {}),
      );
    });

    return () => {
      unsubAuth();
      stop();
    };
  }, []);
}
