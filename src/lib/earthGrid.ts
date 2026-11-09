/**
 * Global search: screens every land cell on Earth (0.5°, about 55 km) for any Moon or Mars target,
 * so new analogs are found systematically rather than by clicking around.
 *
 * Built by scripts/build-earth-grid.py from open data: Köppen-Geiger climate zones (Rubel et al.),
 * GeoNames towns, the Earth Impact Database, the Smithsonian volcano list and Natural Earth salt
 * flats, glaciers, regions and countries. Ten of the 13 factors can be screened this way; slope,
 * anorthosite and caves need the live probe or a field survey, so the screening confidence says
 * how much of a target's profile was covered. Two stages, as in real site selection:
 * screen the planet coarsely, then characterize the best cells precisely with the live probe.
 */
import type { EarthSite, FactorKey, FactorValue, PlanetTarget } from '../data/types'
import { FACTOR_KEYS } from '../data/types'
import { CLIMATE_ZONES } from '../data/climateZones'
import { factorSimilarity } from './scoring'
import { distanceKm } from './geo'
import { lowSunRaw, lowSunValue } from './sun'

export interface GridMeta {
  version: number
  res: number
  w: number
  h: number
  land: number
  record: number
  built: string
  climates: string[]
  countries: string[]
  regions: [string, string][]
}

/** Factors the global grid can screen. The rest stay "no data" until a live probe. */
export const SCREENED: FactorKey[] = ['thermal', 'aridity', 'cold', 'ice', 'barren', 'isolation', 'crater', 'basalt', 'sediment', 'lowsun']

export interface EarthGrid {
  meta: GridMeta
  /** raster index -> land cell number, or -1 for sea */
  cellOf: Int32Array
  /** land cell number -> raster index */
  rasterOf: Int32Array
  climate: Uint8Array
  flags: Uint8Array
  townKm: Uint16Array
  country: Uint8Array
  region: Uint16Array
  /** Screened factor values, one array per factor, indexed by land cell */
  values: Record<FactorKey, Float32Array>
}

const PLAYA = 1 << 5, NEAR_PLAYA = 1 << 6, GLACIER = 1 << 7

/** Remoteness from distance to the nearest town of 1,000+ people: 0 km = 0, 150 km or more = 1. */
export const isolationFromKm = (km: number) => Math.min(1, Math.max(0, Math.log(1 + km / 5) / Math.log(31)))

export function decodeEarthGrid(meta: GridMeta, bytes: Uint8Array): EarthGrid {
  const { w, h, land, record } = meta
  const n = w * h
  const bitmapBytes = Math.ceil(n / 8)
  if (bytes.length < bitmapBytes + land * record) throw new Error('Grid file is shorter than its description')
  const cellOf = new Int32Array(n).fill(-1)
  const rasterOf = new Int32Array(land)
  let c = 0
  for (let i = 0; i < n; i++) {
    if (bytes[i >> 3] & (0x80 >> (i & 7))) { cellOf[i] = c; rasterOf[c] = i; c++ }
  }
  if (c !== land) throw new Error(`Grid says ${land} land cells, bitmap has ${c}`)
  const climate = new Uint8Array(land), flags = new Uint8Array(land), townKm = new Uint16Array(land)
  const country = new Uint8Array(land), region = new Uint16Array(land)
  const values = Object.fromEntries(SCREENED.map(k => [k, new Float32Array(land)])) as Record<FactorKey, Float32Array>
  const rowSun = new Float32Array(h)
  for (let y = 0; y < h; y++) rowSun[y] = lowSunValue(90 - (y + 0.5) * meta.res)
  for (let k = 0; k < land; k++) {
    const o = bitmapBytes + k * record
    const b0 = bytes[o]
    const cls = b0 & 31, fl = b0 & 0xe0
    climate[k] = cls
    flags[k] = fl
    townKm[k] = bytes[o + 1] * 2
    country[k] = bytes[o + 3]
    region[k] = bytes[o + 4] | (bytes[o + 5] << 8)
    const zone = CLIMATE_ZONES[cls] ?? CLIMATE_ZONES[0]
    const glacier = (fl & GLACIER) !== 0
    values.thermal[k] = zone.thermal
    values.aridity[k] = zone.aridity
    values.cold[k] = zone.cold
    values.ice[k] = Math.max(zone.ice, glacier ? 0.9 : 0)
    // Glaciers in a mountain cell come with bare rock around them; ice caps are already counted as ice-covered
    values.barren[k] = cls === 30 ? zone.barren : Math.max(zone.barren, glacier ? 0.55 : 0)
    values.isolation[k] = isolationFromKm(townKm[k])
    values.crater[k] = (bytes[o + 2] >> 4) / 15
    values.basalt[k] = (bytes[o + 2] & 15) / 15
    values.sediment[k] = fl & PLAYA ? 1 : fl & NEAR_PLAYA ? 0.6 : 0
    values.lowsun[k] = rowSun[Math.floor(rasterOf[k] / w)]
  }
  return { meta, cellOf, rasterOf, climate, flags, townKm, country, region, values }
}

export function cellAt(g: EarthGrid, lat: number, lon: number): number {
  const { w, h, res } = g.meta
  const y = Math.min(h - 1, Math.max(0, Math.floor((90 - lat) / res)))
  const x = Math.min(w - 1, Math.max(0, Math.floor((((lon + 180) % 360) + 360) % 360 / res)))
  return g.cellOf[y * w + x]
}

export function cellCenter(g: EarthGrid, cell: number) {
  const i = g.rasterOf[cell], { w, res } = g.meta
  return { lat: 90 - (Math.floor(i / w) + 0.5) * res, lon: -180 + ((i % w) + 0.5) * res }
}

/** Natural Earth names are often upper case; "DESIERTO DE ATACAMA" reads better as "Desierto de Atacama". */
const SMALL = /\b(De|Del|Da|Do|Dos|Das|La|Las|Los|Le|Les|Des|Du|Di|Of|And|The|El|Al)\b/g
export const niceName = (s: string) => s.replace(/\s+/g, ' ').trim().replace(SMALL, (m, _a, off: number) => (off === 0 ? m : m.toLowerCase())).replace(/\b([DL])[’']/g, (m, l: string, off: number) => (off === 0 ? m : `${l.toLowerCase()}’`))

export function placeOf(g: EarthGrid, cell: number) {
  const [region, kind] = g.meta.regions[g.region[cell]] ?? ['', '']
  const country = g.meta.countries[g.country[cell]] ?? ''
  const c = cellCenter(g, cell)
  const where = `${Math.abs(c.lat).toFixed(1)}°${c.lat >= 0 ? 'N' : 'S'} ${Math.abs(c.lon).toFixed(1)}°${c.lon >= 0 ? 'E' : 'W'}`
  const r = region ? niceName(region) : ''
  const name = r && r !== country ? `${r}, ${country}` : r || `${where}, ${country}`
  return { name, region: region ? niceName(region) : '', kind, country, where }
}

const SRC: Partial<Record<FactorKey, string>> = {
  thermal: 'koppen', aridity: 'koppen', cold: 'koppen', ice: 'koppen', barren: 'koppen',
  isolation: 'geonames', crater: 'eid', basalt: 'gvp', sediment: 'natural-earth', lowsun: 'solar-geometry',
}

/** All 13 factors for one cell: screened values with their meaning, the rest marked for the live probe. */
export function cellFactors(g: EarthGrid, cell: number): Record<FactorKey, FactorValue> {
  const zone = CLIMATE_ZONES[g.climate[cell]] ?? CLIMATE_ZONES[0]
  const fl = g.flags[cell]
  const lat = cellCenter(g, cell).lat
  const raw: Partial<Record<FactorKey, string>> = {
    thermal: `Climate zone ${zone.code}, ${zone.label}`,
    aridity: `Climate zone ${zone.code}, ${zone.label}`,
    cold: `Climate zone ${zone.code}, ${zone.label}`,
    ice: fl & GLACIER ? `Glaciers mapped in this cell; climate zone ${zone.code}` : `Climate zone ${zone.code}, ${zone.label}`,
    barren: g.climate[cell] === 30 ? 'Mostly ice-covered: little exposed rock' : fl & GLACIER ? 'Glaciers with bare rock around them' : `Climate zone ${zone.code}, ${zone.label}`,
    isolation: `About ${g.townKm[cell] >= 510 ? '510+' : g.townKm[cell]} km to the nearest town of 1,000+ people`,
    crater: g.values.crater[cell] > 0 ? 'Confirmed impact structure in or near this cell' : 'No confirmed impact structure here',
    basalt: g.values.basalt[cell] > 0 ? 'Young volcanoes nearby (mostly basaltic types score higher)' : 'No Holocene volcano within 100 km',
    sediment: fl & PLAYA ? 'Salt flat in this cell' : fl & NEAR_PLAYA ? 'Salt flat next to this cell' : 'No mapped salt flat',
    lowsun: lowSunRaw(lat),
  }
  const out = {} as Record<FactorKey, FactorValue>
  for (const k of FACTOR_KEYS) {
    out[k] = SCREENED.includes(k)
      ? { value: Number(g.values[k][cell].toFixed(3)), raw: raw[k]!, sourceId: SRC[k]!, estimate: k === 'thermal' || k === 'aridity' || k === 'cold' || k === 'ice' || k === 'barren' }
      : { value: null, raw: 'Not screened globally: probe this spot live', sourceId: k === 'caves' ? 'usgs-caves' : k === 'roughness' ? 'cop-dem' : 'macrostrat', estimate: false }
  }
  return out
}

/** Share of a target's profile weight that the global screening can see. */
export function screenConfidence(t: PlanetTarget): number {
  let all = 0, seen = 0
  for (const [k, w] of Object.entries(t.profile) as [FactorKey, number][]) { all += w; if (SCREENED.includes(k) && t.factors[k] != null) seen += w }
  return all ? seen / all : 0
}

/** Screening score (0..100) of every land cell against a target: the ASI over the screened factors. */
export function screen(g: EarthGrid, t: PlanetTarget): Float32Array {
  const parts = (Object.entries(t.profile) as [FactorKey, number][]).filter(([k, w]) => w > 0 && SCREENED.includes(k) && t.factors[k] != null)
  const total = parts.reduce((s, [, w]) => s + w, 0)
  const out = new Float32Array(g.meta.land)
  if (!total) return out
  for (let c = 0; c < g.meta.land; c++) {
    let s = 0
    for (const [k, w] of parts) s += w * factorSimilarity(g.values[k][c], t.factors[k]!)
    out[c] = (100 * s) / total
  }
  return out
}

export interface Candidate {
  cell: number
  lat: number
  lon: number
  score: number
  name: string
  region: string
  country: string
  climate: string
  townKm: number
  /** Nearest site already listed in the app, and how far away */
  nearestListed: { name: string; km: number } | null
}

/**
 * The best cells that are NOT already known: at least `fromListedKm` from every listed analog and
 * `apartKm` from each other, so the list spreads across the planet instead of one big desert.
 */
export function findCandidates(g: EarthGrid, scores: Float32Array, listed: Pick<EarthSite, 'name' | 'lat' | 'lon'>[], n = 8, apartKm = 450, fromListedKm = 300): Candidate[] {
  const order = Array.from({ length: g.meta.land }, (_, i) => i).sort((a, b) => scores[b] - scores[a])
  const picked: Candidate[] = []
  for (const cell of order) {
    if (picked.length >= n) break
    const p = cellCenter(g, cell)
    let nearest: Candidate['nearestListed'] = null
    for (const s of listed) {
      const km = distanceKm(p, s)
      if (!nearest || km < nearest.km) nearest = { name: s.name, km }
    }
    if (nearest && nearest.km < fromListedKm) continue
    if (picked.some(q => distanceKm(q, p) < apartKm)) continue
    const pl = placeOf(g, cell)
    const zone = CLIMATE_ZONES[g.climate[cell]] ?? CLIMATE_ZONES[0]
    picked.push({ cell, ...p, score: Math.round(scores[cell]), name: pl.name, region: pl.region, country: pl.country, climate: `${zone.code}, ${zone.label}`, townKm: g.townKm[cell], nearestListed: nearest })
  }
  return picked
}

/** Percentile (0..1) of a value among land cells; ties count half, so big flat regions don't distort it. */
export function percentileOf(scores: Float32Array, value: number): number {
  let below = 0, same = 0
  for (let i = 0; i < scores.length; i++) { if (scores[i] < value - 1e-6) below++; else if (scores[i] <= value + 1e-6) same++ }
  return scores.length ? (below + same / 2) / scores.length : 0
}

/**
 * Validation: do the analogs agencies already use come out near the top of the screening?
 * Returns each site's percentile among all land cells, so a method that only rewards
 * deserts, say, would show up as known polar analogs ranking low.
 */
export function validate(g: EarthGrid, scores: Float32Array, sites: Pick<EarthSite, 'id' | 'name' | 'lat' | 'lon'>[]) {
  const rows = sites
    .map(s => { const c = cellAt(g, s.lat, s.lon); return c < 0 ? null : { id: s.id, name: s.name, score: Math.round(scores[c]), percentile: percentileOf(scores, scores[c]) } })
    .filter((r): r is { id: string; name: string; score: number; percentile: number } => !!r)
  const sorted = rows.map(r => r.percentile).sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0
  return { rows, median }
}

/** Colour for a screening score: dim land, through blue and teal, to gold for the best matches. */
const STOPS: [number, [number, number, number]][] = [[0, [27, 36, 54]], [0.35, [36, 80, 122]], [0.6, [46, 143, 138]], [0.78, [159, 191, 79]], [0.9, [233, 178, 76]], [1, [255, 241, 193]]]
export function scoreColor(score: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (score - 20) / 70))
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i]
    if (t <= b) {
      const [a, ca] = STOPS[i - 1]
      const f = (t - a) / (b - a)
      return [0, 1, 2].map(j => Math.round(ca[j] + (cb[j] - ca[j]) * f)) as [number, number, number]
    }
  }
  return STOPS[STOPS.length - 1][1]
}

/** Paints the screening into RGBA pixels, one per grid cell; the sea stays transparent. */
export function paintScores(g: EarthGrid, scores: Float32Array, out: Uint8ClampedArray) {
  for (let i = 0; i < g.cellOf.length; i++) {
    const c = g.cellOf[i], o = i * 4
    if (c < 0) { out[o + 3] = 0; continue }
    const [r, gg, b] = scoreColor(scores[c])
    out[o] = r; out[o + 1] = gg; out[o + 2] = b; out[o + 3] = 255
  }
}

let job: Promise<EarthGrid> | null = null
/** Loads the grid once (about 600 KB, served with the app so it works offline). */
export function loadEarthGrid(base = ''): Promise<EarthGrid> {
  if (!job) {
    job = Promise.all([
      fetch(`${base}data/earth-grid.json`).then(r => { if (!r.ok) throw new Error(`grid meta ${r.status}`); return r.json() as Promise<GridMeta> }),
      fetch(`${base}data/earth-grid.bin`).then(r => { if (!r.ok) throw new Error(`grid data ${r.status}`); return r.arrayBuffer() }),
    ]).then(([meta, buf]) => decodeEarthGrid(meta, new Uint8Array(buf)))
    job.catch(() => { job = null })
  }
  return job
}
