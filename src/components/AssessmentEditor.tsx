import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Eye, Lock, Mail, Save, Send, X } from 'lucide-react';
import {
  calculateAssessmentScores,
  COMPETENCY_GROUPS,
  DEFAULT_WARD,
  EVALUATION_METHODS,
  FEEDBACK_OPTIONS,
  getApplicableSections,
  getFormById,
  getFormsByGroup,
  getFormTotalItems,
  getGroupColorMeta,
  getGroupMeta,
  getTierMeta,
  SELF_FEEDBACK_OPTIONS,
  SELF_SCORE_SCALE,
  SUPERVISOR_SCORE_SCALE,
} from '../data/competencyForms';
import { WARD_STAFF_ROSTER } from '../data/staffRoster';
import { saveAssessment } from '../services/firestoreService';
import {
  buildSelfAssessmentEmailSubject,
  HEAD_NURSE_NOTIFICATION_EMAIL,
  sendSelfAssessmentEmailNotification,
} from '../services/gmailService';
import {
  AssessmentStatus,
  CompetencyAssessment,
  CompetencyGroup,
  FeedbackOptionKey,
  FormId,
  PositionType,
  StaffProfile,
} from '../types/competency';

interface AssessmentEditorProps {
  userUid: string;
  userDisplayName: string;
  isAdmin: boolean;
  staffProfile: StaffProfile | null;
  initialFormId?: FormId;
  initialStaffPrefill?: { staffName: string; positionType: PositionType } | null;
  editingAssessment: CompetencyAssessment | null;
  onCancel: () => void;
  onSaved: (assessmentId: string, openReport?: boolean) => void;
}

export function AssessmentEditor({
  userUid,
  userDisplayName,
  isAdmin,
  staffProfile,
  initialFormId = 'PN',
  initialStaffPrefill = null,
  editingAssessment,
  onCancel,
  onSaved,
}: AssessmentEditorProps) {
  const [formId, setFormId] = useState<FormId>(editingAssessment?.formId ?? initialFormId);
  const [selectedGroup, setSelectedGroup] = useState<CompetencyGroup>(
    () => getFormById(editingAssessment?.formId ?? initialFormId).group
  );
  const [staffName, setStaffName] = useState(
    editingAssessment?.staffName ?? initialStaffPrefill?.staffName ?? ''
  );
  const [staffAgeInput, setStaffAgeInput] = useState<string>(
    editingAssessment?.staffAge !== undefined ? String(editingAssessment.staffAge) : ''
  );
  const staffAge = useMemo(() => {
    const parsed = Number(staffAgeInput);
    if (!Number.isFinite(parsed) || staffAgeInput.trim() === '') return 0;
    return Math.min(85, Math.max(0, parsed));
  }, [staffAgeInput]);
  const [ward, setWard] = useState(
    editingAssessment?.ward ?? staffProfile?.ward ?? DEFAULT_WARD
  );
  const [positionType, setPositionType] = useState<PositionType>(
    editingAssessment?.positionType ??
      initialStaffPrefill?.positionType ??
      staffProfile?.positionType ??
      getFormById(initialFormId).targetRole
  );
  const [totalYearsInput, setTotalYearsInput] = useState<string>(
    editingAssessment?.totalYears !== undefined ? String(editingAssessment.totalYears) : ''
  );
  const totalYears = useMemo(() => {
    const parsed = Number(totalYearsInput);
    if (!Number.isFinite(parsed) || totalYearsInput.trim() === '') return 0;
    return Math.min(65, Math.max(0, parsed));
  }, [totalYearsInput]);
  const [wardYearsInput, setWardYearsInput] = useState<string>(
    editingAssessment?.wardYears !== undefined ? String(editingAssessment.wardYears) : ''
  );
  const wardYears = useMemo(() => {
    const parsed = Number(wardYearsInput);
    if (!Number.isFinite(parsed) || wardYearsInput.trim() === '') return 0;
    return Math.min(65, Math.max(0, parsed));
  }, [wardYearsInput]);
  const [assessmentPeriod, setAssessmentPeriod] = useState(
    editingAssessment?.assessmentPeriod ?? 'ประจำปี 2569'
  );
  const [evaluatorMode, setEvaluatorMode] = useState<'self' | 'supervisor'>(() => {
    if (!isAdmin) return 'self';
    if (
      editingAssessment &&
      (editingAssessment.status === 'self_submitted' ||
        editingAssessment.status === 'evaluated' ||
        editingAssessment.ownerUid !== userUid)
    ) {
      return 'supervisor';
    }
    return 'self';
  });

  useEffect(() => {
    if (!isAdmin) {
      setEvaluatorMode('self');
      return;
    }
    if (
      editingAssessment &&
      (editingAssessment.status === 'self_submitted' ||
        editingAssessment.status === 'evaluated' ||
        editingAssessment.ownerUid !== userUid)
    ) {
      setEvaluatorMode('supervisor');
    } else {
      setEvaluatorMode('self');
    }
  }, [isAdmin, editingAssessment, userUid]);

  const canEvaluateSupervisor = isAdmin && evaluatorMode === 'supervisor';

  const [selfScores, setSelfScores] = useState<Record<string, number>>(
    editingAssessment?.selfScores ?? {}
  );
  const [supervisorScores, setSupervisorScores] = useState<Record<string, number>>(
    editingAssessment?.supervisorScores ?? {}
  );

  const [supervisorFeedback, setSupervisorFeedback] = useState<FeedbackOptionKey[]>(
    editingAssessment?.supervisorFeedback ?? []
  );
  const [supervisorOtherNote, setSupervisorOtherNote] = useState(
    editingAssessment?.supervisorOtherNote ?? ''
  );
  const [selfFeedback, setSelfFeedback] = useState<FeedbackOptionKey[]>(
    editingAssessment?.selfFeedback ?? []
  );
  const [selfOtherNote, setSelfOtherNote] = useState(
    editingAssessment?.selfOtherNote ?? ''
  );

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSelfSubmitModal, setShowSelfSubmitModal] = useState(false);
  const [submittedAssessmentId, setSubmittedAssessmentId] = useState<string | null>(null);
  const [emailSendingError, setEmailSendingError] = useState<string | null>(null);

  const form = useMemo(() => getFormById(formId), [formId]);
  const hasExperienceLevels = useMemo(
    () => form.sections.some((s) => Boolean(s.experienceRange)),
    [form]
  );
  const applicableSections = useMemo(
    () => getApplicableSections(form, wardYears),
    [form, wardYears]
  );
  const totalItems = useMemo(() => getFormTotalItems(form, wardYears), [form, wardYears]);
  const groupForms = useMemo(() => getFormsByGroup(selectedGroup), [selectedGroup]);

  useEffect(() => {
    if (!editingAssessment) {
      const targetForm = getFormById(initialFormId);
      setSelectedGroup(targetForm.group);
      setFormId(initialFormId);
      if (initialStaffPrefill) {
        setStaffName(initialStaffPrefill.staffName);
        setPositionType(initialStaffPrefill.positionType);
      } else {
        setStaffName('');
      }
      setStaffAgeInput('');
      setTotalYearsInput('');
      setWardYearsInput('');
    }
  }, [initialFormId, initialStaffPrefill, editingAssessment]);

  const handleSelectGroup = (group: CompetencyGroup) => {
    if (editingAssessment) return;
    setSelectedGroup(group);
    const meta = getGroupMeta(group);
    setFormId(meta.defaultFormId);
  };

  // Sync recommended position when switching forms on a new assessment
  useEffect(() => {
    if (!editingAssessment) {
      setPositionType(form.targetRole);
      setSelfScores({});
      setSupervisorScores({});
    }
  }, [formId, editingAssessment, form.targetRole]);

  const calc = useMemo(
    () => calculateAssessmentScores(form, selfScores, supervisorScores, wardYears),
    [form, selfScores, supervisorScores, wardYears]
  );

  const tierMeta = getTierMeta(calc.supervisorTier);

  const isSelfLockedForStaff =
    !isAdmin &&
    editingAssessment !== null &&
    (editingAssessment.status === 'evaluated' || editingAssessment.status === 'archived');

  const fillSectionScores = (
    sectionId: string,
    target: 'self' | 'supervisor',
    score: 1 | 2 | 3
  ) => {
    const sec = form.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    if (target === 'self') {
      if (isSelfLockedForStaff) return;
      setSelfScores((prev) => {
        const next = { ...prev };
        for (const item of sec.items) next[item.id] = score;
        return next;
      });
    } else {
      if (!canEvaluateSupervisor) return;
      setSupervisorScores((prev) => {
        const next = { ...prev };
        for (const item of sec.items) next[item.id] = score;
        return next;
      });
    }
  };

  const toggleFeedbackKey = (
    list: FeedbackOptionKey[],
    setter: React.Dispatch<React.SetStateAction<FeedbackOptionKey[]>>,
    key: FeedbackOptionKey
  ) => {
    setter(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const persistAssessment = async (nextStatus: AssessmentStatus, existingId?: string): Promise<string> => {
    const allowedIds = new Set(
      applicableSections.flatMap((sec) => sec.items.map((item) => item.id))
    );
    const scopedSelfScores = Object.fromEntries(
      Object.entries(selfScores).filter(([k]) => allowedIds.has(k))
    );
    const scopedSupScores = canEvaluateSupervisor
      ? Object.fromEntries(Object.entries(supervisorScores).filter(([k]) => allowedIds.has(k)))
      : {};

    return saveAssessment(
      {
        id: existingId ?? editingAssessment?.id,
        ownerUid: editingAssessment?.ownerUid ?? userUid,
        staffUid: editingAssessment?.staffUid ?? userUid,
        staffName,
        staffAge,
        ward,
        positionType,
        totalYears,
        wardYears,
        formId,
        assessmentPeriod,
        status: nextStatus,
        selfScores: scopedSelfScores,
        supervisorScores: scopedSupScores,
        itemMethods: editingAssessment?.itemMethods ?? {},
        supervisorFeedback: canEvaluateSupervisor ? supervisorFeedback : [],
        supervisorOtherNote: canEvaluateSupervisor ? supervisorOtherNote : '',
        selfFeedback,
        selfOtherNote,
        evaluatorName: canEvaluateSupervisor
          ? editingAssessment?.evaluatorName || userDisplayName
          : editingAssessment?.evaluatorName ?? '',
        evaluatorUid: canEvaluateSupervisor ? userUid : editingAssessment?.evaluatorUid ?? '',
      },
      canEvaluateSupervisor
    );
  };

  const handleSave = async (nextStatus: AssessmentStatus, openReport = false) => {
    setErrorMessage(null);
    setSaveMessage(null);

    if (!staffName.trim()) {
      setErrorMessage('กรุณาระบุชื่อ–นามสกุลของผู้รับการประเมิน');
      return;
    }

    setSaving(true);
    try {
      const savedId = await persistAssessment(nextStatus);
      setSaveMessage('บันทึกข้อมูลลงฐานข้อมูลเรียลไทม์เรียบร้อยแล้ว');
      onSaved(savedId, openReport);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSelfSubmitConfirm = () => {
    setErrorMessage(null);
    setSaveMessage(null);
    setEmailSendingError(null);
    if (!staffName.trim()) {
      setErrorMessage('กรุณาระบุชื่อ–นามสกุลของผู้รับการประเมิน');
      return;
    }
    setShowSelfSubmitModal(true);
  };

  const handleConfirmSelfSubmit = async (sendEmail: boolean) => {
    setErrorMessage(null);
    setEmailSendingError(null);
    setSaving(true);
    let savedId = submittedAssessmentId;
    try {
      if (!savedId) {
        savedId = await persistAssessment('self_submitted');
        setSubmittedAssessmentId(savedId);
      }

      if (sendEmail) {
        await sendSelfAssessmentEmailNotification({
          staffName: staffName.trim(),
          positionType,
          ward,
          wardYears,
          formTitle: form.title,
          formCode: form.code,
          assessmentPeriod,
          selfTotalScore: calc.selfTotalScore,
          selfMaxScore: calc.selfMaxScore,
          selfPercentage: calc.selfPercentage,
          selfAnsweredCount: calc.selfAnsweredCount,
          totalItems,
          selfFeedback,
          selfOtherNote,
        });
      }

      setShowSelfSubmitModal(false);
      setSubmittedAssessmentId(null);
      setSaveMessage(
        sendEmail
          ? `ส่งผลประเมินตนเองและส่งอีเมลแจ้งเตือนไปยัง ${HEAD_NURSE_NOTIFICATION_EMAIL} เรียบร้อยแล้ว`
          : 'ส่งผลประเมินตนเองลงฐานข้อมูลเรียลไทม์เรียบร้อยแล้ว'
      );
      onSaved(savedId, false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการดำเนินการ';
      if (savedId) {
        setEmailSendingError(
          `ระบบบันทึกผลประเมินตนเองลงฐานข้อมูลเรียบร้อยแล้ว แต่ไม่สามารถส่งอีเมลแจ้งเตือนได้ (${msg})`
        );
      } else {
        setEmailSendingError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Back & Form Selector Bento Tile */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับไปหน้าหลัก
          </button>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {isAdmin && (
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEvaluatorMode('self')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    evaluatorMode === 'self'
                      ? 'bg-[#4F46E5] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  โหมดผู้ประเมินตนเอง
                </button>
                <button
                  type="button"
                  onClick={() => setEvaluatorMode('supervisor')}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    evaluatorMode === 'supervisor'
                      ? 'bg-[#0891B2] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  โหมดผู้บังคับบัญชา
                </button>
              </div>
            )}

            <div className="text-xs text-slate-500">
              <span className={`font-semibold ${getGroupColorMeta(form.group).accentText}`}>
                กลุ่ม {form.group}
              </span>{' '}
              · {form.revisionDate} · {totalItems} ข้อสมรรถนะ · คะแนนเต็ม {totalItems * 3}
            </div>
          </div>
        </div>

        {!editingAssessment && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                1. เลือกกลุ่มบุคลากรที่ต้องการประเมิน (STN / PN / HP)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {COMPETENCY_GROUPS.map((grp) => {
                  const isActive = selectedGroup === grp.id;
                  const count = getFormsByGroup(grp.id).length;
                  const gColor = getGroupColorMeta(grp.id);
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => handleSelectGroup(grp.id)}
                      className={`text-left p-4 rounded-xl border transition-colors ${
                        isActive
                          ? `${gColor.softBg} ${gColor.softBorder} ring-1 ring-inset ring-current/15`
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            isActive ? gColor.accentText : 'text-slate-900'
                          }`}
                        >
                          {grp.title}
                        </span>
                        <span
                          className={`text-xs font-mono shrink-0 ${
                            isActive ? gColor.accentText : 'text-slate-500'
                          }`}
                        >
                          {count} แบบ
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedGroup === 'STN' && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">
                  2. เลือกสาขาเฉพาะทางในกลุ่ม STN ({groupForms.length} แบบประเมิน)
                </p>
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {groupForms.map((f) => {
                    const isSelected = formId === f.id;
                    const isSeaBlueOption = f.id === 'STN_Colorectal';
                    const isPurpleOption = f.id === 'STN_CA_Breast';
                    const isPinkOption = f.id === 'STN_AVF';
                    const isOrangeOption = f.id === 'STN_LT';
                    const isWhiteOption = f.id === 'STN_KT';
                    const buttonColorClass = isSeaBlueOption
                      ? isSelected
                        ? 'bg-[#0891B2] text-white'
                        : 'bg-[#CFFAFE] text-[#0E7490] ring-1 ring-inset ring-[#67E8F9] hover:bg-[#A5F3FC]'
                      : isPurpleOption
                      ? isSelected
                        ? 'bg-[#9333EA] text-white'
                        : 'bg-[#F3E8FF] text-[#7E22CE] ring-1 ring-inset ring-[#E9D5FF] hover:bg-[#E9D5FF]'
                      : isPinkOption
                      ? isSelected
                        ? 'bg-[#DB2777] text-white'
                        : 'bg-[#FCE7F3] text-[#BE185D] ring-1 ring-inset ring-[#F9A8D4] hover:bg-[#FBCFE8]'
                      : isOrangeOption
                      ? isSelected
                        ? 'bg-[#EA580C] text-white'
                        : 'bg-[#FFEDD5] text-[#C2410C] ring-1 ring-inset ring-[#FDBA74] hover:bg-[#FED7AA]'
                      : isWhiteOption
                      ? isSelected
                        ? 'bg-white text-slate-900 ring-2 ring-inset ring-slate-700 shadow-xs'
                        : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900'
                      : isSelected
                      ? 'bg-[#0891B2] text-white'
                      : 'text-slate-600 hover:text-slate-900';

                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormId(f.id)}
                        className={`min-h-[40px] px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${buttonColorClass}`}
                      >
                        {f.shortTitle}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form Title & Staff Information Bento Tile */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="border-b border-slate-200/80 pb-4">
          <p className="text-xs text-[#0E7490] font-medium">{form.subtitle}</p>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mt-1">{form.title}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ชื่อ–นามสกุล ผู้รับการประเมิน
            </label>
            <input
              type="text"
              list="ward-staff-roster-list"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              disabled={isSelfLockedForStaff}
              placeholder="ระบุชื่อ–นามสกุล"
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            />
            <datalist id="ward-staff-roster-list">
              {WARD_STAFF_ROSTER.map((member) => (
                <option key={member.id} value={member.fullName}>
                  {member.rosterRoleLabel}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">อายุ (ปี)</label>
            <input
              type="number"
              min={18}
              max={85}
              value={staffAgeInput}
              onChange={(e) => setStaffAgeInput(e.target.value)}
              onBlur={() => {
                if (staffAgeInput.trim() !== '') setStaffAgeInput(String(staffAge));
              }}
              disabled={isSelfLockedForStaff}
              placeholder="ระบุอายุ"
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">หอผู้ป่วย</label>
            <input
              type="text"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              disabled={isSelfLockedForStaff}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ตำแหน่ง</label>
            <select
              value={positionType}
              onChange={(e) => setPositionType(e.target.value as PositionType)}
              disabled={isSelfLockedForStaff}
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            >
              <option value="RN">พยาบาลวิชาชีพ (RN / STN)</option>
              <option value="PN">ผู้ปฏิบัติงานพยาบาล (PN)</option>
              <option value="HP">พนักงานช่วยพยาบาล (HP)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ระยะเวลาปฏิบัติงานทั้งหมด (ปี)
            </label>
            <input
              type="number"
              min={0}
              max={65}
              step={0.5}
              value={totalYearsInput}
              onChange={(e) => setTotalYearsInput(e.target.value)}
              onBlur={() => {
                if (totalYearsInput.trim() !== '') setTotalYearsInput(String(totalYears));
              }}
              disabled={isSelfLockedForStaff}
              placeholder="ระบุจำนวนปี"
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ระยะเวลาในหอผู้ป่วยปัจจุบัน (ปี)
            </label>
            <input
              type="number"
              min={0}
              max={65}
              step={0.5}
              value={wardYearsInput}
              onChange={(e) => setWardYearsInput(e.target.value)}
              onBlur={() => {
                if (wardYearsInput.trim() !== '') setWardYearsInput(String(wardYears));
              }}
              disabled={isSelfLockedForStaff}
              placeholder="ระบุจำนวนปี"
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            />
            {hasExperienceLevels && applicableSections[0] && (
              <p className="mt-1.5 text-[11px] font-medium text-[#0E7490] bg-[#ECFEFF] border border-[#A5F3FC] rounded-lg px-2.5 py-1">
                ระดับตามระยะเวลา: {applicableSections[0].shortTitle} ({totalItems} ข้อ)
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">รอบการประเมิน</label>
            <input
              type="text"
              value={assessmentPeriod}
              onChange={(e) => setAssessmentPeriod(e.target.value)}
              disabled={isSelfLockedForStaff}
              placeholder="เช่น ประจำปี 2569"
              className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60"
            />
          </div>
        </div>

        {/* Scoring Legend & Methods Reference */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div>
            <p className="font-semibold text-[#4338CA] mb-1">เกณฑ์การประเมินตนเอง (ช่องซ้ายมือ)</p>
            {SELF_SCORE_SCALE.map((s) => (
              <p key={s.value}>
                <span className="font-mono font-semibold text-[#4F46E5]">{s.value}</span> = {s.label}
              </p>
            ))}
          </div>
          <div>
            <p className="font-semibold text-[#0E7490] mb-1">เกณฑ์จากผู้บังคับบัญชา (ช่องขวามือ)</p>
            {SUPERVISOR_SCORE_SCALE.map((s) => (
              <p key={s.value}>
                <span
                  className={`font-mono font-semibold ${
                    s.value === 1
                      ? 'text-rose-600'
                      : s.value === 2
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {s.value}
                </span>{' '}
                = {s.label} ({s.enLabel})
              </p>
            ))}
          </div>
          <div>
            <p className="font-semibold text-slate-800 mb-1">วิธีการประเมิน (Methods)</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              {EVALUATION_METHODS.map((m) => (
                <p key={m.code}>
                  <span className="font-mono font-semibold text-[#0E7490]">{m.code}</span> = {m.thLabel}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Real-Time Score Bento Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-[#4338CA] font-medium">
            <span>คะแนนประเมินตนเอง (Self)</span>
            <span className="font-mono tabular-nums">
              {calc.selfAnsweredCount}/{totalItems} ข้อ
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold font-mono tabular-nums text-[#4F46E5]">
              {calc.selfPercentage}%
            </span>
            <span className="text-xs font-mono tabular-nums text-[#4338CA]/75">
              ({calc.selfTotalScore} × 100) / {calc.selfMaxScore}
            </span>
          </div>
        </div>

        <div className="md:col-span-4 bg-[#0F172A] border border-slate-800 text-white rounded-2xl p-5 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs text-[#2DD4BF] font-medium">
            <span>คะแนนจากผู้บังคับบัญชา (Supervisor)</span>
            <span className="font-mono tabular-nums">
              {calc.supervisorAnsweredCount}/{totalItems} ข้อ
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-semibold font-mono tabular-nums text-white">
              {calc.supervisorAnsweredCount > 0 ? `${calc.supervisorPercentage}%` : '—'}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              ({calc.supervisorTotalScore} × 100) / {calc.supervisorMaxScore}
            </span>
          </div>
        </div>

        <div className={`md:col-span-4 border rounded-2xl p-5 flex flex-col justify-between gap-2 ${tierMeta.cardClass}`}>
          <p className="text-xs text-slate-700 font-medium">เกณฑ์ตัดสินสมรรถนะการปฏิบัติงาน</p>
          <p className={`text-xl font-semibold ${tierMeta.textClass}`}>
            {tierMeta.thLabel}
          </p>
          <p className="text-[10px] font-bold text-slate-600">
            86–100% เกินมาตรฐาน · 66–85% ตามมาตรฐาน · &lt;66% ปรับปรุง
          </p>
        </div>

        {calc.sectionBreakdowns.length > 1 && (
          <div className="md:col-span-12 bg-white border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {calc.sectionBreakdowns.map((sec) => (
              <div key={sec.sectionId} className="text-xs">
                <div className="flex items-center justify-between text-slate-700 mb-1.5">
                  <span className="truncate font-medium">{sec.shortTitle}</span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      sec.supervisorAnsweredCount > 0 ? 'text-[#0E7490]' : 'text-[#4F46E5]'
                    }`}
                  >
                    {sec.supervisorAnsweredCount > 0
                      ? `${sec.supervisorPercentage}%`
                      : `${sec.selfPercentage}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      sec.supervisorAnsweredCount > 0 ? 'bg-[#0891B2]' : 'bg-[#6366F1]'
                    }`}
                    style={{
                      width: `${
                        sec.supervisorAnsweredCount > 0
                          ? sec.supervisorPercentage
                          : sec.selfPercentage
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Evaluation Table by Section */}
      <div className="space-y-4">
        {hasExperienceLevels && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">
                ระบบคัดเลือกหัวข้อประเมินอัตโนมัติตามระยะเวลาในหอผู้ป่วยปัจจุบัน ({wardYears} ปี)
              </p>
              <span className="text-xs font-mono text-[#0E7490] font-semibold">
                ประเมินเฉพาะ {applicableSections[0]?.shortTitle} · {totalItems} ข้อ (เต็ม {totalItems * 3} คะแนน)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {form.sections.map((sec, idx) => {
                const isMatched = applicableSections.some((a) => a.id === sec.id);
                const rangeHints = ['< 1 ปี', '1 – <3 ปี', '3 – <5 ปี', '5 – <10 ปี', '≥ 10 ปี'];
                return (
                  <div
                    key={sec.id}
                    className={`rounded-xl border px-3 py-2 text-xs transition-colors ${
                      isMatched
                        ? 'bg-[#ECFEFF] border-[#0891B2] text-[#0E7490] font-semibold'
                        : 'bg-slate-50/70 border-slate-200/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{sec.shortTitle}</span>
                      <span className="font-mono text-[11px] shrink-0">{sec.items.length} ข้อ</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 font-mono ${isMatched ? 'text-[#0891B2]' : 'text-slate-400'}`}>
                      เกณฑ์: {rangeHints[idx] ?? sec.experienceRange}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {applicableSections.map((section) => {
          const secBreakdown = calc.sectionBreakdowns.find((s) => s.sectionId === section.id);
          let tableLastSubGroup: string | undefined = undefined;
          let mobileLastSubGroup: string | undefined = undefined;

          return (
            <div key={section.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
              <div className="bg-[#ECFEFF]/55 border-b border-slate-200/80 px-4 sm:px-5 py-3.5 sm:py-4 space-y-2">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900">{section.title}</h3>
                    {section.definition && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        <span className="font-semibold text-[#0E7490]">คำจำกัดความ: </span>
                        {section.definition}
                      </p>
                    )}
                  </div>
                  {canEvaluateSupervisor && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[#0E7490] font-medium mr-0.5">หัวหน้าทั้งหมวด:</span>
                        {([1, 2, 3] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => fillSectionScores(section.id, 'supervisor', v)}
                            className="min-w-[36px] min-h-[36px] px-2 py-1 font-mono bg-white border border-[#A5F3FC] text-[#0E7490] hover:bg-[#0891B2] hover:text-white rounded-lg transition-colors"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Touch-First Card Stack (< 768px: iOS & Android Phones Portrait & Narrow Landscape) */}
              <div className="md:hidden divide-y divide-slate-100">
                {section.items.map((item) => {
                  const showSubGroup = item.subGroup && item.subGroup !== mobileLastSubGroup;
                  mobileLastSubGroup = item.subGroup;
                  const selfVal = selfScores[item.id];
                  const supVal = supervisorScores[item.id];

                  return (
                    <React.Fragment key={`m-${item.id}`}>
                      {showSubGroup && (
                        <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-[#0E7490] border-y border-slate-200/80">
                          {item.subGroup}
                        </div>
                      )}
                      <div className="p-4 space-y-3">
                        <p className="text-sm text-slate-900 leading-relaxed">
                          <span className="font-mono font-semibold text-[#0E7490] mr-1.5">
                            {item.numberLabel}.
                          </span>
                          {item.text}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="bg-[#EEF2FF]/55 border border-[#C7D2FE]/70 rounded-xl p-2.5 space-y-2">
                            <p className="text-[11px] font-semibold text-[#4338CA]">
                              การประเมินตนเอง (1–3)
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {([1, 2, 3] as const).map((scoreVal) => {
                                const selected = selfVal === scoreVal;
                                return (
                                  <button
                                    key={`m-self-${scoreVal}`}
                                    type="button"
                                    disabled={isSelfLockedForStaff}
                                    onClick={() =>
                                      setSelfScores((prev) => ({ ...prev, [item.id]: scoreVal }))
                                    }
                                    aria-label={`ประเมินตนเองข้อ ${item.numberLabel} คะแนน ${scoreVal}`}
                                    className={`min-h-[44px] rounded-xl flex items-center justify-center gap-1 font-mono text-sm transition-colors ${
                                      selected
                                        ? scoreVal === 1
                                          ? 'bg-slate-600 text-white font-semibold'
                                          : scoreVal === 2
                                          ? 'bg-[#6366F1] text-white font-semibold'
                                          : 'bg-[#4F46E5] text-white font-semibold'
                                        : 'bg-white text-slate-500 border border-[#C7D2FE] hover:text-[#4F46E5]'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {selected && <Check className="w-4 h-4" />}
                                    <span>{scoreVal}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div
                            className={`rounded-xl p-2.5 space-y-2 border ${
                              canEvaluateSupervisor
                                ? 'bg-[#ECFEFF]/55 border-[#A5F3FC]/80'
                                : 'bg-slate-50 border-slate-200/80 opacity-80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-[11px] font-semibold text-[#0E7490] inline-flex items-center gap-1">
                                {!canEvaluateSupervisor && <Lock className="w-3 h-3 text-slate-400" />}
                                <span>ผู้บังคับบัญชา (1–3)</span>
                              </p>
                              {!canEvaluateSupervisor && (
                                <span className="text-[10px] text-slate-400">เฉพาะหัวหน้า</span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {([1, 2, 3] as const).map((scoreVal) => {
                                const selected = supVal === scoreVal;
                                return (
                                  <button
                                    key={`m-sup-${scoreVal}`}
                                    type="button"
                                    disabled={!canEvaluateSupervisor}
                                    aria-disabled={!canEvaluateSupervisor}
                                    onClick={() => {
                                      if (!canEvaluateSupervisor) return;
                                      setSupervisorScores((prev) => ({
                                        ...prev,
                                        [item.id]: scoreVal,
                                      }));
                                    }}
                                    aria-label={`หัวหน้าประเมินข้อ ${item.numberLabel} คะแนน ${scoreVal}`}
                                    className={`min-h-[44px] rounded-xl flex items-center justify-center gap-1 font-mono text-sm transition-colors ${
                                      selected
                                        ? scoreVal === 1
                                          ? 'bg-rose-600 text-white font-semibold'
                                          : scoreVal === 2
                                          ? 'bg-amber-500 text-white font-semibold'
                                          : 'bg-emerald-600 text-white font-semibold'
                                        : canEvaluateSupervisor
                                        ? 'bg-white text-slate-500 border border-[#A5F3FC] hover:text-[#0E7490]'
                                        : 'bg-slate-100 text-slate-300 border border-slate-200'
                                    } disabled:opacity-55 disabled:cursor-not-allowed`}
                                  >
                                    {selected && <Check className="w-4 h-4" />}
                                    <span>{scoreVal}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {secBreakdown && (
                  <div className="bg-slate-50/80 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-700">
                    <span>รวมคะแนนหมวด: {section.shortTitle}</span>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-[#4F46E5] font-semibold">
                        ตนเอง {secBreakdown.selfScore}/{secBreakdown.maxScore} ({secBreakdown.selfPercentage}%)
                      </span>
                      <span className="text-[#0E7490] font-semibold">
                        หัวหน้า {secBreakdown.supervisorScore}/{secBreakdown.maxScore} ({secBreakdown.supervisorPercentage}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tablet & Desktop 7-Column Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-xs text-slate-700">
                      <th colSpan={3} className="px-2 py-2 text-center border-r border-slate-200/80 w-32 text-[#4338CA] bg-[#EEF2FF]/70">
                        การประเมินตนเอง
                      </th>
                      <th rowSpan={2} className="px-4 py-2 text-left border-r border-slate-200/80">
                        ข้อความระบุสมรรถนะ
                      </th>
                      <th colSpan={3} className="px-2 py-2 text-center w-32 text-[#0E7490] bg-[#ECFEFF]/70">
                        <div className="inline-flex items-center justify-center gap-1">
                          {!canEvaluateSupervisor && <Lock className="w-3 h-3 text-slate-500" />}
                          <span>การประเมินจากผู้บังคับบัญชา</span>
                        </div>
                        {!canEvaluateSupervisor && (
                          <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                            เฉพาะผู้บังคับบัญชา
                          </p>
                        )}
                      </th>
                    </tr>
                    <tr className="border-b border-slate-200/80 bg-slate-50/50 text-xs text-slate-600 font-mono">
                      <th className="py-1.5 text-center border-r border-slate-100 w-10">1</th>
                      <th className="py-1.5 text-center border-r border-slate-100 w-10">2</th>
                      <th className="py-1.5 text-center border-r border-slate-200/80 w-10">3</th>
                      <th className="py-1.5 text-center border-r border-slate-100 w-10">1</th>
                      <th className="py-1.5 text-center border-r border-slate-100 w-10">2</th>
                      <th className="py-1.5 text-center w-10">3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {section.items.map((item) => {
                      const showSubGroup = item.subGroup && item.subGroup !== tableLastSubGroup;
                      tableLastSubGroup = item.subGroup;
                      const selfVal = selfScores[item.id];
                      const supVal = supervisorScores[item.id];

                      return (
                        <React.Fragment key={item.id}>
                          {showSubGroup && (
                            <tr className="bg-slate-50">
                              <td
                                colSpan={7}
                                className="px-4 py-2 text-xs font-semibold text-[#0E7490] border-y border-slate-200/80"
                              >
                                {item.subGroup}
                              </td>
                            </tr>
                          )}
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            {/* Self 1, 2, 3 */}
                            {([1, 2, 3] as const).map((scoreVal, idx) => {
                              const selected = selfVal === scoreVal;
                              return (
                                <td
                                  key={`self-${scoreVal}`}
                                  className={`p-1 text-center align-middle ${
                                    idx === 2 ? 'border-r border-slate-200/80' : 'border-r border-slate-100'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    disabled={isSelfLockedForStaff}
                                    onClick={() =>
                                      setSelfScores((prev) => ({ ...prev, [item.id]: scoreVal }))
                                    }
                                    aria-label={`ประเมินตนเองข้อ ${item.numberLabel} คะแนน ${scoreVal}`}
                                    className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center font-mono text-xs transition-colors ${
                                      selected
                                        ? scoreVal === 1
                                          ? 'bg-slate-600 text-white font-semibold'
                                          : scoreVal === 2
                                          ? 'bg-[#6366F1] text-white font-semibold'
                                          : 'bg-[#4F46E5] text-white font-semibold'
                                        : 'text-slate-300 hover:bg-[#EEF2FF] hover:text-[#4F46E5]'
                                    } disabled:cursor-not-allowed`}
                                  >
                                    {selected ? <Check className="w-4 h-4" /> : scoreVal}
                                  </button>
                                </td>
                              );
                            })}

                            {/* Competency Description */}
                            <td className="px-4 py-3 border-r border-slate-200/80 align-top">
                              <p className="text-sm text-slate-900 leading-relaxed">
                                <span className="font-mono font-semibold text-[#0E7490] mr-1.5">
                                  {item.numberLabel}.
                                </span>
                                {item.text}
                              </p>
                            </td>

                            {/* Supervisor 1, 2, 3 */}
                            {([1, 2, 3] as const).map((scoreVal, idx) => {
                              const selected = supVal === scoreVal;
                              return (
                                <td
                                  key={`sup-${scoreVal}`}
                                  className={`p-1 text-center align-middle ${
                                    !canEvaluateSupervisor ? 'bg-slate-50/60' : ''
                                  } ${idx < 2 ? 'border-r border-slate-100' : ''}`}
                                >
                                  <button
                                    type="button"
                                    disabled={!canEvaluateSupervisor}
                                    aria-disabled={!canEvaluateSupervisor}
                                    tabIndex={canEvaluateSupervisor ? 0 : -1}
                                    onClick={() => {
                                      if (!canEvaluateSupervisor) return;
                                      setSupervisorScores((prev) => ({
                                        ...prev,
                                        [item.id]: scoreVal,
                                      }));
                                    }}
                                    aria-label={`หัวหน้าประเมินข้อ ${item.numberLabel} คะแนน ${scoreVal}`}
                                    className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center font-mono text-xs transition-colors ${
                                      selected
                                        ? scoreVal === 1
                                          ? 'bg-rose-600 text-white font-semibold'
                                          : scoreVal === 2
                                          ? 'bg-amber-500 text-white font-semibold'
                                          : 'bg-emerald-600 text-white font-semibold'
                                        : canEvaluateSupervisor
                                        ? 'text-slate-300 hover:bg-[#ECFEFF] hover:text-[#0E7490]'
                                        : 'text-slate-300 bg-slate-100/70'
                                    } disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none`}
                                  >
                                    {selected ? <Check className="w-4 h-4" /> : scoreVal}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {secBreakdown && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t border-slate-200/80 text-xs font-medium text-slate-700">
                        <td colSpan={3} className="px-3 py-2.5 text-center font-mono tabular-nums border-r border-slate-200/80 text-[#4F46E5] font-semibold">
                          {secBreakdown.selfScore} / {secBreakdown.maxScore} ({secBreakdown.selfPercentage}%)
                        </td>
                        <td className="px-4 py-2.5 border-r border-slate-200/80">
                          รวมคะแนนหมวด: {section.shortTitle}
                        </td>
                        <td colSpan={3} className="px-3 py-2.5 text-center font-mono tabular-nums text-[#0E7490] font-semibold">
                          {secBreakdown.supervisorScore} / {secBreakdown.maxScore} ({secBreakdown.supervisorPercentage}%)
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Post-Assessment Feedback Bento Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#C7D2FE] rounded-2xl p-4 sm:p-6 space-y-3">
          <h4 className="text-sm font-semibold text-[#4338CA]">
            ความคิดเห็นของผู้รับการประเมิน
          </h4>
          <div className="space-y-1.5 sm:space-y-2">
            {SELF_FEEDBACK_OPTIONS.map((opt) => (
              <label key={opt.key} className="min-h-[38px] py-0.5 flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isSelfLockedForStaff}
                  checked={selfFeedback.includes(opt.key)}
                  onChange={() => toggleFeedbackKey(selfFeedback, setSelfFeedback, opt.key)}
                  className="w-5 h-5 sm:w-4 sm:h-4 rounded border-slate-300 accent-[#4F46E5] disabled:opacity-50 shrink-0"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            disabled={isSelfLockedForStaff}
            value={selfOtherNote}
            onChange={(e) => setSelfOtherNote(e.target.value)}
            placeholder="ระบุความคิดเห็นเพิ่มเติมของผู้รับการประเมิน..."
            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15 focus:border-[#4F46E5] disabled:opacity-60"
          />
        </div>

        <div className="bg-white border border-[#A5F3FC] rounded-2xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[#0E7490]">
              ข้อเสนอแนะจากผู้บังคับบัญชาที่ต้องทำต่อ
            </h4>
            {!canEvaluateSupervisor && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                <Lock className="w-3 h-3" />
                เฉพาะผู้บังคับบัญชา
              </span>
            )}
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {FEEDBACK_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className={`min-h-[38px] py-0.5 flex items-center gap-2.5 text-sm text-slate-700 ${
                  canEvaluateSupervisor ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!canEvaluateSupervisor}
                  checked={supervisorFeedback.includes(opt.key)}
                  onChange={() => {
                    if (!canEvaluateSupervisor) return;
                    toggleFeedbackKey(supervisorFeedback, setSupervisorFeedback, opt.key);
                  }}
                  className="w-5 h-5 sm:w-4 sm:h-4 rounded border-slate-300 accent-[#0891B2] disabled:opacity-50 shrink-0"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            disabled={!canEvaluateSupervisor}
            value={supervisorOtherNote}
            onChange={(e) => setSupervisorOtherNote(e.target.value)}
            placeholder={
              canEvaluateSupervisor
                ? 'ระบุข้อเสนอแนะเพิ่มเติมจากผู้บังคับบัญชา...'
                : 'สำหรับผู้บังคับบัญชากรอกเท่านั้น'
            }
            className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Feedback Banner + Action Buttons */}
      {errorMessage && (
        <div className="p-3.5 text-sm text-rose-800 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl">
          {errorMessage}
        </div>
      )}
      {saveMessage && (
        <div className="p-3.5 text-sm text-emerald-800 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl">
          {saveMessage}
        </div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-50 sm:bg-transparent rounded-xl transition-colors"
        >
          ยกเลิก
        </button>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          {!isSelfLockedForStaff && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave('draft')}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                บันทึกร่าง
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleOpenSelfSubmitConfirm}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Send className="w-4 h-4" />
                ส่งผลประเมินตนเอง
              </button>
            </>
          )}

          {canEvaluateSupervisor && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave('evaluated', true)}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              บันทึกผลประเมินผู้บังคับบัญชา &amp; ดูกราฟสรุป
            </button>
          )}
        </div>
      </div>

      {showSelfSubmitModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/55 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="self-submit-confirm-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="self-submit-confirm-title" className="text-base font-semibold text-slate-900">
                    ยืนยันการส่งผลประเมินตนเองและส่งอีเมลแจ้งเตือน
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ระบบจะบันทึกผลประเมินตนเองและส่งอีเมลแจ้งหัวหน้าหอผู้ป่วยผ่านบัญชี Gmail ของคุณ
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (submittedAssessmentId) {
                    const id = submittedAssessmentId;
                    setShowSelfSubmitModal(false);
                    setSubmittedAssessmentId(null);
                    onSaved(id, false);
                  } else {
                    setShowSelfSubmitModal(false);
                  }
                }}
                aria-label="ปิดหน้าต่าง"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500">ผู้รับการประเมิน:</span>
                <span className="font-semibold text-slate-900">
                  {staffName.trim()} ({positionType})
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500">แบบประเมิน / รอบ:</span>
                <span className="font-medium text-slate-900">
                  {form.code} · {assessmentPeriod}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500">คะแนนประเมินตนเอง:</span>
                <span className="font-mono font-semibold text-[#4F46E5]">
                  {calc.selfTotalScore}/{calc.selfMaxScore} คะแนน ({calc.selfPercentage}%)
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-500">ส่งอีเมลแจ้งเตือนถึง:</span>
                  <span className="font-mono font-semibold text-[#0E7490] break-all">
                    {HEAD_NURSE_NOTIFICATION_EMAIL}
                  </span>
                </div>
                <p className="text-slate-500">
                  หัวข้ออีเมล:{' '}
                  <span className="text-slate-800 font-medium break-words">
                    {buildSelfAssessmentEmailSubject({
                      staffName: staffName.trim(),
                      positionType,
                      ward,
                      wardYears,
                      formTitle: form.title,
                      formCode: form.code,
                      assessmentPeriod,
                      selfTotalScore: calc.selfTotalScore,
                      selfMaxScore: calc.selfMaxScore,
                      selfPercentage: calc.selfPercentage,
                      selfAnsweredCount: calc.selfAnsweredCount,
                      totalItems,
                      selfFeedback,
                      selfOtherNote,
                    })}
                  </span>
                </p>
              </div>
            </div>

            {emailSendingError && (
              <div className="p-3 text-xs text-rose-800 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl">
                {emailSendingError}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (submittedAssessmentId) {
                    const id = submittedAssessmentId;
                    setShowSelfSubmitModal(false);
                    setSubmittedAssessmentId(null);
                    onSaved(id, false);
                  } else {
                    setShowSelfSubmitModal(false);
                  }
                }}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {submittedAssessmentId ? 'ปิด (บันทึกผลแล้ว)' : 'ยกเลิก'}
              </button>
              {!submittedAssessmentId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConfirmSelfSubmit(false)}
                  className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  ส่งเฉพาะผล (ไม่ส่งอีเมล)
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmSelfSubmit(true)}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {saving
                  ? 'กำลังบันทึกและส่งอีเมล...'
                  : submittedAssessmentId
                  ? 'ลองส่งอีเมลอีกครั้ง'
                  : 'ยืนยันส่งผลและส่งอีเมลแจ้งเตือน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
