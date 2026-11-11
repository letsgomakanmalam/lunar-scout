import { describe, expect, it } from 'vitest'
import { emptyGrid, type BaseGrid } from './base'
import type { ModuleId } from '../data/types'
import { HALF, LOOP, LOOP_LENGTH, ROVER_SPEED, ROVER_STOP_S, cellCorners, cornerXZ, crewCount, homeCells, loopPoint, nearestOnLoop, roverPlan, route, workCells } from './baseLife'

const make = (mods: [number, ModuleId, 1 | 2][]): BaseGrid => {
  const g = emptyGrid()
  for (const [i, id, level] of mods) g[i] = { id, level }
  return g
}
const ROVER_HALF_WIDTH = 0.3

describe('rover loop', () => {
  it('is a closed, smooth loop', () => {
    const n = 2000
    let prev = loopPoint(0)
    for (let k = 1; k <= n; k++) {
      const p = loopPoint((k / n) * LOOP_LENGTH)
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan((LOOP_LENGTH / n) * 1.05)
      prev = p
    }
    const end = loopPoint(LOOP_LENGTH), start = loopPoint(0)
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThan(1e-6)
  })
  it('points the rover the way it is going', () => {
    for (const s of [1, 10, 13.1, 25, 40]) {
      const a = loopPoint(s), b = loopPoint(s + 0.01)
      const d = Math.atan2(b.z - a.z, b.x - a.x) - a.heading
      expect(Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))).toBeLessThan(0.05)
    }
  })
  it('stays clear of the plots, on the plateau, and away from the rock spires', () => {
    let minToPlots = Infinity
    for (let k = 0; k < 2000; k++) {
      const p = loopPoint((k / 2000) * LOOP_LENGTH)
      minToPlots = Math.min(minToPlots, Math.hypot(Math.max(Math.abs(p.x) - HALF, 0), Math.max(Math.abs(p.z) - HALF, 0)))
      // the rover's outer edge inside the rounded-square plateau (radius 7.9)
      expect(((Math.abs(p.x) + ROVER_HALF_WIDTH) / 7.9) ** 4 + ((Math.abs(p.z) + ROVER_HALF_WIDTH) / 7.9) ** 4).toBeLessThan(1)
    }
    expect(minToPlots).toBeGreaterThanOrEqual(ROVER_HALF_WIDTH)
    // spires: 7.95 to 8.15 out, 0.22 to 0.48 rad either side of each axis, up to 0.34 wide (BaseScene)
    for (let q = 0; q < 4; q++) for (const off of [-0.32, -0.22, 0.38, 0.48]) for (const d of [7.95, 8.15]) {
      const sx = Math.cos(q * Math.PI / 2 + off) * d, sz = Math.sin(q * Math.PI / 2 + off) * d
      let near = Infinity
      for (let k = 0; k < 800; k++) { const p = loopPoint((k / 800) * LOOP_LENGTH); near = Math.min(near, Math.hypot(p.x - sx, p.z - sz)) }
      expect(near).toBeGreaterThan(ROVER_HALF_WIDTH + 0.34)
    }
  })
  it('finds where the rover parks by its garage', () => {
    const s = nearestOnLoop(9, 0) // straight out on the +x side
    const p = loopPoint(s)
    expect(p.x).toBeCloseTo(LOOP.half, 5)
    expect(Math.abs(p.z)).toBeLessThan(0.2)
  })
})

describe('rover timetable', () => {
  const home = 5
  it('in the simulation, drives one lap per daytime shift and parks otherwise', () => {
    expect(roverPlan({ hour: 6, seconds: 0, home })).toEqual({ s: home, driving: false })
    const midShift = roverPlan({ hour: 12, seconds: 0, home })
    expect(midShift.driving).toBe(true)
    expect(midShift.s).toBeCloseTo(home + LOOP_LENGTH / 2, 5)
    expect(roverPlan({ hour: 24 * 3 + 12, seconds: 0, home }).s).toBeCloseTo(midShift.s, 5) // same time on another day
    expect(roverPlan({ hour: 12, seconds: 0, dark: true, home })).toEqual({ s: home, driving: false })
    expect(roverPlan({ hour: 12, seconds: 0, failed: true, home })).toEqual({ s: home, driving: false })
  })
  it('outside the simulation, laps by the real clock and pauses at the garage', () => {
    expect(roverPlan({ seconds: 10, home }).s).toBeCloseTo(home + 10 * ROVER_SPEED, 5)
    const lap = LOOP_LENGTH / ROVER_SPEED
    expect(roverPlan({ seconds: lap + ROVER_STOP_S / 2, home })).toEqual({ s: home, driving: false })
  })
})

describe('crew', () => {
  it('walks corner to corner along the gaps between plots', () => {
    expect(route([0, 0], [3, 2])).toEqual([[1, 0], [2, 0], [3, 0], [3, 1], [3, 2]])
    expect(route([2, 2], [2, 2])).toEqual([])
    expect(cornerXZ([0, 0])).toEqual({ x: -HALF, z: -HALF })
    expect(cellCorners(7)).toEqual([[1, 1], [2, 1], [1, 2], [2, 2]])
  })
  it('matches the habitats, keeps away from the reactor, and caps the crowd', () => {
    const g = make([[0, 'habitat', 1], [1, 'reactor', 1], [2, 'lab', 1]])
    expect(crewCount(g)).toBe(2)
    expect(workCells(g)).toEqual([0, 2])
    expect(homeCells(g)).toEqual([0])
    expect(crewCount(make([[0, 'habitat', 2], [1, 'habitat', 2], [2, 'habitat', 2]]))).toBe(8)
    expect(crewCount(make([[2, 'lab', 1]]))).toBe(0)
  })
})
