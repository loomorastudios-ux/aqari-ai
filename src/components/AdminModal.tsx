import React, { useState } from 'react';
import { RemoteConfig } from '../types';
import { CONFIG_URL } from '../constants';
import { 
  X, 
  Settings, 
  Key, 
  Save, 
  Copy, 
  Check, 
  RefreshCw, 
  Flame, 
  AlertTriangle, 
  DollarSign, 
  Bell,
  Code
} from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: RemoteConfig;
  onSaveConfig: (updated: RemoteConfig) => void;
  onResetConfig: () => void;
  onTestUnlock?: (plan: 'starter' | 'pro' | 'enterprise') => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetConfig,
  onTestUnlock,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);

  // Form State
  const [starterPrice, setStarterPrice] = useState(config.prices.starter);
  const [proPrice, setProPrice] = useState(config.prices.pro);
  const [enterprisePrice, setEnterprisePrice] = useState(config.prices.enterprise);

  const [discountActive, setDiscountActive] = useState(config.discount.active);
  const [discountPercent, setDiscountPercent] = useState(config.discount.percent);
  const [discountCode, setDiscountCode] = useState(config.discount.code);
  const [discountBanner, setDiscountBanner] = useState(config.discount.banner);

  const [announcementActive, setAnnouncementActive] = useState(config.announcement.active);
  const [announcementText, setAnnouncementText] = useState(config.announcement.text);
  const [announcementType, setAnnouncementType] = useState(config.announcement.type);

  const [maintenance, setMaintenance] = useState(config.maintenance);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'aqari2026') {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleSave = () => {
    const updated: RemoteConfig = {
      prices: {
        starter: Number(starterPrice),
        pro: Number(proPrice),
        enterprise: Number(enterprisePrice),
      },
      discount: {
        active: discountActive,
        percent: Number(discountPercent),
        code: discountCode.trim(),
        banner: discountBanner.trim(),
      },
      announcement: {
        active: announcementActive,
        text: announcementText.trim(),
        type: announcementType,
      },
      maintenance,
    };

    onSaveConfig(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const currentJsonString = JSON.stringify(
    {
      prices: {
        starter: Number(starterPrice),
        pro: Number(proPrice),
        enterprise: Number(enterprisePrice),
      },
      discount: {
        active: discountActive,
        percent: Number(discountPercent),
        code: discountCode.trim(),
        banner: discountBanner.trim(),
      },
      announcement: {
        active: announcementActive,
        text: announcementText.trim(),
        type: announcementType,
      },
      maintenance,
    },
    null,
    2
  );

  const handleCopyJson = () => {
    navigator.clipboard.writeText(currentJsonString);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      
      <div className="relative w-full max-w-2xl rounded-[32px] glass-dropdown p-6 sm:p-8 border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Auth Gate if not logged in */}
        {!isAuthenticated ? (
          <div className="p-4 sm:p-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto shadow-md">
              <Key className="w-6 h-6 text-[#D4AF37]" />
            </div>

            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Terminal Admin Console
              </h3>
              <p className="text-xs text-zinc-400 mt-1 font-mono">
                Enter master administrative passcode to configure live pricing and remote broadcasts.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="max-w-xs mx-auto space-y-3">
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(false);
                }}
                placeholder="Master Passcode (aqari2026)"
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#D4AF37] text-white text-xs font-mono text-center tracking-widest outline-none"
              />

              {authError && (
                <div className="text-xs text-rose-400 font-mono">
                  Incorrect passcode. Hint: aqari2026
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono tracking-wider transition cursor-pointer"
              >
                Authenticate & Unlock
              </button>
            </form>
          </div>
        ) : (
          /* Admin Form Content */
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            
            <div className="border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37]">
                <Settings className="w-4 h-4 text-[#D4AF37]" />
                <span>LIVE REMOTE CONFIG CONTROLLER</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight mt-1">
                Aqari Global Config
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Target endpoint: <code className="text-zinc-300 break-all">{CONFIG_URL}</code>
              </p>
            </div>

            {(import.meta.env.VITE_LEMON_TEST_MODE === 'true' || import.meta.env.VITE_LEMON_TEST_MODE === true) && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center justify-between gap-2">
                <span>⚠️ LEMON SQUEEZY TEST MODE ACTIVE</span>
                <span className="font-bold underline">Use test card: 4242 4242 4242 4242</span>
              </div>
            )}

            {savedSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Config updated locally. To push to all users worldwide, copy the JSON below to your GitHub config.json.</span>
              </div>
            )}

            {/* Section 1: Prices */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <DollarSign className="w-4 h-4 text-[#D4AF37]" />
                <span>Base USD Prices (Automatically converted to OMR, AED, GBP)</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">Starter Tier ($)</label>
                  <input
                    type="number"
                    value={starterPrice}
                    onChange={(e) => setStarterPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">Pro Tier ($)</label>
                  <input
                    type="number"
                    value={proPrice}
                    onChange={(e) => setProPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">Enterprise ($)</label>
                  <input
                    type="number"
                    value={enterprisePrice}
                    onChange={(e) => setEnterprisePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Discount & Campaign */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>Discount & Promo Banner</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-zinc-300">
                  <input
                    type="checkbox"
                    checked={discountActive}
                    onChange={(e) => setDiscountActive(e.target.checked)}
                    className="accent-[#D4AF37] w-4 h-4 cursor-pointer"
                  />
                  <span>Active Campaign</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">Discount Percent (%)</label>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-zinc-400 block mb-1">Promo Code (LemonSqueezy)</label>
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-1">Banner Announcement Text</label>
                <input
                  type="text"
                  value={discountBanner}
                  onChange={(e) => setDiscountBanner(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
                />
              </div>
            </div>

            {/* Section 3: Bottom Toast Announcement */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span>Bottom Floating Toast</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-zinc-300">
                  <input
                    type="checkbox"
                    checked={announcementActive}
                    onChange={(e) => setAnnouncementActive(e.target.checked)}
                    className="accent-cyan-400 w-4 h-4 cursor-pointer"
                  />
                  <span>Show Toast</span>
                </label>
              </div>

              <input
                type="text"
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-white text-xs font-mono"
              />
            </div>

            {/* Section 4: Maintenance Switch */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Emergency Maintenance Mode</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  Overlays terminal with maintenance screen.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-rose-400 font-bold">
                <input
                  type="checkbox"
                  checked={maintenance}
                  onChange={(e) => setMaintenance(e.target.checked)}
                  className="accent-rose-500 w-4 h-4 cursor-pointer"
                />
                <span>Enable Maintenance</span>
              </label>
            </div>

            {/* Admin Testing Sandbox (Kept strictly for Admin) */}
            {onTestUnlock && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                <div className="text-xs font-mono font-bold text-amber-300 flex items-center justify-between">
                  <span>ADMIN TESTING SANDBOX (No Payment)</span>
                  <span className="text-[10px] text-zinc-400">Hidden from production users</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onTestUnlock('starter');
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono transition cursor-pointer"
                  >
                    Unlock Starter (50 Analyses)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onTestUnlock('pro');
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-bold text-xs font-mono transition cursor-pointer"
                  >
                    Unlock Pro (400 Analyses)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onTestUnlock('enterprise');
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono transition cursor-pointer"
                  >
                    Unlock Enterprise (Unlimited)
                  </button>
                </div>
              </div>
            )}

            {/* JSON Output & Copy */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase text-zinc-400 flex items-center gap-1">
                  <Code className="w-3.5 h-3.5" />
                  <span>GitHub config.json Payload</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-black text-[11px] font-mono transition flex items-center gap-1 cursor-pointer text-white"
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-zinc-400 p-2.5 rounded bg-black border border-white/5 overflow-x-auto max-h-32">
                {currentJsonString}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onResetConfig}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-mono transition cursor-pointer"
              >
                Reset to Defaults
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white text-xs font-mono transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold text-xs font-mono tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Config Locally</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
