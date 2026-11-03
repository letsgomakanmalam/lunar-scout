import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance, greatCircle, nearest, parsePhoton, pathKm, unwrapLon } from './geo'
import { nightBands, skyAt } from './sky'
import { EARTH_SITES } from '../data/earthSites'

describe('distances on Earth', () => {
  it('matches known distances', () => {
    expect(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })).toBeGreaterThan(340) // London to Paris ≈ 344 km
    expect(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })).toBeLessThan(347)
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(Math.PI * 6371.0088, 0)
    expect(pathKm([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }])).toBeCloseTo(2 * distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 6)
  })

  it('formats distances for people', () => {
    expect(formatDistance(0.42)).toBe('420 m')
    expect(formatDistance(8.44)).toBe('8.4 km')
    expect(formatDistance(1234.5)).toBe('1,235 km')
    expect(formatDistance(100, 'mi')).toBe('62 mi')
  })

  it('draws great circles that start and end on the points and never jump across the map', () => {
    const a = { lat: 35.7, lon: 139.7 }, b = { lat: 37.6, lon: -122.4 } // Tokyo to San Francisco crosses the date line
    const line = greatCircle(a, b)
    expect(line[0][0]).toBeCloseTo(a.lon, 6)
    expect(line[line.length - 1][1]).toBeCloseTo(b.lat, 6)
    for (let i = 1; i < line.length; i++) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180)
    expect(Math.max(...line.map(c => c[1]))).toBeGreaterThan(45) // the shortest route bends north
    expect(unwrapLon([[170, 0], [-170, 0]])[1][0]).toBe(190)
  })

  it('finds the nearest Moon analog to a place', () => {
    const kl = { lat: 3.139, lon: 101.687 }
    const n = nearest(kl, EARTH_SITES)!
    for (const s of EARTH_SITES) expect(n.km).toBeLessThanOrEqual(distanceKm(kl, s))
  })

  it('reads search results and skips broken ones', () => {
    const hits = parsePhoton({ features: [
      { geometry: { coordinates: [101.69, 3.14] }, properties: { name: 'Kuala Lumpur', country: 'Malaysia', extent: [101.6, 3.25, 101.76, 3.03], osm_type: 'R', osm_id: 2939672 } },
      { geometry: {}, properties: { name: 'broken' } },
    ] })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ name: 'Kuala Lumpur', detail: 'Malaysia', lat: 3.14, lon: 101.69, bbox: [101.6, 3.03, 101.76, 3.25] })
    expect(parsePhoton(null)).toEqual([])
  })
})

describe('Sun, Moon and night, right now', () => {
  it('puts the Sun over the Tropic of Cancer at the June solstice and the equator at the equinox', () => {
    expect(skyAt(new Date('2026-06-21T08:24:00Z')).sun.lat).toBeCloseTo(23.44, 0)
    expect(Math.abs(skyAt(new Date('2026-03-20T14:46:00Z')).sun.lat)).toBeLessThan(0.3)
  })

  it('puts the Sun near Greenwich at noon UTC', () => {
    expect(Math.abs(skyAt(new Date('2026-01-01T12:00:00Z')).sun.lon)).toBeLessThan(5)
  })

  it('keeps the Moon within its real distance and latitude range', () => {
    for (let i = 0; i < 60; i++) {
      const m = skyAt(new Date(Date.UTC(2026, 0, 1) + i * 86400000 * 1.37)).moon
      expect(m.km).toBeGreaterThan(356000)
      expect(m.km).toBeLessThan(407000)
      expect(Math.abs(m.lat)).toBeLessThan(29.5)
    }
  })

  it('puts the point opposite the Sun in the dark and the point under the Sun in daylight', () => {
    const inside = (pt: [number, number], ring: [number, number][]) => {
      let c = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j]
        if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c
      }
      return c
    }
    for (const iso of ['2026-06-21T08:00:00Z', '2026-12-21T20:00:00Z', '2026-03-20T03:00:00Z']) {
      const s = skyAt(new Date(iso)).sun
      const ring = nightBands(s).features[0].geometry.coordinates[0]
      const anti: [number, number] = [((s.lon + 360) % 360) - 180, -s.lat]
      expect(inside(anti, ring), iso).toBe(true)
      expect(inside([s.lon, s.lat], ring), iso).toBe(false)
    }
  })
})
