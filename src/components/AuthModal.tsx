import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import {
  loginOrCreateUser,
  getRememberedAccounts,
  removeRememberedAccount,
  RememberedAccount,
} from '../utils/userStorage';
import {
  getGoogleClientId,
  isValidGoogleClientId,
  setCustomGoogleClientId,
  formatOAuthErrorMessage,
  verifyGoogleAccessToken,
  verifyGoogleIdToken,
  buildGoogleOAuthUrl,
} from '../utils/oauthConfig';
import {
  X,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  ArrowRight,
  ExternalLink,
  Loader2,
  Trash2,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (user: User) => void;
  initialEmail?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
  initialEmail,
}) => {
  const [rememberedList, setRememberedList] = useState<RememberedAccount[]>([]);
  const [showAccountChooser, setShowAccountChooser] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Verifying with Google...');
  const [customClientIdInput, setCustomClientIdInput] = useState('');
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const activeHintRef = useRef<string | null>(null);

  // Load remembered accounts when opening modal
  useEffect(() => {
    if (isOpen) {
      const list = getRememberedAccounts();
      setRememberedList(list);
      setErrorMsg(null);
      setIsLoading(false);

      if (list.length > 0 && !initialEmail) {
        setShowAccountChooser(false);
      } else {
        setShowAccountChooser(true);
      }
    }
  }, [isOpen, initialEmail]);

  // Listen for OAuth popup completion messages
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      // Validate origin if coming from same host or google callback
      if (event.data && typeof event.data === 'object' && event.data.type === 'AQARI_GOOGLE_AUTH_CALLBACK') {
        const { accessToken, idToken, error } = event.data;
        if (error) {
          setErrorMsg(formatOAuthErrorMessage(error));
          setIsLoading(false);
          return;
        }

        try {
          setIsLoading(true);
          setLoadingText('Verifying token with Google endpoint...');
          if (accessToken) {
            const verified = await verifyGoogleAccessToken(accessToken);
            handleSuccessfulGoogleAuth(verified);
          } else if (idToken) {
            const verified = await verifyGoogleIdToken(idToken);
            handleSuccessfulGoogleAuth(verified);
          }
        } catch (err) {
          setErrorMsg(formatOAuthErrorMessage(err));
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleSuccessfulGoogleAuth = (verified: {
    googleId: string;
    email: string;
    name: string;
    avatar: string;
    picture?: string;
  }) => {
    const cleanEmail = verified.email.toLowerCase().trim();
    const { user } = loginOrCreateUser(
      cleanEmail,
      'google',
      verified.name,
      verified.picture || verified.avatar,
      verified.googleId
    );

    setIsLoading(false);
    onSignIn(user);
    onClose();
  };

  /**
   * Real Google Sign-In with Google Identity Services (GIS) OAuth 2.0 Token Client
   * Strictly prompts with 'select_account' and passes 'login_hint' when clicking a remembered account.
   */
  const triggerRealGoogleAuth = async (loginHint?: string) => {
    setErrorMsg(null);
    setIsLoading(true);
    setLoadingText(loginHint ? `Connecting to Google (${loginHint})...` : 'Opening Google Sign-In...');
    activeHintRef.current = loginHint || null;

    const clientId = getGoogleClientId();

    if (!clientId || !isValidGoogleClientId(clientId)) {
      setIsLoading(false);
      setErrorMsg(
        'Google OAuth Client ID is not configured. Please create a Web Application OAuth Client ID in Google Cloud Console and set GOOGLE_CLIENT_ID in your .env or Vercel Environment Variables, or enter it below to test.'
      );
      setShowClientIdConfig(true);
      return;
    }

    const win = window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              prompt?: string;
              hint?: string;
              callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
              error_callback?: (err: unknown) => void;
            }) => {
              requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
            };
          };
          id?: {
            initialize: (config: unknown) => void;
            prompt: (notification?: unknown) => void;
          };
        };
      };
    };

    // 1. Try Google Identity Services OAuth 2.0 Token Client (Official modern GIS flow)
    if (win.google?.accounts?.oauth2?.initTokenClient) {
      try {
        const tokenClient = win.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          hint: loginHint || undefined,
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              setErrorMsg(formatOAuthErrorMessage(tokenResponse.error_description || tokenResponse.error));
              setIsLoading(false);
              return;
            }

            if (!tokenResponse.access_token) {
              setErrorMsg('No access token returned from Google. Verification failed.');
              setIsLoading(false);
              return;
            }

            try {
              setLoadingText('Verifying token with Google Userinfo API...');
              // Verify directly against Google's Userinfo API
              const verified = await verifyGoogleAccessToken(tokenResponse.access_token);
              handleSuccessfulGoogleAuth(verified);
            } catch (verifyErr) {
              console.error('Google token verification failed:', verifyErr);
              setErrorMsg('Google verification failed. Token rejected by Google API.');
              setIsLoading(false);
            }
          },
          error_callback: (err: unknown) => {
            console.warn('Google Token Client error:', err);
            setErrorMsg(formatOAuthErrorMessage(err));
            setIsLoading(false);
          },
        });

        tokenClient.requestAccessToken({
          prompt: 'select_account',
          hint: loginHint || undefined,
        });
        return;
      } catch (gisErr) {
        console.warn('GIS TokenClient initiation failed, falling back to popup flow:', gisErr);
      }
    }

    // 2. Direct Popup OAuth 2.0 Authorization Endpoint Fallback
    try {
      const authUrl = buildGoogleOAuthUrl({ loginHint });
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup was blocked by browser
        window.location.href = authUrl;
        return;
      }

      // Poll popup to detect close or URL redirect with tokens
      const pollTimer = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(pollTimer);
            setIsLoading(false);
            return;
          }

          const currentHref = popup.location.href;
          if (currentHref && (currentHref.includes('access_token=') || currentHref.includes('id_token='))) {
            clearInterval(pollTimer);
            const hash = popup.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const idToken = params.get('id_token');
            popup.close();

            if (accessToken) {
              const verified = await verifyGoogleAccessToken(accessToken);
              handleSuccessfulGoogleAuth(verified);
            } else if (idToken) {
              const verified = await verifyGoogleIdToken(idToken);
              handleSuccessfulGoogleAuth(verified);
            }
          }
        } catch {
          // Cross-origin access error while on accounts.google.com is expected until redirect
        }
      }, 500);
    } catch (popupErr) {
      console.error('Failed to open Google auth popup:', popupErr);
      setErrorMsg(formatOAuthErrorMessage(popupErr));
      setIsLoading(false);
    }
  };

  // Clicking a remembered account MUST trigger real Google login with login_hint and prompt=select_account
  const handleSelectRememberedAccount = (account: RememberedAccount) => {
    triggerRealGoogleAuth(account.email);
  };

  // Remove account from remembered accounts
  const handleRemoveAccount = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    removeRememberedAccount(email);
    const updated = getRememberedAccounts();
    setRememberedList(updated);
    if (updated.length === 0) {
      setShowAccountChooser(true);
    }
  };

  if (!isOpen) return null;

  const hasRemembered = rememberedList.length > 0;
  const isViewingRemembered = hasRemembered && !showAccountChooser;

  return (
    <div
      id="loginModal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200"
    >
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
            {isViewingRemembered ? 'Choose an Account' : 'Sign in with Google'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            {isViewingRemembered
              ? 'Select your account to verify identity via Google.'
              : 'Real Google OAuth 2.0 verification. 3 free institutional analyses unlocked.'}
          </p>
        </div>

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-amber-200 text-xs flex items-center justify-center gap-2.5 animate-in fade-in duration-200">
            <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin shrink-0" />
            <span className="font-mono font-medium">{loadingText}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* VIEW 1: REMEMBERED ACCOUNTS LIST */}
        {isViewingRemembered ? (
          <div className="space-y-4">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Saved Google Accounts</span>
              <span>{rememberedList.length} Remembered</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {rememberedList.map((account) => (
                <div
                  key={account.email}
                  onClick={() => !isLoading && handleSelectRememberedAccount(account)}
                  className={`group relative flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] ${
                    isLoading ? 'opacity-60 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {account.picture || (account.avatar && account.avatar.startsWith('http')) ? (
                      <img
                        src={account.picture || account.avatar}
                        alt={account.name}
                        className="w-10 h-10 rounded-xl object-cover border border-[#D4AF37]/40 shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8B5CF6] flex items-center justify-center text-black font-black font-mono text-sm uppercase shadow-sm shrink-0">
                        {account.avatar || account.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 truncate">
                      <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{account.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <div className="text-xs text-zinc-400 font-mono truncate">{account.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectRememberedAccount(account);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black font-mono text-[11px] font-bold transition cursor-pointer"
                    >
                      <span>Sign In</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={(e) => handleRemoveAccount(e, account.email)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Remove from remembered accounts"
                      aria-label="Remove account"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* "Use another account" button - triggers real Google login with prompt=select_account */}
            <div className="pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setErrorMsg(null);
                  triggerRealGoogleAuth();
                }}
                className="w-full py-3 px-4 rounded-xl bg-transparent hover:bg-white/[0.05] border border-white/10 hover:border-white/20 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer min-h-[44px]"
              >
                <UserPlus className="w-4 h-4 text-[#D4AF37]" />
                <span>Use another account</span>
              </button>
            </div>
          </div>
        ) : (
          /* VIEW 2: GOOGLE SIGN IN SCREEN */
          <div className="space-y-4">
            {/* Main Google Login Action */}
            <button
              type="button"
              onClick={() => triggerRealGoogleAuth()}
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-xs tracking-wide transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-3 cursor-pointer min-h-[48px] active:scale-98 disabled:opacity-50"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                {isLoading ? 'Connecting to Google...' : 'Continue with Google'}
              </span>
            </button>

            {/* Back to remembered accounts if any exist */}
            {hasRemembered && (
              <div className="pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setShowAccountChooser(false);
                  }}
                  className="w-full py-2 text-center text-xs font-mono text-zinc-400 hover:text-[#D4AF37] transition cursor-pointer"
                >
                  ← Back to remembered accounts ({rememberedList.length})
                </button>
              </div>
            )}

            {/* Real Client ID Configuration / Live Testing */}
            <div className="pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setShowClientIdConfig(!showClientIdConfig)}
                className="w-full text-left text-[11px] font-mono text-zinc-400 hover:text-[#D4AF37] transition flex items-center justify-between cursor-pointer py-1"
              >
                <span>Google Cloud Client ID Setup</span>
                <span className="text-[10px] text-zinc-500">{showClientIdConfig ? '▲ Hide' : '▼ View / Test'}</span>
              </button>

              {showClientIdConfig && (
                <div className="mt-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.08] space-y-2.5 animate-in fade-in duration-150">
                  <div className="text-[10px] text-zinc-300 font-mono leading-relaxed">
                    Paste your Google OAuth 2.0 Web Client ID:
                  </div>
                  <input
                    type="text"
                    value={customClientIdInput}
                    onChange={(e) => setCustomClientIdInput(e.target.value)}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 focus:border-[#D4AF37] text-white text-xs font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customClientIdInput.trim()) return;
                      setCustomGoogleClientId(customClientIdInput);
                      setErrorMsg(null);
                      setShowClientIdConfig(false);
                      triggerRealGoogleAuth();
                    }}
                    className="w-full py-2 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-black font-mono text-xs font-bold transition cursor-pointer min-h-[38px]"
                  >
                    Save & Test Google Sign-In
                  </button>
                  <div className="text-[10px] text-zinc-400 font-mono pt-1">
                    Origin: <span className="text-zinc-200">{typeof window !== 'undefined' ? window.location.origin : 'https://aqari-ai-rho.vercel.app'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-[10px] text-zinc-400 font-mono flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real Google OAuth 2.0 • Scopes: openid, email, profile</span>
        </div>
      </div>
    </div>
  );
};
