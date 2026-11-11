/**
 * Life at the base: where the astronauts walk and where the rover drives, as plain functions of the
 * base layout and of time, so the 3D scene only has to draw them (and they can be tested).
 *
 *   - Astronauts walk along the gaps between plots, from module to module, and work there.
 *     In the mission simulation they go inside when the base is dark or life support fails.
 *   - The rover drives a loop just outside the plots. In the simulation it does one lap per 8-hour
 *     shift each day while the Sun is up and parks by its garage otherwise, so dragging the timeline
 *     moves it to where it would be at that hour. Outside the simulation it laps continuously.
 */
import { GRID_SIZE, crewCapacity, type BaseGrid } from './base'

export const TILE = 2
export const HALF = (GRID_SIZE * TILE) / 2
/** Most astronauts shown at once (habitats hold 2, or 4 when upgraded) */
export const MAX_CREW = 8
export const crewCount = (grid: BaseGrid) => Math.min(MAX_CREW, crewCapacity(grid))

/* ---------- Rover loop: a rounded square just outside the plots, inside the rock spires ---------- */

export const LOOP = { half: 6.4, r: 0.6 } // 0.4 clear of the plots on the sides, 0.3 at the corners, on the plateau, inside the spires
const SIDE = 2 * (LOOP.half - LOOP.r)
const ARC = (Math.PI * LOOP.r) / 2
export const LOOP_LENGTH = 4 * (SIDE + ARC)

/** Point on the loop at distance s, and the direction of travel (radians from +x towards +z). */
export function loopPoint(s: number): { x: number; z: number; heading: number } {
  const S = LOOP.half, R = LOOP.r, a = S - R
  let u = ((s % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH
  const dirs = [[0, 1], [-1, 0], [0, -1], [1, 0]]
  const starts = [[S, -a], [a, S], [-S, a], [-a, -S]]
  const centres = [[a, a], [-a, a], [-a, -a], [a, -a]]
  for (let k = 0; k < 4; k++) {
    if (u <= SIDE) {
      const [dx, dz] = dirs[k], [x0, z0] = starts[k]
      return { x: x0 + dx * u, z: z0 + dz * u, heading: Math.atan2(dz, dx) }
    }
    u -= SIDE
    if (u <= ARC || k === 3) {
      const th = (k * Math.PI) / 2 + Math.min(u, ARC) / R, [cx, cz] = centres[k]
      return { x: cx + R * Math.cos(th), z: cz + R * Math.sin(th), heading: Math.atan2(Math.cos(th), -Math.sin(th)) }
    }
    u -= ARC
  }
  return { x: S, z: -a, heading: Math.PI / 2 }
}

/** Distance along the loop of the point nearest to (x, z): where the rover parks by its garage. */
export function nearestOnLoop(x: number, z: number): number {
  let best = 0, bestD = Infinity
  for (let k = 0; k < 400; k++) {
    const s = (k / 400) * LOOP_LENGTH, p = loopPoint(s), d = (p.x - x) ** 2 + (p.z - z) ** 2
    if (d < bestD) { bestD = d; best = s }
  }
  return best
}

/** The rover's working day in the simulation: one lap per shift, mission hours 8 to 16 */
export const SHIFT = { start: 8, hours: 8 }
/** Outside the simulation: speed (units a second) and a pause at the garage after each lap */
export const ROVER_SPEED = 0.8
export const ROVER_STOP_S = 8

/**
 * Where the rover should be. With a simulation hour, it follows the daily shift and parks in the dark
 * or when life support has failed; without one, it laps continuously by the real clock.
 */
export function roverPlan(o: { hour?: number; seconds: number; dark?: boolean; failed?: boolean; home: number }): { s: number; driving: boolean } {
  if (o.hour !== undefined) {
    if (o.dark || o.failed) return { s: o.home, driving: false }
    const hd = ((o.hour % 24) + 24) % 24
    const f = (hd - SHIFT.start) / SHIFT.hours
    return f >= 0 && f < 1 ? { s: o.home + f * LOOP_LENGTH, driving: true } : { s: o.home, driving: false }
  }
  const lap = LOOP_LENGTH / ROVER_SPEED, period = lap + ROVER_STOP_S
  const ph = ((o.seconds % period) + period) % period
  return ph < lap ? { s: o.home + ph * ROVER_SPEED, driving: true } : { s: o.home, driving: false }
}

/* ---------- Walking: along the gaps between plots, corner to corner ---------- */

export type Corner = [number, number]
/** World position of a plot corner (cx, cz from 0 to GRID_SIZE). */
export const cornerXZ = ([cx, cz]: Corner) => ({ x: cx * TILE - HALF, z: cz * TILE - HALF })
/** The four corners of a plot. */
export const cellCorners = (i: number): Corner[] => {
  const c = i % GRID_SIZE, r = Math.floor(i / GRID_SIZE)
  return [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]]
}
/** Corner-by-corner route: along x first, then along z, one plot edge at a time. */
export function route(from: Corner, to: Corner): Corner[] {
  const out: Corner[] = []
  let [x, z] = from
  while (x !== to[0]) { x += Math.sign(to[0] - x); out.push([x, z]) }
  while (z !== to[1]) { z += Math.sign(to[1] - z); out.push([x, z]) }
  return out
}
/** Plots worth walking to: every module except the reactor, which crews keep away from. */
export const workCells = (grid: BaseGrid) => grid.flatMap((m, i) => (m && m.id !== 'reactor' ? [i] : []))
export const homeCells = (grid: BaseGrid) => grid.flatMap((m, i) => (m?.id === 'habitat' ? [i] : []))
