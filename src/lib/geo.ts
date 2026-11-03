/** Distances and paths on the real (curved) Earth. */
const R = 6371.0088 // mean Earth radius, km
const RAD = Math.PI / 180

export type Units = 'km' | 'mi'
export interface LatLon { lat: number; lon: number }

/** Great-circle distance in km (haversine formula). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLon = (b.lon - a.lon) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Total length of a path through several points, in km. */
export const pathKm = (pts: LatLon[]) => pts.slice(1).reduce((sum, p, i) => sum + distanceKm(pts[i], p), 0)

export function formatDistance(km: number, units: Units = 'km') {
  if (units === 'km' && km < 1) return `${Math.round(km * 1000)} m`
  const v = units === 'mi' ? km * 0.621371 : km
  const digits = v < 10 ? 1 : 0
  return `${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units}`
}

/** Points along the great circle from a to b as [lon, lat], so long lines curve the way flights do. */
export function greatCircle(a: LatLon, b: LatLon, stepKm = 100): [number, number][] {
  const d = distanceKm(a, b)
  const delta = d / R
  if (delta < 1e-9 || Math.PI - delta < 1e-6) return [[a.lon, a.lat], [b.lon, b.lat]]
  const n = Math.max(1, Math.min(128, Math.ceil(d / stepKm)))
  const p1 = a.lat * RAD, l1 = a.lon * RAD, p2 = b.lat * RAD, l2 = b.lon * RAD
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * delta) / Math.sin(delta)
    const B = Math.sin(f * delta) / Math.sin(delta)
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
    const z = A * Math.sin(p1) + B * Math.sin(p2)
    out.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.hypot(x, y)) / RAD])
  }
  return unwrapLon(out)
}

/** Keeps longitudes continuous so a line crossing the date line doesn't jump across the map. */
export function unwrapLon(coords: [number, number][]): [number, number][] {
  const out = coords.map(c => [c[0], c[1]] as [number, number])
  for (let i = 1; i < out.length; i++) {
    while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360
    while (out[i][0] - out[i - 1][0] < -180) out[i][0] += 360
  }
  return out
}

/** The closest item to a point, with its distance. */
export function nearest<T extends LatLon>(from: LatLon, items: readonly T[]): { item: T; km: number } | null {
  let best: T | null = null
  let bestKm = Infinity
  for (const it of items) {
    const km = distanceKm(from, it)
    if (km < bestKm) { best = it; bestKm = km }
  }
  return best ? { item: best, km: bestKm } : null
}

/** A place found by search. bbox is [west, south, east, north]. */
export interface PlaceHit { id: string; name: string; detail: string; lat: number; lon: number; bbox?: [number, number, number, number] }

interface PhotonFeature { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }

/** Turns a Photon (OpenStreetMap) search response into places. Ignores anything malformed. */
export function parsePhoton(json: unknown): PlaceHit[] {
  const features = (json as { features?: unknown })?.features
  if (!Array.isArray(features)) return []
  const out: PlaceHit[] = []
  features.forEach((raw, i) => {
    const f = raw as PhotonFeature
    const c = f.geometry?.coordinates
    if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') return
    const p = f.properties ?? {}
    const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined)
    const name = str('name') ?? str('street') ?? str('city') ?? str('country') ?? 'Unnamed place'
    const detail = [str('city'), str('state'), str('country')].filter((x, j, arr): x is string => !!x && x !== name && arr.indexOf(x) === j).join(', ')
    const e = p.extent
    const bbox = Array.isArray(e) && e.length === 4 && e.every(v => typeof v === 'number')
      ? ([e[0], e[3], e[2], e[1]] as [number, number, number, number]) // Photon gives [west, north, east, south]
      : undefined
    out.push({ id: `${str('osm_type') ?? ''}${p.osm_id ?? i}-${i}`, name, detail, lat: c[1], lon: c[0], bbox })
  })
  return out
}
