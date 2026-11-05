import type { BaseGrid } from '../lib/base'
import { baseScore, crewCapacity, isOperational, powerBalance } from '../lib/base'
import type { ModuleId } from './types'
import type { LunarTarget } from './types'

/** What quests can look at. Built from the saved game. */
export interface QuestCtx {
  landingId: string | null
  landing: LunarTarget | undefined
  grid: BaseGrid
  scannedCount: number
  missionsDone: string[]
  stars: number
}

export interface Quest {
  id: string
  title: string
  text: string
  reward: { rp?: number; energy?: number }
  /** [have, need] */
  progress: (c: QuestCtx) => [number, number]
}

const count = (c: QuestCtx, id: ModuleId) => c.grid.filter(m => m?.id === id).length
const passed = (c: QuestCtx, mission: string) => (c.missionsDone.includes(mission) ? 1 : 0)

export const QUESTS: Quest[] = [
  { id: 'touchdown', title: 'Touchdown', text: 'Choose a landing site on the Moon.', reward: { energy: 5 }, progress: c => [c.landingId ? 1 : 0, 1] },
  { id: 'shelter', title: 'First shelter', text: 'Build a habitat.', reward: { rp: 20 }, progress: c => [count(c, 'habitat'), 1] },
  { id: 'lights', title: 'Lights on', text: 'Build 2 solar arrays.', reward: { rp: 20 }, progress: c => [count(c, 'power'), 2] },
  { id: 'call-home', title: 'Call home', text: 'Build a comms tower.', reward: { rp: 20 }, progress: c => [count(c, 'comms'), 1] },
  { id: 'running', title: 'Up and running', text: 'Make the base operational: a habitat, a comms tower and power of zero or more.', reward: { rp: 40, energy: 8 }, progress: c => [isOperational(c.grid, c.landing) ? 1 : 0, 1] },
  { id: 'scout', title: 'Analog scout', text: 'Scan 3 places on Earth.', reward: { rp: 30 }, progress: c => [c.scannedCount, 3] },
  { id: 'certified', title: 'Field certified', text: 'Pass any mission.', reward: { rp: 30 }, progress: c => [c.missionsDone.length, 1] },
  { id: 'harvest', title: 'First harvest', text: 'Build a greenhouse farm.', reward: { rp: 30, energy: 5 }, progress: c => [count(c, 'farm'), 1] },
  { id: 'crew4', title: 'Crew of four', text: 'Make room for 4 crew.', reward: { rp: 40 }, progress: c => [crewCapacity(c.grid), 4] },
  { id: 'score-120', title: 'Growing base', text: 'Reach a base score of 120.', reward: { rp: 40 }, progress: c => [baseScore(c.grid), 120] },
  { id: 'surplus', title: 'Power surplus', text: 'Make 6 more power than you use.', reward: { rp: 40 }, progress: c => [Math.max(0, powerBalance(c.grid, c.landing).net), 6] },
  { id: 'rover-trials', title: 'Rover trials', text: 'Pass the Regolith rover trials mission.', reward: { rp: 20 }, progress: c => [passed(c, 'rover'), 1] },
  { id: 'crater-science', title: 'Crater science', text: 'Pass the Impact crater geology mission.', reward: { rp: 20 }, progress: c => [passed(c, 'crater'), 1] },
  { id: 'polar-ice', title: 'Polar ice', text: 'Pass the Polar ice prospecting mission.', reward: { rp: 20 }, progress: c => [passed(c, 'ice'), 1] },
  { id: 'water', title: 'Water on tap', text: 'Build an ice extractor.', reward: { rp: 40, energy: 5 }, progress: c => [count(c, 'ice'), 1] },
  { id: 'stars6', title: 'Rising star', text: 'Earn 6 mission stars.', reward: { rp: 50 }, progress: c => [c.stars, 6] },
  { id: 'score-400', title: 'Moon town', text: 'Reach a base score of 400.', reward: { rp: 80, energy: 10 }, progress: c => [baseScore(c.grid), 400] },
]

export const questById = (id: string) => QUESTS.find(q => q.id === id)
export const questDone = (q: Quest, c: QuestCtx) => { const [have, need] = q.progress(c); return have >= need }

/** Technology: unlock a building by finishing its quests, then paying research points. */
export interface Tech { id: ModuleId; requires: string[]; rp: number; tier: 1 | 2 | 3 }

export const TECH: Tech[] = [
  { id: 'farm', requires: ['shelter', 'lights'], rp: 40, tier: 1 },
  { id: 'battery', requires: ['lights'], rp: 30, tier: 1 },
  { id: 'pad', requires: ['touchdown', 'call-home'], rp: 40, tier: 1 },
  { id: 'rover', requires: ['rover-trials'], rp: 0, tier: 2 },
  { id: 'lab', requires: ['crater-science'], rp: 0, tier: 2 },
  { id: 'ice', requires: ['polar-ice'], rp: 0, tier: 2 },
  { id: 'oxygen', requires: ['water', 'harvest'], rp: 80, tier: 3 },
  { id: 'printer', requires: ['crew4', 'score-120'], rp: 90, tier: 3 },
  { id: 'telescope', requires: ['stars6', 'surplus'], rp: 120, tier: 3 },
]

export const techFor = (id: ModuleId) => TECH.find(t => t.id === id)
