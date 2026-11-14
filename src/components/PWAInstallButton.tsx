import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Check, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'hero' | 'floating' | 'footer';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'footer',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // Hide completely if already installed OR if browser cannot install (desktop without beforeinstallprompt & non-iOS)
  if ((isInstalled && !justInstalled) || (!isInstallable && !isIOS && !justInstalled)) {
    return null;
  }

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // Just installed feedback
  if (justInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-xs font-mono">
        <Check className="w-4 h-4" />
        <span>App Installed!</span>
      </div>
    );
  }

  // Footer / Standard Gold Button
  return (
    <>
      <button
        onClick={handleInstallClick}
        type="button"
        title="Install AQARI Terminal App - ثبّت التطبيق"
        aria-label="Install AQARI Terminal App"
        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C99D28] hover:brightness-110 text-black font-bold text-sm font-mono tracking-wide transition cursor-pointer min-h-[48px] shadow-[0_0_20px_rgba(212,175,55,0.28)] active:scale-95 ${
          variant === 'footer' ? 'mx-auto' : ''
        } ${className}`}
      >
        <Download className="w-4 h-4 text-black shrink-0" />
        <span>Install AQARI Terminal App</span>
        <span className="font-arabic font-semibold text-black/80 hidden sm:inline">• ثبّت التطبيق</span>
      </button>

      {showIOSModal && (
        <IOSInstallModal onClose={() => setShowIOSModal(false)} />
      )}
    </>
  );
};

// Modal instructions for iOS Safari and other browsers
const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-[#D4AF37]/40 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#10b981] p-0.5 shadow-md">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#D4AF37]" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Install Aqari App</h3>
            <p className="text-xs text-[#D4AF37] font-arabic font-medium">تثبيت تطبيق عقاري على جهازك</p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed mb-4">
          Install Aqari directly to your home screen for instant full-screen access, lightning speed, and offline property intelligence.
        </p>

        {/* Step-by-step instructions */}
        <div className="space-y-3 p-3.5 bg-white/[0.03] rounded-2xl border border-white/[0.08] mb-5">
          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <div className="text-white font-medium flex items-center gap-1.5">
                <span>Tap the</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-emerald-400 font-mono">
                  <Share2 className="w-3 h-3" /> Share
                </span>
                <span>button</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">At the bottom of Safari or browser menu</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <div className="text-white font-medium flex items-center gap-1.5">
                <span>Scroll down & tap</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[#D4AF37] font-mono">
                  <PlusSquare className="w-3 h-3" /> Add to Home Screen
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">"إضافة إلى الصفحة الرئيسية"</p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <div className="text-white font-medium">Tap "Add" in top-right corner</div>
              <p className="text-[11px] text-zinc-400 mt-0.5">Aqari will appear right alongside your apps</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer min-h-[44px]"
        >
          Got it / فهمت
        </button>
      </div>
    </div>
  );
};
