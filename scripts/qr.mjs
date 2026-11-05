// Make a QR code for your live website so anyone can open it on a phone.
// Usage:  npm run qr -- https://your-team.github.io/lunar-scout/
//    or:  set SITE_URL in a .env-like way:  SITE_URL=https://... npm run qr
import { mkdirSync } from 'node:fs'
import QRCode from 'qrcode'
import qrcodeTerminal from 'qrcode-terminal'

const url = process.argv[2] || process.env.SITE_URL
if (!url || !/^https?:\/\//.test(url)) {
  console.error('\nGive the website address, for example:\n  npm run qr -- https://your-team.github.io/lunar-scout/\n')
  process.exit(1)
}
// public/ isn't stored in git (the QR images are ignored), so make sure it exists on a fresh checkout
mkdirSync('public', { recursive: true })
await QRCode.toFile('qr-site.png', url, { width: 1024, margin: 2 })
await QRCode.toFile('public/qr-site.png', url, { width: 512, margin: 2 })
console.log(`\nQR code for ${url}\n`)
qrcodeTerminal.generate(url, { small: true })
console.log('Saved qr-site.png (print it for your poster or slides) and public/qr-site.png.\n')
