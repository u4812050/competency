import React, { useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'dark' | 'light';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'dark' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const canTrigger = isInstallable || isIOS || isAndroid;
  if (!canTrigger) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  const buttonClasses =
    variant === 'dark'
      ? 'w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#2DD4BF] hover:text-white bg-[#1E293B]/80 hover:bg-[#1E293B] border border-[#2DD4BF]/30 rounded-xl transition-colors whitespace-nowrap'
      : 'w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0';

  return (
    <>
      <button type="button" onClick={() => void handleClick()} className={buttonClasses}>
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>เพิ่มไอคอนลงหน้าจอ</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/apple-touch-icon.png"
                  alt="Boonsom 7 App Icon"
                  className="w-12 h-12 rounded-2xl border border-slate-200 shadow-sm shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    Boonsom 7 Competency
                  </h3>
                  <p className="text-xs text-slate-500">
                    เพิ่มไอคอนแอปไว้บนหน้าจอหลัก
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="ปิดหน้าต่าง"
                onClick={() => setShowGuideModal(false)}
                className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0891B2] text-white font-semibold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>
                    เปิดเว็บนี้ในเบราว์เซอร์ <strong>Safari</strong> แล้วแตะปุ่ม{' '}
                    <strong className="inline-flex items-center gap-1 text-[#0E7490]">
                      <Share className="w-3.5 h-3.5 inline" /> แชร์ (Share)
                    </strong>{' '}
                    ที่แถบด้านล่างหรือมุมขวาบน
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0891B2] text-white font-semibold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    เลื่อนลงแล้วเลือกเมนู{' '}
                    <strong className="inline-flex items-center gap-1 text-slate-900">
                      <PlusSquare className="w-3.5 h-3.5 inline" /> เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)
                    </strong>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0891B2] text-white font-semibold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>
                    แตะ <strong>เพิ่ม (Add)</strong> มุมขวาบน เพื่อสร้างไอคอนแอปบนหน้าจอ iPhone / iPad
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0891B2] text-white font-semibold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>
                    เปิดเว็บนี้ใน <strong>Chrome</strong> แล้วแตะปุ่มเมนู{' '}
                    <strong className="inline-flex items-center gap-0.5 text-[#0E7490]">
                      <MoreVertical className="w-3.5 h-3.5 inline" /> (3 จุด)
                    </strong>{' '}
                    ที่มุมขวาบน
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0891B2] text-white font-semibold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    เลือก <strong>“เพิ่มลงในหน้าจอหลัก” (Add to Home screen)</strong> หรือ{' '}
                    <strong>“ติดตั้งแอป” (Install app)</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#0891B2] text-white font-semibold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>
                    กด <strong>ติดตั้ง / เพิ่ม</strong> เพื่อวางไอคอนไว้บนหน้าจอ Android
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[42px] py-2 text-xs font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-xl transition-colors"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </>
  );
};
