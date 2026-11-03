import { describe, expect, it } from 'vitest'
import { computeASI, factorSimilarity, starsFor } from './scoring'
import type { EarthSite, LunarTarget, Mission } from '../data/types'

const fv = (value: number | null) => ({ value, raw: '', sourceId: 'power', estimate: true })
const v = (vals: Partial<Record<string, number | null>>, k: string) => (k in vals ? vals[k] ?? null : 0.5)
const site = (vals: Partial<Record<string, number | null>>): EarthSite => ({
  id: 's', name: 'S', country: 'X', lat: 0, lon: 0, status: 'known', environment: 'desert', description: '',
  factors: {
    thermal: fv(v(vals, 'thermal')), aridity: fv(v(vals, 'aridity')), roughness: fv(v(vals, 'roughness')),
    basalt: fv(v(vals, 'basalt')), crater: fv(v(vals, 'crater')), caves: fv(v(vals, 'caves')),
    cold: fv(v(vals, 'cold')), isolation: fv(v(vals, 'isolation')),
  },
})
const target: LunarTarget = { id: 't', name: 'T', lat: 0, lon: 0, description: '', landable: false, factors: { aridity: 1, roughness: 0.5, isolation: 1 } }
const mission: Mission = { id: 'm', title: 'M', brief: '', targetId: 't', passAsi: 60, reward: 0, equipmentTip: '', weights: { aridity: 0.5, roughness: 0.25, isolation: 0.25 } }

describe('factorSimilarity', () => {
  it('is 1 for equal values and 0 for opposite values', () => {
    expect(factorSimilarity(0.3, 0.3)).toBe(1)
    expect(factorSimilarity(0, 1)).toBe(0)
  })
})

describe('computeASI', () => {
  it('scores 100 when the site matches the target', () => {
    const r = computeASI(site({ aridity: 1, roughness: 0.5, isolation: 1 }), target, mission)
    expect(r.asi).toBe(100)
    expect(r.confidence).toBe(1)
  })

  it('always stays between 0 and 100', () => {
    for (let i = 0; i < 200; i++) {
      const s = site({ aridity: Math.random(), roughness: Math.random(), isolation: Math.random() })
      const r = computeASI(s, target, mission)
      expect(r.asi!).toBeGreaterThanOrEqual(0)
      expect(r.asi!).toBeLessThanOrEqual(100)
    }
  })

  it('skips missing data and re-normalizes weights', () => {
    const r = computeASI(site({ aridity: null, roughness: 0.5, isolation: 1 }), target, mission)
    expect(r.missing).toEqual(['aridity'])
    expect(r.asi).toBe(100)
    expect(r.confidence).toBeCloseTo(0.5)
  })

  it('returns null ASI when no factor has data', () => {
    const r = computeASI(site({ aridity: null, roughness: null, isolation: null }), target, mission)
    expect(r.asi).toBeNull()
    expect(r.confidence).toBe(0)
  })

  it('does not change when all weights are scaled', () => {
    const s = site({ aridity: 0.7, roughness: 0.2, isolation: 0.4 })
    const scaled = { ...mission, weights: { aridity: 5, roughness: 2.5, isolation: 2.5 } }
    expect(computeASI(s, target, scaled).asi).toBe(computeASI(s, target, mission).asi)
  })

  it('never decreases when a factor moves closer to the target', () => {
    const a = computeASI(site({ aridity: 0.4, roughness: 0.5, isolation: 1 }), target, mission).asi!
    const b = computeASI(site({ aridity: 0.8, roughness: 0.5, isolation: 1 }), target, mission).asi!
    expect(b).toBeGreaterThanOrEqual(a)
  })
})

describe('starsFor', () => {
  it('awards stars by margin and probe use', () => {
    expect(starsFor(55, 60, 1)).toBe(0)
    expect(starsFor(61, 60, 1)).toBe(1)
    expect(starsFor(72, 60, 6)).toBe(2)
    expect(starsFor(85, 60, 3)).toBe(3)
  })
})
