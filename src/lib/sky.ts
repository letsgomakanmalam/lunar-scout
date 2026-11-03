/**
 * Where the Sun and the Moon are overhead right now, and where it is night.
 * Low-precision formulas (about 1 degree), plenty for a world map; the Moon part follows
 * the widely used method in SunCalc by Vladimir Agafonkin.
 */
import type { LatLon } from './geo'

const RAD = Math.PI / 180
const DAY_MS = 86400000
const J1970 = 2440588
const J2000 = 2451545
const OBLIQUITY = 23.4397 * RAD

const daysSinceJ2000 = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000
const siderealDeg = (d: number) => 280.16 + 360.9856235 * d
const wrapLon = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

function subPoint(ra: number, dec: number, d: number): LatLon {
  return { lat: dec / RAD, lon: wrapLon(ra / RAD - siderealDeg(d)) }
}

function sun(d: number) {
  const M = RAD * (357.5291 + 0.98560028 * d)
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + RAD * 102.9372 + Math.PI
  return { ra: Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L)), dec: Math.asin(Math.sin(OBLIQUITY) * Math.sin(L)) }
}

function moon(d: number) {
  const L = RAD * (218.316 + 13.176396 * d)
  const M = RAD * (134.963 + 13.064993 * d)
  const F = RAD * (93.272 + 13.22935 * d)
  const l = L + RAD * 6.289 * Math.sin(M)
  const b = RAD * 5.128 * Math.sin(F)
  return {
    ra: Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)),
    km: 385001 - 20905 * Math.cos(M),
  }
}

export interface SkyNow { at: Date; sun: LatLon; moon: LatLon & { km: number } }

export function skyAt(date: Date): SkyNow {
  const d = daysSinceJ2000(date)
  const s = sun(d)
  const m = moon(d)
  return { at: date, sun: subPoint(s.ra, s.dec, d), moon: { ...subPoint(m.ra, m.dec, d), km: m.km } }
}

/**
 * Night as map polygons: one per sun altitude (0° sunset, -6° and -12° twilight), so
 * stacked semi-transparent fills give a soft, realistic edge.
 */
export function nightBands(sunAt: LatLon, altitudes = [0, -6, -12]) {
  const dec = Math.max(Math.abs(sunAt.lat), 0.1) * Math.sign(sunAt.lat || 1) * RAD
  return {
    type: 'FeatureCollection' as const,
    features: altitudes.map(h => {
      const ring: [number, number][] = []
      for (let lon = -180; lon <= 180; lon += 2) {
        const H = (lon - sunAt.lon) * RAD
        // Sun altitude at latitude φ: sin(alt) = A·sinφ + B·cosφ = R·sin(φ + θ)
        const A = Math.sin(dec), B = Math.cos(dec) * Math.cos(H)
        const R = Math.hypot(A, B), th = Math.atan2(B, A)
        const k = Math.asin(Math.max(-1, Math.min(1, Math.sin(h * RAD) / R)))
        const norm = (x: number) => Math.atan2(Math.sin(x), Math.cos(x))
        const a1 = norm(k - th), a2 = norm(Math.PI - k - th)
        const phi = Math.abs(a1) <= Math.PI / 2 ? a1 : a2
        ring.push([lon, Math.max(-85, Math.min(85, phi / RAD))])
      }
      // The pole that is in darkness closes the shape: the Sun's altitude at the north pole equals its declination.
      const pole = dec / RAD < h ? 85 : -85
      ring.push([180, pole], [-180, pole], ring[0])
      return { type: 'Feature' as const, properties: { altitude: h }, geometry: { type: 'Polygon' as const, coordinates: [ring] } }
    }),
  }
}
