import { describe, expect, it } from 'vitest'
import { STAGES, ZOOM_END, ZOOM_KEYS, fovLabel, makeCurve, stageAt } from './cosmos'

describe('opening zoom', () => {
  const fov = makeCurve(ZOOM_KEYS)
  it('passes through every keyframe and only ever zooms in', () => {
    for (const [t, f] of ZOOM_KEYS) expect(fov(t)).toBeCloseTo(f, 9)
    let prev = Infinity
    for (let t = 0; t <= ZOOM_END; t += 0.01) { expect(fov(t)).toBeLessThanOrEqual(prev + 1e-9); prev = fov(t) }
  })
  it('comes to rest at Earth and the Moon', () => {
    expect(fov(ZOOM_END) - fov(ZOOM_END - 0.01)).toBeGreaterThan(-0.01)
  })
  it('describes the view in words people know', () => {
    expect(fovLabel(26.94)).toBe('92 billion light-years')
    expect(fovLabel(21)).toBe('105,700 light-years')
    expect(fovLabel(9.3)).toBe('2.0 million km')
  })
  it('names each stage on the way in', () => {
    expect(STAGES[stageAt(26)].name).toBe('Observable universe')
    expect(STAGES[stageAt(21)].name).toBe('Milky Way')
    expect(STAGES[stageAt(13)].name).toBe('Solar System')
    expect(STAGES[stageAt(9.3)].name).toBe('Earth and Moon')
  })
})
