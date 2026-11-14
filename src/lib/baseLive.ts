/**
 * The living base: a mission clock that keeps running, and what everyone and everything at the base
 * is doing at that hour. Plain functions of the base layout and of time, so they can be tested and
 * the 3D scene only has to draw the result.
 *
 *   - Clock: one real second is one mission minute (or faster, the player chooses). It keeps running
 *     at that pace while the game is closed, like the energy bar.
 *   - Sun: the real Sun for the landing site at that hour (lib/baseSim).
 *   - Crew: an ISS-style day. 8.5 hours of sleep, meals, two work blocks, two hours of exercise.
 *     Moonwalks are done in pairs (the buddy rule), one pair at a time.
 *   - Greenhouse: beds are sown by hand, one every few days, so harvests keep coming. Each crop takes
 *     as long as it really did in space or in NASA's test chambers. Food arrives at harvest.
 *   - Power, air, water and food use the same hour-by-hour model as the 60-day test (stepHour).
 *   - Cargo landers come every 30 days if there is a landing pad. Regolith berms take weeks to print.
 *
 * Simplifications, on purpose: crops do not die if the lights go out, the Mars season stays winter
 * (the hardest), and a crew that runs out of anything is flown home and replaced instead of lost.
 */
import type { ModuleId, PlanetTarget } from '../data/types'
import type { BaseGrid, PlacedModule } from './base'
import {
  CREW, FARM_FOOD, ICE_KG, LUNAR_DAY_H, O2_MARS, O2_MOON, REACTOR_KW, SOLAR_KW, SOL_H, START_DAYS, STORE_KWH,
  envFor, hardwareOf, resupply, startStocks, stepHour, sunAt, type Hardware, type SiteEnv, type Stocks, type SunNow,
} from './baseSim'

/* ---------- Clock ---------- */

/** Mission seconds per real second. 60 = one real second is one mission minute. */
export const SPEEDS = [
  { rate: 0, label: 'Pause', short: 'II' },
  { rate: 60, label: '1 second = 1 minute', short: '1 min' },
  { rate: 600, label: '1 second = 10 minutes', short: '10 min' },
  { rate: 3600, label: '1 second = 1 hour', short: '1 h' },
  { rate: 21600, label: '1 second = 6 hours', short: '6 h' },
] as const
export const BASE_RATE = 60
/** A new base starts at 08:00 on day 1 */
export const START_HOUR = 8
/** The longest stretch worked through hour by hour after a break (older time is skipped) */
export const MAX_CATCH_UP_H = 24 * 45
const MARS_YEAR_H = 668.6 * SOL_H

export const dayLength = (env: SiteEnv) => (env.kind === 'mars' ? SOL_H : 24)

/** Day (or sol) number from 1, and the time of day on a 24-hour clock. */
export function clockOf(hour: number, dayLen: number) {
  const day = Math.floor(hour / dayLen)
  const hod = ((hour - day * dayLen) / dayLen) * 24
  const mins = Math.floor(hod * 60 + 1e-6), hh = Math.floor(mins / 60), mm = mins % 60
  return { day: day + 1, hod, text: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }
}

/**
 * The hour to ask the Sun model for. The 60-day test starts each site in its hardest moment; the live
 * base starts a Moon site near the equator at sunrise instead of sunset, and repeats the Mars year.
 */
export function sunHour(env: SiteEnv, hour: number) {
  if (env.kind === 'equatorial') return hour + LUNAR_DAY_H / 2
  if (env.kind === 'mars') return hour % MARS_YEAR_H
  return hour
}
export const liveSun = (env: SiteEnv, lat: number, hour: number) => sunAt(env, lat, sunHour(env, hour))

/* ---------- Greenhouse ---------- */

export interface Crop { id: 'lettuce' | 'radish' | 'wheat' | 'potato'; name: string; days: number; note: string }

/** How long each crop takes from seed to harvest, from real space and ground experiments. */
export const CROPS: Crop[] = [
  { id: 'lettuce', name: 'Red romaine lettuce', days: 33, note: 'Grown for 33 days in the Veggie unit on the International Space Station (Veg-01).' },
  { id: 'radish', name: 'Radishes', days: 27, note: 'About 27 days to maturity in the Advanced Plant Habitat on the International Space Station (Plant Habitat-02).' },
  { id: 'wheat', name: 'Wheat', days: 80, note: "77 to 86 days from planting to harvest in NASA's Biomass Production Chamber tests." },
  { id: 'potato', name: 'Potatoes', days: 105, note: "Harvested 91 or 105 days after planting in NASA's Biomass Production Chamber tests." },
]
/** Beds in a greenhouse at level 1 and 2, as indexes into CROPS */
export const BEDS: [number[], number[]] = [[0, 1, 2, 3], [0, 1, 2, 3, 0, 1]]
/** A new bed is sown every few days so harvests are spread out; a harvested bed is resown the next day */
export const SOW_EVERY_H = 3 * 24
const TURNAROUND_H = 24

export type BedStage = 'empty' | 'sown' | 'sprout' | 'growing' | 'ripe' | 'harvest'
export interface BedState {
  crop: Crop
  stage: BedStage
  /** 0 at sowing, 1 when ready to pick */
  growth: number
  /** Days since sowing (0 when empty) and days until harvest */
  day: number
  left: number
  /** How many harvests this bed has given */
  harvests: number
  /** What each harvest gives, kg */
  yieldKg: number
}

const cycleH = (c: Crop) => c.days * 24 + TURNAROUND_H
const bedYield = (c: Crop, level: 1 | 2) => (FARM_FOOD[level - 1] / BEDS[level - 1].length) * (cycleH(c) / 24)

/** One bed, age hours after the greenhouse was built. Bed k waits k sowing turns before its first seeds. */
export function bedState(age: number, k: number, level: 1 | 2): BedState {
  const crop = CROPS[BEDS[level - 1][k]]
  const yieldKg = bedYield(crop, level)
  const a = age - k * SOW_EVERY_H
  if (a < 0) return { crop, stage: 'empty', growth: 0, day: 0, left: crop.days + -a / 24, harvests: 0, yieldKg }
  const cyc = Math.floor(a / cycleH(crop)), into = a - cyc * cycleH(crop), day = into / 24
  if (day >= crop.days) return { crop, stage: 'harvest', growth: 1, day, left: 0, harvests: cyc, yieldKg }
  const growth = day / crop.days
  const stage: BedStage = growth < 0.06 ? 'sown' : growth < 0.25 ? 'sprout' : growth < 0.8 ? 'growing' : 'ripe'
  return { crop, stage, growth, day, left: crop.days - day, harvests: cyc, yieldKg }
}

export const farmBeds = (age: number, level: 1 | 2): BedState[] => BEDS[level - 1].map((_, k) => bedState(age, k, level))

/** Harvests of one greenhouse between two ages (after `from`, up to and including `to`). */
export function harvestsBetween(from: number, to: number, level: 1 | 2): { crop: Crop; kg: number }[] {
  const out: { crop: Crop; kg: number }[] = []
  BEDS[level - 1].forEach((ci, k) => {
    const crop = CROPS[ci], first = k * SOW_EVERY_H + crop.days * 24, every = cycleH(crop)
    for (let n = Math.max(0, Math.ceil((from - first) / every)); first + n * every <= to; n++) {
      if (first + n * every > from) out.push({ crop, kg: bedYield(crop, level) })
    }
  })
  return out
}

/** The hands-on job in a greenhouse today, if any: sowing or picking comes before the daily check. */
export function farmJob(beds: BedState[]): { bed: number; kind: 'sow' | 'harvest' | 'tend' } | null {
  const pick = beds.findIndex(b => b.stage === 'harvest')
  if (pick >= 0) return { bed: pick, kind: 'harvest' }
  const sow = beds.findIndex(b => b.stage === 'sown' && b.day < 1)
  if (sow >= 0) return { bed: sow, kind: 'sow' }
  const growing = beds.flatMap((b, i) => (b.stage === 'empty' ? [] : [i]))
  return growing.length ? { bed: growing[0], kind: 'tend' } : null
}

/* ---------- Crew day ---------- */

export type Duty = 'sleep' | 'meal' | 'eva' | 'farm' | 'lab' | 'systems' | 'exercise' | 'rest'
export const DUTY_TEXT: Record<Duty, string> = {
  sleep: 'Asleep', meal: 'Eating', eva: 'Working outside', farm: 'Tending the greenhouse', lab: 'In the lab',
  systems: 'Checking systems', exercise: 'Exercising', rest: 'Off duty',
}
/** Work blocks, on a 24-hour clock */
export const BLOCK_A = [8, 12] as const
export const BLOCK_B = [13.5, 17.5] as const
/** In the dark only one pair goes out, for a short inspection round with helmet lamps */
const DARK_ROUND = [11, 12.5] as const

export interface CrewCtx { dark: boolean; failed: boolean; storm: boolean; hasFarm: boolean; hasLab: boolean }

const within = (h: number, [a, b]: readonly [number, number]) => h >= a && h < b
/** Which work block a pair spends outside: pairs take turns, and swap every day. */
const evaBlock = (pair: number, day: number) => ((pair + day) % 2 === 0 ? BLOCK_A : BLOCK_B)

/** Who looks after the greenhouses today and when: the first crew member not outside in that block. */
export function gardener(n: number, day: number): { who: number; block: readonly [number, number] } {
  for (const block of [BLOCK_A, BLOCK_B]) {
    for (let i = 0; i < n; i++) if (evaBlock(Math.floor(i / 2), day) !== block) return { who: i, block: [block[0] + 1, block[0] + 3] }
  }
  return { who: 0, block: [BLOCK_B[0] + 1, BLOCK_B[0] + 3] }
}

/** What crew member i of n is doing at this time of day. */
export function dutyAt(i: number, n: number, hod: number, day: number, c: CrewCtx): Duty {
  if (hod >= 21.5 || hod < 6) return 'sleep'
  if (hod < 7.5 || within(hod, [12.5, 13.5]) || within(hod, [19.5, 20.5])) return 'meal'
  if (within(hod, [17.5, 19.5])) return 'exercise'
  if (hod >= 20.5) return 'rest'
  const pair = Math.floor(i / 2)
  if (!c.failed && !c.storm && n >= 2 && !(n % 2 && i === n - 1)) { // nobody goes out alone
    if (c.dark ? pair === 0 && within(hod, DARK_ROUND) : within(hod, evaBlock(pair, day))) return 'eva'
  }
  if (within(hod, BLOCK_A) || within(hod, BLOCK_B)) {
    const g = gardener(n, day)
    if (c.hasFarm && g.who === i && within(hod, g.block)) return 'farm'
    return c.hasLab && i % 2 === 1 ? 'lab' : 'systems'
  }
  return 'rest'
}

/* ---------- Cargo landers and printing ---------- */

/** A cargo lander every 30 days from day 28 (as in the 60-day test). It stays four days, then leaves. */
export const LANDER = { firstDay: 28, everyDays: 30, descentH: 0.25, stayH: 96 }
export type LanderPhase = 'away' | 'descent' | 'landed' | 'ascent'
export interface LanderState { phase: LanderPhase; /** 0..1 through the descent or ascent */ k: number; /** hours until the next landing */ eta: number }

const arrival = (n: number) => (LANDER.firstDay + n * LANDER.everyDays) * 24
/** Where the lander is. padSince: when the pad was built; a lander already on its way down is not caught. */
export function landerAt(hour: number, padSince = 0): LanderState {
  const n = Math.max(0, Math.floor((hour + LANDER.descentH - arrival(0)) / (LANDER.everyDays * 24)))
  const a = arrival(n), next = hour + LANDER.descentH < a ? a : arrival(n + 1)
  const eta = next - hour
  if (padSince > a - LANDER.descentH) return { phase: 'away', k: 0, eta }
  if (hour >= a - LANDER.descentH && hour < a) return { phase: 'descent', k: (hour - (a - LANDER.descentH)) / LANDER.descentH, eta: a - hour }
  if (hour >= a && hour < a + LANDER.stayH) return { phase: 'landed', k: 1, eta }
  if (hour >= a + LANDER.stayH && hour < a + LANDER.stayH + LANDER.descentH) return { phase: 'ascent', k: (hour - a - LANDER.stayH) / LANDER.descentH, eta }
  return { phase: 'away', k: 0, eta }
}
/** Landings after `from`, up to and including `to`. */
export function landingsBetween(from: number, to: number): number[] {
  const out: number[] = []
  for (let n = Math.max(0, Math.ceil((from - arrival(0)) / (LANDER.everyDays * 24))); arrival(n) <= to; n++) if (arrival(n) > from) out.push(arrival(n))
  return out
}

/** Days to print a shielding berm from regolith, at level 1 and 2 */
export const PRINT_DAYS: [number, number] = [30, 18]
export const printProgress = (age: number, level: 1 | 2) => Math.min(1, Math.max(0, age / (PRINT_DAYS[level - 1] * 24)))

/** Crews go home after about six months, like an International Space Station stay */
export const ROTATION_DAYS = 180

/* ---------- The live base ---------- */

export interface LiveEvent { h: number; text: string; kind: 'good' | 'bad' | 'info' }

export interface LiveState extends Stocks {
  site: string
  hour: number
  /** What stands on each plot and since when (mission hour) */
  built: ({ id: ModuleId; h: number } | null)[]
  crew: number
  /** When this crew arrived */
  crewSince: number
  log: LiveEvent[]
}

const LOG_MAX = 14
const say = (s: LiveState, h: number, text: string, kind: LiveEvent['kind'] = 'info') => { s.log = [{ h, text, kind }, ...s.log].slice(0, LOG_MAX) }

export function initLive(grid: BaseGrid, site: PlanetTarget): LiveState {
  const hw = hardwareOf(grid, envFor(site))
  return {
    site: site.id, hour: START_HOUR, ...startStocks(hw), crew: hw.crew, crewSince: START_HOUR,
    built: grid.map(m => (m ? { id: m.id, h: START_HOUR } : null)), log: [],
  }
}

const ageOf = (s: Pick<LiveState, 'built'>, cell: number, hour: number) => Math.max(0, hour - (s.built[cell]?.h ?? hour))
const cellsOf = (grid: BaseGrid, id: ModuleId) => grid.flatMap((m, cell) => (m?.id === id ? [{ m, cell }] : []))

/** How much of the berms is printed: each printer's share of the shielding, by its progress. */
function shieldShare(grid: BaseGrid, s: Pick<LiveState, 'built'>, hour: number) {
  const ps = cellsOf(grid, 'printer')
  if (!ps.length) return 1
  const w = (m: PlacedModule) => (m.level === 2 ? 0.5 : 0.3)
  return ps.reduce((sum, p) => sum + w(p.m) * printProgress(ageOf(s, p.cell, hour), p.m.level), 0) / ps.reduce((sum, p) => sum + w(p.m), 0)
}

/** New buildings start their clocks now; a bigger crew arrives with a month of supplies. */
function reconcile(s: LiveState, grid: BaseGrid, hw: Hardware) {
  s.built = grid.map((m, i) => (m ? (s.built[i]?.id === m.id ? s.built[i] : { id: m.id, h: s.hour }) : null))
  if (hw.crew > s.crew) {
    const more = hw.crew - s.crew
    s.o2 += CREW.o2 * more * START_DAYS; s.water += CREW.water * more * START_DAYS; s.food += CREW.food * more * START_DAYS
    if (!s.crew) { s.crewSince = s.hour; s.dose = 0 }
  }
  s.crew = hw.crew
  s.stored = Math.min(s.stored, hw.storeKWh)
}

/** Runs the base forward to a later hour, one hour at a time, and returns the new state. */
export function advanceLive(prev: LiveState, grid: BaseGrid, site: PlanetTarget, toHour: number): LiveState {
  const env = envFor(site), hw = hardwareOf(grid, env)
  const s: LiveState = { ...prev, built: [...prev.built], log: prev.log }
  reconcile(s, grid, hw)
  if (toHour <= s.hour) return s
  if (toHour - s.hour > MAX_CATCH_UP_H) s.hour = toHour - MAX_CATCH_UP_H
  const farms = cellsOf(grid, 'farm')
  let wasDark = liveSun(env, site.lat, Math.floor(s.hour)).dark
  for (let h = Math.floor(s.hour) + 1; h <= Math.floor(toHour); h++) {
    const sun = liveSun(env, site.lat, h)
    const step = stepHour(hw, env, sun, s, { farmFood: false, shield: shieldShare(grid, s, h) })
    if (env.kind !== 'mars' && sun.dark !== wasDark) say(s, h, sun.dark ? (env.kind === 'polar' ? 'The Sun slipped behind the ridge. The base is on stored power.' : 'Sunset. The two-week lunar night begins.') : (env.kind === 'polar' ? 'The Sun is back above the ridge.' : 'Sunrise after the long lunar night.'), sun.dark ? 'bad' : 'good')
    wasDark = sun.dark
    if (hw.crew > 0) {
      for (const f of farms) {
        const age = ageOf(s, f.cell, h)
        for (const hv of harvestsBetween(age - 1, age, f.m.level)) {
          s.food += hv.kg
          say(s, h, `${hv.crop.name} harvested: ${hv.kg.toFixed(1)} kg of fresh food. The bed is sown again tomorrow.`, 'good')
        }
      }
      if (hw.hasPad && landingsBetween(h - 1, h).length) { resupply(hw, s); say(s, h, 'A cargo lander touched down with 30 days of oxygen, water and food.', 'good') }
      const out = step.powerOut ? 'power' : s.o2 <= 0 ? 'oxygen' : s.water <= 0 ? 'water' : s.food <= 0 ? 'food' : null
      if (out && h - s.crewSince >= 72) {
        // No one is lost: the crew flies home and a relief crew lands with fresh supplies
        Object.assign(s, { ...startStocks(hw), stored: hw.storeKWh * 0.5 })
        s.crewSince = h
        say(s, h, `The base ran out of ${out}. The crew flew home and a relief crew landed with 30 days of supplies.`, 'bad')
      } else if ((h - s.crewSince) / 24 >= ROTATION_DAYS) {
        s.crewSince = h; s.dose = 0
        say(s, h, `Crew rotation after ${ROTATION_DAYS} days: a fresh crew takes over.`)
      }
    }
  }
  s.hour = toHour
  return s
}

/* ---------- What to draw and tell, for one moment ---------- */

export interface CellLive {
  /** Powered and running */
  on: boolean
  /** One line for the building's card */
  status: string
  beds?: BedState[]
  /** A crew member is working in this greenhouse right now */
  job?: { bed: number; kind: 'sow' | 'harvest' | 'tend' } | null
  lander?: LanderState
  /** 0..1: berm printed, tank filled or battery charged */
  level?: number
  /** Window light, 0..1 */
  lit?: number
  /** Crew inside */
  inside?: number
}

export interface LiveFrame {
  hour: number
  dayLen: number
  day: number
  hod: number
  time: string
  mars: boolean
  sun: SunNow
  storm: boolean
  gen: number
  load: number
  /** Battery charge 0..1, or null without storage */
  soc: number | null
  storeKWh: number
  /** Days of oxygen, water and food left for the crew */
  o2: number
  water: number
  food: number
  dose: number
  crew: number
  duties: Duty[]
  cells: (CellLive | null)[]
  failed: boolean
}

/** The moment to describe: the live base's state, or one hour of the 60-day test. */
export interface Snapshot {
  hour: number
  /** The hour for the Sun model, if different (the 60-day test uses its own) */
  sunAtHour?: number
  stored: number
  o2: number
  water: number
  food: number
  dose: number
  /** When each plot was built; missing means from the start */
  built?: LiveState['built']
  failed?: boolean
}

const days = (stock: number, need: number, crew: number) => (crew ? Math.max(0, stock / (need * crew)) : 0)
const until = (h: number) => (h < 1 ? 'in under an hour' : h < 36 ? `in ${Math.round(h)} hours` : `in ${Math.round(h / 24)} days`)

export function frameFor(grid: BaseGrid, site: PlanetTarget, snap: Snapshot): LiveFrame {
  const env = envFor(site), hw = hardwareOf(grid, env), dayLen = dayLength(env), mars = env.kind === 'mars'
  const { hour } = snap
  const clock = clockOf(hour, dayLen)
  const sun = snap.sunAtHour !== undefined ? sunAt(env, site.lat, snap.sunAtHour) : liveSun(env, site.lat, hour)
  const storm = mars && (sun.tau ?? 0) > 2
  // The same switching-off rule as the hour step, without changing anything
  const probe = stepHour(hw, env, sun, { stored: snap.stored, o2: 1e9, water: 1e9, food: 1e9, dose: 0 })
  const failed = snap.failed ?? probe.powerOut
  const onCell = new Map(hw.others.map((o, i) => [o.cell, probe.on[i]]))
  const net = probe.gen - probe.load
  const soc = hw.storeKWh ? Math.min(1, snap.stored / hw.storeKWh) : null
  const built = { built: snap.built ?? grid.map(m => (m ? { id: m.id, h: 0 } : null)) }
  const age = (cell: number) => ageOf(built, cell, hour)
  const ctx: CrewCtx = { dark: sun.dark, failed, storm, hasFarm: grid.some(m => m?.id === 'farm'), hasLab: grid.some(m => m?.id === 'lab') }
  const day = clock.day - 1
  const duties = Array.from({ length: hw.crew }, (_, i) => dutyAt(i, hw.crew, clock.hod, day, ctx))
  const insideAll = duties.filter(d => d !== 'eva').length
  const asleep = duties.length > 0 && duties.every(d => d === 'sleep')
  const o2 = days(snap.o2, CREW.o2, hw.crew), water = days(snap.water, CREW.water, hw.crew), food = days(snap.food, CREW.food, hw.crew)
  const lv = (m: PlacedModule) => m.level - 1
  const habitats = cellsOf(grid, 'habitat')
  let farmSeen = 0
  const farmsTotal = cellsOf(grid, 'farm').length

  const cells = grid.map((m, cell): CellLive | null => {
    if (!m) return null
    const on = !failed && (onCell.get(cell) ?? true)
    const off = failed ? 'Life support has failed' : 'Switched off to save power'
    switch (m.id) {
      case 'habitat': {
        const share = habitats.length ? Math.round(insideAll / habitats.length) : 0
        return { on: !failed, lit: failed ? 0 : asleep ? 0.12 : 1, inside: share, status: failed ? off : !hw.crew ? 'Empty' : asleep ? `${hw.crew} crew asleep` : `${insideAll} inside, ${hw.crew - insideAll} outside` }
      }
      case 'power': {
        const kw = SOLAR_KW[lv(m)] * sun.light
        return { on: sun.light > 0.02, level: sun.light, status: sun.light > 0.02 ? `Tracking the Sun: making ${kw.toFixed(1)} of ${SOLAR_KW[lv(m)]} kW${storm ? ' through the dust' : ''}` : mars ? 'Night: no sunlight' : 'The Sun is hidden: no power' }
      }
      case 'reactor': return { on: true, status: `Making ${REACTOR_KW[lv(m)]} kW, day and night` }
      case 'battery': {
        const kwh = STORE_KWH.battery[lv(m)] * (soc ?? 0)
        return { on: true, level: soc ?? 0, status: `${Math.round((soc ?? 0) * 100)}% charged (${Math.round(kwh)} kWh), ${Math.abs(net) < 0.05 || (soc === 1 && net > 0) ? 'holding' : net > 0 ? 'charging' : 'feeding the base'}` }
      }
      case 'comms': {
        const pass = mars && (Math.abs(clock.hod - 3) < 0.2 || Math.abs(clock.hod - 15) < 0.2)
        return { on, level: mars ? (pass ? 1 : 0) : 1, status: !on ? off : mars ? (pass ? 'Relay orbiter overhead: sending data to Earth' : 'Waiting for the next relay orbiter pass (about 03:00 and 15:00)') : 'Linked to Earth: 1.3 seconds each way' }
      }
      case 'farm': {
        const beds = hw.crew ? farmBeds(age(cell), m.level) : farmBeds(-1, m.level).map(b => ({ ...b, left: b.crop.days }))
        const g = gardener(hw.crew, day)
        // The gardener splits the two-hour slot between the greenhouses
        const slot = (g.block[1] - g.block[0]) / Math.max(1, farmsTotal), from = g.block[0] + slot * farmSeen++
        const here = on && hw.crew > 0 && duties[g.who] === 'farm' && clock.hod >= from && clock.hod < from + slot
        const job = here ? farmJob(beds) : null
        const next = beds.filter(b => b.stage !== 'empty').sort((a, b) => a.left - b.left)[0]
        const status = !hw.crew ? 'Needs a crew to sow the beds' : !on ? `${off}: the grow lights are dark` : job?.kind === 'harvest' ? `Crew picking ${beds[job.bed].crop.name.toLowerCase()}` : job?.kind === 'sow' ? `Crew sowing ${beds[job.bed].crop.name.toLowerCase()}` : job ? 'Crew watering and checking the beds' : next ? (next.stage === 'harvest' ? `${next.crop.name} ready to pick` : `Next harvest: ${next.crop.name.toLowerCase()} in ${Math.ceil(next.left)} days`) : 'Beds ready for the first seeds'
        // Grow lights: 16 hours on, 8 off, as for lettuce on the space station
        return { on, beds, job, lit: on && clock.hod >= 6 && clock.hod < 22 ? 1 : 0, status }
      }
      case 'pad': {
        const l = landerAt(hour, built.built[cell]?.h ?? 0)
        return { on, lander: l, status: l.phase === 'descent' ? 'Cargo lander on final descent' : l.phase === 'landed' ? 'Cargo lander on the pad: unloading supplies' : l.phase === 'ascent' ? 'Cargo lander lifting off' : `Next cargo lander ${until(l.eta)}` }
      }
      case 'lab': {
        const busy = on && duties.some(d => d === 'lab')
        return { on, lit: on ? (busy ? 1 : 0.25) : 0, status: !on ? off : busy ? 'Crew analysing regolith samples' : 'Instruments on standby' }
      }
      case 'ice': return { on, level: Math.min(1, water / 60), status: !on ? off : `Drilling: ${(ICE_KG[lv(m)] * env.ice).toFixed(1)} kg of water a day${env.ice < 0.3 ? ' (little ice here)' : ''}` }
      case 'oxygen': return { on, level: Math.min(1, o2 / 60), status: !on ? off : mars ? `Splitting CO₂ from the air: ${O2_MARS[lv(m)]} kg of oxygen a day` : `Splitting water: up to ${O2_MOON[lv(m)]} kg of oxygen a day` }
      case 'rover': {
        const out = on && !sun.dark && clock.hod >= 8 && clock.hod < 16
        return { on, level: out ? 1 : 0, status: !on ? off : out ? 'Rover out on its daily traverse' : sun.dark ? 'Rover parked: too dark to drive far' : 'Rover parked and charging' }
      }
      case 'printer': {
        const p = printProgress(age(cell), m.level)
        return { on, level: p, status: p >= 1 ? 'Berm finished: shielding the habitats from radiation' : !on ? `${off} (berm ${Math.round(p * 100)}% printed)` : `Printing a regolith berm: ${Math.round(p * 100)}%, ${Math.ceil((1 - p) * PRINT_DAYS[lv(m)])} days to go` }
      }
      case 'telescope': return { on, status: !on ? off : 'Listening to the early universe' }
    }
  })

  return {
    hour, dayLen, day: clock.day, hod: clock.hod, time: clock.text, mars, sun, storm, gen: probe.gen, load: probe.load,
    soc, storeKWh: hw.storeKWh, o2, water, food, dose: snap.dose, crew: hw.crew, duties, cells, failed,
  }
}

/** Moves a clock forward: real milliseconds at a speed (mission seconds per real second) to mission hours. */
export const missionHours = (ms: number, rate: number) => (Math.max(0, ms) / 1000) * rate / 3600
