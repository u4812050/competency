import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  LogOut,
  Menu,
  Plus,
  UserCheck,
  X,
} from 'lucide-react';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AssessmentDetailModal } from './components/AssessmentDetailModal';
import { AssessmentEditor } from './components/AssessmentEditor';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RecordsTable, type StaffPrefill } from './components/RecordsTable';
import { StaffProfileView } from './components/StaffProfileView';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { COMPETENCY_GROUPS, getGroupColorMeta } from './data/competencyForms';
import { CompetencyAssessment, FormId } from './types/competency';

type AppTab = 'dashboard' | 'assess' | 'records' | 'profile';

function CompetencyWorkspace() {
  const {
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
  } = useFirebase();

  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [editingAssessment, setEditingAssessment] = useState<CompetencyAssessment | null>(null);
  const [initialFormId, setInitialFormId] = useState<FormId>('PN');
  const [initialStaffPrefill, setInitialStaffPrefill] = useState<StaffPrefill | null>(null);
  const [viewingReport, setViewingReport] = useState<CompetencyAssessment | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  React.useEffect(() => {
    if (!isAdmin && (activeTab === 'records' || activeTab === 'profile')) {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  React.useEffect(() => {
    if (!pendingReportId) return;
    const found = assessments.find((x) => x.id === pendingReportId);
    if (found) {
      setViewingReport(found);
      setPendingReportId(null);
    }
  }, [pendingReportId, assessments]);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const openNewAssessment = (formId: FormId = 'PN', prefill: StaffPrefill | null = null) => {
    setEditingAssessment(null);
    setInitialFormId(formId);
    setInitialStaffPrefill(prefill);
    setActiveTab('assess');
    setMobileMenuOpen(false);
  };

  const openEditAssessment = (assessment: CompetencyAssessment) => {
    setViewingReport(null);
    setEditingAssessment(assessment);
    setInitialFormId(assessment.formId);
    setInitialStaffPrefill(null);
    setActiveTab('assess');
    setMobileMenuOpen(false);
  };

  if (!authReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F4F7FB] px-4">
        <div className="text-center space-y-2.5">
          <div className="w-7 h-7 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">กำลังเชื่อมต่อระบบประเมินสมรรถนะ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-[#F4F7FB] flex flex-col justify-center py-5 sm:py-8 lg:py-10 px-4 sm:px-6 lg:px-8 px-safe pb-safe">
        <div className="max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Hero Bento Tile */}
          <div className="md:col-span-7 lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 lg:p-8 flex flex-col justify-between gap-5 sm:gap-7">
            <div className="space-y-2.5 sm:space-y-3">
              <p className="text-xs font-semibold text-[#0E7490] leading-relaxed">
                หอผู้ป่วยพิเศษบุญสม 7 · งานการพยาบาลผู้ป่วยพิเศษเฉพาะทาง · โรงพยาบาลมหาราชนครเชียงใหม่
              </p>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 tracking-tight">
                ระบบประเมินสมรรถนะเฉพาะหน่วยงาน
                <span className="block">(Unit-Specific Competency)</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
                แพลตฟอร์มบันทึกผลประเมินสมรรถนะทางการพยาบาล คำนวณค่าร้อยละและระดับเกณฑ์มาตรฐานอัตโนมัติ
                จัดเก็บข้อมูลแบบเรียลไทม์ พร้อมสรุปผลเปรียบเทียบเชิงกราฟิกครบทั้ง 7 แบบประเมิน
              </p>
            </div>

            {authError && (
              <p className="text-xs text-rose-700 bg-[#FFF1F2] border border-[#FECDD3] rounded-xl p-3">
                {authError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                เข้าสู่ระบบด้วยบัญชี Google เพื่อบันทึกและดูผลประเมินแบบเรียลไทม์
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <PWAInstallButton variant="light" />
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <UserCheck className="w-4 h-4" />
                  เข้าสู่ระบบด้วย Google
                </button>
              </div>
            </div>
          </div>

          {/* Visual Illustration Tile */}
          <div className="md:col-span-5 lg:col-span-4 rounded-2xl overflow-hidden border border-slate-200/90 bg-white aspect-[4/3] sm:aspect-[16/10] max-h-64 sm:max-h-72 md:max-h-none md:aspect-auto md:h-full">
            <img
              src="/assets/aistudio/Gemini_Generated_Image_y4xyycy4xyycy4xy_d473e530.jfif"
              alt="Smart Performance Assessment"
              className="w-full h-full object-cover object-top md:object-center"
            />
          </div>
        </div>
      </div>
    );
  }

  const navItems: {
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }[] = [
    { id: 'assess', label: 'แบบประเมินสมรรถนะ', icon: ClipboardCheck },
    { id: 'dashboard', label: 'ภาพรวมกราฟิก', icon: BarChart3 },
    { id: 'records', label: 'ทะเบียนผลประเมิน', icon: FileSpreadsheet, adminOnly: true },
    { id: 'profile', label: 'ข้อมูลบุคลากรและสิทธิ์', icon: Activity, adminOnly: true },
  ];

  const activeBreadcrumb =
    activeTab === 'dashboard'
      ? 'ภาพรวมสมรรถนะเชิงกราฟิก'
      : activeTab === 'assess'
      ? editingAssessment
        ? `แก้ไข / ประเมินผล: ${editingAssessment.staffName}`
        : 'บันทึกแบบประเมินสมรรถนะใหม่'
      : activeTab === 'records'
      ? 'ทะเบียนผลการประเมินทั้งหมด'
      : 'ข้อมูลบุคลากรและสิทธิ์ผู้ประเมิน';

  return (
    <div className="min-h-dvh bg-[#F4F7FB] flex">
      {/* Deep Slate Desktop & Tablet Landscape Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 lg:shrink-0 bg-[#0F172A] text-slate-100 border-r border-slate-800 no-print">
        <div className="h-16 px-4 flex items-center gap-2.5 border-b border-slate-800">
          <img
            src="/apple-touch-icon.png"
            alt="Boonsom 7"
            className="w-7 h-7 rounded-lg border border-slate-700 shrink-0"
          />
          <span className="text-base font-semibold tracking-tight text-white whitespace-nowrap truncate">
            Boonsom 7 <span className="text-[#2DD4BF]">Competency</span>
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLocked = Boolean(item.adminOnly && !isAdmin);
            return (
              <button
                key={item.id}
                type="button"
                disabled={isLocked}
                aria-disabled={isLocked}
                title={isLocked ? 'เฉพาะหัวหน้าหอผู้ป่วย / ผู้ประเมิน (Admin) เท่านั้น' : undefined}
                onClick={() => {
                  if (isLocked) return;
                  if (item.id === 'assess' && activeTab !== 'assess') {
                    setEditingAssessment(null);
                    setInitialStaffPrefill(null);
                  }
                  setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
                  isLocked
                    ? 'text-slate-500 opacity-55 cursor-not-allowed'
                    : isActive
                    ? 'bg-[#1E293B] text-[#2DD4BF]'
                    : 'text-slate-300 hover:text-white hover:bg-[#1E293B]/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isLocked ? 'text-slate-500' : isActive ? 'text-[#2DD4BF]' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {isLocked && <Lock className="w-3.5 h-3.5 ml-auto text-slate-500 shrink-0" />}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            <p className="px-3.5 pb-1 text-xs font-medium text-slate-400">
              เลือกประเมินตามกลุ่ม
            </p>
            {COMPETENCY_GROUPS.map((grp) => {
              const gColor = getGroupColorMeta(grp.id);
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => openNewAssessment(grp.defaultFormId)}
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#1E293B] rounded-xl transition-colors whitespace-nowrap"
                >
                  <span>ประเมินกลุ่ม {grp.code}</span>
                  <span className={`font-mono text-[11px] font-semibold ${gColor.darkAccentText}`}>
                    {grp.id === 'STN' ? '5 แบบ' : '1 แบบ'}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2.5">
          <div className="text-xs">
            <p className="font-medium text-white truncate">
              {staffProfile?.fullName || user.displayName || user.email}
            </p>
            <p className="text-[#2DD4BF] font-medium truncate mt-0.5">
              {isAdmin ? 'หัวหน้าหอผู้ป่วย / ผู้ประเมิน' : 'ผู้รับการประเมิน'}
            </p>
          </div>
          <PWAInstallButton variant="dark" />
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#1E293B] hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Deep Slate Mobile & Tablet Portrait Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] max-h-dvh bg-[#0F172A] text-slate-100 border-r border-slate-800 flex flex-col z-10 pl-[env(safe-area-inset-left)]">
            <div className="h-14 sm:h-16 px-4 sm:px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/apple-touch-icon.png"
                  alt="Boonsom 7"
                  className="w-7 h-7 rounded-lg border border-slate-700 shrink-0"
                />
                <span className="text-base font-semibold text-white truncate">
                  Boonsom 7 <span className="text-[#2DD4BF]">Competency</span>
                </span>
              </div>
              <button
                type="button"
                aria-label="ปิดเมนู"
                onClick={() => setMobileMenuOpen(false)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isLocked = Boolean(item.adminOnly && !isAdmin);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isLocked}
                    aria-disabled={isLocked}
                    title={isLocked ? 'เฉพาะหัวหน้าหอผู้ป่วย / ผู้ประเมิน (Admin) เท่านั้น' : undefined}
                    onClick={() => {
                      if (isLocked) return;
                      if (item.id === 'assess' && activeTab !== 'assess') {
                        setEditingAssessment(null);
                        setInitialStaffPrefill(null);
                      }
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                      isLocked
                        ? 'text-slate-500 opacity-55 cursor-not-allowed'
                        : isActive
                        ? 'bg-[#1E293B] text-[#2DD4BF]'
                        : 'text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {isLocked && <Lock className="w-3.5 h-3.5 ml-auto text-slate-500 shrink-0" />}
                  </button>
                );
              })}

              <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
                <p className="px-3.5 pb-1 text-xs font-medium text-slate-400">
                  เลือกประเมินตามกลุ่ม
                </p>
                {COMPETENCY_GROUPS.map((grp) => {
                  const gColor = getGroupColorMeta(grp.id);
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => openNewAssessment(grp.defaultFormId)}
                      className="w-full min-h-[42px] flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#1E293B] rounded-xl transition-colors"
                    >
                      <span>ประเมินกลุ่ม {grp.code}</span>
                      <span className={`font-mono text-[11px] font-semibold ${gColor.darkAccentText}`}>
                        {grp.id === 'STN' ? '5 แบบ' : '1 แบบ'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
            <div className="p-3 sm:p-4 pb-safe border-t border-slate-800 space-y-2.5 shrink-0">
              <div className="text-xs px-1">
                <p className="font-medium text-white truncate">
                  {staffProfile?.fullName || user.displayName || user.email}
                </p>
                <p className="text-[#2DD4BF] font-medium truncate mt-0.5">
                  {isAdmin ? 'หัวหน้าหอผู้ป่วย / ผู้ประเมิน' : 'ผู้รับการประเมิน'}
                </p>
              </div>
              <PWAInstallButton variant="dark" />
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-[#1E293B] hover:bg-slate-700 rounded-xl transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออกจากระบบ
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Light Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, 1 Primary CTA on right */}
        <header className="sticky top-0 z-30 min-h-[56px] sm:h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 no-print">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="เปิดเมนู"
              className="lg:hidden min-w-[44px] min-h-[44px] -ml-1 inline-flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-xl shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm lg:text-xs text-slate-500 truncate">
                <span className="hidden sm:inline">หอผู้ป่วยพิเศษบุญสม 7 / </span>
                <span className="text-slate-900 font-medium">{activeBreadcrumb}</span>
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openNewAssessment('PN')}
              className="min-h-[40px] sm:min-h-[38px] inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>ประเมิน</span>
              <span className="hidden sm:inline -ml-1">สมรรถนะ</span>
              <span className="-ml-1">ใหม่</span>
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-safe max-w-[1360px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <AnalyticsDashboard
              assessments={assessments}
              loading={dataLoading}
              onCreateNew={(formId) => openNewAssessment(formId)}
              onSelectAssessment={(a) => setViewingReport(a)}
            />
          )}

          {activeTab === 'assess' && (
            <AssessmentEditor
              userUid={user.uid}
              userDisplayName={user.displayName || user.email || 'ผู้ใช้งาน'}
              isAdmin={isAdmin}
              staffProfile={staffProfile}
              initialFormId={initialFormId}
              initialStaffPrefill={initialStaffPrefill}
              editingAssessment={editingAssessment}
              onCancel={() => {
                setEditingAssessment(null);
                setInitialStaffPrefill(null);
                setActiveTab(isAdmin ? 'records' : 'dashboard');
              }}
              onSaved={(savedId, openReport) => {
                setEditingAssessment(null);
                setInitialStaffPrefill(null);
                if (openReport) {
                  setPendingReportId(savedId);
                }
                setActiveTab(isAdmin ? 'records' : 'dashboard');
              }}
            />
          )}

          {activeTab === 'records' && isAdmin && (
            <RecordsTable
              assessments={assessments}
              isAdmin={isAdmin}
              loading={dataLoading}
              onCreateNew={(formId, prefill) => openNewAssessment(formId, prefill)}
              onEdit={(a) => openEditAssessment(a)}
              onViewReport={(a) => setViewingReport(a)}
            />
          )}

          {activeTab === 'profile' && isAdmin && (
            <StaffProfileView
              userUid={user.uid}
              userEmail={user.email || ''}
              isAdmin={isAdmin}
              isBootstrappedAdmin={isBootstrappedAdmin}
            />
          )}
        </main>
      </div>

      {viewingReport && (
        <AssessmentDetailModal
          assessment={viewingReport}
          onClose={() => setViewingReport(null)}
          onEdit={(a) => openEditAssessment(a)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <CompetencyWorkspace />
    </FirebaseProvider>
  );
}
