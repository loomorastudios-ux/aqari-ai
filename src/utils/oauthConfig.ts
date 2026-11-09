/**
 * Google OAuth Configuration and Helper Utilities
 * Reads credentials securely from environment variables (never hardcoded).
 */

export const getGoogleClientId = (): string => {
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
    return window.location.origin;
  }
  return '';
};

export const formatOAuthErrorMessage = (rawError: string | Error | unknown): string => {
  const text = typeof rawError === 'string' ? rawError : (rawError as Error)?.message || '';

  if (text.includes('invalid_client') || text.includes('OAuth client was not found') || text.includes('401')) {
    return 'Google OAuth Error (401: invalid_client): The OAuth client ID was not found or is misconfigured in Google Cloud Console. Verify GOOGLE_CLIENT_ID and authorized origins.';
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
