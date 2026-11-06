/**
 * Live data for a field probe. Every service is keyless and allows requests from a web page.
 * Each call has its own timeout and failure never stops the others: a probe with fewer
 * measurements just reports lower data confidence. Also used by scripts/measure-sites.ts (Node 20+).
 */
import { ndviDate, parseElevations, parseMacrostrat, parseNdvi, parsePower, reliefGrid, type Climate, type Geology, type ProbeData } from './probe'

export type StepId = 'climate' | 'terrain' | 'plants' | 'rocks' | 'place'
export type StepState = 'wait' | 'ok' | 'fail'

export const STEPS: { id: StepId; label: string; source: string }[] = [
  { id: 'climate', label: 'Climate', source: 'NASA POWER' },
  { id: 'terrain', label: 'Terrain', source: 'Copernicus DEM (ESA)' },
  { id: 'plants', label: 'Vegetation', source: 'NASA MODIS' },
  { id: 'rocks', label: 'Rock type', source: 'Macrostrat' },
  { id: 'place', label: 'Place name', source: 'OpenStreetMap' },
]

const POWER_PARAMS = ['T2M', 'T2M_MIN', 'T2M_RANGE', 'PRECTOTCORR']

export const powerUrl = (lat: number, lon: number, params = POWER_PARAMS) =>
  `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=${params.join(',')}&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&format=JSON`

export const elevationUrl = (pts: { lat: number; lon: number }[]) =>
  `https://api.open-meteo.com/v1/elevation?latitude=${pts.map(p => p.lat.toFixed(4)).join(',')}&longitude=${pts.map(p => p.lon.toFixed(4)).join(',')}`

export const ndviUrl = (lat: number, lon: number) => {
  const d = ndviDate(lat)
  return `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&band=250m_16_days_NDVI&startDate=${d}&endDate=${d}&kmAboveBelow=1&kmLeftRight=1`
}

export const geologyUrl = (lat: number, lon: number) => `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}`

export const placeUrl = (lat: number, lon: number) => `https://photon.komoot.io/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&lang=en`

type Fetch = typeof fetch

async function getJson(url: string, timeoutMs: number, f: Fetch, accept = 'application/json'): Promise<unknown> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await f(url, { signal: ctl.signal, headers: { Accept: accept } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

/** "Name, Region, Country" from a Photon reverse-geocoding answer. */
export function parsePlace(json: unknown): string | null {
  const p = (json as { features?: { properties?: Record<string, unknown> }[] })?.features?.[0]?.properties
  if (!p) return null
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined)
  const parts = [s('name') ?? s('city') ?? s('county'), s('state'), s('country')].filter((x, i, a): x is string => !!x && a.indexOf(x) === i)
  return parts.length ? parts.join(', ') : null
}

export interface ProbeResult extends ProbeData { place: string | null; failed: StepId[] }

export interface ProbeOptions {
  onStep?: (id: StepId, state: StepState) => void
  timeoutMs?: number
  fetch?: Fetch
  /** Skip the place name (the measuring script already knows each site's name) */
  skipPlace?: boolean
}

export async function runProbe(lat: number, lon: number, opts: ProbeOptions = {}): Promise<ProbeResult> {
  const f = opts.fetch ?? fetch
  const ms = opts.timeoutMs ?? 15000
  const failed: StepId[] = []
  const step = async <T>(id: StepId, work: () => Promise<T | null>): Promise<T | null> => {
    opts.onStep?.(id, 'wait')
    try {
      const v = await work()
      opts.onStep?.(id, v == null ? 'fail' : 'ok')
      if (v == null) failed.push(id)
      return v
    } catch {
      opts.onStep?.(id, 'fail')
      failed.push(id)
      return null
    }
  }

  const climate = step<Climate>('climate', async () => {
    try {
      return parsePower(await getJson(powerUrl(lat, lon), ms, f))
    } catch {
      // If a parameter is ever retired, try again with the essentials only
      return parsePower(await getJson(powerUrl(lat, lon, ['T2M', 'T2M_MIN', 'PRECTOTCORR']), ms, f))
    }
  })
  const elevations = step<number[]>('terrain', async () => parseElevations(await getJson(elevationUrl(reliefGrid(lat, lon)), ms, f)))
  const ndvi = step<number>('plants', async () => parseNdvi(await getJson(ndviUrl(lat, lon), ms, f)))
  const geology = step<Geology>('rocks', async () => parseMacrostrat(await getJson(geologyUrl(lat, lon), ms, f)))
  const place = opts.skipPlace ? Promise.resolve(null) : step<string>('place', async () => parsePlace(await getJson(placeUrl(lat, lon), ms, f)))

  const [c, e, n, g, p] = await Promise.all([climate, elevations, ndvi, geology, place])
  return { climate: c, elevations: e, ndvi: n, geology: g, place: p, failed }
}
