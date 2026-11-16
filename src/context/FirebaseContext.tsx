import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, setCachedGmailAccessToken } from '../lib/firebase';
import {
  checkIsAdminUser,
  subscribeAssessments,
  subscribeStaffProfile,
} from '../services/firestoreService';
import { isDesignatedAdminEmail } from '../data/competencyForms';
import { CompetencyAssessment, StaffProfile } from '../types/competency';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  staffProfile: StaffProfile | null;
  assessments: CompetencyAssessment[];
  dataLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBootstrappedAdmin, setIsBootstrappedAdmin] = useState(false);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [assessments, setAssessments] = useState<CompetencyAssessment[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setCachedGmailAccessToken(null);
        setIsAdmin(false);
        setIsBootstrappedAdmin(false);
        setStaffProfile(null);
        setAssessments([]);
        setDataLoading(false);
        setAuthReady(true);
        return;
      }

      const bootstrapped =
        isDesignatedAdminEmail(nextUser.email) && nextUser.emailVerified === true;
      setIsBootstrappedAdmin(bootstrapped);

      try {
        const adminFlag = await checkIsAdminUser(
          nextUser.uid,
          nextUser.email,
          nextUser.emailVerified
        );
        setIsAdmin(adminFlag);
      } catch {
        setIsAdmin(bootstrapped);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    setDataLoading(true);
    const unsubProfile = subscribeStaffProfile(
      user.uid,
      (profile) => {
        setStaffProfile(profile);
      },
      (err) => {
        console.error(err);
      }
    );

    const unsubAssessments = subscribeAssessments(
      user.uid,
      isBootstrappedAdmin,
      (items) => {
        setAssessments(items);
        setDataLoading(false);
      },
      (err) => {
        console.error(err);
        setDataLoading(false);
      }
    );

    return () => {
      unsubProfile();
      unsubAssessments();
    };
  }, [authReady, user, isBootstrappedAdmin]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedGmailAccessToken(credential.accessToken);
      }
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (code === 'auth/unauthorized-domain') {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `โดเมน ${hostname || 'นี้'} ยังไม่ได้รับอนุญาตใน Firebase Authentication กรุณาเพิ่มโดเมนนี้ใน Authorized domains ของโปรเจกต์ Firebase`
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'เบราว์เซอร์บล็อกหน้าต่างเข้าสู่ระบบ (Popup) กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง'
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('คุณได้ปิดหน้าต่างเข้าสู่ระบบก่อนดำเนินการเสร็จสิ้น');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('การเชื่อมต่อเครือข่ายขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      } else {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบได้';
        setAuthError(msg);
      }
    }
  };

  const signOut = async () => {
    setAuthError(null);
    setCachedGmailAccessToken(null);
    await firebaseSignOut(auth);
  };

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        isBootstrappedAdmin,
        staffProfile,
        assessments,
        dataLoading,
        authError,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
