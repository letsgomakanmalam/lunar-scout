/**
 * Field probe: turns open-data measurements at any point on Earth into analog factors.
 * Every function here is pure (no network), so it is unit-tested and shared by the app's live
 * probe and by scripts/measure-sites.ts. Fetching lives in probeFetch.ts.
 *
 *   NASA POWER climatology  -> temperature swing, extreme cold, dryness, ground ice
 *   Copernicus DEM (ESA)    -> slope & roughness (local relief over a 4 x 4 km box)
 *   MODIS NDVI (NASA)       -> bare ground
 *   Macrostrat geologic map -> basalt, anorthosite, water-laid rock & salts
 *   Earth Impact Database   -> impact craters
 *   Solar geometry          -> low polar Sun
 * Caves and remoteness need field surveys and a population grid, so a probe leaves them as "no data".
 */
import type { EarthSite, Environment, FactorKey, FactorValue } from '../data/types'
import { FACTOR_KEYS } from '../data/types'
import { IMPACTS, type Impact } from '../data/impacts'
import { distanceKm } from './geo'
import { lowSunRaw, lowSunValue } from './sun'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const r3 = (n: number) => Number(clamp01(n).toFixed(3))
const measured = (value: number, raw: string, sourceId: string): FactorValue => ({ value: r3(value), raw, sourceId, estimate: false })
const fmt = (n: number, d = 1) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

/* ---------- NASA POWER climatology ---------- */

export interface Climate {
  /** Mean annual air temperature, °C */
  meanC: number | null
  /** Mean daily temperature range, °C */
  rangeC: number | null
  /** Lowest temperature in the climatology, °C */
  minC: number | null
  /** Precipitation, mm per year */
  rainMm: number | null
  /** Grid-cell elevation POWER reports, m */
  elevation: number | null
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Reads a POWER climatology point response (properties.parameter.X.ANN). Fill values become null. */
export function parsePower(json: unknown): Climate | null {
  const j = json as { properties?: { parameter?: Record<string, Record<string, number>> }; header?: { fill_value?: number }; parameters?: Record<string, { units?: string }>; geometry?: { coordinates?: number[] } }
  const p = j?.properties?.parameter
  if (!p || typeof p !== 'object') return null
  const fill = typeof j.header?.fill_value === 'number' ? j.header.fill_value : -999
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v !== fill && v > -900
  const ann = (k: string) => (ok(p[k]?.ANN) ? p[k].ANN : null)
  const lowest = (k: string) => {
    const vals = MONTHS.map(m => p[k]?.[m]).filter(ok)
    if (vals.length) return Math.min(...vals)
    return ann(k)
  }
  let rainMm = ann('PRECTOTCORR')
  if (rainMm != null) {
    const units = j.parameters?.PRECTOTCORR?.units ?? 'mm/day'
    if (/day/i.test(units)) rainMm *= 365.25 // POWER climatology gives mean mm per day
  }
  const elev = j.geometry?.coordinates?.[2]
  return {
    meanC: ann('T2M'),
    rangeC: ann('T2M_RANGE'),
    minC: lowest('T2M_MIN'),
    rainMm,
    elevation: ok(elev) ? elev : null,
  }
}

/** Climate measurements as factors. Scales are written into each raw label. */
export function climateFactors(c: Climate): Partial<Record<FactorKey, FactorValue>> {
  const out: Partial<Record<FactorKey, FactorValue>> = {}
  if (c.rangeC != null) out.thermal = measured((c.rangeC - 5) / 15, `Daily swing ${fmt(c.rangeC)} °C (5 °C = 0, 20 °C = 1)`, 'power')
  if (c.meanC != null) {
    out.cold = measured((10 - c.meanC) / 30, `Mean annual ${fmt(c.meanC)} °C (10 °C = 0, −20 °C = 1)`, 'power')
    const permafrost = c.meanC <= -8 ? 'permafrost very likely' : c.meanC <= -2 ? 'permafrost likely' : c.meanC <= 1 ? 'patchy frozen ground possible' : 'no permafrost expected'
    out.ice = measured((1 - c.meanC) / 12, `Mean annual ${fmt(c.meanC)} °C: ${permafrost}`, 'power')
  }
  if (c.rainMm != null) out.aridity = measured(Math.exp(-c.rainMm / 450), `${fmt(c.rainMm, 0)} mm of rain a year`, 'power')
  return out
}

/* ---------- Copernicus DEM via Open-Meteo ---------- */

/** A square of n x n points spanning ±halfKm around a place, for the elevation request. */
export function reliefGrid(lat: number, lon: number, halfKm = 2, n = 5): { lat: number; lon: number }[] {
  const out: { lat: number; lon: number }[] = []
  const dLat = halfKm / 111.32
  const dLon = halfKm / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)))
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const fy = n === 1 ? 0 : (i / (n - 1)) * 2 - 1
    const fx = n === 1 ? 0 : (j / (n - 1)) * 2 - 1
    out.push({ lat: Math.max(-89.9, Math.min(89.9, lat + fy * dLat)), lon: ((lon + fx * dLon + 540) % 360) - 180 })
  }
  return out
}

export function parseElevations(json: unknown): number[] | null {
  const e = (json as { elevation?: unknown })?.elevation
  if (!Array.isArray(e)) return null
  const vals = e.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return vals.length ? vals : null
}

export function reliefFactor(elev: number[]): FactorValue | null {
  if (elev.length < 4) return null
  const relief = Math.max(...elev) - Math.min(...elev)
  return measured(relief / 500, `Local relief ${fmt(relief, 0)} m across 4 km (500 m = 1)`, 'cop-dem')
}

/** True when the elevation samples look like open water (flat at or below sea level). */
export const looksLikeSea = (elev: number[]) => elev.length > 0 && elev.every(v => v <= 0.5)

/* ---------- MODIS NDVI via ORNL DAAC ---------- */

/** MOD13Q1 16-day composite in the local growing season: July in the north, January in the south. */
export const ndviDate = (lat: number) => (lat >= 0 ? 'A2024193' : 'A2024017')

export function parseNdvi(json: unknown): number | null {
  const subs = (json as { subset?: { data?: unknown }[] })?.subset
  if (!Array.isArray(subs)) return null
  const vals: number[] = []
  for (const s of subs) if (Array.isArray(s.data)) for (const v of s.data) if (typeof v === 'number' && v > -2000) vals.push(v * 0.0001)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export function ndviFactor(ndvi: number): FactorValue {
  return measured((0.45 - ndvi) / 0.35, `Peak-season NDVI ${fmt(ndvi, 2)} (0.10 or less = bare)`, 'modis-ndvi')
}

/* ---------- Macrostrat geologic map ---------- */

export interface Geology { name: string; lith: string; text: string }

/** First map unit with a lithology, preferring the most detailed map scale. */
export function parseMacrostrat(json: unknown): Geology | null {
  const data = (json as { success?: { data?: unknown } })?.success?.data
  if (!Array.isArray(data)) return null
  const rank: Record<string, number> = { large: 0, medium: 1, small: 2, tiny: 3 }
  const units = data
    .map(u => u as Record<string, unknown>)
    .filter(u => typeof u.lith === 'string' && (u.lith as string).trim())
    .sort((a, b) => (rank[String(a.scale)] ?? 9) - (rank[String(b.scale)] ?? 9))
  const u = units[0]
  if (!u) return null
  const str = (k: string) => (typeof u[k] === 'string' ? (u[k] as string) : '')
  const name = str('name') || str('strat_name') || 'Unnamed unit'
  return { name, lith: str('lith'), text: [str('lith'), str('name'), str('strat_name'), str('descrip')].join(' ').toLowerCase() }
}

const ROCK_RULES: { key: 'basalt' | 'anorthosite' | 'sediment'; re: RegExp; value: number; word: string }[] = [
  { key: 'basalt', re: /basalt|lava flow|picrite|komatiite|tholeiit/, value: 1, word: 'basalt' },
  { key: 'basalt', re: /volcanic|andesite|scoria|cinder/, value: 0.7, word: 'volcanic rock' },
  { key: 'basalt', re: /tuff|ignimbrite|pyroclastic|dacite|rhyolite|trachyte/, value: 0.5, word: 'volcanic ash rock' },
  { key: 'anorthosite', re: /anorthosit/, value: 1, word: 'anorthosite' },
  { key: 'anorthosite', re: /gabbro|norite|troctolite/, value: 0.4, word: 'gabbro or norite' },
  { key: 'sediment', re: /evaporite|gypsum|anhydrite|halite|salt|playa|sulfate|sulphate/, value: 1, word: 'salts' },
  { key: 'sediment', re: /clay|mudstone|claystone|lacustrine|siltstone|shale|sandstone|conglomerate|fluvial|delta/, value: 0.75, word: 'water-laid rock' },
  { key: 'sediment', re: /alluvi|sediment|sand|gravel|unconsolidated/, value: 0.5, word: 'loose sediment' },
  { key: 'sediment', re: /limestone|dolomite|carbonate|chalk/, value: 0.45, word: 'carbonate rock' },
]

export function rockFactors(g: Geology): Partial<Record<FactorKey, FactorValue>> {
  const best: Partial<Record<'basalt' | 'anorthosite' | 'sediment', { value: number; word: string }>> = {}
  for (const r of ROCK_RULES) {
    if (!r.re.test(g.text)) continue
    if (!best[r.key] || best[r.key]!.value < r.value) best[r.key] = { value: r.value, word: r.word }
  }
  const unit = g.lith ? `"${g.name}" (${g.lith.replace(/\s+/g, ' ').slice(0, 60)})` : `"${g.name}"`
  const out: Partial<Record<FactorKey, FactorValue>> = {}
  for (const k of ['basalt', 'anorthosite', 'sediment'] as const) {
    const b = best[k]
    out[k] = measured(b?.value ?? 0, b ? `Geologic map: ${unit}, ${b.word}` : `Geologic map: ${unit}, none found`, 'macrostrat')
  }
  return out
}

/* ---------- Impact craters ---------- */

/** Older structures are eroded, so they look less like fresh lunar craters. */
const preservation = (ma: number) => (ma < 1 ? 1 : ma < 60 ? 0.85 : ma < 500 ? 0.6 : 0.4)

export function craterFactor(lat: number, lon: number, list: Impact[] = IMPACTS): FactorValue {
  let best = 0
  let what = 'No confirmed impact structure nearby'
  for (const c of list) {
    const km = distanceKm({ lat, lon }, c)
    const r = km / Math.max(0.05, c.km / 2)
    const near = r <= 1 ? 1 : r < 3 ? 1 - (r - 1) / 2 : 0
    const v = near * preservation(c.ma)
    if (v > best) {
      best = v
      what = r <= 1 ? `Inside ${c.name} (${fmt(c.km, c.km < 2 ? 1 : 0)} km, ${c.ma < 1 ? 'young' : `${fmt(c.ma, 0)} Myr`})` : `${fmt(km, 0)} km from ${c.name}`
    }
  }
  return measured(best, what, 'eid')
}

/* ---------- Putting a probe together ---------- */

export interface ProbeData {
  climate?: Climate | null
  elevations?: number[] | null
  ndvi?: number | null
  geology?: Geology | null
  /** Distance to the nearest town of 1,000+ people, from the global grid (GeoNames) */
  townKm?: number | null
}

/** All 13 factors for a probed point. Anything not measured is "no data" and lowers confidence. */
export function probeFactors(lat: number, lon: number, d: ProbeData): Record<FactorKey, FactorValue> {
  const got: Partial<Record<FactorKey, FactorValue>> = {
    ...(d.climate ? climateFactors(d.climate) : {}),
    ...(d.geology ? rockFactors(d.geology) : {}),
    crater: craterFactor(lat, lon),
    lowsun: { value: r3(lowSunValue(lat)), raw: lowSunRaw(lat), sourceId: 'solar-geometry', estimate: false },
  }
  if (d.elevations) { const f = reliefFactor(d.elevations); if (f) got.roughness = f }
  if (d.ndvi != null) got.barren = ndviFactor(d.ndvi)
  if (d.townKm != null) {
    const v = Math.min(1, Math.max(0, Math.log(1 + d.townKm / 5) / Math.log(31)))
    got.isolation = measured(v, `About ${d.townKm >= 510 ? '510+' : Math.round(d.townKm)} km to the nearest town of 1,000+ people (150 km = 1)`, 'geonames')
  }
  const NONE: Partial<Record<FactorKey, [string, string]>> = {
    caves: ['Caves need a field survey', 'usgs-caves'],
    isolation: ['Remoteness grid not loaded', 'geonames'],
  }
  const out = {} as Record<FactorKey, FactorValue>
  for (const k of FACTOR_KEYS) {
    out[k] = got[k] ?? { value: null, raw: NONE[k]?.[0] ?? 'Service did not answer', sourceId: NONE[k]?.[1] ?? 'power', estimate: false }
  }
  return out
}

/** A rough environment label from what was measured, for map colours and filters. */
export function guessEnvironment(f: Record<FactorKey, FactorValue>): Environment {
  const v = (k: FactorKey) => f[k].value ?? 0
  if (v('crater') >= 0.6) return 'impact'
  if (v('cold') >= 0.6 || v('ice') >= 0.6) return 'polar'
  if (v('basalt') >= 0.7) return 'volcanic'
  if (v('sediment') >= 0.9 && v('aridity') >= 0.6) return 'sedimentary'
  if (v('aridity') >= 0.6) return 'desert'
  return 'highland'
}

export function probeSite(id: string, lat: number, lon: number, place: string | null, d: ProbeData, when = new Date()): EarthSite {
  const factors = probeFactors(lat, lon, d)
  const name = place ? `Field probe: ${place}` : `Field probe ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
  const measuredCount = FACTOR_KEYS.filter(k => factors[k].value != null).length
  return {
    id, name, country: place?.split(', ').pop() ?? 'Unknown', lat, lon, status: 'discovery', environment: guessEnvironment(factors),
    description: `Characterized live from open data on ${when.toISOString().slice(0, 10)}: ${measuredCount} of ${FACTOR_KEYS.length} factors measured.`,
    factors, probedAt: when.toISOString(),
  }
}

/** Requirement 7.2: a high-scoring probe far from every listed analog is a new analog candidate. */
export const NEW_ANALOG_KM = 200
export const NEW_ANALOG_ASI = 75
