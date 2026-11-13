import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Serverless / Edge handler for Google OAuth 2.0 callback
 * URL: https://aqari-ai-rho.vercel.app/api/auth/callback/google
 */
export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '', `http://${req.headers?.host || 'localhost:3000'}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
          <h2>Google Authentication Error</h2>
          <p style="color:#f87171;">${error}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'AQARI_GOOGLE_AUTH_CALLBACK', error: ${JSON.stringify(error)} }, '*');
              window.close();
            } else {
              setTimeout(() => { window.location.href = '/#/landing'; }, 2500);
            }
          </script>
        </body>
      </html>
    `);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/callback/google`;

  if (code && clientId && clientSecret) {
    try {
      // Exchange code for tokens with Google's OAuth 2.0 token endpoint
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed: ${errText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      const idToken = tokenData.id_token;

      // Verify directly with Google Userinfo API
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        throw new Error('Failed to verify token with Google userinfo API');
      }

      const userData = await userRes.json();

      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authenticating...</title></head>
          <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
            <p>Verification successful. Redirecting to AQARI Terminal...</p>
            <script>
              const payload = {
                type: 'AQARI_GOOGLE_AUTH_CALLBACK',
                accessToken: ${JSON.stringify(accessToken)},
                idToken: ${JSON.stringify(idToken)},
                user: ${JSON.stringify(userData)}
              };
              if (window.opener) {
                window.opener.postMessage(payload, '*');
                window.close();
              } else {
                window.location.href = '/#access_token=' + encodeURIComponent(${JSON.stringify(accessToken)}) + '&id_token=' + encodeURIComponent(${JSON.stringify(idToken)});
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('OAuth Callback Error:', err);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family:sans-serif; background:#000; color:#fff; text-align:center; padding:50px;">
            <h2>Verification Failed</h2>
            <p style="color:#f87171;">${err?.message || 'Authentication error'}</p>
            <a href="/#/landing" style="color:#D4AF37;">Back to AQARI</a>
          </body>
        </html>
      `);
    }
  }

  // Fallback direct redirect to app
  res.writeHead(302, { Location: '/#/landing' });
  res.end();
}
