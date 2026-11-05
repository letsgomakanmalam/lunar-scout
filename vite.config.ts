import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

// Which commit this build is. On GitHub it's the pushed commit; locally, the current one.
const buildSha = (() => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' }
})()

// The 24/7 link, from the GitHub repo in package.json
const liveUrl = (() => {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    const u: string = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? ''
    const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(u)
    return m ? `https://${m[1].toLowerCase()}.github.io/${m[2]}/` : null
  } catch { return null }
})()

// The version shown on the title screen, from package.json
const appVersion = (() => { try { return JSON.parse(readFileSync('package.json', 'utf8')).version as string } catch { return 'dev' } })()

/** Stamps the commit into the page so scripts/livelink.mjs can tell when an update is live. */
function buildStamp(): Plugin {
  return { name: 'build-stamp', transformIndexHtml: html => html.replace('</head>', `  <meta name="lunar-build" content="${buildSha}" />\n  </head>`) }
}

function phoneQr(): Plugin {
  const show = (server: ViteDevServer | PreviewServer) => {
    server.httpServer?.once('listening', async () => {
      setTimeout(async () => {
        const url = server.resolvedUrls?.network?.[0]
        if (!url) return
        if (liveUrl) console.log(`\n  Your 24/7 link (any device, any time): ${liveUrl}\n  This computer only, same Wi-Fi, while this window is open: ${url}`)
        else console.log('Open on your phone: ' + url)
        try {
          const { default: qt } = await import('qrcode-terminal')
          qt.generate(url, { small: true })
          const { default: QRCode } = await import('qrcode')
          QRCode.toFile('qr-dev.png', url, { width: 512 }).catch(() => {})
        } catch { /* optional */ }
      }, 300)
    })
  }
  return { name: 'phone-qr', configureServer: show, configurePreviewServer: show }
}

export default defineConfig({
  server: {
    // Always the same address. If an old copy of the site is still running, say so instead of
    // quietly starting on another port while the browser keeps showing the old one.
    port: 5173,
    strictPort: true,
  },
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  base: './',
  plugins: [react(), phoneQr(), buildStamp()],
  // Inline (empty) PostCSS config: Vite then never searches parent folders for one,
  // so a stray file there (like a package.json saved with a BOM) can't break the build.
  css: { postcss: {} },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'], charts: ['recharts'] } } },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
} as any)
