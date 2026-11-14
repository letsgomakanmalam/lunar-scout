import { describe, expect, it } from 'vitest'
import { SOURCES } from '../data/sources'
import { targetById } from '../data/targets'
import { SOL_H, envFor, sunAt } from './baseSim'
import { clockOf, dayLength, liveSun } from './baseLive'
import { NATURE, PHOBOS, PREVIEWABLE, SOLAR_STORM, chance, natureAt, natureOf, shadowLength, shortWhy, solarStormAt, withPreview, type NatureId } from './baseNature'

const at = (id: string, hour: number) => {
  const t = targetById(id), env = envFor(t)
  return natureAt(env, t, hour, clockOf(hour, dayLength(env)).hod, h => liveSun(env, t.lat, h))
}
const scan = (id: string, from: number, to: number, step = 0.25) => {
  const seen = new Set<NatureId>()
  for (let h = from; h < to; h += step) for (const n of at(id, h).active) seen.add(n)
  return seen
}

describe('nature at the base', () => {
  it('explains every phenomenon: what you see, why it happens and what it means, with a known source', () => {
    const ids = new Set(SOURCES.map(s => s.id))
    for (const n of Object.values(NATURE)) {
      expect(n.what.length, n.id).toBeGreaterThan(30)
      expect(n.why.length, n.id).toBeGreaterThan(120)
      expect(n.so.length, n.id).toBeGreaterThan(40)
      expect(ids.has(n.sourceId), n.id).toBe(true)
    }
    expect(natureOf('moon').map(n => n.id)).not.toContain('dust-devil')
    expect(natureOf('mars').map(n => n.id)).not.toContain('earthshine')
    expect(natureOf('moon').map(n => n.id)).toContain('solar-storm')
    expect(natureOf('mars').map(n => n.id)).toContain('solar-storm')
  })
  it('gives the same sky for the same mission hour', () => {
    expect(at('shackleton', 321.37)).toEqual(at('shackleton', 321.37))
    expect(chance(42)).toBe(chance(42))
    for (let n = 0; n < 200; n++) { expect(chance(n)).toBeGreaterThanOrEqual(0); expect(chance(n)).toBeLessThan(1) }
  })
  it('runs solar particle storms on a schedule: a fast rise, a slow fade, then quiet', () => {
    const s = SOLAR_STORM.firstH
    expect(solarStormAt(0)).toBe(0)
    expect(solarStormAt(s - 0.1)).toBe(0)
    expect(solarStormAt(s + 1.5)).toBeCloseTo(0.5)
    expect(solarStormAt(s + 3)).toBe(1)
    expect(solarStormAt(s + 20)).toBeLessThan(solarStormAt(s + 5))
    expect(solarStormAt(s + SOLAR_STORM.lastsH + 1)).toBe(0)
    expect(solarStormAt(s + SOLAR_STORM.everyH + 4)).toBeGreaterThan(0.9)
    expect(at('shackleton', s + 4).active[0]).toBe('solar-storm')
    expect(at('jezero', s + 4).active).toContain('solar-storm')
  })
  it('shows the Moon its own nature: flashes, quakes at sunrise and sunset, earthshine in the dark, long shadows in the light', () => {
    const seen = scan('shackleton', 8, 60 * 24)
    for (const id of ['impact', 'thermal-quake', 'earthshine', 'long-shadows', 'solar-storm'] as const) expect(seen.has(id), id).toBe(true)
    for (const id of ['dust-devil', 'dust-storm', 'phobos', 'blue-sunset'] as const) expect(seen.has(id), id).toBe(false)
    // Earthshine only in the dark, long shadows only in the light, and a quake only when the light has just changed
    const t = targetById('shackleton'), env = envFor(t)
    let flashes = 0, slots = 0
    for (let h = 8; h < 40 * 24; h += 0.25) {
      const n = at('shackleton', h), sun = liveSun(env, t.lat, h)
      expect(n.active.includes('earthshine')).toBe(sun.dark)
      expect(n.active.includes('long-shadows')).toBe(!sun.dark)
      expect(n.quake != null).toBe(liveSun(env, t.lat, h - 2).dark !== sun.dark)
      slots++; if (n.impact) { flashes++; expect(n.impact.dist).toBeGreaterThanOrEqual(14); expect(n.impact.dist).toBeLessThanOrEqual(59) }
    }
    expect(flashes / slots).toBeGreaterThan(0.04)
    expect(flashes / slots).toBeLessThan(0.14)
    // Near the equator the Sun climbs high, so long shadows come only around sunrise and sunset
    expect(at('marius-hills', 8 + 7 * 24).active).not.toContain('long-shadows')
  })
  it('shows Mars its own nature: dust devils after noon, a blue glow at dusk, Phobos at night, and the dust storm', () => {
    const seen = scan('jezero', 8, 40 * SOL_H)
    for (const id of ['dust-devil', 'dust-storm', 'phobos', 'blue-sunset', 'solar-storm'] as const) expect(seen.has(id), id).toBe(true)
    for (const id of ['impact', 'thermal-quake', 'earthshine', 'long-shadows'] as const) expect(seen.has(id), id).toBe(false)
    const t = targetById('jezero'), env = envFor(t)
    for (let h = 8; h < 40 * SOL_H; h += 0.2) {
      const n = at('jezero', h), sun = liveSun(env, t.lat, h), hod = clockOf(h, SOL_H).hod
      if (n.dustDevils) { expect(hod).toBeGreaterThanOrEqual(11); expect(hod).toBeLessThan(15.5); expect(sun.dark).toBe(false); expect(n.active).not.toContain('dust-storm') }
      if (n.phobos) { expect(sun.dark).toBe(true); expect(n.phobos.elev).toBeGreaterThanOrEqual(0); expect(n.phobos.elev).toBeLessThanOrEqual(70); expect(Math.abs(n.phobos.az)).toBeLessThanOrEqual(90) }
      if (n.active.includes('dust-storm')) expect(sun.tau).toBeGreaterThan(2)
    }
  })
  it('moves Phobos from west to east, and hides it near the poles', () => {
    const env = envFor(targetById('jezero')), night = () => ({ ...sunAt(env, 18, 0), dark: true, elev: -40, tau: 0.5 })
    const a = natureAt(env, { lat: 18, lon: 0 }, PHOBOS.everyH * 3 + 0.5, 1, night).phobos!
    const b = natureAt(env, { lat: 18, lon: 0 }, PHOBOS.everyH * 3 + 2.1, 3, night).phobos!
    const c = natureAt(env, { lat: 18, lon: 0 }, PHOBOS.everyH * 3 + 3.9, 5, night).phobos!
    expect(a.az).toBeGreaterThan(b.az)
    expect(b.az).toBeGreaterThan(c.az)
    expect(b.elev).toBeGreaterThan(a.elev)
    expect(b.elev).toBeGreaterThan(c.elev)
    expect(natureAt(env, { lat: 18, lon: 0 }, PHOBOS.everyH * 3 + 6, 7, night).phobos).toBeNull()
    expect(natureAt(env, { lat: 75, lon: 0 }, PHOBOS.everyH * 3 + 2, 3, night).phobos).toBeNull()
  })
  it('measures how thick the dust storm is, and none on the Moon', () => {
    let peak = 0
    for (let h = 8; h < 40 * SOL_H; h += 1) {
      const n = at('jezero', h)
      peak = Math.max(peak, n.dust)
      expect(n.dust).toBeGreaterThanOrEqual(0)
      expect(n.dust).toBeLessThanOrEqual(1)
      if (n.active.includes('dust-storm')) expect(n.dust).toBeGreaterThan(0.4) // optical depth above 2
    }
    expect(peak).toBeGreaterThan(0.6)
    expect(at('jezero', 30).dust).toBe(0)
    expect(at('shackleton', 300).dust).toBe(0)
  })
  it('can show any sudden event on demand, with its reason', () => {
    const calm = at('jezero', 60)
    expect(withPreview(calm, 'dust-storm', 1).dust).toBe(1)
    expect(withPreview(calm, 'dust-storm', 1).active[0]).toBe('dust-storm')
    expect(withPreview(calm, 'dust-devil', 1).dustDevils).toBe(2)
    expect(withPreview(calm, 'solar-storm', 1).solar).toBe(1)
    const moon = at('shackleton', 60)
    const a = withPreview(moon, 'impact', 5).impact!, b = withPreview(moon, 'impact', 6).impact!
    expect(a.id).not.toBe(b.id)
    expect(a.dist).toBeLessThanOrEqual(30)
    expect(withPreview(moon, 'thermal-quake', 7).quake).toBe(-7)
    expect(calm.dust).toBe(0) // the real moment is not changed
    for (const id of PREVIEWABLE) { expect(shortWhy(id).startsWith(NATURE[id].title)).toBe(true); expect(shortWhy(id).length).toBeLessThan(260) }
  })
  it('gets the shadow sum right', () => {
    expect(shadowLength(45)).toBeCloseTo(1)
    expect(Math.round(shadowLength(2))).toBe(29) // the figure quoted in the long-shadows note
    expect(shadowLength(1.5)).toBeGreaterThan(shadowLength(6))
  })
})
