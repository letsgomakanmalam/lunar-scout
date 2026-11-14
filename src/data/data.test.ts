import { describe, expect, it } from 'vitest'
import { EARTH_SITES } from './earthSites'
import { TARGETS, targetById } from './targets'
import { MISSIONS, missionsOf } from './missions'
import { SOURCES } from './sources'
import { MODULES } from './modules'
import { GAPS } from './gaps'
import { IMPACTS } from './impacts'
import { FACTOR_KEYS, FACTOR_HINTS, FACTOR_LABELS, PROCESS_KEYS, PROCESS_LABELS } from './types'
import { rankTwins, sharedProcesses } from '../lib/twins'
import { computeASI } from '../lib/scoring'

const sourceIds = new Set(SOURCES.map(s => s.id))

describe('data integrity', () => {
  it('has unique ids', () => {
    for (const list of [EARTH_SITES, TARGETS, MISSIONS, SOURCES, MODULES, GAPS]) {
      const ids = list.map(x => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('every factor has a label and a plain-language hint', () => {
    for (const k of FACTOR_KEYS) {
      expect(FACTOR_LABELS[k]).toBeTruthy()
      expect(FACTOR_HINTS[k].length).toBeGreaterThan(20)
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
      // Low polar Sun is computed, never estimated
      expect(s.factors.lowsun.estimate).toBe(false)
    }
  })

  it('covers every environment the challenge names, and new candidates as well as known analogs', () => {
    const envs = new Set(EARTH_SITES.map(s => s.environment))
    for (const e of ['desert', 'polar', 'volcanic', 'cave', 'impact', 'highland'] as const) expect(envs.has(e), e).toBe(true)
    expect(EARTH_SITES.filter(s => s.status === 'candidate').length).toBeGreaterThanOrEqual(5)
    expect(EARTH_SITES.some(s => s.factors.anorthosite.value === 0.95)).toBe(true) // a lunar-highland rock analog
  })

  it('targets cover the Moon Base and Mars, with valid data and known sources', () => {
    expect(targetById('shackleton').kind).toBe('base')
    expect(TARGETS.filter(t => t.world === 'moon').length).toBeGreaterThanOrEqual(3)
    expect(TARGETS.filter(t => t.world === 'mars').length).toBeGreaterThanOrEqual(5)
    for (const t of TARGETS) {
      expect(Math.abs(t.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(t.lon)).toBeLessThanOrEqual(180)
      expect(t.facts.length, t.id).toBeGreaterThan(0)
      for (const id of t.sourceIds) expect(sourceIds.has(id), `${t.id} source ${id}`).toBe(true)
      for (const [k, w] of Object.entries(t.profile)) {
        expect(w).toBeGreaterThan(0)
        expect(t.factors[k as keyof typeof t.factors], `${t.id} profile ${k} needs a value`).toBeDefined()
      }
      for (const v of Object.values(t.factors)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
      if (t.landable) expect(t.landing, t.id).toBeDefined()
    }
  })

  it('covers the dimensions the challenge names: dust and wind, habitability, and processes', () => {
    for (const s of EARTH_SITES) {
      expect(s.factors.wind.value, s.id).not.toBeNull()
      expect(s.factors.life.value, s.id).not.toBeNull()
      expect(s.processes?.length, s.id).toBeGreaterThan(0)
    }
    for (const t of TARGETS) {
      expect(t.processes?.length, t.id).toBeGreaterThan(0)
      for (const p of t.processes!) expect(PROCESS_LABELS[p]).toBeTruthy()
      // The Moon has no wind and no life to look for; Mars has dust storms and is searched for signs of life
      expect(t.factors.wind !== undefined, t.id).toBe(t.world === 'mars')
      expect(t.factors.life !== undefined, t.id).toBe(t.world === 'mars')
      const w = Object.values(t.profile).reduce((a, b) => a + (b ?? 0), 0)
      expect(w, `${t.id} profile weights`).toBeCloseTo(1, 6)
    }
    for (const p of PROCESS_KEYS) expect(EARTH_SITES.some(s => s.processes!.includes(p)), p).toBe(true)
    // Wind-carved, hyper-arid salt basins rank near the top for dusty Martian plains
    const utopia = rankTwins(targetById('utopia'), EARTH_SITES).slice(0, 5).map(r => r.site.id)
    expect(utopia).toContain('qaidam')
    expect(sharedProcesses(EARTH_SITES.find(s => s.id === 'qaidam')!, targetById('gale'))).toEqual(['salt', 'wind'])
    expect(sharedProcesses(EARTH_SITES.find(s => s.id === 'mulu')!, targetById('shackleton'))).toEqual([])
  })

  it('missions point to real targets and have positive weights', () => {
    for (const m of MISSIONS) {
      expect(TARGETS.some(t => t.id === m.targetId), m.id).toBe(true)
      const w = Object.values(m.weights)
      expect(w.length).toBeGreaterThan(0)
      expect(w.every(x => (x ?? 0) > 0)).toBe(true)
    }
    expect(MISSIONS[0].id).toBe('tutorial')
    expect(missionsOf('moon').length).toBeGreaterThan(0)
    expect(missionsOf('mars').length).toBeGreaterThan(0)
  })

  it('every mission can be passed by at least one site', () => {
    for (const m of MISSIONS) {
      const t = targetById(m.targetId)
      const best = Math.max(...EARTH_SITES.map(s => computeASI(s, t, m).asi ?? 0))
      expect(best, `${m.id} best ASI`).toBeGreaterThanOrEqual(m.passAsi)
    }
  })

  it('module unlocks reference real modules', () => {
    for (const m of MISSIONS) if (m.unlocks) expect(MODULES.some(x => x.id === m.unlocks)).toBe(true)
  })

  it('reality gaps and impact structures are well formed', () => {
    for (const g of GAPS) for (const id of g.sourceIds) expect(sourceIds.has(id), `${g.id} source ${id}`).toBe(true)
    expect(IMPACTS.length).toBeGreaterThan(60)
    for (const c of IMPACTS) {
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90)
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180)
      expect(c.km).toBeGreaterThan(0)
    }
  })
})
