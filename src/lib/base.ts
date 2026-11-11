import type { PlanetTarget, ModuleId } from '../data/types'
import { moduleById } from '../data/modules'

export interface PlacedModule { id: ModuleId; level: 1 | 2 }
export type BaseGrid = (PlacedModule | null)[]

export const GRID_SIZE = 6

export const emptyGrid = (): BaseGrid => Array.from({ length: GRID_SIZE * GRID_SIZE }, () => null)

/** Research-point price, scaled by the landing site and its building discounts. */
export function moduleCost(id: ModuleId, landing: PlanetTarget | undefined, upgrade = false): number {
  const def = moduleById(id)
  let cost = upgrade ? def.upgradeCost : def.cost
  cost *= landing?.landing?.costMultiplier ?? 1
  cost *= landing?.landing?.discounts?.[id] ?? 1
  return Math.round(cost)
}

/** Energy to build, scaled by how hard the landing site is. */
export function energyCost(id: ModuleId, landing: PlanetTarget | undefined): number {
  return Math.max(1, Math.round(moduleById(id).energy * (landing?.landing?.costMultiplier ?? 1)))
}

export function modulePower(m: PlacedModule, landing: PlanetTarget | undefined): number {
  const def = moduleById(m.id)
  let p = def.power[m.level - 1]
  if (m.id === 'power') p += landing?.landing?.powerBonus ?? 0
  if (m.id === 'habitat') p += landing?.landing?.habitatPower ?? 0
  return p
}

export function powerBalance(grid: BaseGrid, landing: PlanetTarget | undefined) {
  let produced = 0
  let used = 0
  for (const cell of grid) {
    if (!cell) continue
    const p = modulePower(cell, landing)
    if (p >= 0) produced += p
    else used += -p
  }
  return { produced, used, net: produced - used }
}

export function crewCapacity(grid: BaseGrid) {
  return grid.reduce((n, c) => n + (c?.id === 'habitat' ? (c.level === 2 ? 4 : 2) : 0), 0)
}

/** A base is operational with at least one habitat, one comms tower and non-negative power. */
export function isOperational(grid: BaseGrid, landing: PlanetTarget | undefined) {
  const has = (id: ModuleId) => grid.some(c => c?.id === id)
  return has('habitat') && has('comms') && powerBalance(grid, landing).net >= 0
}

export function rankFor(stars: number) {
  if (stars >= 24) return 'Chief analog scientist'
  if (stars >= 14) return 'Planetary geologist'
  if (stars >= 8) return 'Analog specialist'
  if (stars >= 3) return 'Field scout'
  return 'Cadet'
}

/* ---------- Energy: refills over time, even while the game is closed ---------- */

export const ENERGY_BASE_CAP = 20
const ENERGY_BASE_MS = 40000

/** Battery banks store more energy. */
export function energyCap(grid: BaseGrid) {
  return grid.reduce((n, c) => n + (c?.id === 'battery' ? (c.level === 2 ? 10 : 6) : 0), ENERGY_BASE_CAP)
}

/** Milliseconds per energy point. Solar arrays and landing pads make it faster. */
export function energyRegenMs(grid: BaseGrid) {
  let boost = 0
  for (const c of grid) {
    if (c?.id === 'power') boost += c.level === 2 ? 0.3 : 0.2
    if (c?.id === 'pad') boost += c.level === 2 ? 0.25 : 0.15
  }
  return Math.max(8000, Math.round(ENERGY_BASE_MS / (1 + boost)))
}

/**
 * Energy right now, given the stored value and when it was last settled.
 * Keeps the part-way progress towards the next point. next is when the next point arrives (null when full).
 */
export function settleEnergy(energy: number, at: number, now: number, cap: number, period: number) {
  if (energy >= cap) return { energy, at: now, next: null as number | null }
  const gained = Math.floor(Math.max(0, now - at) / period)
  const value = Math.min(cap, energy + gained)
  if (value >= cap) return { energy: value, at: now, next: null as number | null }
  const at2 = at + gained * period
  return { energy: value, at: at2, next: at2 + period }
}

/* ---------- Base score: buildings score more next to the right neighbours ---------- */

interface ScoreRule { base: number; near?: Partial<Record<ModuleId, number>>; other?: number }

/** Points each building gets for itself and for each neighbouring building (8 around it). */
export const SCORE_RULES: Record<ModuleId, ScoreRule> = {
  habitat: { base: 6, near: { farm: 4, oxygen: 3, lab: 2, habitat: 1, printer: 2, pad: -4, ice: -1 } },
  power: { base: 4, near: { battery: 3, power: 1 } },
  comms: { base: 4, near: { lab: 2, habitat: 1, telescope: -5 } },
  farm: { base: 5, near: { habitat: 3, ice: 4, oxygen: 2, farm: 1, pad: -3 } },
  battery: { base: 3, near: { power: 3, battery: 1 } },
  pad: { base: 5, near: { rover: 4, printer: 2 } },
  lab: { base: 6, near: { habitat: 2, comms: 2, printer: 2, lab: 1 } },
  ice: { base: 6, near: { farm: 3, oxygen: 4, rover: 2 } },
  rover: { base: 4, near: { pad: 3, lab: 2, ice: 2 } },
  oxygen: { base: 5, near: { ice: 4, habitat: 2, farm: 2 } },
  printer: { base: 6, near: { habitat: 3, rover: 2, lab: 2 } },
  reactor: { base: 5, near: { habitat: -5, farm: -4, lab: -2, battery: 2, power: 1 } },
  telescope: { base: 14, near: { power: 0, battery: 0, comms: -6, pad: -6 }, other: -2 },
}

/** The up to 8 plots around a plot. */
export function neighbours(i: number): number[] {
  const r = Math.floor(i / GRID_SIZE), c = i % GRID_SIZE
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue
    const rr = r + dr, cc = c + dc
    if (rr >= 0 && rr < GRID_SIZE && cc >= 0 && cc < GRID_SIZE) out.push(rr * GRID_SIZE + cc)
  }
  return out
}

/** One building's points: its own value (half again when upgraded) plus what its neighbours add. */
export function cellScore(grid: BaseGrid, i: number): number {
  const m = grid[i]
  if (!m) return 0
  const rule = SCORE_RULES[m.id]
  let pts = rule.base * (m.level === 2 ? 1.5 : 1)
  for (const n of neighbours(i)) {
    const o = grid[n]
    if (o) pts += rule.near?.[o.id] ?? rule.other ?? 0
  }
  return pts
}

export const baseScore = (grid: BaseGrid) => Math.round(grid.reduce((sum, _, i) => sum + cellScore(grid, i), 0))

/** How much the base score would change if this building went on this plot. */
export function placementGain(grid: BaseGrid, i: number, id: ModuleId): number {
  if (grid[i]) return 0
  const next = [...grid]
  next[i] = { id, level: 1 }
  return baseScore(next) - baseScore(grid)
}

/** Score targets. Each one reached refills some energy and gives research points. */
export const SCORE_GOALS = [40, 100, 180, 280, 400, 550, 750, 1000, 1300, 1700]
export const GOAL_REWARD = { energy: 8, rp: 25 }

export const goalsReached = (score: number) => SCORE_GOALS.filter(g => score >= g).length

/** The target the ring is filling towards, and the one before it. */
export function goalRange(score: number, reached: number) {
  const i = Math.max(reached, goalsReached(score))
  return { from: i ? SCORE_GOALS[i - 1] : 0, to: SCORE_GOALS[Math.min(i, SCORE_GOALS.length - 1)], done: i >= SCORE_GOALS.length }
}
