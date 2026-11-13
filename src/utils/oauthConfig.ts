/**
 * Real Google OAuth 2.0 Configuration and Verification Utilities
 * Strictly uses official Google OAuth endpoints:
 * - https://accounts.google.com/o/oauth2/v2/auth
 * - https://www.googleapis.com/oauth2/v3/userinfo
 * - https://oauth2.googleapis.com/tokeninfo
 *
 * Scopes: openid, email, profile
 * Prompt: select_account
 */

export interface GoogleVerifiedUser {
  googleId: string;
  email: string;
  name: string;
  avatar: string;
  picture?: string;
  emailVerified: boolean;
}

export const isValidGoogleClientId = (id?: string | null): boolean => {
  if (!id) return false;
  const clean = id.trim();
  if (
    clean.startsWith('XXXX') ||
    clean.includes('الجديد') ||
    clean.includes('YOUR_') ||
    clean.includes('MY_') ||
    clean.length < 15
  ) {
    return false;
  }
  return clean.includes('.apps.googleusercontent.com') || clean.length > 20;
};

export const setCustomGoogleClientId = (id: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('aqari_custom_google_client_id', id.trim());
  }
};

export const getGoogleClientId = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('aqari_custom_google_client_id');
    if (custom && isValidGoogleClientId(custom)) {
      return custom.trim();
    }
  }

  const fromEnv =
    (typeof process !== 'undefined' && process.env?.GOOGLE_CLIENT_ID) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
    '';
  return fromEnv.trim();
};

export const getGoogleRedirectUri = (): string => {
  const fromEnv =
    (typeof process !== 'undefined' && process.env?.GOOGLE_REDIRECT_URI) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_REDIRECT_URI) ||
    '';
  if (fromEnv.trim()) {
    return fromEnv.trim();
  }
  if (typeof window !== 'undefined') {
    // If running on Vercel deployment, prioritize configured Vercel URL
    if (window.location.hostname.includes('vercel.app')) {
      return 'https://aqari-ai-rho.vercel.app/api/auth/callback/google';
    }
    return window.location.origin;
  }
  return 'https://aqari-ai-rho.vercel.app/api/auth/callback/google';
};

/**
 * Verify Access Token directly against Google's Userinfo API
 * Endpoint: https://www.googleapis.com/oauth2/v3/userinfo
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleVerifiedUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token verification failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.email) {
    throw new Error('Google userinfo response did not include a verified email address.');
  }

  const name = data.name || data.email.split('@')[0];
  const avatar = data.picture || name.charAt(0).toUpperCase();

  return {
    googleId: data.sub || data.id,
    email: data.email.toLowerCase().trim(),
    name,
    avatar,
    picture: data.picture,
    emailVerified: Boolean(data.email_verified),
  };
}

/**
 * Verify ID Token directly against Google's Tokeninfo API
 * Endpoint: https://oauth2.googleapis.com/tokeninfo?id_token=...
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleVerifiedUser> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google ID token verification failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.email) {
    throw new Error('Google tokeninfo response did not include a valid email.');
  }

  const name = data.name || data.email.split('@')[0];
  const avatar = data.picture || name.charAt(0).toUpperCase();

  return {
    googleId: data.sub,
    email: data.email.toLowerCase().trim(),
    name,
    avatar,
    picture: data.picture,
    emailVerified: data.email_verified === 'true' || Boolean(data.email_verified),
  };
}

/**
 * Generate standard Google OAuth 2.0 URL
 */
export function buildGoogleOAuthUrl(options?: { loginHint?: string; state?: string }): string {
  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri();
  const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const state = options?.state || 'aqari_auth_' + Date.now();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token id_token',
    scope: 'openid email profile',
    prompt: 'select_account',
    nonce,
    state,
  });

  if (options?.loginHint) {
    params.set('login_hint', options.loginHint.trim().toLowerCase());
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export const formatOAuthErrorMessage = (rawError: string | Error | unknown): string => {
  const text = typeof rawError === 'string' ? rawError : (rawError as Error)?.message || '';

  if (
    text.includes('invalid_client') ||
    text.includes('OAuth client was not found') ||
    text.includes('401')
  ) {
    return 'Google OAuth Error (401: invalid_client): The OAuth client was not found in Google Cloud Console. Ensure your new OAuth 2.0 Web Client ID is configured in .env and Vercel environment variables.';
  }

  if (text.includes('idpiframe_initialization_failed') || text.includes('origin_mismatch')) {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'this URL';
    return `Authorized JavaScript origin mismatch. Please add "${currentOrigin}" to Authorized JavaScript origins in Google Cloud Console.`;
  }

  if (text.includes('popup_closed_by_user') || text.includes('access_denied')) {
    return 'Sign-in cancelled by user.';
  }

  return text || 'Google sign-in encountered an error. Please try again.';
};
