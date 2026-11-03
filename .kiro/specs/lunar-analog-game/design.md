# Design Document: LUNAR SCOUT — Earth Analog Hunt

## Overview

LUNAR SCOUT is a static, client-side educational web game for the NASA Space Apps Challenge 2026 (Kuala Lumpur). Players complete science missions by scanning real Earth analog sites, earn research points, choose a lunar landing site, and build a Moon base. Every scan produces an explainable Analog Similarity Index (ASI) with cited data sources. All data lives in typed files in `src/data`, so the app needs no backend and deploys to any static host.

## Game Design

### Core loop
```
MISSIONS ──► EXPLORE EARTH (scan, certify) ──► research points ──► LANDING SITE ──► BASE BUILDER
    ▲                                                                                    │
    └──────────────────── completing missions unlocks missions and modules ◄─────────────┘
```

### Screens
| Screen | Hash | Purpose |
|---|---|---|
| Title | (none) | Earth–Moon art, "Start scouting" / "Continue scouting" |
| Missions | `#missions` | Ordered list; one more mission opens per mission passed |
| Explore Earth | `#explore` | Mission brief + Moon target, NASA Blue Marble map, scan panel with ASI and radar |
| Landing site | `#land` | Choose Taurus-Littrow, Marius Hills pit or Shackleton rim |
| Base | `#build` | 6×6 grid, module palette, power and status |
| Journal | `#journal` | Auto entries + player notes |
| Progress | `#dashboard` | Rank, stats, mission log, local leaderboard, reset |
| About | `#about` | Challenge, how scoring works, site codex, sources |

A 3-step tutorial overlay appears on the Explore screen until finished or skipped.

### Missions
| Mission | Moon target | Weights | Pass | Reward | Unlocks |
|---|---|---|---|---|---|
| First light (tutorial) | Taurus-Littrow | aridity .4, roughness .3, isolation .3 | 50 | 50 | — |
| Regolith rover trials | Taurus-Littrow | roughness .3, basalt .25, aridity .25, isolation .2 | 60 | 120 | Rover garage |
| Impact crater geology | Copernicus | crater .45, aridity .2, isolation .2, roughness .15 | 60 | 120 | Science lab |
| Lava-tube habitat | Marius Hills pit | caves .45, basalt .3, aridity .15, isolation .1 | 65 | 150 | — |
| Polar ice prospecting | Shackleton rim | cold .4, aridity .25, isolation .2, crater .15 | 65 | 150 | Ice extractor |
| Lunar night survival | Taurus-Littrow | thermal .45, aridity .35, isolation .2 | 70 | 180 | — |

Each mission has 8 probes. Each scan of a new site uses one.

### Stars and ranks
- 0 stars: ASI below pass mark (logged as provisional).
- 1 star: pass. 2 stars: pass + 10. 3 stars: pass + 20 and ≤ 4 probes used.
- Ranks by total stars: Cadet (0–2), Field scout (3–7), Analog specialist (8–13), Chief selenologist (14+).

### Visual identity
AAA game presentation, grounded in Apollo hardware rather than generic sci-fi.
- Colour has meaning: Apollo gold foil `#e9b24c` = player actions and rewards; Earth blue `#72b6ff` = Earth and data; regolith white `#ebe6da` = the Moon. Space black `#05070d`, glass panels `#0d1320`, pass `#5fe0a2`, fail `#ff6f5e`.
- Type: Michroma (Eurostile-style, 1960s space-age) for the logo and screen titles, Barlow Condensed for HUD labels and numbers, Barlow for body text. Self-hosted in `src/assets/fonts` so the demo works offline.
- Motifs: réseau crosses (the + marks on Apollo Hasselblad photos) frame imaging surfaces; chamfered corners mark things you can act on.
- Signature moment: the title screen's live 3D Moon (real mare layout, crater relief) with the gold Earth-to-Moon trajectory.
- Game feel: HUD with animated counters, Q/E tab switching, scan sequence, "Site certified" reward screen, touchdown sequence, synthesized UI sound (M to mute). Reduced motion is respected everywhere.

## Analog Similarity Index (ASI)

Each Earth site has eight factors normalized 0..1, where 1 = as Moon-like as anywhere on Earth gets: temperature swing, dryness, slope & roughness, volcanic rock, impact craters, caves & lava tubes, extreme cold, remoteness.

The Moon is more extreme than Earth on most factors, so targets use an **Earth-best proxy**: the target value is set to the most extreme Earth level (1) where the Moon exceeds Earth's range.

```
sim_f      = 1 − |site_f − target_f|
ASI        = round(100 × Σ w_f · sim_f / Σ w_f)       over factors with data
confidence = Σ w_f (with data) / Σ w_f (all)
```
Factors with missing data are skipped and weights re-normalize. If no factor has data, ASI is null.

### Factors & data sources
| Factor | Earth source | Moon source |
|---|---|---|
| Temperature swing, extreme cold | MODIS LST (MOD11A2) | LRO Diviner |
| Dryness | NASA POWER | Moon = 1 (proxy) |
| Slope & roughness | NASADEM | LRO LOLA |
| Volcanic rock | GLiM lithology | USGS Unified Geologic Map of the Moon |
| Impact craters | Earth Impact Database | LROC |
| Caves & lava tubes | USGS / NPS records | LROC pit catalog |
| Remoteness | SEDAC GPW v4 | Moon = 1 (proxy) |

Current site values are team estimates (`estimate: true`) to be replaced with computed values.

### Seed sites
Known analogs: Haughton Crater, Atacama (Yungay), McMurdo Dry Valleys, Craters of the Moon, Lava Beds, Meteor Crater, Mauna Kea, Timanfaya (Lanzarote), Ries Crater, Bockfjord (Svalbard), Holuhraun, Death Valley.
Under-studied candidates: Lonar Crater, Harrat Khaybar, El Pinacate.
Malaysian comparison sites: Gunung Mulu, Batu Caves, Mount Kinabalu summit. These show why humid limestone or granite sites score low.

## Data Models

```ts
type FactorKey = 'thermal'|'aridity'|'roughness'|'basalt'|'crater'|'caves'|'cold'|'isolation'
interface FactorValue { value: number | null; raw: string; sourceId: string; estimate: boolean }
interface DataSource  { id: string; name: string; agency: 'NASA'|'USGS'|'ESA'|'JAXA'|'Other'; url: string }
interface EarthSite   { id; name; country; lat; lon; status: 'known'|'candidate'|'local'; environment; description; factors: Record<FactorKey, FactorValue> }
interface LunarTarget { id; name; lat; lon; description; landable: boolean;
                        landing?: { difficulty: 'Easy'|'Medium'|'Hard'; costMultiplier; powerBonus; perks: string[] };
                        factors: Partial<Record<FactorKey, number>> }
interface Mission     { id; title; brief; targetId; weights: Partial<Record<FactorKey, number>>; passAsi; reward; unlocks?: ModuleId; equipmentTip }
type ModuleId = 'habitat'|'power'|'comms'|'lab'|'ice'|'rover'
interface PlacedModule { id: ModuleId; level: 1 | 2 }
```

Persisted game state (localStorage key `lunar-scout-v1`): tutorial status, active mission, probes used, scanned sites, completed missions, research points, unlocked modules, landing site, grid, journal, leaderboard.

## Architecture

```
NASA / USGS / partner datasets ──(team reads values, cites source)──► src/data/*.ts (typed + tested)
                                                                         │
React app (static, Vite) ── store.ts (Zustand + persist) ◄───────────────┤
   ├─ lib/scoring.ts   pure ASI, stars, strengths/weaknesses
   ├─ lib/base.ts      costs, power, crew, operational status, ranks
   ├─ EarthMap         MapLibre + NASA GIBS Blue Marble tiles
   ├─ MoonGlobe        canvas Moon (procedural texture, real mare layout) with target lock
   ├─ Hud, RewardOverlay, ScanFx, Modal, Icon, Counter, Starfield, EarthGlobe
   └─ AsiRadar         Recharts radar
Build ──► GitHub Actions ──► GitHub Pages ──► QR code artifact
```
Routing uses plain `#hash` names so screens can be bookmarked.

## Components and Interfaces

| Unit | Responsibility | Interface |
|---|---|---|
| `EarthMap` | Map, site markers, selection, fly-to | `selectedId`, `scannedIds`, `onSelect(id)` |
| `MoonGlobe` | Lit, rotating Moon; turns to a target and locks a reticle on it | `size`, `target`, `markers`, `spin`, `label` |
| `Hud` | Top bar: tabs, research points, stars, sound | `nav` |
| `RewardOverlay` | Certification result: stars, ASI, points, unlocks | `result` + callbacks |
| `Modal` / `ConfirmDialog` | In-game dialogs (replace window.confirm) | `open`, `onClose` |
| `globe.ts` / `moonTexture.ts` | Canvas globe renderer and procedural Moon/Earth textures | `prepareGlobe`, `renderMoon`, `moonTextureSteps` |
| `sfx.ts` | Synthesized UI sounds, respects mute | `sfx(name)` |
| `AsiRadar` | Site vs target chart | `result: ScanResult` |
| `Tutorial` | First-run 3-step overlay | reads/writes store |
| `scoring.ts` | ASI and stars | `computeASI(site, target, mission)`, `starsFor(asi, pass, probes)`, `strengthsAndWeaknesses(result)` |
| `base.ts` | Base rules | `moduleCost`, `modulePower`, `powerBalance`, `crewCapacity`, `isOperational`, `rankFor` |
| `store.ts` | Game actions | `scan`, `certify`, `chooseLanding`, `place`, `upgrade`, `remove`, `addNote`, `saveScore`, `resetAll` |

## Correctness Properties

1. **Range:** `0 ≤ ASI ≤ 100` and `0 ≤ confidence ≤ 1` for any inputs.
2. **Identity:** a site equal to the target scores 100.
3. **Missing data:** null factors are skipped and weights re-normalize; all-null gives ASI null and confidence 0.
4. **Monotonicity:** moving one factor closer to the target never lowers ASI.
5. **Weight invariance:** scaling all weights by a constant does not change ASI.
6. **Traceability:** every factor's `sourceId` exists in `sources.ts`.
7. **Passability:** every mission can be passed by at least one seed site.
8. **Economy:** placing or upgrading never makes research points negative.

## Base Systems

### Research points
First certification earns `reward × stars`. Re-certifying with more stars earns 30 per extra star.

### Landing sites
| Site | Difficulty | Cost × | Solar bonus | Other perk |
|---|---|---|---|---|
| Taurus-Littrow | Easy | 1.00 | 0 | none |
| Marius Hills pit | Medium | 1.10 | 0 | habitats use 1 less power |
| Shackleton rim | Hard | 1.25 | +3 per array | ice extractor 30% cheaper |

### Modules
| Module | Cost | Upgrade | Power L1/L2 | Unlock |
|---|---|---|---|---|
| Habitat | 60 | 90 | −2 / −3 | start |
| Solar array | 40 | 60 | +4 / +7 | start |
| Comms tower | 50 | 70 | −1 / −1 | start |
| Science lab | 80 | 110 | −2 / −3 | Impact crater mission |
| Ice extractor | 90 | 120 | −3 / −4 | Polar ice mission |
| Rover garage | 70 | 90 | −1 / −2 | Rover trials mission |

Operational = at least one habitat, one comms tower and net power ≥ 0. Removing refunds 50% of the build cost.

## Automation

- `npm run dev` (Vite plugin `phoneQr`): prints a QR code for the LAN URL and saves `qr-dev.png`.
- `npm run qr -- <url>`: saves `qr-site.png` for the live site.
- `.github/workflows/deploy.yml`: typecheck → test → build → GitHub Pages → `site-qr` artifact.
- `.kiro/hooks/`: tests after logic edits, data validation after data edits, typecheck after UI edits, manual pre-submit check.
- `start-dev.bat` / `check-all.bat`: double-click helpers for Windows.

## Error Handling

- Missing factor data: shown via confidence %, weights re-normalize.
- No probes left: message tells the player to certify or switch mission.
- Not enough research points or locked module: build is refused with the reason.
- Map tiles fail to load: markers and the site list (dropdown) still work.
- No WebGL on the device: the map shows a short message; the site list still works.
- Corrupt or old saved state: "Reset progress" on the Progress screen.

## Testing Strategy

- `src/lib/scoring.test.ts`: properties 1–5 and star rules.
- `src/data/data.test.ts`: unique ids, coordinates, 0..1 ranges, property 6, property 7, module unlock references.
- `npm run check` (typecheck + tests + build) runs in CI on every push and pull request.
- Manual: play the tutorial and one full mission on a phone via the QR code before submitting.
