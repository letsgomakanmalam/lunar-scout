import { describe, expect, it } from 'vitest'
import { migrateSave, missionUnlocked, missionsToOpen, questContext, type MissionRecord } from './store'
import { emptyGrid } from './lib/base'

const rec = { stars: 1, asi: 60, siteId: 'atacama' } as unknown as MissionRecord

describe('saves and unlocks', () => {
  it('moves old saves to the new landing sites and drops missions that no longer exist', () => {
    const out = migrateSave({ landingId: 'taurus-littrow', activeMissionId: 'gone', completed: { tutorial: rec, gone: rec } }, 0)
    expect(out.landingId).toBe('mons-mouton')
    expect(out.activeMissionId).toBe('tutorial')
    expect(Object.keys(out.completed as object)).toEqual(['tutorial'])
    expect(out.discoveries).toEqual([])
    expect(migrateSave({ landingId: 'copernicus' }, 1).landingId).toBeNull()
    expect(migrateSave({ landingId: 'shackleton' }, 1).landingId).toBe('shackleton')
  })
  it('keeps probes from older saves working when new factors are added', () => {
    const f = { value: 0.5, raw: 'x', sourceId: 'power', estimate: false }
    const old = { id: 'probe-1', name: 'Field probe', factors: { thermal: f, aridity: f } }
    const out = migrateSave({ discoveries: [old, null] }, 2).discoveries as { factors: Record<string, { value: number | null }> }[]
    expect(out).toHaveLength(1)
    expect(out[0].factors.thermal.value).toBe(0.5)
    expect(out[0].factors.wind.value).toBeNull()
    expect(out[0].factors.life.value).toBeNull()
    expect(Object.keys(out[0].factors)).toHaveLength(15)
  })
  it('opens the Moon track step by step and Mars after any passed mission', () => {
    expect(missionUnlocked('tutorial', {})).toBe(true)
    expect(missionUnlocked('ice', {})).toBe(true)
    expect(missionUnlocked('lowsun', {})).toBe(false)
    expect(missionUnlocked('mars-ice', {})).toBe(false)
    expect(missionsToOpen('mars-ice', {})).toBe(1)
    const one = { tutorial: rec }
    expect(missionUnlocked('lowsun', one)).toBe(true)
    expect(missionUnlocked('mars-ice', one)).toBe(true)
    expect(missionUnlocked('mars-delta', one)).toBe(false)
    expect(missionsToOpen('mars-delta', one)).toBe(1)
    expect(missionUnlocked('mars-delta', { tutorial: rec, 'mars-ice': rec })).toBe(true)
    expect(missionUnlocked('mars-clay', {}, true)).toBe(true) // judge mode
  })
  it('counts worlds and discoveries for quests', () => {
    const c = questContext({ landingId: null, grid: emptyGrid(), scanned: {}, completed: { tutorial: rec, 'mars-ice': rec }, discoveries: [] })
    expect(c.worldsDone).toBe(2)
    expect(c.discoveries).toBe(0)
  })
})
