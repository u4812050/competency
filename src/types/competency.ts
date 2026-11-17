export type FormId =
  | 'PN'
  | 'HP'
  | 'STN_Colorectal'
  | 'STN_CA_Breast'
  | 'STN_AVF'
  | 'STN_LT'
  | 'STN_KT';

export type CompetencyGroup = 'STN' | 'PN' | 'HP';

export type PositionType = 'RN' | 'PN' | 'HP';

export type AssessmentStatus = 'draft' | 'self_submitted' | 'evaluated' | 'archived';

export type CompetencyTier = 'pending' | 'exceed' | 'meet' | 'need_improvement';

export type EvaluationMethodCode = 'O' | 'D' | 'W' | 'V' | 'R' | 'WS';

export type FeedbackOptionKey = 'training' | 'supervision' | 'policy_review' | 'support' | 'other';

export interface CompetencyItem {
  id: string;
  numberLabel: string;
  text: string;
  subGroup?: string;
}

export interface CompetencySection {
  id: string;
  title: string;
  shortTitle: string;
  definition?: string;
  experienceRange?: string;
  items: CompetencyItem[];
}

export interface CompetencyFormTemplate {
  id: FormId;
  group: CompetencyGroup;
  code: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  targetRole: PositionType;
  targetRoleLabel: string;
  revisionDate: string;
  sections: CompetencySection[];
}

export interface StaffProfile {
  uid: string;
  fullName: string;
  age: number;
  ward: string;
  positionType: PositionType;
  totalYears: number;
  wardYears: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompetencyAssessment {
  id: string;
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
  selfTotalScore: number;
  selfMaxScore: number;
  selfPercentage: number;
  supervisorTotalScore: number;
  supervisorMaxScore: number;
  supervisorPercentage: number;
  supervisorTier: CompetencyTier;
  supervisorFeedback: FeedbackOptionKey[];
  supervisorOtherNote: string;
  selfFeedback: FeedbackOptionKey[];
  selfOtherNote: string;
  evaluatorName: string;
  evaluatorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SectionScoreBreakdown {
  sectionId: string;
  shortTitle: string;
  title: string;
  itemCount: number;
  maxScore: number;
  selfScore: number;
  selfAnsweredCount: number;
  selfPercentage: number;
  supervisorScore: number;
  supervisorAnsweredCount: number;
  supervisorPercentage: number;
}
