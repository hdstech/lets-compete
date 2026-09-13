import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Vercel serves api/*.ts in production, but the Vite dev server doesn't know
// about them. This mounts the organizer signup function on the dev server so
// /signup — and the e2e suite, which runs against `npm run dev` — works
// locally without `vercel dev`. Dev only: configureServer never runs in a
// build. Only Content-Type is forwarded; the handler reads nothing else.
function devApiRoutes(): Plugin {
  return {
    name: 'dev-api-routes',
    configureServer(server) {
      server.middlewares.use('/api/organizer-signup', async (req, res) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const request = new Request('http://localhost/api/organizer-signup', {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
            body: req.method === 'POST' ? Buffer.concat(chunks).toString('utf8') : undefined,
          })
          const { default: handler } = await server.ssrLoadModule('/api/organizer-signup.ts')
          const response = (await handler(request)) as Response
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch (err) {
          server.config.logger.error(`dev /api/organizer-signup failed: ${String(err)}`)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Dev API route failed.' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load server-only vars (SUPABASE_URL, SUPABASE_SECRET_KEY — no VITE_
  // prefix) onto process.env for the dev api adapter above. process.env is
  // never exposed to the client bundle; only VITE_-prefixed vars are.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [
      react(),
      devApiRoutes(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Event Scoring App',
          short_name: 'EventScoring',
          description: 'Live event scoring and results for quiz and judged formats.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
            },
          ],
        },
      }),
    ],
  }
})
