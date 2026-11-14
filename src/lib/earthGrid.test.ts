import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { cellAt, cellCenter, cellFactors, decodeEarthGrid, findCandidates, isolationFromKm, niceName, percentileOf, placeOf, scoreColor, screen, screenConfidence, validate, SCREENED, type GridMeta } from './earthGrid'
import { probeFactors } from './probe'
import { TARGETS, targetById } from '../data/targets'
import { EARTH_SITES } from '../data/earthSites'
import { CLIMATE_ZONES } from '../data/climateZones'
import { distanceKm } from './geo'
import { rankTwins } from './twins'
import { ordinal } from './format'

const file = (p: string) => fileURLToPath(new URL(`../../public/data/${p}`, import.meta.url))
const meta = JSON.parse(readFileSync(file('earth-grid.json'), 'utf8')) as GridMeta
const bytes = new Uint8Array(readFileSync(file('earth-grid.bin')))
const g = decodeEarthGrid(meta, bytes)
const zoneAt = (lat: number, lon: number) => CLIMATE_ZONES[g.climate[cellAt(g, lat, lon)]].code

describe('global screening grid', () => {
  it('decodes every land cell and rejects a truncated file', () => {
    expect(g.meta.land).toBeGreaterThan(80000)
    expect(g.rasterOf).toHaveLength(g.meta.land)
    expect(() => decodeEarthGrid(meta, bytes.slice(0, 1000))).toThrow()
    const c = cellAt(g, 3.14, 101.69)
    expect(cellCenter(g, c).lat).toBeCloseTo(3.25, 1)
  })
  it('puts real places in the right climate zones', () => {
    expect(zoneAt(3.14, 101.69)).toBe('Af') // Kuala Lumpur
    expect(zoneAt(-24.08, -70.17)).toBe('BWk') // Atacama
    expect(zoneAt(23, 10)).toBe('BWh') // Sahara
    expect(zoneAt(-80, 60)).toBe('EF') // Antarctic plateau
    expect(cellAt(g, 0, -150)).toBe(-1) // Pacific Ocean
  })
  it('knows craters, salt flats, volcanoes and remoteness', () => {
    const meteor = cellAt(g, 35.03, -111.02), uyuni = cellAt(g, -20.13, -67.49), kl = cellAt(g, 3.14, 101.69)
    expect(g.values.crater[meteor]).toBeGreaterThan(0.9)
    expect(g.values.sediment[uyuni]).toBe(1)
    expect(g.values.basalt[cellAt(g, 25, 39.9)]).toBeGreaterThan(0.8) // Harrat Khaybar
    expect(g.values.isolation[kl]).toBeLessThan(0.4)
    expect(g.values.isolation[cellAt(g, -80, 60)]).toBe(1)
    expect(placeOf(g, uyuni).name).toContain('Bolivia')
  })
  it('gives 15 factors per cell, leaving the unscreenable ones for the live probe', () => {
    const f = cellFactors(g, cellAt(g, -24.08, -70.17))
    expect(Object.keys(f)).toHaveLength(15)
    expect(f.wind.value).toBeNull()
    expect(f.life.value).toBeGreaterThan(0.85) // the Atacama: almost no liquid water
    expect(f.roughness.value).toBeNull()
    expect(f.anorthosite.value).toBeNull()
    expect(f.caves.value).toBeNull()
    for (const k of SCREENED) expect(f[k].value, k).not.toBeNull()
  })
  it('scores every target from 0 to 100 and finds well-separated new candidates', () => {
    for (const t of TARGETS) {
      const s = screen(g, t)
      expect(Math.min(...s)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...s)).toBeLessThanOrEqual(100)
      expect(screenConfidence(t)).toBeGreaterThan(0.5)
      const c = findCandidates(g, s, EARTH_SITES, 6)
      expect(c.length).toBe(6)
      for (const x of c) expect(Math.min(...EARTH_SITES.map(e => distanceKm(e, x)))).toBeGreaterThanOrEqual(300)
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) expect(distanceKm(c[i], c[j])).toBeGreaterThanOrEqual(450)
    }
  })
  it('ranks the analogs agencies already use near the top (validation)', () => {
    // Each site is checked against its own relevant known analogs, as the app does
    for (const id of ['jezero', 'gale', 'marius-hills', 'malapert', 'oxia']) {
      const t = targetById(id)
      const s = screen(g, t)
      const known = rankTwins(t, EARTH_SITES).filter(r => r.site.status === 'known').slice(0, 5).map(r => r.site)
      const v = validate(g, s, known)
      expect(v.rows).toHaveLength(5)
      expect(v.median, id).toBeGreaterThan(0.85)
    }
    // and it discriminates: for a polar Moon site, a polar crater beats a hot desert
    const polar = screen(g, targetById('malapert'))
    const site = (id: string) => EARTH_SITES.find(e => e.id === id)!
    const [haughton, death] = validate(g, polar, [site('haughton'), site('deathvalley')]).rows
    expect(haughton.percentile).toBeGreaterThan(death.percentile)
    // ice sheets are not bare ground: no ice-cap cell may win a lava-tube target
    const lava = screen(g, targetById('marius-hills'))
    const best = findCandidates(g, lava, EARTH_SITES, 5)
    for (const c of best) expect(c.climate.startsWith('EF')).toBe(false)
  })
  it('has sensible helpers', () => {
    expect(isolationFromKm(0)).toBe(0)
    expect(isolationFromKm(150)).toBeCloseTo(1, 5)
    expect(isolationFromKm(40)).toBeGreaterThan(isolationFromKm(20))
    expect(niceName('Desierto De Atacama')).toBe('Desierto de Atacama')
    expect(niceName('Péninsule D’Ungava')).toBe('Péninsule d’Ungava')
    expect(percentileOf(new Float32Array([1, 2, 2, 3]), 2)).toBeCloseTo(0.5, 5)
    expect(['1st', '2nd', '3rd', '11th', '12th', '21st', '52nd', '71st', '94th'].join()).toBe([1, 2, 3, 11, 12, 21, 52, 71, 94].map(n => ordinal(n)).join())
    expect(scoreColor(0)).toEqual([27, 36, 54])
    expect(scoreColor(100)).toEqual([255, 241, 193])
  })
  it('lets live probes use remoteness from the grid', () => {
    const f = probeFactors(-24.08, -70.17, { townKm: 68 })
    expect(f.isolation.value).toBeGreaterThan(0.7)
    expect(f.isolation.sourceId).toBe('geonames')
  })
})
