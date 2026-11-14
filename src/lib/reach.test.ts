import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodeEarthGrid, placeOf, screen, type GridMeta } from './earthGrid'
import { TARGETS, targetById } from '../data/targets'
import { HOMES, MAX_KM, MIN_KM, bestWithin, distancesFrom, kmOfSlider, reachFrontier, sliderOfKm } from './reach'

const file = (p: string) => fileURLToPath(new URL(`../../public/data/${p}`, import.meta.url))
const g = decodeEarthGrid(JSON.parse(readFileSync(file('earth-grid.json'), 'utf8')) as GridMeta, new Uint8Array(readFileSync(file('earth-grid.bin'))))
const kl = HOMES[0]

describe('analog within reach', () => {
  it('builds a frontier that only moves outwards and upwards, ending at the best place on Earth', () => {
    for (const t of TARGETS) {
      const scores = screen(g, t), km = distancesFrom(g, kl)
      const f = reachFrontier(scores, km)
      expect(f.length, t.id).toBeGreaterThan(1)
      for (let i = 1; i < f.length; i++) {
        expect(f[i].km).toBeGreaterThanOrEqual(f[i - 1].km)
        expect(f[i].score).toBeGreaterThan(f[i - 1].score)
      }
      expect(Math.max(...scores) - f[f.length - 1].score).toBeLessThan(1)
      expect(f.length).toBeLessThan(110) // one point of gain per step at most
    }
  })
  it('finds nothing closer and better than a frontier step', () => {
    const scores = screen(g, targetById('gale')), km = distancesFrom(g, kl)
    for (const s of reachFrontier(scores, km)) {
      for (let c = 0; c < scores.length; c += 7) if (km[c] < s.km) expect(scores[c]).toBeLessThan(s.score)
    }
  })
  it('gives the best place inside a travel radius, and agrees with the frontier', () => {
    const scores = screen(g, targetById('utopia')), km = distancesFrom(g, kl)
    const near = bestWithin(scores, km, 1500)!, far = bestWithin(scores, km, 6000)!, all = bestWithin(scores, km, MAX_KM)!
    expect(near.km).toBeLessThanOrEqual(1500)
    expect(far.score).toBeGreaterThanOrEqual(near.score)
    expect(all.score).toBeCloseTo(Math.max(...scores), 4)
    // From rainy Kuala Lumpur a Mars-like desert is far away: reach matters
    expect(far.score - near.score).toBeGreaterThan(10)
    expect(placeOf(g, far.cell).country).toBeTruthy()
    expect(bestWithin(scores, km, 0)).toBeNull()
  })
  it('measures distance from home correctly', () => {
    const km = distancesFrom(g, kl)
    expect(Math.min(...km)).toBeLessThan(60) // Kuala Lumpur is on land
    expect(Math.max(...km)).toBeLessThanOrEqual(20040)
  })
  it('maps the slider to distances and back', () => {
    expect(kmOfSlider(0)).toBe(MIN_KM)
    expect(kmOfSlider(100)).toBe(MAX_KM)
    expect(kmOfSlider(50)).toBeGreaterThan(1000)
    expect(kmOfSlider(50)).toBeLessThan(2000)
    expect(kmOfSlider(sliderOfKm(3000))).toBe(3000)
    for (const h of HOMES) { expect(Math.abs(h.lat)).toBeLessThanOrEqual(90); expect(Math.abs(h.lon)).toBeLessThanOrEqual(180) }
  })
})
