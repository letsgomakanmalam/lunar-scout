import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'

function phoneQr(): Plugin {
  const show = (server: ViteDevServer | PreviewServer) => {
    server.httpServer?.once('listening', async () => {
      setTimeout(async () => {
        const url = server.resolvedUrls?.network?.[0]
        if (!url) return
        console.log('Open on your phone: ' + url)
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
  base: './',
  plugins: [react(), phoneQr()],
  server: { port: 5173 },
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
