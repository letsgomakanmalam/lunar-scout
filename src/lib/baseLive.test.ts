import { describe, expect, it } from 'vitest'
import { emptyGrid, type BaseGrid } from './base'
import type { ModuleId } from '../data/types'
import { targetById } from '../data/targets'
import { CREW, FARM_FOOD, SITE_ENV, simulateBase } from './baseSim'
import {
  BEDS, CROPS, LANDER, MAX_CATCH_UP_H, PRINT_DAYS, SOW_EVERY_H, START_HOUR, advanceLive, bedState, clockOf, dutyAt, farmBeds, farmJob,
  frameFor, gardener, harvestsBetween, initLive, landerAt, landingsBetween, liveSun, missionHours, printProgress, type CrewCtx,
} from './baseLive'

const make = (mods: [ModuleId, 1 | 2][]): BaseGrid => {
  const g = emptyGrid()
  mods.forEach(([id, level], i) => { g[i] = { id, level } })
  return g
}
const calm: CrewCtx = { dark: false, failed: false, storm: false, hasFarm: true, hasLab: true }

describe('mission clock', () => {
  it('counts days from 1 and shows a 24-hour clock, also for the longer Martian sol', () => {
    expect(clockOf(8, 24)).toMatchObject({ day: 1, text: '08:00' })
    expect(clockOf(24 * 3 + 13.5, 24)).toMatchObject({ day: 4, text: '13:30' })
    expect(clockOf(24.66 * 2 + 12.33, 24.66).day).toBe(3)
    expect(clockOf(24.66 * 2 + 12.33, 24.66).text).toBe('12:00')
  })
  it('turns real time into mission time: one second is one minute at the normal speed', () => {
    expect(missionHours(60_000, 60)).toBeCloseTo(1)
    expect(missionHours(1000, 3600)).toBeCloseTo(1)
    expect(missionHours(5000, 0)).toBe(0)
  })
  it('starts a base near the lunar equator at sunrise, not at the start of the two-week night', () => {
    expect(liveSun(SITE_ENV['marius-hills'], 14.09, START_HOUR + 48).dark).toBe(false)
    expect(liveSun(SITE_ENV['marius-hills'], 14.09, START_HOUR + 20 * 24).dark).toBe(true)
  })
})

describe('greenhouse', () => {
  it('grows each crop for as long as it really takes, then harvests and sows again', () => {
    const lettuce = CROPS[0]
    expect(bedState(0, 0, 1).stage).toBe('sown')
    expect(bedState(10 * 24, 0, 1).stage).toBe('growing')
    expect(bedState(10 * 24, 0, 1).growth).toBeCloseTo(10 / lettuce.days)
    expect(bedState(30 * 24, 0, 1).stage).toBe('ripe')
    expect(bedState(lettuce.days * 24 + 2, 0, 1).stage).toBe('harvest')
    const again = bedState((lettuce.days + 1) * 24 + 1, 0, 1)
    expect(again.stage).toBe('sown')
    expect(again.harvests).toBe(1)
  })
  it('sows one bed every few days, so the beds are at different stages', () => {
    expect(bedState(SOW_EVERY_H - 1, 1, 1).stage).toBe('empty')
    expect(bedState(SOW_EVERY_H + 1, 1, 1).stage).toBe('sown')
    const growths = farmBeds(20 * 24, 1).map(b => b.growth)
    expect(new Set(growths.map(g => g.toFixed(3))).size).toBe(BEDS[0].length)
  })
  it('gives the same food over a long time as the 60-day test assumes', () => {
    for (const level of [1, 2] as const) {
      const kg = harvestsBetween(0, 2000 * 24, level).reduce((s, h) => s + h.kg, 0)
      expect(kg / 2000).toBeGreaterThan(FARM_FOOD[level - 1] * 0.93)
      expect(kg / 2000).toBeLessThanOrEqual(FARM_FOOD[level - 1] * 1.001)
    }
  })
  it('counts each harvest once, however time is split', () => {
    const whole = harvestsBetween(0, 400 * 24, 2).length
    let parts = 0
    for (let h = 0; h < 400 * 24; h++) parts += harvestsBetween(h, h + 1, 2).length
    expect(parts).toBe(whole)
    expect(whole).toBeGreaterThan(20)
  })
  it('picks the job: harvest first, then sowing, then the daily check', () => {
    expect(farmJob(farmBeds(-1, 1))).toBeNull()
    expect(farmJob(farmBeds(2, 1))).toEqual({ bed: 0, kind: 'sow' })
    expect(farmJob(farmBeds(40, 1))?.kind).toBe('tend')
    expect(farmJob(farmBeds(CROPS[1].days * 24 + SOW_EVERY_H + 3, 1))).toEqual({ bed: 1, kind: 'harvest' })
  })
})

describe('crew day', () => {
  it('sleeps 8.5 hours, eats three times and exercises two hours', () => {
    let sleep = 0, meal = 0, exercise = 0
    for (let q = 0; q < 96; q++) {
      const d = dutyAt(0, 4, q / 4, 0, calm)
      if (d === 'sleep') sleep++
      if (d === 'meal') meal++
      if (d === 'exercise') exercise++
    }
    expect(sleep / 4).toBe(8.5)
    expect(meal / 4).toBe(3.5)
    expect(exercise / 4).toBe(2)
  })
  it('sends astronauts outside only in pairs, one pair at a time', () => {
    for (const n of [2, 4, 6, 8]) for (let day = 0; day < 4; day++) for (let q = 0; q < 96; q++) {
      const out = Array.from({ length: n }, (_, i) => dutyAt(i, n, q / 4, day, calm)).flatMap((d, i) => (d === 'eva' ? [i] : []))
      expect(out.length % 2).toBe(0)
      for (let k = 0; k < out.length; k += 2) expect(Math.floor(out[k] / 2)).toBe(Math.floor(out[k + 1] / 2))
    }
    expect(dutyAt(0, 4, 9, 0, calm)).toBe('eva')
    expect(dutyAt(2, 4, 9, 0, calm)).not.toBe('eva')
    expect(dutyAt(2, 4, 15, 0, calm)).toBe('eva')
  })
  it('keeps everyone in during a dust storm or a failure, and sends one pair on a short round in the dark', () => {
    for (let q = 0; q < 96; q++) {
      expect(dutyAt(0, 2, q / 4, 0, { ...calm, storm: true })).not.toBe('eva')
      expect(dutyAt(0, 2, q / 4, 0, { ...calm, failed: true })).not.toBe('eva')
      expect(dutyAt(2, 4, q / 4, 0, { ...calm, dark: true })).not.toBe('eva')
    }
    expect(dutyAt(0, 4, 11.5, 0, { ...calm, dark: true })).toBe('eva')
    expect(dutyAt(0, 4, 9, 0, { ...calm, dark: true })).not.toBe('eva')
  })
  it('always has someone free to tend the greenhouse, and never the pair that is outside', () => {
    for (const n of [2, 4, 8]) for (let day = 0; day < 4; day++) {
      const g = gardener(n, day)
      const mid = (g.block[0] + g.block[1]) / 2
      expect(dutyAt(g.who, n, mid, day, calm)).toBe('farm')
    }
  })
})

describe('cargo landers and printing', () => {
  it('lands every 30 days from day 28, stays four days and leaves', () => {
    const a = LANDER.firstDay * 24
    expect(landerAt(a - 100).phase).toBe('away')
    expect(landerAt(a - 100).eta).toBeCloseTo(100)
    expect(landerAt(a - LANDER.descentH / 2).phase).toBe('descent')
    expect(landerAt(a - LANDER.descentH / 2).k).toBeCloseTo(0.5)
    expect(landerAt(a + 10).phase).toBe('landed')
    expect(landerAt(a + LANDER.stayH + LANDER.descentH / 2).phase).toBe('ascent')
    expect(landerAt(a + LANDER.stayH + 5).phase).toBe('away')
    expect(landerAt(a + 30 * 24 + 1).phase).toBe('landed')
    expect(landerAt(a + 10, a + 5).phase).toBe('away') // the pad was built after it came down
    expect(landingsBetween(0, 100 * 24)).toEqual([28 * 24, 58 * 24, 88 * 24])
    expect(landingsBetween(28 * 24, 58 * 24)).toEqual([58 * 24])
  })
  it('prints a berm over weeks, faster when upgraded', () => {
    expect(printProgress(0, 1)).toBe(0)
    expect(printProgress(PRINT_DAYS[0] * 12, 1)).toBeCloseTo(0.5)
    expect(printProgress(PRINT_DAYS[0] * 12, 2)).toBeGreaterThan(0.5)
    expect(printProgress(1e6, 1)).toBe(1)
  })
})

describe('live base', () => {
  const site = targetById('shackleton')
  const solid = make([['habitat', 1], ['power', 1], ['power', 1], ['power', 1], ['power', 1], ['comms', 1], ['farm', 1], ['ice', 1], ['oxygen', 1], ['battery', 2], ['battery', 2], ['battery', 2], ['battery', 2], ['battery', 2], ['battery', 2], ['reactor', 1], ['pad', 1], ['printer', 1]])

  it('starts with a month of supplies and full batteries', () => {
    const s = initLive(solid, site)
    const f = frameFor(solid, site, s)
    expect(f.crew).toBe(2)
    expect(f.o2).toBeCloseTo(30)
    expect(f.food).toBeCloseTo(30)
    expect(f.soc).toBe(1)
    expect(f.time).toBe('08:00')
    expect(f.cells.filter(Boolean).length).toBe(solid.filter(Boolean).length)
  })
  it('gives the same result in one go or in many small steps', () => {
    const start = initLive(solid, site)
    const once = advanceLive(start, solid, site, START_HOUR + 400.5)
    let s = start
    for (let h = START_HOUR; h < START_HOUR + 400.5; h += 0.37) s = advanceLive(s, solid, site, Math.min(START_HOUR + 400.5, h + 0.37))
    expect(s.o2).toBeCloseTo(once.o2, 6)
    expect(s.food).toBeCloseTo(once.food, 6)
    expect(s.stored).toBeCloseTo(once.stored, 6)
    expect(s.log.length).toBe(once.log.length)
  })
  it('brings food in at harvest and with each cargo lander, and logs it', () => {
    const s = advanceLive(initLive(solid, site), solid, site, START_HOUR + 40 * 24)
    expect(s.log.some(e => /Radishes harvested/.test(e.text))).toBe(true)
    expect(s.log.some(e => /cargo lander/.test(e.text))).toBe(true)
    expect(s.food).toBeGreaterThan(0)
    expect(frameFor(solid, site, s).cells[6]!.beds!.some(b => b.harvests > 0)).toBe(true)
  })
  it('starts the clock of a new building when it is built', () => {
    let s = advanceLive(initLive(solid, site), solid, site, 500)
    const more = [...solid]
    more[20] = { id: 'farm', level: 1 }
    s = advanceLive(s, more, site, 501)
    expect(s.built[20]).toEqual({ id: 'farm', h: 500 })
    expect(frameFor(more, site, s).cells[20]!.beds![0].day).toBeCloseTo(1 / 24)
    expect(frameFor(more, site, s).cells[6]!.beds![0].day).toBeGreaterThan(15)
  })
  it('flies the crew home when the base runs dry, and a relief crew takes over', () => {
    const bare = make([['habitat', 1], ['reactor', 1], ['comms', 1]])
    const s = advanceLive(initLive(bare, site), bare, site, START_HOUR + 40 * 24)
    expect(s.log.some(e => e.kind === 'bad' && /relief crew/.test(e.text))).toBe(true)
    expect(s.o2).toBeGreaterThan(0)
    expect(s.o2).toBeLessThanOrEqual(CREW.o2 * 2 * 30)
  })
  it('skips ahead after a very long break instead of grinding through it', () => {
    const s = advanceLive(initLive(solid, site), solid, site, START_HOUR + MAX_CATCH_UP_H * 20)
    expect(s.hour).toBe(START_HOUR + MAX_CATCH_UP_H * 20)
    expect(Number.isFinite(s.o2)).toBe(true)
  })
  it('gives a new crew supplies when the first habitat is built', () => {
    let s = initLive(make([['power', 1]]), site)
    expect(s.o2).toBe(0)
    const withHome = make([['power', 1], ['habitat', 2]])
    s = advanceLive(s, withHome, site, START_HOUR + 1)
    expect(frameFor(withHome, site, s).o2).toBeGreaterThan(29)
  })
  it('describes one hour of the 60-day test with the same picture', () => {
    const r = simulateBase(solid, site)
    const t = 300
    const f = frameFor(solid, site, { hour: t, sunAtHour: t, stored: r.soc[t] * r.storeKWh, o2: r.o2[t] * CREW.o2 * r.crew, water: r.water[t] * CREW.water * r.crew, food: r.food[t] * CREW.food * r.crew, dose: r.dose[t], failed: false })
    expect(f.gen).toBeCloseTo(r.gen[t], 3)
    expect(f.o2).toBeCloseTo(r.o2[t], 3)
    expect(f.sun.elev).toBeCloseTo(r.elev[t], 3)
  })
  it('shows the Mars relay passes and keeps the crew in during the dust storm', () => {
    const mars = targetById('jezero')
    const base = make([['habitat', 1], ['reactor', 1], ['comms', 1]])
    const at = (h: number) => frameFor(base, mars, { hour: h, stored: 0, o2: 50, water: 50, food: 50, dose: 0 })
    expect(at(24.66 * 2 + (15 / 24) * 24.66).cells[2]!.level).toBe(1)
    expect(at(24.66 * 2 + (9 / 24) * 24.66).cells[2]!.level).toBe(0)
    expect(at(24.66 * 26 + (9 / 24) * 24.66).storm).toBe(true)
    expect(at(24.66 * 26 + (9 / 24) * 24.66).duties).not.toContain('eva')
    expect(at(24.66 * 2 + (9 / 24) * 24.66).duties).toContain('eva')
  })
})
