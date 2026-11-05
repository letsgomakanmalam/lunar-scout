declare module 'qrcode-terminal' {
  const qr: { generate(text: string, opts?: { small?: boolean }, cb?: (s: string) => void): void }
  export default qr
}

/** From package.json, set in vite.config.ts */
declare const __APP_VERSION__: string
