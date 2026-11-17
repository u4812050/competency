import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AssessmentStatus,
  CompetencyAssessment,
  FeedbackOptionKey,
  FormId,
  PositionType,
  StaffProfile,
} from '../types/competency';
import {
  calculateAssessmentScores,
  getApplicableSections,
  getFormById,
  isDesignatedAdminEmail,
} from '../data/competencyForms';

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const ALLOWED_FEEDBACK: FeedbackOptionKey[] = [
  'training',
  'supervision',
  'policy_review',
  'support',
  'other',
];

function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function clampString(val: string, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function sanitizeScoreMap(
  input: Record<string, number>,
  allowedItemIds?: Set<string>
): Record<string, number> {
  const clean: Record<string, number> = {};
  const entries = Object.entries(input || {}).slice(0, 60);
  for (const [k, v] of entries) {
    if (
      VALID_ID_REGEX.test(k) &&
      (!allowedItemIds || allowedItemIds.has(k)) &&
      (v === 1 || v === 2 || v === 3)
    ) {
      clean[k] = v;
    }
  }
  return clean;
}

function sanitizeMethodMap(
  input: Record<string, string>,
  allowedItemIds?: Set<string>
): Record<string, string> {
  const clean: Record<string, string> = {};
  const entries = Object.entries(input || {}).slice(0, 60);
  for (const [k, v] of entries) {
    if (
      VALID_ID_REGEX.test(k) &&
      (!allowedItemIds || allowedItemIds.has(k)) &&
      typeof v === 'string' &&
      v.trim().length > 0
    ) {
      clean[k] = v.trim().slice(0, 30);
    }
  }
  return clean;
}

function sanitizeFeedbackList(list: FeedbackOptionKey[]): FeedbackOptionKey[] {
  const seen = new Set<FeedbackOptionKey>();
  for (const item of list || []) {
    if (ALLOWED_FEEDBACK.includes(item)) {
      seen.add(item);
    }
    if (seen.size >= 5) break;
  }
  return Array.from(seen);
}

export async function checkIsAdminUser(uid: string, email?: string | null, emailVerified?: boolean): Promise<boolean> {
  if (isDesignatedAdminEmail(email) && emailVerified === true) {
    return true;
  }
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (error) {
    // Non-admins querying their own admin doc is allowed by rules; if permission denied, fallback false
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return false;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeStaffProfile(
  uid: string,
  onData: (profile: StaffProfile | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `staffProfiles/${uid}`;
  return onSnapshot(
    doc(db, 'staffProfiles', uid),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(snap.data() as StaffProfile);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function saveStaffProfile(
  uid: string,
  input: {
    fullName: string;
    age: number;
    ward: string;
    positionType: PositionType;
    totalYears: number;
    wardYears: number;
  },
  isNew: boolean
): Promise<void> {
  const path = `staffProfiles/${uid}`;
  const docRef = doc(db, 'staffProfiles', uid);
  const sanitized = {
    fullName: clampString(input.fullName, 120) || 'ไม่ระบุชื่อ',
    age: clampNumber(Math.round(input.age), 18, 85),
    ward: clampString(input.ward, 100) || 'หอผู้ป่วยพิเศษบุญสม 7',
    positionType: input.positionType,
    totalYears: clampNumber(Number(input.totalYears), 0, 65),
    wardYears: clampNumber(Number(input.wardYears), 0, 65),
  };

  try {
    if (isNew) {
      await setDoc(docRef, {
        uid,
        ...sanitized,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export function subscribeAssessments(
  uid: string,
  isBootstrappedOrAdmin: boolean,
  onData: (items: CompetencyAssessment[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'assessments';
  const colRef = collection(db, 'assessments');
  const q = isBootstrappedOrAdmin
    ? query(colRef)
    : query(colRef, where('ownerUid', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const records: CompetencyAssessment[] = snapshot.docs.map((d) => ({
        ...(d.data() as Omit<CompetencyAssessment, 'id'>),
        id: d.id,
      }));
      records.sort((a, b) => {
        const aSec = (a.updatedAt as { seconds?: number } | null)?.seconds ?? 0;
        const bSec = (b.updatedAt as { seconds?: number } | null)?.seconds ?? 0;
        return bSec - aSec;
      });
      onData(records);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export interface SaveAssessmentInput {
  id?: string;
  ownerUid: string;
  ownerEmail?: string;
  staffUid: string;
  staffName: string;
  staffAge: number;
  ward: string;
  positionType: PositionType;
  totalYears: number;
  wardYears: number;
  formId: FormId;
  assessmentPeriod: string;
  status: AssessmentStatus;
  selfScores: Record<string, number>;
  supervisorScores: Record<string, number>;
  itemMethods: Record<string, string>;
  supervisorFeedback: FeedbackOptionKey[];
  supervisorOtherNote: string;
  selfFeedback: FeedbackOptionKey[];
  selfOtherNote: string;
  evaluatorName: string;
  evaluatorUid: string;
}

export async function saveAssessment(
  input: SaveAssessmentInput,
  isAdmin: boolean
): Promise<string> {
  const form = getFormById(input.formId);
  const cleanWardYears = clampNumber(Number(input.wardYears), 0, 65);
  const applicableSections = getApplicableSections(form, cleanWardYears);
  const allowedItemIds = new Set(
    applicableSections.flatMap((sec) => sec.items.map((item) => item.id))
  );

  const cleanSelfScores = sanitizeScoreMap(input.selfScores, allowedItemIds);
  const cleanSupScores = isAdmin ? sanitizeScoreMap(input.supervisorScores, allowedItemIds) : {};
  const cleanMethods = isAdmin ? sanitizeMethodMap(input.itemMethods, allowedItemIds) : {};

  const calc = calculateAssessmentScores(form, cleanSelfScores, cleanSupScores, cleanWardYears);

  const assessmentId =
    input.id && VALID_ID_REGEX.test(input.id)
      ? input.id
      : `asm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const path = `assessments/${assessmentId}`;
  const docRef = doc(db, 'assessments', assessmentId);

  const basePayload = {
    ...(input.ownerEmail !== undefined
      ? { ownerEmail: clampString(input.ownerEmail, 254) }
      : {}),
    staffName: clampString(input.staffName, 120) || 'ไม่ระบุชื่อบุคลากร',
    staffAge: clampNumber(Math.round(input.staffAge), 18, 85),
    ward: clampString(input.ward, 100) || 'หอผู้ป่วยพิเศษบุญสม 7',
    positionType: input.positionType,
    totalYears: clampNumber(Number(input.totalYears), 0, 65),
    wardYears: clampNumber(Number(input.wardYears), 0, 65),
    assessmentPeriod: clampString(input.assessmentPeriod, 50) || 'ประจำปี 2569',
    status: input.status,
    selfScores: cleanSelfScores,
    selfTotalScore: calc.selfTotalScore,
    selfMaxScore: calc.selfMaxScore,
    selfPercentage: calc.selfPercentage,
    selfFeedback: sanitizeFeedbackList(input.selfFeedback),
    selfOtherNote: clampString(input.selfOtherNote, 500),
  };

  try {
    if (!input.id) {
      await setDoc(docRef, {
        ownerUid: input.ownerUid,
        staffUid: VALID_ID_REGEX.test(input.staffUid) ? input.staffUid : input.ownerUid,
        formId: input.formId,
        ...basePayload,
        supervisorScores: cleanSupScores,
        itemMethods: cleanMethods,
        supervisorTotalScore: isAdmin ? calc.supervisorTotalScore : 0,
        supervisorMaxScore: calc.supervisorMaxScore,
        supervisorPercentage: isAdmin ? calc.supervisorPercentage : 0,
        supervisorTier: isAdmin ? calc.supervisorTier : 'pending',
        supervisorFeedback: isAdmin ? sanitizeFeedbackList(input.supervisorFeedback) : [],
        supervisorOtherNote: isAdmin ? clampString(input.supervisorOtherNote, 500) : '',
        evaluatorName: isAdmin ? clampString(input.evaluatorName, 120) : '',
        evaluatorUid: isAdmin ? clampString(input.evaluatorUid, 128) : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (isAdmin) {
      await updateDoc(docRef, {
        ...basePayload,
        supervisorScores: cleanSupScores,
        itemMethods: cleanMethods,
        supervisorTotalScore: calc.supervisorTotalScore,
        supervisorMaxScore: calc.supervisorMaxScore,
        supervisorPercentage: calc.supervisorPercentage,
        supervisorTier: calc.supervisorTier,
        supervisorFeedback: sanitizeFeedbackList(input.supervisorFeedback),
        supervisorOtherNote: clampString(input.supervisorOtherNote, 500),
        evaluatorName: clampString(input.evaluatorName, 120),
        evaluatorUid: clampString(input.evaluatorUid, 128),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        ...basePayload,
        updatedAt: serverTimestamp(),
      });
    }
    return assessmentId;
  } catch (error) {
    handleFirestoreError(error, input.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  const path = `assessments/${assessmentId}`;
  try {
    await deleteDoc(doc(db, 'assessments', assessmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function grantAdminRole(targetUid: string, grantedByUid: string): Promise<void> {
  if (!VALID_ID_REGEX.test(targetUid)) {
    throw new Error('UID ไม่ถูกต้อง');
  }
  const path = `admins/${targetUid}`;
  try {
    await setDoc(doc(db, 'admins', targetUid), {
      uid: targetUid,
      grantedBy: grantedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeAdminRole(targetUid: string): Promise<void> {
  const path = `admins/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'admins', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAdminsList(
  onData: (admins: { uid: string; grantedBy: string; createdAt?: unknown }[]) => void
): Unsubscribe {
  const path = 'admins';
  return onSnapshot(
    collection(db, 'admins'),
    (snap) => {
      onData(
        snap.docs.map((d) => ({
          uid: d.id,
          grantedBy: String(d.data().grantedBy ?? ''),
          createdAt: d.data().createdAt,
        }))
      );
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
