# Project Structure

```
.kiro/
  steering/            product, tech, structure, competition (always read)
  specs/lunar-analog-game/  requirements, design, tasks
  hooks/               automation that runs when files are saved
.github/workflows/     deploy.yml: test, build, deploy to Pages, QR artifact
.vscode/               editor settings (hides unrelated Java tooling)
scripts/qr.mjs         QR code for the live site
src/
  data/                types.ts, sources.ts, earthSites.ts, moon.ts (targets + missions), modules.ts, tutorial.ts (guided tour), data.test.ts
  tutorial.test.ts     guided tutorial logic
  lib/                 scoring.ts (+ test), base.ts (+ test), moonTexture.ts + globe.ts (+ test), textureCache.ts, audio.ts, sfx.ts, music.ts, motion.ts, format.ts
  assets/fonts/        self-hosted fonts + licences
  components/          EarthMap, MoonGlobe, EarthGlobe, Starfield, Hud, AsiRadar, ScanFx, RewardOverlay, Modal, Tutorial, Icon, Counter
  screens/             Title, Missions, Explore, Land, Build, Journal, Dashboard, About
  store.ts             Zustand game state
  App.tsx, main.tsx, styles.css
start-dev.bat, check-all.bat   double-click helpers for Windows
```
Naming: PascalCase components, camelCase functions, kebab-case ids in data.

Not in this repo: pitch, demo script, project page draft and submission checklist live in a separate `presentation` folder kept by the team. Do not create presentation files here.
