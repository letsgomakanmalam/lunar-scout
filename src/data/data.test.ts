import { describe, expect, it } from 'vitest'
import { EARTH_SITES } from './earthSites'
import { LUNAR_TARGETS, MISSIONS } from './moon'
import { SOURCES } from './sources'
import { MODULES } from './modules'
import { FACTOR_KEYS } from './types'
import { computeASI } from '../lib/scoring'

const sourceIds = new Set(SOURCES.map(s => s.id))

describe('data integrity', () => {
  it('has unique ids', () => {
    for (const list of [EARTH_SITES, LUNAR_TARGETS, MISSIONS, SOURCES, MODULES]) {
      const ids = list.map(x => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('earth sites have valid coordinates and every factor cites a known source', () => {
    for (const s of EARTH_SITES) {
      expect(Math.abs(s.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(s.lon)).toBeLessThanOrEqual(180)
      for (const k of FACTOR_KEYS) {
        const f = s.factors[k]
        expect(f, `${s.id}.${k}`).toBeDefined()
        if (f.value !== null) {
          expect(f.value).toBeGreaterThanOrEqual(0)
          expect(f.value).toBeLessThanOrEqual(1)
        }
        expect(sourceIds.has(f.sourceId), `${s.id}.${k} source ${f.sourceId}`).toBe(true)
      }
    }
  })

  it('missions point to real targets and have positive weights', () => {
    for (const m of MISSIONS) {
      expect(LUNAR_TARGETS.some(t => t.id === m.targetId), m.id).toBe(true)
      const w = Object.values(m.weights)
      expect(w.length).toBeGreaterThan(0)
      expect(w.every(x => (x ?? 0) > 0)).toBe(true)
    }
  })

  it('every mission can be passed by at least one site', () => {
    for (const m of MISSIONS) {
      const t = LUNAR_TARGETS.find(x => x.id === m.targetId)!
      const best = Math.max(...EARTH_SITES.map(s => computeASI(s, t, m).asi ?? 0))
      expect(best, `${m.id} best ASI`).toBeGreaterThanOrEqual(m.passAsi)
    }
  })

  it('module unlocks reference real modules', () => {
    for (const m of MISSIONS) if (m.unlocks) expect(MODULES.some(x => x.id === m.unlocks)).toBe(true)
  })
})
