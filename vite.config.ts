import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const SSR_ROUTE_MAP: Record<string, string> = {
  '/api/me': '/api/me.ts',
  '/api/auth/session': '/api/auth/session.ts',
  '/api/checkout': '/api/checkout.ts',
  '/api/checkout/verify': '/api/checkout/verify.ts',
  '/api/analyze': '/api/analyze.ts',
  '/api/save': '/api/save.ts',
  '/api/export': '/api/export.ts',
  '/api/portfolio': '/api/portfolio.ts',
  '/api/user/license': '/api/user/license.ts',
  '/api/debug/my-plan': '/api/debug/my-plan.ts',
  '/api/news': '/api/news.ts',
  '/api/cron/check-expiry': '/api/cron/check-expiry.ts',
  '/api/test/email-day29': '/api/test/email-day29.ts',
  '/api/webhooks/lemonsqueezy': '/api/webhooks/lemonsqueezy.ts',
  '/api/webhooks/logs': '/api/webhooks/logs.ts',
  '/api/admin/users': '/api/admin/users.ts',
  '/api/admin/pricing': '/api/admin/pricing.ts',
  '/api/pricing': '/api/pricing.ts',
};

function readRequestBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      resolve('');
      return;
    }
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

function attachResponseShims(res: any) {
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = (data: any) => {
    if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
      res.end(data);
      return res;
    }
    if (typeof data === 'object') {
      return res.json(data);
    }
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.end(String(data));
    return res;
  };
  return res;
}

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers?.host || 'localhost:3000'}`);
        const pathname = parsedUrl.pathname;
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());
        attachResponseShims(res);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // 1. /api/market/live (async live fetch with 6h server cache)
        if (pathname === '/api/market/live') {
          try {
            const mod = await server.ssrLoadModule('/api/market/live.ts');
            if (typeof mod.default === 'function') {
              await mod.default(req, res);
              return;
            }
          } catch (e: any) {
            console.error('API /api/market/live dev error:', e);
            return res.status(500).json({ error: e?.message || 'Market feed failed' });
          }
        }

        // 2. /api/demo/:slug
        if (pathname.startsWith('/api/demo/')) {
          try {
            const slug = pathname.replace('/api/demo/', '').split('/')[0];
            const mod = await server.ssrLoadModule('/src/constants/demoAnalyses.ts');
            const demo = mod.DEMO_ANALYSES?.[slug];
            if (demo) {
              return res.status(200).json({ success: true, demo });
            }
            return res.status(404).json({ error: 'Demo not found', available: Object.keys(mod.DEMO_ANALYSES || {}) });
          } catch (e: any) {
            console.error('API /api/demo dev error:', e);
            return res.status(500).json({ error: e?.message || 'Demo route failed' });
          }
        }

        // 3. Dynamic Admin User / Evidence PDF routes
        if (pathname.startsWith('/api/admin/user/')) {
          try {
            req.query.email = decodeURIComponent(pathname.replace('/api/admin/user/', '').split('/')[0]);
            const rawBody = await readRequestBody(req);
            req.rawBody = rawBody;
            try {
              req.body = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              req.body = rawBody;
            }
            const mod = await server.ssrLoadModule('/api/admin/user/[email].ts');
            await mod.default(req, res);
            return;
          } catch (err: any) {
            console.error(`API ${pathname} dev error:`, err);
            return res.status(500).json({ error: err?.message || 'Admin user API error' });
          }
        }

        if (pathname.startsWith('/api/admin/export/')) {
          try {
            req.query.email = decodeURIComponent(pathname.replace('/api/admin/export/', '').split('/')[0]);
            const mod = await server.ssrLoadModule('/api/admin/export/[email].ts');
            await mod.default(req, res);
            return;
          } catch (err: any) {
            console.error(`API ${pathname} dev error:`, err);
            return res.status(500).json({ error: err?.message || 'Admin export API error' });
          }
        }

        // 4. Static Mapped API handlers
        const modulePath = SSR_ROUTE_MAP[pathname];
        if (modulePath) {
          try {
            const rawBody = await readRequestBody(req);
            req.rawBody = rawBody;
            try {
              req.body = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              req.body = rawBody;
            }
            const mod = await server.ssrLoadModule(modulePath);
            if (typeof mod.default === 'function') {
              await mod.default(req, res);
              return;
            }
          } catch (err: any) {
            console.error(`API ${pathname} dev error:`, err);
            return res.status(500).json({ error: err?.message || 'Internal API error' });
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    publicDir: 'public',
    plugins: [react(), tailwindcss(), devApiPlugin()],
    define: {
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''),
      'process.env.GOOGLE_REDIRECT_URI': JSON.stringify(process.env.GOOGLE_REDIRECT_URI || process.env.VITE_GOOGLE_REDIRECT_URI || ''),
      'process.env.LEMON_TEST_MODE': JSON.stringify(process.env.LEMON_TEST_MODE || 'true'),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
