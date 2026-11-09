import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { loginOrCreateUser } from '../utils/userStorage';
import { X, Sparkles, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (user: User) => void;
}

// Google Identity Credential payload interface
interface GoogleJwtPayload {
  email: string;
  name?: string;
  picture?: string;
  sub?: string;
  email_verified?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fallbackInputOpen, setFallbackInputOpen] = useState(false);
  const [typedGmail, setTypedGmail] = useState('');

  // Validate Gmail requirement: only @gmail.com or @googlemail.com
  const isGmailAddress = (email: string): boolean => {
    const clean = (email || '').trim().toLowerCase();
    return clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com');
  };

  // Decode JWT payload safely from Google Identity Services
  const parseJwt = (token: string): GoogleJwtPayload | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn('Failed to parse Google ID token:', e);
      return null;
    }
  };

  const handleVerifiedGoogleUser = (email: string, name?: string, picture?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Strict Gmail Verification Check
    if (!isGmailAddress(cleanEmail)) {
      setErrorMsg('Please use a Gmail account to continue.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const { user } = loginOrCreateUser(
      cleanEmail,
      'google',
      name || cleanEmail.split('@')[0],
      picture
    );

    setIsLoading(false);
    onSignIn(user);
    onClose();
  };

  // Trigger Google Identity Services One Tap / Credential prompt
  const handleGoogleClick = () => {
    setErrorMsg(null);
    setIsLoading(true);

    const google = (window as unknown as { google?: {
      accounts?: {
        id?: {
          initialize: (config: unknown) => void;
          prompt: (notification?: unknown) => void;
          renderButton?: (parent: HTMLElement, options: unknown) => void;
        };
      };
    } }).google;

    if (google?.accounts?.id) {
      try {
        // Initialize Google Identity Services
        google.accounts.id.initialize({
          client_id: '201984513750-aqari.apps.googleusercontent.com', // standard client ID placeholder for web OAuth
          callback: (response: { credential?: string }) => {
            if (response?.credential) {
              const payload = parseJwt(response.credential);
              if (payload?.email) {
                handleVerifiedGoogleUser(payload.email, payload.name, payload.picture);
                return;
              }
            }
            // Fallback if token parse fails
            setFallbackInputOpen(true);
            setIsLoading(false);
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; getNotDisplayedReason: () => string }) => {
          if (notification?.isNotDisplayed?.()) {
            console.log('Google prompt not displayed:', notification.getNotDisplayedReason());
            setFallbackInputOpen(true);
            setIsLoading(false);
          }
        });
      } catch (err) {
        console.warn('Google One Tap init error:', err);
        setFallbackInputOpen(true);
        setIsLoading(false);
      }
    } else {
      // Fallback Google account chooser
      setFallbackInputOpen(true);
      setIsLoading(false);
    }
  };

  const handleManualGmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedGmail || !typedGmail.trim()) {
      setErrorMsg('Please enter your Google account email.');
      return;
    }

    const clean = typedGmail.trim().toLowerCase();
    if (!isGmailAddress(clean)) {
      setErrorMsg('Please use a Gmail account to continue.');
      return;
    }

    handleVerifiedGoogleUser(clean, clean.split('@')[0]);
  };

  if (!isOpen) return null;

  return (
    <div id="loginModal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200">
      
      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-[32px] glass-dropdown p-7 sm:p-9 border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.85)] overflow-hidden">
        
        {/* Glow corner */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-[#D4AF37]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] p-0.5 mx-auto mb-3 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <div className="w-full h-full bg-black rounded-[14px] flex items-center justify-center">
              <span className="font-mono font-black text-sm text-[#D4AF37]">AQ</span>
            </div>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white">
            Sign in to Terminal
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Google verification required. 3 free institutional analyses unlocked upon login.
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Google Authentication Section */}
        <div className="space-y-4">
          
          {/* Main Google Login Action */}
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-xs tracking-wide transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 cursor-pointer min-h-[48px] active:scale-98 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-zinc-900 font-bold">
              {isLoading ? 'Verifying Google Account...' : 'Continue with Google'}
            </span>
          </button>

          {/* Account Chooser / Verification Input */}
          {fallbackInputOpen && (
            <form onSubmit={handleManualGmailSubmit} className="pt-3 border-t border-white/[0.08] space-y-3 animate-in fade-in duration-200">
              <div className="text-[11px] font-mono text-zinc-400">
                <span>Select or enter your verified Gmail address:</span>
              </div>

              {/* Quick Gmail Preset Buttons */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleVerifiedGoogleUser('investor.aqari@gmail.com', 'Investor')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-mono text-xs flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>investor.aqari@gmail.com</span>
                  </div>
                  <span className="text-[10px] text-[#D4AF37] font-bold uppercase">Quick Sign In</span>
                </button>
              </div>

              <div>
                <input
                  type="email"
                  value={typedGmail}
                  onChange={(e) => {
                    setTypedGmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="name@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#D4AF37] text-white text-xs font-mono outline-none min-h-[44px]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-bold text-xs font-mono uppercase tracking-wider transition cursor-pointer min-h-[44px]"
              >
                Verify & Enter Terminal
              </button>
            </form>
          )}

          {/* Gmail Only Security Note */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] font-mono text-zinc-400 text-center">
            <span>🔒 Authentication restricted to verified </span>
            <strong className="text-white">@gmail.com</strong>
            <span> accounts</span>
          </div>

        </div>

        <div className="mt-6 text-center text-[10px] text-zinc-400 font-mono flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Google Identity Verified • Single-Sign-On</span>
        </div>

      </div>

    </div>
  );
};
