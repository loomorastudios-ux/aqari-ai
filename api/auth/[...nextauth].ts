/**
 * NextAuth.js Configuration for Vercel Deployment
 * Using GoogleProvider with real OAuth 2.0
 * Scopes: openid, email, profile
 * Prompt: select_account
 */

export const authOptions = {
  providers: [
    {
      id: 'google',
      name: 'Google',
      type: 'oauth' as const,
      wellKnown: 'https://accounts.google.com/.well-known/openid-configuration',
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
          response_type: 'code',
        },
      },
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      profile(profile: any) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async session({ session, token }: any) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.googleId = token.sub;
      }
      return session;
    },
    async jwt({ token, account, profile }: any) {
      if (account && profile) {
        token.googleId = profile.sub;
      }
      return token;
    },
  },
};

export default async function handler(req: any, res: any) {
  // Simple JSON provider info endpoint for Vercel functions
  if (req.method === 'GET' && req.url?.includes('/providers')) {
    return res.status(200).json({
      google: {
        id: 'google',
        name: 'Google',
        type: 'oauth',
        signinUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        callbackUrl: 'https://aqari-ai-rho.vercel.app/api/auth/callback/google',
      },
    });
  }

  return res.status(200).json({ status: 'NextAuth endpoint active' });
}
