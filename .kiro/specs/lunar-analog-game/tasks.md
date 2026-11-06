# Implementation Plan: LUNAR SCOUT — Earth Analog Hunt

## Overview

The core game loop is already running: missions, scanner with ASI, certifications, landing-site selection, base builder, journal, progress dashboard, tutorial, CI, and QR automation are all implemented. The remaining work replaces estimated factor data with real values and adds the unimplemented P1 features — Ghost Signature heatmap, animated link beam, Field Kit cards, debrief export, Discovery mode, and accessibility/sound polish.

## Tasks

- [x] 1. Scaffold, tooling, and data types
  - [x] 1.1 Initialize Vite + React + TypeScript project with Zustand, MapLibre, Recharts, and Vitest
    - Create `vite.config.ts`, `tsconfig.json`, and `package.json` with all dependencies pinned
    - _Requirements: 16_
  - [x] 1.2 Define all shared TypeScript types in `src/data/types.ts`
    - `FactorKey`, `FactorValue`, `DataSource`, `EarthSite`, `LunarTarget`, `Mission`, `ModuleId`, `PlacedModule`
    - _Requirements: 2.2, 4.3_
  - [x] 1.3 Add phone QR code automation
    - Implement `scripts/qr.mjs` Vite plugin that prints QR to console and saves `qr-dev.png` on `npm run dev`
    - Add `npm run qr -- <url>` script that saves `qr-site.png`
    - _Requirements: 16.1, 16.2_
  - [x] 1.4 Configure GitHub Actions workflow
    - `deploy.yml`: typecheck → test → build → deploy to GitHub Pages → upload `site-qr` artifact
    - _Requirements: 16.3_
  - [x] 1.5 Add Kiro hooks for automated checks
    - Run Vitest after edits to `src/lib/`, run `validate:data` after edits to `src/data/`, run typecheck after edits to `src/`
    - _Requirements: 16.4_

- [x] 2. Seed data and scoring engine
  - [x] 2.1 Populate `src/data/sources.ts` with all cited datasets
    - Entries for MODIS LST, NASA POWER, NASADEM, SEDAC GPW, GLiM, Earth Impact Database, USGS Caves, LROC, LRO Diviner/LOLA, USGS Geologic Moon Map
    - _Requirements: 4.3, 8.2_
  - [x] 2.2 Populate `src/data/earthSites.ts` with 18 Earth analog sites
    - 12 known analogs, 3 under-studied candidates, 3 Malaysian comparison sites; all factor values with `estimate: true` and cited `sourceId`
    - _Requirements: 2.1, 7.1, 8.1, 8.2_
  - [x] 2.3 Populate `src/data/moon.ts` with 4 lunar targets and 6 missions
    - Targets: Taurus-Littrow, Marius Hills Pit, Shackleton Rim, Copernicus; missions per design weights and pass marks
    - _Requirements: 2.1, 2.2, 12.1, 12.2_
  - [x] 2.4 Populate `src/data/modules.ts` with 6 base modules
    - Habitat, Solar Array, Comms Tower, Science Lab, Ice Extractor, Rover Garage with costs, upgrade costs, power values, and unlock flags
    - _Requirements: 13.1, 13.6_
  - [x] 2.5 Implement `computeASI`, `starsFor`, and `strengthsAndWeaknesses` in `src/lib/scoring.ts`
    - Formula: `sim_f = 1 − |site_f − target_f|`; weighted average; skip null factors and re-normalize; confidence = used weight / total weight
    - _Requirements: 4.1, 4.2, 4.4, 6.1_
  - [x] 2.6 Implement base rules in `src/lib/base.ts`
    - `moduleCost` (applies landing `costMultiplier`, Shackleton ice discount), `modulePower` (applies Marius habitat bonus and Shackleton solar bonus), `powerBalance`, `crewCapacity`, `isOperational`, `rankFor`
    - _Requirements: 13.2, 13.4, 13.5, 15.2_
  - [x] 2.7 Write scoring unit tests in `src/lib/scoring.test.ts`
    - Cover Properties 1–5: range (0–100), identity (site = target → ASI 100), missing-data re-normalization, monotonicity, weight invariance; cover star rules
    - _Requirements: 4.4_
  - [x] 2.8 Write data integrity tests in `src/data/data.test.ts`
    - Unique IDs, valid coordinates, factor values 0–1, every `sourceId` exists (Property 6), every mission is passable by at least one site (Property 7), module unlock references valid
    - _Requirements: 2.2, 4.3, 8.2_

- [x] 3. Zustand store
  - [x] 3.1 Implement `src/store.ts` with all game actions
    - State: tutorial, active mission, probes used, scanned sites, completed missions, research points, unlocked modules, landing site, grid, journal, leaderboard
    - Actions: `go`, `setMission`, `scan` (probe gate), `certify` (ASI → stars → reward → unlock → journal entry), `chooseLanding` (confirmation + grid clear), `place`, `upgrade`, `remove` (50% refund), `addNote`, `deleteNote`, `saveScore`, `resetAll`
    - _Requirements: 1.4, 4.1, 4.5, 6.1, 6.2, 12.3, 12.4, 13.2, 13.3, 13.5, 14.1, 14.2, 15.1, 15.3_
  - [x] 3.2 Add `missionUnlocked` helper and progressive unlock logic
    - Two missions open at start; one additional mission unlocks per completed mission
    - _Requirements: 2.4_

- [x] 4. Map and chart components
  - [x] 4.1 Implement `EarthMap` component in `src/components/EarthMap.tsx`
    - MapLibre GL JS with NASA GIBS Blue Marble tiles; clickable site markers; fly-to on select; `selectedId`, `scannedIds`, `onSelect(id)` props; fallback site-list `<select>` when tiles fail
    - _Requirements: 3.1, 4.1_
  - [x] 4.2 Implement `MoonMap` component in `src/components/MoonMap.tsx`
    - SVG orthographic Moon disc; highlight active landing target; `activeId`, `size` props
    - _Requirements: 3.1, 3.2_
  - [x] 4.3 Implement `AsiRadar` component in `src/components/AsiRadar.tsx`
    - Recharts `RadarChart`; site vs target normalized factor values; `result: ScanResult` prop
    - _Requirements: 4.2_
  - [x] 4.4 Implement `Tutorial` overlay in `src/components/Tutorial.tsx`
    - 3-step dialog: "Your mission" → "Scan Earth" → "Certify"; Next / Skip buttons wired to store `tutorialStep` and `finishTutorial`
    - _Requirements: 1.2, 1.3_

- [x] 5. Screens — title, missions, explore, land, build, journal, dashboard, about
  - [x] 5.1 Implement `Title` screen in `src/screens/Title.tsx`
    - Animated SVG Earth–Moon twin view with dashed gold foil line (`@keyframes foil`); "Start scouting" / "Continue scouting" button routes to `missions` (returning) or `explore` (first visit)
    - _Requirements: 1.1, 1.4_
  - [x] 5.2 Implement `Missions` screen in `src/screens/Missions.tsx`
    - Ordered list of all 6 missions; show brief, pass mark, reward, unlock; disable locked missions; star display for completed missions
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 5.3 Implement `Explore` screen in `src/screens/Explore.tsx`
    - Mission brief panel + `MoonMap` (target) + `EarthMap` + scan panel; 1.5 s scanner sweep animation; reveal ASI + `AsiRadar` + strengths/weaknesses + source citations; Certify button; probe counter and pass-mark display; educational approximation notice
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 10.3_
  - [x] 5.4 Implement `Land` screen in `src/screens/Land.tsx`
    - Cards for 3 landable targets showing difficulty, cost multiplier, power bonus, and perks; disable selection until one mission is complete; confirmation dialog when changing an existing choice
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 5.5 Implement `Build` screen in `src/screens/Build.tsx`
    - 6×6 interactive grid; module palette with locked/unlocked state and cost; place, upgrade (level 1→2), and remove (50% refund); power produced/used/net; crew capacity; operational status; landing perks sidebar
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  - [x] 5.6 Implement `Journal` screen in `src/screens/Journal.tsx`
    - List auto-entries (certifications, landing choices) and player notes; add-note form; delete player notes
    - _Requirements: 14.1, 14.2_
  - [x] 5.7 Implement `Dashboard` screen in `src/screens/Dashboard.tsx`
    - Rank (`rankFor`), stars, missions passed, sites scanned, research points, landing site, base status; mission log table; device leaderboard (top 10, save score by name); reset-progress button
    - _Requirements: 15.1, 15.2, 15.3_
  - [x] 5.8 Implement `About` screen in `src/screens/About.tsx`
    - "How the ASI works" explanation; site codex list; data sources list with links; challenge attribution
    - _Requirements: 8.1, 8.2, 8.3, 10.3, 11.4_
  - [x] 5.9 Wire all screens in `src/App.tsx` with `#hash` routing
    - `useEffect` reads `location.hash` on load and `hashchange`; updates hash when `screen` state changes; renders correct screen component; shows `Tutorial` overlay on `explore` when not done
    - _Requirements: 1.2, 1.4_

- [x] 6. Styles and visual identity
  - [x] 6.1 Implement global CSS in `src/styles.css`
    - Design tokens: basalt `#1a1f29`, panel `#232a36`, regolith `#e6e1d5`, dust `#a8a397`, foil `#e0a83a`, sky `#7fb2e5`, good `#6fcf97`, bad `#ef7b6b`; Barlow Condensed headings, IBM Plex Sans body; responsive layouts for Explore (side-by-side → stacked), Build (grid + sidebars), page screens
    - _Requirements: 3.1, 10.1, 10.2_

- [ ] 7. Checkpoint — run `npm run check` (typecheck + tests + build)
  - Confirm all existing tests pass, TypeScript compiles clean, and Vite builds successfully before continuing.
  - _Requirements: 16.3_

- [ ] 8. Replace estimated site data with real values (P0)
  - [ ] 8.1 Update `thermal` and `cold` factor values for all sites in `src/data/earthSites.ts`
    - Read temperature-swing amplitude and minimum annual temperature from MODIS LST (MOD11A2, 8-day composites); normalize against the Moon's ~280 K day–night swing and −173 °C minimum; set `raw` to the actual statistic (e.g., "Annual LST swing 68 K") and `estimate: false`
    - _Requirements: 4.3, 8.2_
  - [ ] 8.2 Update `aridity` factor values for all sites
    - Read mean annual precipitation from NASA POWER (PRECTOTCORR); normalize against Moon proxy of 1 (0 mm/yr); set `raw` and `estimate: false`
    - _Requirements: 4.3, 8.2_
  - [ ] 8.3 Update `roughness` factor values for all sites
    - Read terrain roughness index (standard deviation of elevation over 1 km window) from NASADEM via Earthdata; normalize against LRO LOLA roughness at Shackleton rim; set `raw` and `estimate: false`
    - _Requirements: 4.3, 8.2_
  - [ ] 8.4 Update `isolation` factor values for all sites
    - Read population density (persons/km²) from SEDAC GPW v4; normalize 0 → 1 using log scale (Moon = 1 proxy); set `raw` and `estimate: false`
    - _Requirements: 4.3, 8.2_
  - [ ]* 8.5 Add a `validate:data` npm script and confirm it stays green after real values are applied
    - Script runs `tsc --noEmit` and `vitest --run src/data/data.test.ts`; verify `estimate: false` count increases and all integrity tests still pass
    - _Requirements: 4.3, 16.4_

- [ ] 9. Ghost Signature heatmap (P1)
  - [ ] 9.1 Add `computeGridASI` utility to `src/lib/scoring.ts`
    - Accept a `Mission`, a `LunarTarget`, and a list of `{lat, lon}` grid points; return `{lat, lon, asi}[]`; reuse existing `computeASI` with synthetic `EarthSite` objects whose factor values all default to `null` except any we can estimate from coarse climate data
    - _Requirements: 3.3, 7.1_
  - [ ] 9.2 Add "Ghost Signature" toggle and heatmap layer to `EarthMap`
    - When toggled on, call `computeGridASI` for a 4°×4° global grid and render a MapLibre fill-color layer (`heatmap` or `fill` with opacity proportional to ASI); toggle button in `EarthMap` props controlled by `Explore` screen state
    - _Requirements: 3.3_

- [ ] 10. Animated link beam (P1)
  - [ ] 10.1 Add an SVG animated arc to `Explore` connecting the selected Earth site to the active lunar target
    - Compute screen positions of the Earth site marker and the `MoonMap` target highlight; draw a curved `<path>` element with a CSS `stroke-dashoffset` animation; show only when a site is selected and scanned; respect `prefers-reduced-motion`
    - _Requirements: 3.4, 10.4_

- [ ] 11. Field Kit equipment cards (P1)
  - [ ] 11.1 Add `fieldKit` outcome logic to `src/lib/scoring.ts`
    - `equipmentOutcome(equipment: string, site: EarthSite, mission: Mission): 'success' | 'partial' | 'fail'` based on relevant factor similarities; define threshold rules per equipment type matching the six Field Kit items
    - _Requirements: 5.1, 5.2_
  - [ ] 11.2 Add Field Kit panel to `Explore` screen
    - Show 6 equipment cards (Pressurized Rover, Regolith Drill, Inflatable Habitat, Solar Array, Ice Extractor, Lander Pad) after a site is scanned; each card shows outcome badge (success / partial / fail) and a one-sentence explanation derived from the site's factor strengths/weaknesses; deploying a mission-relevant equipment item on success adds +5 to the certified ASI bonus (store action update)
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 11.3 Write unit tests for `equipmentOutcome` in `src/lib/scoring.test.ts`
    - Verify outcome rules for each equipment type against known factor profiles
    - _Requirements: 5.2_

- [ ] 12. Debrief report export (P1)
  - [ ] 12.1 Implement `buildDebriefText` utility in `src/lib/scoring.ts`
    - Return a structured string with site name, coordinates, ASI, factor breakdown (similarity, source dataset), strengths, weaknesses, and recommended tests derived from weak factors
    - _Requirements: 6.3_
  - [ ] 12.2 Add debrief export controls to `Explore` screen
    - "Export PNG" button: render debrief panel to canvas using `html2canvas` (or equivalent) and trigger download as `debrief-{siteId}.png`
    - "Copy share link" button: encode active mission ID, site ID, and ASI into the URL hash and copy to clipboard; navigating to the link should restore the scan state
    - _Requirements: 6.3, 6.4_
  - [ ]* 12.3 Write a unit test for `buildDebriefText`
    - Verify all required fields are present in the output string for a known site/mission combination
    - _Requirements: 6.3_

- [ ] 13. Discovery mode — scan any land cell (P1)
  - [ ] 13.1 Extend `EarthMap` to emit `onGridSelect(lat: number, lon: number)` for clicks outside predefined site markers
    - Add a MapLibre `click` handler that resolves the click coordinates to the nearest 2°×2° grid cell center and emits it; visually distinguish grid-cell selections from site-marker selections with a different cursor and pin style
    - _Requirements: 7.1_
  - [ ] 13.2 Add `scanGrid` action to `src/store.ts`
    - Accept `{lat, lon}` and a mission ID; construct a synthetic `EarthSite` with null factor values; run `computeASI`; if ASI ≥ 75 and > 200 km from all known `EARTH_SITES`, award a "New Analog Candidate" badge and persist the discovery in store state
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 13.3 Add Discovery Codex section to `About` screen
    - List player-discovered analog candidates with coordinates, ASI, and discovery date; pulling from store state
    - _Requirements: 7.3_
  - [ ]* 13.4 Write unit tests for `scanGrid` in `src/store` helpers
    - Test badge awarded when ASI ≥ 75 and distance > 200 km; not awarded when either condition fails
    - _Requirements: 7.2_

- [ ] 14. Accessibility and motion/sound (P1)
  - [ ] 14.1 Audit and fix keyboard navigation across all screens
    - Verify all interactive elements (`button`, `select`, map controls, grid cells) are reachable by `Tab` and activatable by `Enter`/`Space`; add `aria-label` to all icon-only controls and SVG elements; add `role="grid"` and `aria-label` to the base-builder grid (already present — verify completeness)
    - _Requirements: 10.2_
  - [ ] 14.2 Add reduced-motion support to all animations
    - Wrap CSS `@keyframes` (foil line, scanner sweep, link beam) in `@media (prefers-reduced-motion: no-preference)`; in `Explore`, the scanner duration is already checked — confirm `Tutorial` and any new animations respect the same check
    - _Requirements: 10.4_
  - [ ] 14.3 Add sound-mute control
    - Add a mute toggle button to the topbar in `App.tsx`; persist mute preference in store; wire to any click/scan sound effects added in prior tasks (no-op if no sounds implemented); confirm presence of `<button>` with descriptive `aria-label`
    - _Requirements: 10.4_
  - [ ]* 14.4 Verify WCAG AA contrast for all color pairs in `src/styles.css`
    - Use a programmatic contrast check (e.g., `color-contrast` function or a test helper) against the design token palette; confirm `--regolith` on `--basalt`, `--foil-ink` on `--foil`, and `--dust` on `--panel` all meet 4.5:1 minimum
    - _Requirements: 10.2_

- [ ] 15. Checkpoint — run `npm run check` and confirm full test suite passes
  - Ensure all tests pass; resolve any TypeScript errors introduced by new modules. Ask the user if any design questions arise before proceeding.
  - _Requirements: 16.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster build
- Never invent precise numbers for factor values; keep `estimate: true` until a value is read from the actual dataset
- Properties 1–8 from the design's Correctness Properties section are covered by existing tests in Tasks 2.7 and 2.8; new code must not break them
- P2 features (Mars mode, shared leaderboard, automated data pipeline) are out of scope for this task list — mention in the pitch only

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["8.1", "8.2", "8.3", "8.4", "9.1", "11.1", "12.1", "13.1"] },
    { "id": 1, "tasks": ["8.5", "9.2", "10.1", "11.2", "12.2", "13.2", "14.1", "14.2", "14.3"] },
    { "id": 2, "tasks": ["11.3", "12.3", "13.3", "13.4", "14.4"] }
  ]
}
```

## Moon + Mars update (November 2026)
- [x] Mars as a first-class world (was P2): 7 Mars targets, 6 Mars missions, Mars globe, Mars landing sites and base look
- [x] Moon targets re-focused on the permanent base: NASA Moon Base ridge, Artemis III regions, lava-tube pit
- [x] Discovery mode (was P1): live probe of any point, new-analog-candidate rule (Req 7.2)
- [x] Debrief report export (Req 6.3/6.4): Analog Passport (Markdown, JSON) and twin reports
- [x] New factors: anorthosite, ground ice, water-laid rock and salts, low polar Sun (computed), bare ground
- [x] Twin finder with campaign planner and reality gaps; south-pole light calendar
- [x] Script for real values (Task 8): `npm run measure` writes src/data/measured.json
- [ ] Run `npm run measure` online and review the changes; review new site estimates and descriptions
- [ ] Try live probes on the venue network; prepare a cached demo in case the Wi-Fi is down
