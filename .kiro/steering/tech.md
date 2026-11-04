# Tech Stack

- **Runtime**: Node.js 20 or newer (LTS). No Java, Python or database needed to run the site.
- **Framework**: Vite 5 + React 18 + TypeScript (strict)
- **Styling**: plain CSS with variables in `src/styles.css` (no Tailwind)
- **Earth map**: MapLibre GL JS with NASA GIBS Blue Marble raster tiles (free, no API key)
- **Moon views**: canvas 2D renderer (`src/lib/globe.ts`) with a procedural texture (`src/lib/moonTexture.ts`); maria and named craters sit at their real positions (no WebGL needed)
- **Auto-save**: `scripts/autopush.mjs` runs before `npm run dev` (and as `npm run sync`): commit all changes, pull with rebase, push. Never blocks startup; `npm run dev:nosave` skips it
- **Map layers and search** (all keyless): OpenFreeMap Liberty style, NASA GIBS (VIIRS NOAA-20 true colour, Blue Marble), EOX Sentinel-2 cloudless 2024, Photon geocoder by Komoot. Sun/Moon/night maths in `src/lib/sky.ts`, distances in `src/lib/geo.ts`
- **Fonts**: Michroma, Barlow, Barlow Condensed, self-hosted woff2 in `src/assets/fonts` (SIL OFL); no Google Fonts request
- **Sound and music**: effects and an original generative soundtrack synthesized with Web Audio (`src/lib/sfx.ts`, `src/lib/music.ts`, shared context in `src/lib/audio.ts`); M toggles effects, N toggles music
- **State**: Zustand with `persist` (progress saved in the browser's localStorage)
- **Charts**: Recharts radar chart
- **Tests**: Vitest (`npm test`)
- **QR codes**: `qrcode` + `qrcode-terminal`, wired into Vite (dev) and `scripts/qr.mjs` (live site)
- **CI/CD**: GitHub Actions → GitHub Pages, plus a QR code artifact for the live URL

## Commands
| Command | What it does |
|---|---|
| `npm install` | Install packages (first time) |
| `npm run dev` | Start the site on your network and print a QR code for your phone |
| `npm test` | Run unit and data tests |
| `npm run validate:data` | Check site/mission data only |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run check` | Typecheck + tests + build (run before every commit) |
| `npm run qr -- <url>` | QR code PNG for the live website |

## Rules
- All scoring logic lives in `src/lib/scoring.ts`; base logic in `src/lib/base.ts`. Both are pure and tested.
- Every factor value must cite a `sourceId` from `src/data/sources.ts`. Guesses keep `estimate: true`.
- Use relative paths (`base: './'`) so the build works on GitHub Pages and any static host.
- Works on every screen: check at 320, 390 and 844x390 (phones), 768 and 1024 (tablets), 1366 and 1920 (laptop, desktop). Touch targets at least 44px; two-finger map panning on touch.
- Accessibility: keyboard-playable, visible focus, reduced motion respected.
- Windows users: use `start-dev.bat` and `check-all.bat`. Avoid bash-only commands in npm scripts.
