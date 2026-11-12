import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = req.url.split('?')[0];

        // 1. /api/market/live
        if (url === '/api/market/live') {
          try {
            const mod = await server.ssrLoadModule('/api/market/live.ts');
            const data = mod.getDeterministicMarketData ? mod.getDeterministicMarketData() : {};
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return;
          } catch (e: any) {
            console.error('API /api/market/live dev error:', e);
          }
        }

        // 2. /api/demo/:slug
        if (url.startsWith('/api/demo/')) {
          try {
            const slug = url.replace('/api/demo/', '').split('/')[0];
            const mod = await server.ssrLoadModule('/src/constants/demoAnalyses.ts');
            const demo = mod.DEMO_ANALYSES?.[slug];
            if (demo) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, demo }));
              return;
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Demo not found', available: Object.keys(mod.DEMO_ANALYSES || {}) }));
              return;
            }
          } catch (e: any) {
            console.error('API /api/demo dev error:', e);
          }
        }

        // 3. /api/checkout
        if (url === '/api/checkout') {
          try {
            let body = '';
            req.on('data', (chunk: any) => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsedBody = body ? JSON.parse(body) : {};
                req.body = parsedBody;
                const mod = await server.ssrLoadModule('/api/checkout.ts');
                res.status = (code: number) => { res.statusCode = code; return res; };
                res.json = (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return res;
                };
                await mod.default(req, res);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message || 'Checkout failed' }));
              }
            });
            return;
          } catch (e: any) {
            console.error('API /api/checkout dev error:', e);
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
