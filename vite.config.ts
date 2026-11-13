import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const SSR_ROUTE_MAP: Record<string, string> = {
  '/api/app': '/api/app.ts',
  '/api/admin': '/api/admin.ts',
  '/api/webhooks/lemonsqueezy': '/api/webhooks/lemonsqueezy.ts',
  '/api/cron/check-expiry': '/api/cron/check-expiry.ts',
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
        let pathname = parsedUrl.pathname;
        req.query = Object.fromEntries(parsedUrl.searchParams.entries());
        attachResponseShims(res);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        if (pathname === '/api/auth/callback/google') {
          pathname = '/api/app';
          req.query.action = 'google-callback';
        }

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
