import React, { useEffect, useState } from 'react';
import { Check, Copy, ShieldCheck, Trash2 } from 'lucide-react';
import {
  grantAdminRole,
  revokeAdminRole,
  subscribeAdminsList,
} from '../services/firestoreService';

interface StaffProfileViewProps {
  userUid: string;
  userEmail: string;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
}

export function StaffProfileView({
  userUid,
  userEmail,
  isAdmin,
  isBootstrappedAdmin,
}: StaffProfileViewProps) {
  const [copiedUid, setCopiedUid] = useState(false);

  const [adminsList, setAdminsList] = useState<
    { uid: string; grantedBy: string; createdAt?: unknown }[]
  >([]);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [adminStatusMsg, setAdminStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isBootstrappedAdmin) return;
    const unsub = subscribeAdminsList((list) => setAdminsList(list));
    return () => unsub();
  }, [isBootstrappedAdmin]);

  const handleCopyUid = async () => {
    await navigator.clipboard.writeText(userUid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminStatusMsg(null);
    if (!newAdminUid.trim()) return;
    try {
      await grantAdminRole(newAdminUid.trim(), userUid);
      setNewAdminUid('');
      setAdminStatusMsg('เพิ่มสิทธิ์ผู้ประเมิน (หัวหน้าหอผู้ป่วย) เรียบร้อยแล้ว');
    } catch (err) {
      setAdminStatusMsg(err instanceof Error ? err.message : 'ไม่สามารถเพิ่มสิทธิ์ได้');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Account & UID Bento Tile */}
      <div className="bg-[#0F172A] border border-slate-800 text-white rounded-2xl p-4 sm:p-6 space-y-4">
        <div>
          <p className="text-xs text-[#2DD4BF] font-medium">บัญชีผู้ใช้งานปัจจุบัน</p>
          <p className="text-sm font-medium text-white mt-1 truncate">{userEmail}</p>
        </div>
        <div className="pt-3 border-t border-slate-800">
          <p className="text-xs text-slate-400">ระดับสิทธิ์ในระบบ</p>
          <p className="text-sm font-semibold text-emerald-300 mt-1">
            {isAdmin ? 'หัวหน้าหอผู้ป่วย / ผู้ประเมิน (Admin)' : 'ผู้รับการประเมิน (Staff)'}
          </p>
        </div>
        <div className="pt-3 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-1.5">รหัสประจำตัวผู้ใช้งาน (UID)</p>
          <div className="flex items-center justify-between gap-2 bg-[#1E293B] border border-slate-700/80 rounded-xl px-3 py-1.5">
            <code className="font-mono text-xs text-slate-100 truncate">{userUid}</code>
            <button
              type="button"
              onClick={() => void handleCopyUid()}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-[#2DD4BF] hover:text-white rounded-lg shrink-0"
              title="คัดลอก UID"
            >
              {copiedUid ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Head Nurse / Evaluator Role Management Bento Tile (Bootstrapped Admin Only) */}
      {isBootstrappedAdmin && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0891B2] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                จัดการสิทธิ์ผู้บังคับบัญชา (Evaluator Access)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ระบุ UID ของหัวหน้าเวรหรือผู้ตรวจประเมินเพื่ออนุญาตให้ลงคะแนนช่องผู้บังคับบัญชา
              </p>
            </div>
          </div>

          <form onSubmit={(e) => void handleGrantAdmin(e)} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newAdminUid}
              onChange={(e) => setNewAdminUid(e.target.value)}
              placeholder="วาง UID ของหัวหน้าเวร..."
              className="flex-1 min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/15 focus:border-[#0891B2]"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              เพิ่มสิทธิ์
            </button>
          </form>

          {adminStatusMsg && (
            <p className="text-xs text-emerald-800 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-2.5">
              {adminStatusMsg}
            </p>
          )}

          {adminsList.length > 0 && (
            <div className="border border-slate-200/80 rounded-xl divide-y divide-slate-100">
              {adminsList.map((adm) => (
                <div key={adm.uid} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-slate-800 truncate">{adm.uid}</span>
                  <button
                    type="button"
                    onClick={() => void revokeAdminRole(adm.uid)}
                    className="min-h-[36px] px-2 inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 shrink-0 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    เพิกถอน
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
