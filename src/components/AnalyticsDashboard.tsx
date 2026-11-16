import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Search } from 'lucide-react';
import {
  calculateAssessmentScores,
  COMPETENCY_GROUPS,
  getApplicableSections,
  getFormById,
  getFormsByGroup,
  getGroupColorMeta,
  getGroupMeta,
  getTierMeta,
} from '../data/competencyForms';
import { CompetencyAssessment, CompetencyGroup, FormId } from '../types/competency';

interface AnalyticsDashboardProps {
  assessments: CompetencyAssessment[];
  loading: boolean;
  onCreateNew: (formId?: FormId) => void;
  onSelectAssessment: (assessment: CompetencyAssessment) => void;
}

const TIER_COLORS: Record<string, string> = {
  exceed: '#10B981',
  meet: '#F59E0B',
  need_improvement: '#F43F5E',
  pending: '#94A3B8',
};

export function AnalyticsDashboard({
  assessments,
  loading,
  onSelectAssessment,
}: AnalyticsDashboardProps) {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'ALL' | CompetencyGroup>('ALL');
  const [selectedFormFilter, setSelectedFormFilter] = useState<'ALL' | FormId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');

  const handleGroupChange = (group: 'ALL' | CompetencyGroup) => {
    setSelectedGroupFilter(group);
    if (group === 'PN') {
      setSelectedFormFilter('PN');
    } else if (group === 'HP') {
      setSelectedFormFilter('HP');
    } else {
      setSelectedFormFilter('ALL');
    }
  };

  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    for (const a of assessments) {
      if (a.assessmentPeriod) set.add(a.assessmentPeriod);
    }
    return Array.from(set).sort();
  }, [assessments]);

  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      if (a.status === 'archived') return false;
      const formGroup = getFormById(a.formId).group;
      if (selectedGroupFilter !== 'ALL' && formGroup !== selectedGroupFilter) return false;
      if (selectedFormFilter !== 'ALL' && a.formId !== selectedFormFilter) return false;
      if (periodFilter !== 'ALL' && a.assessmentPeriod !== periodFilter) return false;
      if (
        searchQuery.trim() &&
        !a.staffName.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [assessments, selectedGroupFilter, selectedFormFilter, periodFilter, searchQuery]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const evaluated = filtered.filter((a) => a.supervisorTier !== 'pending');
    const pendingCount = total - evaluated.length;

    const avgSelf =
      total > 0
        ? Number((filtered.reduce((sum, a) => sum + (a.selfPercentage || 0), 0) / total).toFixed(1))
        : 0;

    const avgSupervisor =
      evaluated.length > 0
        ? Number(
            (
              evaluated.reduce((sum, a) => sum + (a.supervisorPercentage || 0), 0) /
              evaluated.length
            ).toFixed(1)
          )
        : 0;

    const passCount = evaluated.filter(
      (a) => a.supervisorTier === 'exceed' || a.supervisorTier === 'meet'
    ).length;
    const passRate =
      evaluated.length > 0 ? Number(((passCount * 100) / evaluated.length).toFixed(1)) : 0;

    return {
      total,
      evaluatedCount: evaluated.length,
      pendingCount,
      avgSelf,
      avgSupervisor,
      passRate,
    };
  }, [filtered]);

  // Chart data:
  // - ALL groups: compare 3 groups (STN, PN, HP)
  // - STN group (ALL subforms): compare 5 STN specialty forms
  // - Specific form (PN, HP, or specific STN): compare its internal sections/levels
  const comparisonChartData = useMemo(() => {
    if (selectedGroupFilter === 'ALL') {
      return COMPETENCY_GROUPS.map((grp) => {
        const subset = filtered.filter((a) => getFormById(a.formId).group === grp.id);
        const evaluatedSubset = subset.filter((a) => a.supervisorTier !== 'pending');
        const selfAvg =
          subset.length > 0
            ? Number((subset.reduce((s, a) => s + a.selfPercentage, 0) / subset.length).toFixed(1))
            : 0;
        const supAvg =
          evaluatedSubset.length > 0
            ? Number(
                (
                  evaluatedSubset.reduce((s, a) => s + a.supervisorPercentage, 0) /
                  evaluatedSubset.length
                ).toFixed(1)
              )
            : 0;
        return {
          name: `กลุ่ม ${grp.code}`,
          fullName: grp.title,
          count: subset.length,
          selfPct: selfAvg,
          supervisorPct: supAvg,
        };
      });
    }

    if (selectedGroupFilter === 'STN' && selectedFormFilter === 'ALL') {
      return getFormsByGroup('STN').map((form) => {
        const subset = filtered.filter((a) => a.formId === form.id);
        const evaluatedSubset = subset.filter((a) => a.supervisorTier !== 'pending');
        const selfAvg =
          subset.length > 0
            ? Number((subset.reduce((s, a) => s + a.selfPercentage, 0) / subset.length).toFixed(1))
            : 0;
        const supAvg =
          evaluatedSubset.length > 0
            ? Number(
                (
                  evaluatedSubset.reduce((s, a) => s + a.supervisorPercentage, 0) /
                  evaluatedSubset.length
                ).toFixed(1)
              )
            : 0;
        return {
          name: form.code,
          fullName: form.shortTitle,
          count: subset.length,
          selfPct: selfAvg,
          supervisorPct: supAvg,
        };
      });
    }

    const activeFormId =
      selectedFormFilter !== 'ALL'
        ? selectedFormFilter
        : getGroupMeta(selectedGroupFilter).defaultFormId;
    const form = getFormById(activeFormId);

    return form.sections.map((section) => {
      let selfSum = 0;
      let selfCount = 0;
      let supSum = 0;
      let supCount = 0;

      for (const a of filtered) {
        const calc = calculateAssessmentScores(form, a.selfScores, a.supervisorScores, a.wardYears);
        const sec = calc.sectionBreakdowns.find((s) => s.sectionId === section.id);
        if (sec) {
          if (sec.selfAnsweredCount > 0) {
            selfSum += sec.selfPercentage;
            selfCount += 1;
          }
          if (sec.supervisorAnsweredCount > 0) {
            supSum += sec.supervisorPercentage;
            supCount += 1;
          }
        }
      }

      return {
        name: section.shortTitle,
        fullName: section.title,
        count: filtered.length,
        selfPct: selfCount > 0 ? Number((selfSum / selfCount).toFixed(1)) : 0,
        supervisorPct: supCount > 0 ? Number((supSum / supCount).toFixed(1)) : 0,
      };
    });
  }, [filtered, selectedGroupFilter, selectedFormFilter]);

  const tierDistribution = useMemo(() => {
    const counts = {
      exceed: 0,
      meet: 0,
      need_improvement: 0,
      pending: 0,
    };
    for (const a of filtered) {
      counts[a.supervisorTier] = (counts[a.supervisorTier] || 0) + 1;
    }
    return [
      { key: 'exceed', name: 'สูงกว่ามาตรฐาน (86-100%)', value: counts.exceed },
      { key: 'meet', name: 'ตามมาตรฐาน (66-85%)', value: counts.meet },
      { key: 'need_improvement', name: 'ต้องปรับปรุง (< 66%)', value: counts.need_improvement },
      { key: 'pending', name: 'รอหัวหน้าประเมิน', value: counts.pending },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  // Gap & Low-Score Item Analysis
  const topGapItems = useMemo(() => {
    const itemStats = new Map<
      string,
      {
        itemId: string;
        formCode: string;
        text: string;
        selfSum: number;
        selfN: number;
        supSum: number;
        supN: number;
      }
    >();

    for (const a of filtered) {
      const form = getFormById(a.formId);
      for (const sec of getApplicableSections(form, a.wardYears)) {
        for (const item of sec.items) {
          const selfVal = a.selfScores?.[item.id];
          const supVal = a.supervisorScores?.[item.id];
          if (!selfVal && !supVal) continue;
          const key = `${a.formId}:${item.id}`;
          const existing = itemStats.get(key) ?? {
            itemId: item.id,
            formCode: form.code,
            text: item.text,
            selfSum: 0,
            selfN: 0,
            supSum: 0,
            supN: 0,
          };
          if (selfVal) {
            existing.selfSum += selfVal;
            existing.selfN += 1;
          }
          if (supVal) {
            existing.supSum += supVal;
            existing.supN += 1;
          }
          itemStats.set(key, existing);
        }
      }
    }

    return Array.from(itemStats.values())
      .filter((x) => x.supN > 0)
      .map((x) => {
        const avgSup = Number((x.supSum / x.supN).toFixed(2));
        const avgSelf = x.selfN > 0 ? Number((x.selfSum / x.selfN).toFixed(2)) : 0;
        return {
          ...x,
          avgSup,
          avgSelf,
          gap: Number((avgSup - avgSelf).toFixed(2)),
        };
      })
      .sort((a, b) => a.avgSup - b.avgSup || a.gap - b.gap)
      .slice(0, 6);
  }, [filtered]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-12 h-16 bg-white border border-slate-200/90 rounded-2xl animate-pulse" />
        <div className="lg:col-span-4 h-32 bg-[#0F172A]/85 rounded-2xl animate-pulse" />
        <div className="lg:col-span-3 h-32 bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl animate-pulse" />
        <div className="lg:col-span-3 h-32 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl animate-pulse" />
        <div className="lg:col-span-2 h-32 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl animate-pulse" />
        <div className="lg:col-span-7 h-80 bg-white border border-slate-200/90 rounded-2xl animate-pulse" />
        <div className="lg:col-span-5 h-80 bg-white border border-slate-200/90 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bento Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          {/* 3-Group Selector */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleGroupChange('ALL')}
              className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedGroupFilter === 'ALL'
                  ? 'bg-[#0F172A] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกกลุ่ม (ทั้งหมด)
            </button>
            {COMPETENCY_GROUPS.map((grp) => {
              const gColor = getGroupColorMeta(grp.id);
              const isSelected = selectedGroupFilter === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => handleGroupChange(grp.id)}
                  className={`min-h-[38px] px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isSelected ? gColor.solidBg : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  กลุ่ม {grp.code}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อบุคลากร..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2]"
              />
            </div>

            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              aria-label="กรองรอบการประเมิน"
              className="w-full sm:w-auto min-h-[42px] px-3 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2]"
            >
              <option value="ALL">ทุกรอบการประเมิน</option>
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary STN Sub-form Filter */}
        {selectedGroupFilter === 'STN' && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">สาขาในกลุ่ม STN:</span>
            <button
              type="button"
              onClick={() => setSelectedFormFilter('ALL')}
              className={`min-h-[36px] px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedFormFilter === 'ALL'
                  ? 'bg-[#0891B2] text-white'
                  : 'bg-[#ECFEFF] text-[#0E7490] hover:bg-[#CFFAFE]'
              }`}
            >
              รวมทุกสาขา STN
            </button>
            {getFormsByGroup('STN').map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFormFilter(f.id)}
                className={`min-h-[36px] px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedFormFilter === f.id
                    ? 'bg-[#0891B2] text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.shortTitle}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty State Bento Grid */}
      {filtered.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 bg-white border border-slate-200/90 rounded-2xl px-6 py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#0F172A] text-[#2DD4BF] flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              ยังไม่มีข้อมูลผลการประเมินสมรรถนะในกลุ่มที่เลือก
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              เลือกกลุ่มที่ต้องการเริ่มต้นบันทึกแบบประเมินด้านล่างเพื่อคำนวณคะแนนและแสดงกราฟแบบเรียลไทม์
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Bento Row 1: Deep Slate Focal Tile + Flat Minimal Pastel KPI Strip */}
          <div className="sm:col-span-2 lg:col-span-4 bg-[#0F172A] text-white border border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#2DD4BF]">คะแนนเฉลี่ยจากผู้บังคับบัญชา</p>
              <span className="text-xs font-mono text-slate-400 tabular-nums">Supervisor</span>
            </div>
            <p className="text-3xl sm:text-4xl font-semibold font-mono tabular-nums tracking-tight text-white">
              {kpis.evaluatedCount > 0 ? `${kpis.avgSupervisor}%` : '—'}
            </p>
            <p className="text-xs text-slate-300 tabular-nums">
              เทียบคะแนนประเมินตนเองเฉลี่ย <span className="text-[#818CF8] font-mono font-semibold">{kpis.avgSelf}%</span>
            </p>
          </div>

          {/* Flat Mint-Emerald Pass Rate Bento Tile */}
          <div className="lg:col-span-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4">
            <p className="text-xs font-semibold text-emerald-800">อัตราผ่านเกณฑ์มาตรฐาน (≥ 66%)</p>
            <p className="text-2xl sm:text-3xl font-semibold text-emerald-700 font-mono tabular-nums">
              {kpis.evaluatedCount > 0 ? `${kpis.passRate}%` : '—'}
            </p>
            <p className="text-xs text-emerald-800/80">
              Meet 66–85% · Exceed 86–100%
            </p>
          </div>

          {/* Flat Indigo Total Forms Bento Tile */}
          <div className="lg:col-span-3 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4">
            <p className="text-xs font-semibold text-[#3730A3]">จำนวนแบบประเมินทั้งหมด</p>
            <p className="text-2xl sm:text-3xl font-semibold text-[#4F46E5] font-mono tabular-nums">
              {kpis.total}
            </p>
            <p className="text-xs text-[#3730A3]/75 tabular-nums">
              ประเมินโดยหัวหน้าแล้ว {kpis.evaluatedCount} รายการ
            </p>
          </div>

          {/* Flat Amber Pending Evaluation Bento Tile */}
          <div className="sm:col-span-2 lg:col-span-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4">
            <p className="text-xs font-semibold text-[#92400E]">รอหัวหน้าประเมิน</p>
            <p className="text-2xl sm:text-3xl font-semibold text-[#D97706] font-mono tabular-nums">
              {kpis.pendingCount}
            </p>
            <p className="text-xs text-[#92400E]/75">ร่าง / ส่งผลตนเอง</p>
          </div>

          {/* Bento Row 2: 7/5 Asymmetric Charts */}
          <div className="sm:col-span-2 lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6">
            <div className="mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                เปรียบเทียบคะแนนสมรรถนะเทียบเกณฑ์มาตรฐาน (ร้อยละ)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เส้นประอำพัน = ผ่านเกณฑ์ (66%) · เส้นประมรกต = สูงกว่ามาตรฐาน (86%)
              </p>
            </div>
            <div className="h-64 sm:h-72 lg:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonChartData}
                  margin={{ top: 10, right: 8, left: -12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value}%`, '']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                    itemStyle={{ color: '#F8FAFC' }}
                    labelStyle={{ color: '#2DD4BF', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine
                    y={66}
                    stroke="#F59E0B"
                    strokeOpacity={0.75}
                    strokeDasharray="4 4"
                  />
                  <ReferenceLine
                    y={86}
                    stroke="#10B981"
                    strokeOpacity={0.75}
                    strokeDasharray="4 4"
                  />
                  <Bar dataKey="selfPct" name="ประเมินตนเอง (%)" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  <Bar
                    dataKey="supervisorPct"
                    name="ผู้บังคับบัญชา (%)"
                    fill="#0891B2"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6">
            <div className="mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                กราฟใยแมงมุม (Self vs Supervisor)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedGroupFilter === 'ALL'
                  ? 'ค่าเฉลี่ยร้อยละเปรียบเทียบ 3 กลุ่ม (STN, PN, HP)'
                  : selectedGroupFilter === 'STN' && selectedFormFilter === 'ALL'
                  ? 'ค่าเฉลี่ยร้อยละจำแนกตามสาขาในกลุ่ม STN (5 สาขา)'
                  : `ค่าเฉลี่ยร้อยละตามหมวด/ระดับของ ${
                      getFormById(
                        selectedFormFilter !== 'ALL'
                          ? selectedFormFilter
                          : getGroupMeta(selectedGroupFilter).defaultFormId
                      ).shortTitle
                    }`}
              </p>
            </div>
            <div className="h-64 sm:h-72 lg:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="64%"
                  margin={{ top: 8, right: 20, bottom: 8, left: 20 }}
                  data={comparisonChartData}
                >
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#334155', fontSize: 11 }} />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748B', fontSize: 10 }}
                  />
                  <Radar
                    name="ประเมินตนเอง (%)"
                    dataKey="selfPct"
                    stroke="#6366F1"
                    fill="#6366F1"
                    fillOpacity={0.22}
                  />
                  <Radar
                    name="ผู้บังคับบัญชา (%)"
                    dataKey="supervisorPct"
                    stroke="#0891B2"
                    fill="#0891B2"
                    fillOpacity={0.32}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, '']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F8FAFC',
                    }}
                    itemStyle={{ color: '#F8FAFC' }}
                    labelStyle={{ color: '#2DD4BF', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bento Row 3: 4/5/3 Insights Grid */}
          <div className="sm:col-span-2 lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                สัดส่วนระดับผลสมรรถนะ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                จำแนกตามเกณฑ์ประเมินผู้บังคับบัญชา
              </p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={76}
                      paddingAngle={3}
                    >
                      {tierDistribution.map((entry) => (
                        <Cell key={entry.key} fill={TIER_COLORS[entry.key] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`${val} รายการ`, '']}
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#1E293B',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#F8FAFC',
                      }}
                      itemStyle={{ color: '#F8FAFC' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-2 mt-2 border-t border-slate-100 pt-3">
              {tierDistribution.map((d) => (
                <div key={d.key} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: TIER_COLORS[d.key] }}
                    />
                    {d.name}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6">
            <div className="mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                หัวข้อสมรรถนะที่ควรเร่งพัฒนา
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เรียงจากคะแนนเฉลี่ยผู้บังคับบัญชาต่ำสุด (เต็ม 3.00)
              </p>
            </div>

            {topGapItems.length === 0 ? (
              <div className="py-10 sm:py-12 text-center text-sm text-slate-500">
                ยังไม่มีคะแนนประเมินจากผู้บังคับบัญชาเพียงพอสำหรับการวิเคราะห์รายข้อ
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topGapItems.map((item) => {
                  const pct = Math.round((item.avgSup / 3) * 100);
                  return (
                    <div key={`${item.formCode}-${item.itemId}`} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0E7490] mb-0.5">{item.formCode}</p>
                          <p className="text-sm text-slate-900 line-clamp-2">{item.text}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-semibold tabular-nums text-slate-900">
                            {item.avgSup.toFixed(2)} / 3.00
                          </p>
                          <p className="text-xs font-mono tabular-nums text-[#4F46E5]">
                            ตนเอง {item.avgSelf.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.avgSup < 2
                              ? 'bg-rose-500'
                              : item.avgSup < 2.58
                              ? 'bg-amber-500'
                              : 'bg-[#0891B2]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 lg:col-span-3 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">รายการประเมินล่าสุด</h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">คลิกเพื่อเปิดดูกราฟสรุปผลรายบุคคล</p>
              <div className="divide-y divide-slate-100">
                {filtered.slice(0, 5).map((a) => {
                  const meta = getTierMeta(a.supervisorTier);
                  const form = getFormById(a.formId);
                  const gColor = getGroupColorMeta(form.group);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelectAssessment(a)}
                      className="w-full min-h-[48px] py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-left hover:bg-slate-50 px-2 -mx-2 rounded-xl transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {a.staffName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          <span className={`font-semibold ${gColor.accentText}`}>{form.code}</span> · {a.assessmentPeriod}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-semibold tabular-nums text-slate-900">
                          {a.supervisorTier === 'pending'
                            ? `${a.selfPercentage}%`
                            : `${a.supervisorPercentage}%`}
                        </p>
                        <p className={`text-xs font-medium ${meta.textClass}`}>{meta.thLabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
