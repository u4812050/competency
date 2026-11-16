import React, { useMemo, useState } from 'react';
import { BarChart2, Download, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import {
  COMPETENCY_FORMS,
  COMPETENCY_GROUPS,
  DEFAULT_WARD,
  getFormById,
  getFormsByGroup,
  getGroupColorMeta,
  getTierMeta,
} from '../data/competencyForms';
import { normalizeThaiName, WARD_STAFF_ROSTER } from '../data/staffRoster';
import { deleteAssessment } from '../services/firestoreService';
import {
  CompetencyAssessment,
  CompetencyGroup,
  CompetencyTier,
  FormId,
  PositionType,
} from '../types/competency';

export interface StaffPrefill {
  staffName: string;
  positionType: PositionType;
}

interface RecordsTableProps {
  assessments: CompetencyAssessment[];
  isAdmin: boolean;
  loading: boolean;
  onCreateNew: (formId?: FormId, prefill?: StaffPrefill) => void;
  onEdit: (assessment: CompetencyAssessment) => void;
  onViewReport: (assessment: CompetencyAssessment) => void;
}

export function RecordsTable({
  assessments,
  isAdmin,
  loading,
  onCreateNew,
  onEdit,
  onViewReport,
}: RecordsTableProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'ALL' | CompetencyGroup>('ALL');
  const [formFilter, setFormFilter] = useState<'ALL' | FormId>('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | CompetencyTier | 'unassessed'>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleGroupChange = (group: 'ALL' | CompetencyGroup) => {
    setGroupFilter(group);
    if (group === 'PN') {
      setFormFilter('PN');
    } else if (group === 'HP') {
      setFormFilter('HP');
    } else {
      setFormFilter('ALL');
    }
  };

  const availableFormOptions = useMemo(() => {
    if (groupFilter === 'ALL') return COMPETENCY_FORMS;
    return getFormsByGroup(groupFilter);
  }, [groupFilter]);

  const assessedNameSet = useMemo(() => {
    return new Set(assessments.map((a) => normalizeThaiName(a.staffName)));
  }, [assessments]);

  const unassessedRoster = useMemo(() => {
    return WARD_STAFF_ROSTER.filter(
      (member) => !assessedNameSet.has(normalizeThaiName(member.fullName))
    );
  }, [assessedNameSet]);

  const assessedRosterCount = WARD_STAFF_ROSTER.length - unassessedRoster.length;

  const filteredAssessments = useMemo(() => {
    if (tierFilter === 'unassessed') return [];
    return assessments.filter((a) => {
      const formGroup = getFormById(a.formId).group;
      if (groupFilter !== 'ALL' && formGroup !== groupFilter) return false;
      if (formFilter !== 'ALL' && a.formId !== formFilter) return false;
      if (tierFilter !== 'ALL' && a.supervisorTier !== tierFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !a.staffName.toLowerCase().includes(q) &&
          !a.ward.toLowerCase().includes(q) &&
          !a.assessmentPeriod.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [assessments, groupFilter, formFilter, tierFilter, search]);

  const filteredRoster = useMemo(() => {
    if (tierFilter !== 'ALL' && tierFilter !== 'unassessed') return [];
    if ((groupFilter === 'ALL' || groupFilter === 'STN') && formFilter !== 'ALL') return [];

    return unassessedRoster.filter((member) => {
      if (groupFilter !== 'ALL' && member.category !== groupFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !member.fullName.toLowerCase().includes(q) &&
          !member.rosterRoleLabel.toLowerCase().includes(q) &&
          !DEFAULT_WARD.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [unassessedRoster, groupFilter, formFilter, tierFilter, search]);

  const totalVisibleRows = filteredAssessments.length + filteredRoster.length;

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAssessment(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'ชื่อ-นามสกุล',
      'ตำแหน่ง',
      'อายุ',
      'หอผู้ป่วย',
      'แบบประเมิน',
      'รอบการประเมิน',
      'คะแนนตนเอง',
      'ร้อยละตนเอง',
      'คะแนนผู้บังคับบัญชา',
      'ร้อยละผู้บังคับบัญชา',
      'ระดับผลประเมิน',
      'ผู้ประเมิน',
    ];
    const assessedRows = filteredAssessments.map((a) => {
      const form = getFormById(a.formId);
      const tier = getTierMeta(a.supervisorTier);
      return [
        a.staffName,
        a.positionType,
        a.staffAge,
        a.ward,
        form.code,
        a.assessmentPeriod,
        `${a.selfTotalScore}/${a.selfMaxScore}`,
        `${a.selfPercentage}%`,
        `${a.supervisorTotalScore}/${a.supervisorMaxScore}`,
        `${a.supervisorPercentage}%`,
        tier.thLabel,
        a.evaluatorName || '-',
      ];
    });

    const rosterRows = filteredRoster.map((member) => [
      member.fullName,
      member.rosterRoleLabel,
      '-',
      DEFAULT_WARD,
      member.category === 'SUPERVISOR' ? 'ผู้บังคับบัญชา' : `กลุ่ม ${member.category}`,
      '-',
      '-',
      '-',
      '-',
      '-',
      'ยังไม่เริ่มประเมิน',
      '-',
    ]);

    const rows = [...assessedRows, ...rosterRows].map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boonsom7_competency_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white border border-zinc-200/70 rounded-2xl p-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 bg-zinc-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar Bento Tile */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* 3-Group Segmented Filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleGroupChange('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                groupFilter === 'ALL'
                  ? 'bg-[#0F172A] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทุกกลุ่ม
            </button>
            {COMPETENCY_GROUPS.map((grp) => {
              const gColor = getGroupColorMeta(grp.id);
              const isSelected = groupFilter === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => handleGroupChange(grp.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isSelected ? gColor.solidBg : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  กลุ่ม {grp.code}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2.5">
            {totalVisibleRows > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลด CSV
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onCreateNew(
                  groupFilter === 'PN'
                    ? 'PN'
                    : groupFilter === 'HP'
                    ? 'HP'
                    : formFilter !== 'ALL'
                    ? formFilter
                    : 'STN_Colorectal'
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              สร้างแบบประเมินใหม่
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, กลุ่ม, รอบ..."
                className="pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2] w-56"
              />
            </div>

            {(groupFilter === 'ALL' || groupFilter === 'STN') && (
              <select
                value={formFilter}
                onChange={(e) => setFormFilter(e.target.value as 'ALL' | FormId)}
                aria-label="กรองตามแบบประเมิน"
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2]"
              >
                <option value="ALL">
                  {groupFilter === 'STN' ? 'ทุกสาขาในกลุ่ม STN' : 'ทุกแบบประเมิน'}
                </option>
                {availableFormOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.shortTitle}
                  </option>
                ))}
              </select>
            )}

            <select
              value={tierFilter}
              onChange={(e) =>
                setTierFilter(e.target.value as 'ALL' | CompetencyTier | 'unassessed')
              }
              aria-label="กรองตามผลประเมิน"
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2]"
            >
              <option value="ALL">ทุกระดับผลประเมิน</option>
              <option value="exceed">สูงกว่ามาตรฐาน (86–100%)</option>
              <option value="meet">ตามมาตรฐาน (66–85%)</option>
              <option value="need_improvement">ต้องการปรับปรุง (&lt; 66%)</option>
              <option value="pending">รอหัวหน้าประเมิน</option>
              <option value="unassessed">ยังไม่เริ่มประเมิน</option>
            </select>
          </div>

          <p className="text-xs text-slate-500">
            บุคลากรทั้งหมด <span className="font-semibold text-slate-700">{WARD_STAFF_ROSTER.length}</span> คน ·{' '}
            บันทึกผลแล้ว <span className="font-semibold text-[#0891B2]">{assessedRosterCount}</span> คน ·{' '}
            ยังไม่ประเมิน <span className="font-semibold text-slate-700">{unassessedRoster.length}</span> คน
          </p>
        </div>
      </div>

      {/* Table Bento Tile */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
        {totalVisibleRows === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-800">ไม่พบรายการบุคลากรหรือแบบประเมิน</p>
            <p className="text-xs text-slate-500 mt-1">
              ปรับตัวกรองด้านบน หรือกดสร้างแบบประเมินใหม่เพื่อเริ่มต้นบันทึก
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-xs text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">ชื่อ–นามสกุล</th>
                  <th className="text-left px-4 py-3 font-medium">แบบประเมิน / กลุ่ม</th>
                  <th className="text-left px-4 py-3 font-medium">รอบประเมิน</th>
                  <th className="text-right px-4 py-3 font-medium">ประเมินตนเอง</th>
                  <th className="text-right px-4 py-3 font-medium">ผู้บังคับบัญชา</th>
                  <th className="text-left px-4 py-3 font-medium">สรุปเกณฑ์</th>
                  <th className="text-right px-4 py-3 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssessments.map((item) => {
                  const form = getFormById(item.formId);
                  const tier = getTierMeta(item.supervisorTier);
                  const gColor = getGroupColorMeta(form.group);
                  const canDelete = isAdmin || item.status === 'draft';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{item.staffName}</p>
                        <p className="text-xs text-slate-500">
                          {item.positionType} · ประสบการณ์ {item.totalYears} ปี
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-medium text-slate-900">{form.code}</span>
                        <span className={`text-xs font-semibold ml-1.5 ${gColor.accentText}`}>
                          · กลุ่ม {form.group}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.assessmentPeriod}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#4F46E5] font-medium">
                        {item.selfPercentage}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0891B2] font-semibold">
                        {item.supervisorTier === 'pending' ? '—' : `${item.supervisorPercentage}%`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${tier.textClass}`}>
                          {tier.thLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewReport(item)}
                            title="สรุปผลเป็นกราฟิก"
                            className="p-2 text-slate-500 hover:text-[#0891B2] hover:bg-[#ECFEFF] rounded-lg transition-colors"
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            title="แก้ไข / ประเมิน"
                            className="p-2 text-slate-500 hover:text-[#4F46E5] hover:bg-[#EEF2FF] rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => void handleDelete(item.id)}
                              title="ลบรายการ"
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-[#FFF1F2] rounded-lg transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRoster.map((member) => {
                  const isSupervisor = member.category === 'SUPERVISOR';
                  const gColor = !isSupervisor
                    ? getGroupColorMeta(member.category as CompetencyGroup)
                    : null;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{member.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {member.rosterRoleLabel} · {DEFAULT_WARD}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {isSupervisor ? (
                          <span className="text-xs font-semibold text-slate-700">
                            ผู้บังคับบัญชา
                          </span>
                        ) : (
                          <>
                            <span className={`text-xs font-semibold ${gColor?.accentText}`}>
                              กลุ่ม {member.category}
                            </span>
                            <span className="text-xs text-slate-400 ml-1.5">
                              · {member.positionType}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">—</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400">
                        —
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400">
                        —
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-400">
                          ยังไม่เริ่มประเมิน
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onCreateNew(member.defaultFormId, {
                              staffName: member.fullName,
                              positionType: member.positionType,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0E7490] bg-[#ECFEFF] hover:bg-[#CFFAFE] border border-[#A5F3FC] rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          ประเมิน
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
