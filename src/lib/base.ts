import type { LunarTarget, ModuleId } from '../data/types'
import { moduleById } from '../data/modules'

export interface PlacedModule { id: ModuleId; level: 1 | 2 }
export type BaseGrid = (PlacedModule | null)[]

export const GRID_SIZE = 6

export const emptyGrid = (): BaseGrid => Array.from({ length: GRID_SIZE * GRID_SIZE }, () => null)

export function moduleCost(id: ModuleId, landing: LunarTarget | undefined, upgrade = false): number {
  const def = moduleById(id)
  let cost = upgrade ? def.upgradeCost : def.cost
  cost *= landing?.landing?.costMultiplier ?? 1
  if (id === 'ice' && landing?.id === 'shackleton') cost *= 0.7
  return Math.round(cost)
}

export function modulePower(m: PlacedModule, landing: LunarTarget | undefined): number {
  const def = moduleById(m.id)
  let p = def.power[m.level - 1]
  if (m.id === 'power') p += landing?.landing?.powerBonus ?? 0
  if (m.id === 'habitat' && landing?.id === 'marius-hills') p += 1
  return p
}

export function powerBalance(grid: BaseGrid, landing: LunarTarget | undefined) {
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
export function isOperational(grid: BaseGrid, landing: LunarTarget | undefined) {
  const has = (id: ModuleId) => grid.some(c => c?.id === id)
  return has('habitat') && has('comms') && powerBalance(grid, landing).net >= 0
}

export function rankFor(stars: number) {
  if (stars >= 14) return 'Chief selenologist'
  if (stars >= 8) return 'Analog specialist'
  if (stars >= 3) return 'Field scout'
  return 'Cadet'
}
