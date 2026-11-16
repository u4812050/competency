import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { Printer, X, Edit3 } from 'lucide-react';
import {
  calculateAssessmentScores,
  FEEDBACK_OPTIONS,
  getFormById,
  getTierMeta,
  SELF_FEEDBACK_OPTIONS,
} from '../data/competencyForms';
import { CompetencyAssessment } from '../types/competency';

interface AssessmentDetailModalProps {
  assessment: CompetencyAssessment;
  onClose: () => void;
  onEdit: (assessment: CompetencyAssessment) => void;
}

export function AssessmentDetailModal({
  assessment,
  onClose,
  onEdit,
}: AssessmentDetailModalProps) {
  const form = useMemo(() => getFormById(assessment.formId), [assessment.formId]);
  const calc = useMemo(
    () =>
      calculateAssessmentScores(
        form,
        assessment.selfScores,
        assessment.supervisorScores,
        assessment.wardYears
      ),
    [form, assessment.selfScores, assessment.supervisorScores, assessment.wardYears]
  );
  const tierMeta = getTierMeta(calc.supervisorTier);
  const hasExperienceLevels = form.sections.some((s) => Boolean(s.experienceRange));

  const chartData = calc.sectionBreakdowns.map((s) => ({
    name: s.shortTitle,
    selfPct: s.selfPercentage,
    supervisorPct: s.supervisorPercentage,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#F4F7FB] border border-slate-200 rounded-2xl w-full max-w-5xl max-h-[92dvh] overflow-y-auto overscroll-contain shadow-lg">
        {/* Top Action Bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 no-print">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <p className="text-xs text-[#0E7490] font-medium truncate">
                {form.code} · {assessment.assessmentPeriod} · {assessment.ward}
              </p>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                รายงานสรุปผลสมรรถนะ: {assessment.staffName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="sm:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(assessment)}
              className="flex-1 sm:flex-initial min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              แก้ไข / ประเมินผล
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์รายงาน
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="hidden sm:inline-flex min-w-[40px] min-h-[40px] items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Bento Content */}
        <div className="p-3.5 sm:p-5 space-y-4">
          {/* Official Hospital Header Bento Tile */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5">
            <p className="text-xs text-[#0E7490] font-medium">{form.subtitle}</p>
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 mt-1">{form.title}</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-xs text-slate-700 pt-3 border-t border-slate-100">
              <div>
                <span className="text-slate-500">ชื่อ–นามสกุล: </span>
                <span className="font-medium text-slate-900">{assessment.staffName}</span>
              </div>
              <div>
                <span className="text-slate-500">อายุ / ตำแหน่ง: </span>
                <span className="font-medium tabular-nums text-slate-900">
                  {assessment.staffAge} ปี · {assessment.positionType}
                </span>
              </div>
              <div>
                <span className="text-slate-500">อายุงานรวม / หอผู้ป่วย: </span>
                <span className="font-medium tabular-nums text-slate-900">
                  {assessment.totalYears} ปี / {assessment.wardYears} ปี
                </span>
                {hasExperienceLevels && calc.sectionBreakdowns[0] && (
                  <span className="ml-1.5 font-semibold text-[#0E7490]">
                    ({calc.sectionBreakdowns[0].shortTitle})
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500">ผู้ประเมิน: </span>
                <span className="font-medium text-slate-900">
                  {assessment.evaluatorName || 'รอผู้บังคับบัญชาประเมิน'}
                </span>
              </div>
            </div>
          </div>

          {/* Formula Score Summary Bento Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-5">
              <p className="text-xs text-[#4338CA] font-medium">ผลประเมินตนเอง (Self-Assessment)</p>
              <p className="mt-1.5 text-3xl font-semibold font-mono tabular-nums text-[#4F46E5]">
                {calc.selfPercentage}%
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-[#4338CA]/75">
                ({calc.selfTotalScore} × 100) / {calc.selfMaxScore} คะแนนเต็ม
              </p>
            </div>

            <div className="bg-[#0F172A] border border-slate-800 text-white rounded-2xl p-5">
              <p className="text-xs text-[#2DD4BF] font-medium">ผลประเมินจากผู้บังคับบัญชา (Supervisor)</p>
              <p className="mt-1.5 text-3xl font-semibold font-mono tabular-nums text-white">
                {calc.supervisorAnsweredCount > 0 ? `${calc.supervisorPercentage}%` : '—'}
              </p>
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-400">
                ({calc.supervisorTotalScore} × 100) / {calc.supervisorMaxScore} คะแนนเต็ม
              </p>
            </div>

            <div className={`border rounded-2xl p-5 ${tierMeta.cardClass}`}>
              <p className="text-xs text-slate-700 font-medium">สรุปเกณฑ์สมรรถนะการปฏิบัติงาน</p>
              <p className={`mt-1.5 text-xl font-semibold ${tierMeta.textClass}`}>
                {tierMeta.thLabel}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {tierMeta.label} · เกณฑ์ {tierMeta.rangeLabel}
              </p>
            </div>
          </div>

          {/* Graphical Breakdown Bento Tiles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print-break-inside-avoid">
            {chartData.length >= 3 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                  กราฟใยแมงมุมสมรรถนะรายหมวด / ระดับ
                </h4>
                <div className="h-56 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="64%"
                      margin={{ top: 8, right: 20, bottom: 8, left: 20 }}
                      data={chartData}
                    >
                      <PolarGrid stroke="#E2E8F0" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#334155', fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }} />
                      <Radar
                        name="ตนเอง (%)"
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
                        fillOpacity={0.3}
                      />
                      <Tooltip
                        formatter={(val) => [`${val}%`, '']}
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
            ) : null}

            <div
              className={`bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 ${
                chartData.length < 3 ? 'lg:col-span-2' : ''
              }`}
            >
              <h4 className="text-sm font-semibold text-slate-900 mb-2">
                คะแนนเปรียบเทียบรายหมวด / ระดับ (ร้อยละ)
              </h4>
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 8, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#334155', fontSize: 11 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip
                      formatter={(val) => [`${val}%`, '']}
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
                      stroke="#D97706"
                      strokeOpacity={0.7}
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={86}
                      stroke="#10B981"
                      strokeOpacity={0.7}
                      strokeDasharray="4 4"
                    />
                    <Bar dataKey="selfPct" name="ตนเอง (%)" fill="#6366F1" radius={[6, 6, 0, 0]} />
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
          </div>

          {/* Section Breakdown Table Bento Tile */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] sm:min-w-0 text-xs sm:text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs text-slate-600">
                  <tr>
                    <th className="text-left px-3 sm:px-4 py-2.5 font-medium">หมวด / ระดับสมรรถนะ</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">จำนวนข้อ</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">ตนเอง (คะแนน)</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">ตนเอง (%)</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">ผู้บังคับบัญชา (คะแนน)</th>
                    <th className="text-right px-3 sm:px-4 py-2.5 font-medium">ผู้บังคับบัญชา (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {calc.sectionBreakdowns.map((sec) => (
                    <tr key={sec.sectionId}>
                      <td className="px-3 sm:px-4 py-2.5 text-slate-900">{sec.shortTitle}</td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                        {sec.itemCount}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {sec.selfScore} / {sec.maxScore}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono tabular-nums text-[#4F46E5] font-medium">
                        {sec.selfPercentage}%
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {sec.supervisorScore} / {sec.maxScore}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right font-mono tabular-nums text-[#0E7490] font-semibold">
                        {sec.supervisorPercentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feedback Summary Bento Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-break-inside-avoid">
            <div className="bg-white border border-[#A5F3FC] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#0E7490] mb-2">
                ข้อเสนอแนะจากผู้บังคับบัญชาที่ต้องทำต่อ
              </h4>
              {assessment.supervisorFeedback.length === 0 && !assessment.supervisorOtherNote ? (
                <p className="text-xs text-slate-500">ไม่มีข้อเสนอแนะเพิ่มเติม</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {assessment.supervisorFeedback.map((key) => {
                    const opt = FEEDBACK_OPTIONS.find((o) => o.key === key);
                    return <li key={key}>✓ {opt?.label || key}</li>;
                  })}
                  {assessment.supervisorOtherNote ? (
                    <li className="text-slate-600 pt-1">หมายเหตุ: {assessment.supervisorOtherNote}</li>
                  ) : null}
                </ul>
              )}
            </div>

            <div className="bg-white border border-[#C7D2FE] rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-[#4338CA] mb-2">
                ความคิดเห็นของผู้รับการประเมิน
              </h4>
              {assessment.selfFeedback.length === 0 && !assessment.selfOtherNote ? (
                <p className="text-xs text-slate-500">ไม่มีความคิดเห็นเพิ่มเติม</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {assessment.selfFeedback.map((key) => {
                    const opt = SELF_FEEDBACK_OPTIONS.find((o) => o.key === key);
                    return <li key={key}>✓ {opt?.label || key}</li>;
                  })}
                  {assessment.selfOtherNote ? (
                    <li className="text-slate-600 pt-1">หมายเหตุ: {assessment.selfOtherNote}</li>
                  ) : null}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
