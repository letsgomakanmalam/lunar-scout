/**
 * Mission simulation: the player's base, hour by hour, for 60 days at its real landing site.
 *
 * Light, cold, dust and radiation come from each site; power, oxygen, water and food are tracked
 * against what a crew really needs. The numbers are simplified engineering estimates, chosen to
 * be in the right range, not a flight design:
 *   - Moon solar arrays: 10 kW, NASA's Vertical Solar Array Technology target, tracking the low polar Sun.
 *   - Fission reactor: 40 kW day and night, NASA's Fission Surface Power target.
 *   - Crew: 0.82 kg oxygen, 1.8 kg food and about 0.5 kg of water lost per person per day after
 *     recycling (NASA Baseline Values and Assumptions Document, BVAD).
 *   - Radiation outside: 1.37 mSv a day on the Moon (Chang'e 4 LND, Zhang et al. 2020), 0.64 on Mars
 *     (Curiosity RAD, Hassler et al. 2014). NASA's career limit is 600 mSv.
 *   - Mars: sunlight 715 W/m² above the air in northern winter, dimmed by dust; a regional dust storm.
 * Each site starts in its hardest season, so a base that survives here survives the year.
 */
import type { ModuleId, PlanetTarget } from '../data/types'
import { crewCapacity, type BaseGrid, type PlacedModule } from './base'

const RAD = Math.PI / 180
export const SIM_DAYS = 60
export const LUNAR_DAY_H = 29.53 * 24
const SUN_TILT_PERIOD_H = 346.6 * 24 // how long the Moon's subsolar point takes to swing north and back
export const SOL_H = 24.66
const MARS_SUN = 715 // W/m² above Mars' air near perihelion (northern winter)
const SOLAR_CONSTANT = 1361

/* ---------- Sites ---------- */

export interface SiteEnv {
  kind: 'polar' | 'equatorial' | 'mars'
  label: string
  /** Radiation outside, mSv per day, and where the figure comes from */
  doseRate: number
  doseSource: string
  /** How much water ice the extractor can reach (1 = plenty, 0.1 = only hydrated minerals) */
  ice: number
  /** Surface temperature in sunlight and in darkness, °C */
  dayC: number
  nightC: number
  /** Habitats inside a lava tube: shielded from radiation and kept at a steady temperature */
  lavaTube?: boolean
  /** Polar sites: how far below flat the horizon dips from the site's height (°), and distant peaks
   *  that can hide the low Sun: [direction °, height above flat °, width °] */
  dip?: number
  peaks?: [number, number, number][]
  /** Share of the year in sunlight, as published (polar sites) */
  yearLit?: number
  /** Mars: the Sun's declination in the simulated season, the usual dust and the storm */
  decl?: number
  tau?: number
  storm?: { start: number; peak: number; days: number }
}

/** Horizon dip seen from h km above the surroundings on the Moon. */
const dip = (km: number) => Math.sqrt((2 * km) / 1737.4) / RAD

export const SITE_ENV: Record<string, SiteEnv> = {
  shackleton: {
    kind: 'polar', label: 'Connecting Ridge, Shackleton', doseRate: 1.37, doseSource: "Chang'e 4 LND", ice: 1, dayC: -30, nightC: -180,
    dip: dip(1.8), peaks: [[60, 2.5, 25], [235, 2.3, 18]], yearLit: 0.88, // peaks fitted to the published 88% sunlit, dark spells of 3-5 days
  },
  malapert: {
    kind: 'polar', label: 'Malapert Massif', doseRate: 1.37, doseSource: "Chang'e 4 LND", ice: 0.6, dayC: -20, nightC: -170,
    dip: dip(5), peaks: [], // flat distant horizon: an estimate from latitude and height only
  },
  'mons-mouton': {
    kind: 'polar', label: 'Mons Mouton plateau', doseRate: 1.37, doseSource: "Chang'e 4 LND", ice: 0.6, dayC: -20, nightC: -170,
    dip: dip(6), peaks: [],
  },
  'marius-hills': {
    kind: 'equatorial', label: 'Marius Hills pit', doseRate: 1.37, doseSource: "Chang'e 4 LND", ice: 0.1, dayC: 100, nightC: -170, lavaTube: true,
  },
  arcadia: {
    kind: 'mars', label: 'Arcadia Planitia', doseRate: 0.64, doseSource: 'Curiosity RAD', ice: 1, dayC: -45, nightC: -110,
    decl: -25.2, tau: 0.6, storm: { start: 18, peak: 4, days: 16 },
  },
  jezero: {
    kind: 'mars', label: 'Jezero Crater', doseRate: 0.64, doseSource: 'Curiosity RAD', ice: 0.1, dayC: -20, nightC: -85,
    decl: -25.2, tau: 0.5, storm: { start: 18, peak: 4, days: 16 },
  },
}

export function envFor(t: PlanetTarget): SiteEnv {
  const known = SITE_ENV[t.id]
  if (known) return known
  if (t.world === 'mars') return { ...SITE_ENV.jezero, label: t.name }
  return Math.abs(t.lat) > 80 ? { ...SITE_ENV['mons-mouton'], label: t.name } : { ...SITE_ENV['marius-hills'], lavaTube: false, label: t.name }
}

export interface SunNow {
  /** Elevation and direction of the Sun, degrees */
  elev: number
  az: number
  /** Share of the Sun's power reaching the arrays (0..1), including terrain, night and dust */
  light: number
  /** Mars: dust optical depth */
  tau?: number
  /** In darkness (night, or the Sun hidden behind terrain) */
  dark: boolean
}

/** Where the Sun is and how much of it reaches the base, t hours into the simulation. */
export function sunAt(env: SiteEnv, lat: number, t: number): SunNow {
  if (env.kind === 'polar') {
    // The Sun circles just above or below the horizon once a lunar day. Its height depends on latitude
    // and on the 1.54° swing of the subsolar point; we start in the season when it is lowest.
    const az = ((t / LUNAR_DAY_H) * 360) % 360
    const swing = 90 - Math.abs(lat)
    const tilt = -1.54 * Math.cos((2 * Math.PI * t) / SUN_TILT_PERIOD_H)
    const elev = swing * Math.cos(az * RAD) + tilt
    let horizon = -env.dip!
    for (const [at, height, width] of env.peaks ?? []) {
      const d = ((az - at + 540) % 360) - 180
      horizon += height * Math.exp(-0.5 * (d / width) ** 2)
    }
    const light = Math.min(1, Math.max(0, (elev - horizon + 0.27) / 0.54)) // the Sun's disc is 0.54° wide
    return { elev, az, light, dark: light < 0.5 }
  }
  if (env.kind === 'equatorial') {
    // Two weeks of day, two weeks of night; we start at sunset, so the long night comes first
    const h = ((t / LUNAR_DAY_H) * 360 + 90) % 360
    const elev = Math.asin(Math.cos(lat * RAD) * Math.cos(h * RAD)) / RAD
    const light = Math.min(1, Math.max(0, (elev + 0.27) / 0.54))
    return { elev, az: h < 180 ? 270 : 90, light, dark: light < 0.5 }
  }
  // Mars: a 24.66-hour sol, the winter Sun, and dust that dims it
  const decl = (env.decl ?? 0) * RAD, phi = lat * RAD
  const hour = ((t / SOL_H) * 360 + 180) % 360 // start at midnight
  const sinE = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hour * RAD)
  const elev = Math.asin(sinE) / RAD
  const tau = dustAt(env, t / SOL_H)
  // Sunlight reaching sun-tracking arrays: the direct beam fades with dust and air mass; some light scatters through
  const T = sinE > 0.02 ? 0.9 * Math.exp((-0.35 * tau) / sinE) + 0.1 : 0
  const light = sinE > 0 ? (MARS_SUN / SOLAR_CONSTANT) * T * Math.min(1, sinE / 0.05) : 0
  return { elev, az: hour, light, tau, dark: sinE <= 0 }
}

/** Dust optical depth on a given sol: the usual haze, and a storm that builds, lingers and clears. */
export function dustAt(env: SiteEnv, sol: number): number {
  const base = env.tau ?? 0.5, s = env.storm
  if (!s) return base
  const x = sol - s.start
  if (x < 0 || x > s.days) return base
  const rise = Math.min(1, x / 3), fall = Math.min(1, (s.days - x) / 5)
  return base + (s.peak - base) * Math.min(rise, fall)
}

/* ---------- Modules as hardware ---------- */

/** Power drawn (kW) at level 1 and 2. Habitats also need heat in the dark (HEAT). */
export const LOAD: Record<ModuleId, [number, number]> = {
  habitat: [8, 14], power: [0, 0], comms: [0.6, 1], farm: [6, 10], battery: [0, 0], pad: [0.5, 0.8], lab: [3, 5],
  ice: [6, 10], rover: [2, 3], oxygen: [4, 7], printer: [4, 6], telescope: [0.5, 0.8], reactor: [0, 0],
}
export const HEAT_MOON: [number, number] = [4, 6]
export const HEAT_MARS: [number, number] = [2, 3]
/** Solar array output in full sunlight (kW): 10 kW is NASA's VSAT target; the upgrade adds panels */
export const SOLAR_KW: [number, number] = [10, 15]
/** Fission reactor output (kW), NASA Fission Surface Power target; the upgrade is a second unit */
export const REACTOR_KW: [number, number] = [40, 80]
/** Stored energy (kWh): batteries, fuel cells when upgraded, and a battery that comes with an upgraded array */
export const STORE_KWH = { battery: [100, 300] as [number, number], arrayUpgrade: 40 }
/** Production per day: water (kg), oxygen (kg; on Mars it is split from CO2 like Perseverance's MOXIE), food (kg) */
export const ICE_KG: [number, number] = [15, 30]
export const O2_MOON: [number, number] = [8, 14]
export const O2_MARS: [number, number] = [3, 6]
export const FARM_FOOD: [number, number] = [0.6, 1.2]
export const FARM_O2: [number, number] = [0.25, 0.5]
/** Per crew member per day (NASA BVAD) */
export const CREW = { o2: 0.82, water: 0.5, food: 1.8 }
export const START_DAYS = 30
export const RESUPPLY_DAYS = [28, 58]
/** Power is cut in this order when the batteries run flat; habitats go last */
export const SHED: ModuleId[] = ['telescope', 'lab', 'printer', 'rover', 'comms', 'farm', 'ice', 'oxygen']

/* ---------- The run ---------- */

export type Cause = 'power' | 'oxygen' | 'water' | 'food'

export interface SimResult {
  env: SiteEnv
  crew: number
  hours: number
  /** Hourly series */
  elev: Float32Array
  az: Float32Array
  light: Float32Array
  gen: Float32Array
  load: Float32Array
  soc: Float32Array
  o2: Float32Array
  water: Float32Array
  food: Float32Array
  dose: Float32Array
  shed: Uint8Array
  storeKWh: number
  /** First failure, if any */
  failed: { hour: number; cause: Cause } | null
  /** Dark stretches (hour ranges) and, on Mars, the dust storm */
  darkSpells: [number, number][]
  storm: [number, number] | null
  lit: number
  minSoc: { value: number; hour: number }
  /** Energy the worst dark spell needs from storage (kWh, at full demand) */
  deficitKWh: number
  /** Average power made and needed while the Sun is up (kW): if needed > made, storage never refills */
  sunMade: number
  sunUsed: number
  advice: string[]
}

const count = (grid: BaseGrid, id: ModuleId) => grid.filter((c): c is PlacedModule => c?.id === id)
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0)

/* ---------- One hour of the base: shared by the 60-day test and the live base ---------- */

/** The base as hardware: what it can make, store and draw. */
export interface Hardware {
  mars: boolean
  crew: number
  habitats: PlacedModule[]
  /** Everything that draws power and can be switched off, with its plot */
  others: { m: PlacedModule; cell: number }[]
  storeKWh: number
  solarKW: number
  reactorKW: number
  /** Share of radiation stopped by regolith berms once they are printed (0..0.6) */
  shield: number
  hasPad: boolean
}

export function hardwareOf(grid: BaseGrid, env: SiteEnv): Hardware {
  const lv = (m: { level: 1 | 2 }) => m.level - 1
  const others: Hardware['others'] = []
  grid.forEach((m, cell) => { if (m && m.id !== 'habitat' && LOAD[m.id][0] > 0) others.push({ m, cell }) })
  return {
    mars: env.kind === 'mars',
    crew: crewCapacity(grid),
    habitats: count(grid, 'habitat'),
    others,
    storeKWh: sum(count(grid, 'battery'), m => STORE_KWH.battery[lv(m)]) + count(grid, 'power').filter(m => m.level === 2).length * STORE_KWH.arrayUpgrade,
    solarKW: sum(count(grid, 'power'), m => SOLAR_KW[lv(m)]),
    reactorKW: sum(count(grid, 'reactor'), m => REACTOR_KW[lv(m)]),
    shield: Math.min(0.6, sum(count(grid, 'printer'), m => (m.level === 2 ? 0.5 : 0.3))),
    hasPad: count(grid, 'pad').length > 0,
  }
}

/** What the base holds: stored energy (kWh), oxygen, water and food (kg), and the crew's dose (mSv). */
export interface Stocks { stored: number; o2: number; water: number; food: number; dose: number }

export const startStocks = (hw: Hardware, days = START_DAYS): Stocks => ({
  stored: hw.storeKWh, o2: CREW.o2 * hw.crew * days, water: CREW.water * hw.crew * days, food: CREW.food * hw.crew * days, dose: 0,
})
/** What one cargo lander brings: 30 days of supplies for the crew. */
export function resupply(hw: Hardware, s: Stocks, days = 30) {
  s.o2 += CREW.o2 * hw.crew * days; s.water += CREW.water * hw.crew * days; s.food += CREW.food * hw.crew * days
}

export interface HourResult {
  gen: number
  /** Power wanted before anything is switched off, and power drawn after */
  demand: number
  load: number
  habLoad: number
  shed: number
  /** Which of hw.others stayed on */
  on: boolean[]
  /** Not even the habitats' life support could be powered */
  powerOut: boolean
}

/**
 * Runs the base for one Earth hour and updates its stocks in place.
 * opts.farmFood false: farms add no steady food (the live base adds each harvest instead);
 * opts.shield: how much of the berms is printed so far (default: all).
 */
export function stepHour(hw: Hardware, env: SiteEnv, sun: SunNow, s: Stocks, opts: { farmFood?: boolean; shield?: number } = {}): HourResult {
  const lv = (m: { level: 1 | 2 }) => m.level - 1
  const perHour = 1 / 24
  const { mars, crew, others } = hw
  const gen = hw.solarKW * sun.light + hw.reactorKW
  // Loads: habitats keep life support and heat; the rest can be switched off
  const heat = sun.dark && !env.lavaTube ? (mars ? HEAT_MARS : HEAT_MOON) : [0, 0]
  const habLoad = sum(hw.habitats, m => LOAD.habitat[lv(m)] * (env.lavaTube ? 0.85 : 1) + heat[lv(m)])
  const on = others.map(() => true)
  const demand = habLoad + sum(others, o => LOAD[o.m.id][lv(o.m)])
  let load = demand
  // Not enough power and the batteries are flat: cut the least important first
  let shed = 0
  if (gen < load && s.stored <= 0.001) {
    for (const id of SHED) {
      others.forEach((o, i) => {
        if (gen >= load || o.m.id !== id || !on[i]) return
        on[i] = false; load -= LOAD[o.m.id][lv(o.m)]; shed++
      })
    }
  }
  const net = gen - load
  s.stored = Math.min(hw.storeKWh, Math.max(0, s.stored + net * (net > 0 ? 0.92 : 1)))
  const powerOut = gen < habLoad && s.stored <= 0 && crew > 0

  // Life support, per hour
  const running = (id: ModuleId) => others.filter((o, i) => o.m.id === id && on[i]).map(o => o.m)
  s.water += sum(running('ice'), m => ICE_KG[lv(m)] * env.ice) * perHour
  for (const m of running('oxygen')) {
    const want = (mars ? O2_MARS : O2_MOON)[lv(m)] * perHour
    if (mars) s.o2 += want
    else { const made = Math.min(want, Math.max(0, s.water - CREW.water * crew) / 1.125); s.o2 += made; s.water -= made * 1.125 }
  }
  s.o2 += sum(running('farm'), m => FARM_O2[lv(m)]) * perHour
  if (opts.farmFood !== false) s.food += sum(running('farm'), m => FARM_FOOD[lv(m)]) * perHour
  s.o2 -= CREW.o2 * crew * perHour
  s.water -= CREW.water * crew * perHour
  s.food -= CREW.food * crew * perHour
  const doseDay = env.doseRate * (env.lavaTube ? 0.05 : 1) * (1 - hw.shield * (opts.shield ?? 1))
  s.dose += doseDay * perHour
  return { gen, demand, load, habLoad, shed, on, powerOut }
}

/* ---------- The run ---------- */

export function simulateBase(grid: BaseGrid, site: PlanetTarget, days = SIM_DAYS): SimResult {
  const env = envFor(site)
  const mars = env.kind === 'mars'
  const hours = Math.round(days * (mars ? SOL_H : 24))
  const hw = hardwareOf(grid, env)
  const { crew, storeKWh } = hw

  const series = () => new Float32Array(hours + 1)
  const r: SimResult = {
    env, crew, hours, elev: series(), az: series(), light: series(), gen: series(), load: series(), soc: series(),
    o2: series(), water: series(), food: series(), dose: series(), shed: new Uint8Array(hours + 1), storeKWh,
    failed: null, darkSpells: [], storm: null, lit: 0, minSoc: { value: 1, hour: 0 }, deficitKWh: 0, sunMade: 0, sunUsed: 0, advice: [],
  }
  const s = startStocks(hw)
  let darkFrom = -1, litSum = 0, spell = 0, worstSpell = 0, madeSum = 0, usedSum = 0
  const perHour = 1 / 24 // each step is one Earth hour

  for (let h = 0; h <= hours; h++) {
    const sun = sunAt(env, site.lat, h)
    if (!sun.dark) litSum++
    if (sun.dark && darkFrom < 0) darkFrom = h
    if (!sun.dark && darkFrom >= 0) { r.darkSpells.push([darkFrom, h]); darkFrom = -1 }
    const step = stepHour(hw, env, sun, s)
    const { gen, load } = step
    // At full demand: the energy each dark spell needs from storage, and the balance while the Sun is up
    if (sun.dark) spell += Math.max(0, step.demand - gen)
    else { if (spell > worstSpell) worstSpell = spell; spell = 0; madeSum += gen; usedSum += step.demand }
    if (step.powerOut && !r.failed) r.failed = { hour: h, cause: 'power' }
    const day = h / 24
    if (hw.hasPad && RESUPPLY_DAYS.some(d => Math.abs(day - d) < perHour / 2)) resupply(hw, s)
    if (crew > 0 && !r.failed) {
      if (s.o2 <= 0) r.failed = { hour: h, cause: 'oxygen' }
      else if (s.water <= 0) r.failed = { hour: h, cause: 'water' }
      else if (s.food <= 0) r.failed = { hour: h, cause: 'food' }
    }
    const daysLeft = (stock: number, need: number) => (crew ? Math.max(0, stock / (need * crew)) : 0)
    r.elev[h] = sun.elev; r.az[h] = sun.az; r.light[h] = sun.light; r.gen[h] = gen; r.load[h] = load
    r.soc[h] = storeKWh ? s.stored / storeKWh : gen >= load ? 1 : 0
    r.o2[h] = daysLeft(s.o2, CREW.o2); r.water[h] = daysLeft(s.water, CREW.water); r.food[h] = daysLeft(s.food, CREW.food)
    r.dose[h] = s.dose; r.shed[h] = step.shed
    if (r.soc[h] < r.minSoc.value) r.minSoc = { value: r.soc[h], hour: h }
  }
  if (darkFrom >= 0) r.darkSpells.push([darkFrom, hours])
  if (mars && env.storm) r.storm = [Math.round(env.storm.start * SOL_H), Math.round((env.storm.start + env.storm.days) * SOL_H)]
  r.lit = litSum / (hours + 1)
  r.deficitKWh = Math.round(Math.max(worstSpell, spell))
  r.sunMade = litSum ? madeSum / litSum : 0
  r.sunUsed = litSum ? usedSum / litSum : 0
  r.advice = adviseFor(r, grid, mars)
  return r
}

/** Concrete, physical advice from what went wrong (or nearly did). */
function adviseFor(r: SimResult, grid: BaseGrid, mars: boolean): string[] {
  const out: string[] = []
  const has = (id: ModuleId) => grid.some(c => c?.id === id)
  if (!r.crew) return ['Build a habitat first: the simulation needs a crew to keep alive.']
  if ((r.failed?.cause === 'power' || r.minSoc.value < 0.15) && r.sunUsed > r.sunMade * 0.97) {
    // Short of power even in sunlight: more batteries cannot help, they never fill up
    const n = Math.max(1, Math.ceil(((r.sunUsed - r.sunMade) / SOLAR_KW[0]) * (mars ? 3 : 1.3)))
    out.push(`Even in sunlight the base needs ${r.sunUsed.toFixed(0)} kW but makes ${r.sunMade.toFixed(0)} kW, so its batteries never fill. Add about ${n} solar array${n > 1 ? 's' : ''}${mars ? ' (sunlight on Mars is weaker)' : ''}, or a fission reactor (40 kW day and night).`)
  } else if (r.failed?.cause === 'power' || r.minSoc.value < 0.15) {
    const need = Math.max(0, r.deficitKWh - r.storeKWh)
    const batteries = Math.max(1, Math.ceil(need / STORE_KWH.battery[0]))
    if (r.env.kind === 'equatorial' || mars) out.push(`A ${r.env.kind === 'equatorial' ? '14.8-day lunar night' : 'Martian winter with a dust storm'} needs about ${r.deficitKWh.toLocaleString('en-US')} kWh more than the arrays make. Batteries that big are impractical: a fission reactor (40 kW day and night) is NASA's answer.`)
    else out.push(`The longest dark spell drew ${r.deficitKWh.toLocaleString('en-US')} kWh from storage, which holds ${r.storeKWh.toLocaleString('en-US')} kWh. Add about ${batteries} battery bank${batteries > 1 ? 's' : ''} (or upgrade them to 300 kWh fuel cells), or a fission reactor.`)
  }
  if (r.failed?.cause === 'oxygen' || r.o2[r.hours] < 5) out.push(has('oxygen') ? (mars ? 'Add another oxygen plant or upgrade it: it splits Martian CO₂ like Perseverance\'s MOXIE.' : 'The oxygen plant runs short of water: add or upgrade an ice extractor.') : mars ? 'Add an oxygen plant: on Mars it makes oxygen from the CO₂ air.' : 'Add an oxygen plant and an ice extractor, or a landing pad for resupply.')
  if (r.failed?.cause === 'water' || r.water[r.hours] < 5) out.push(r.env.ice < 0.3 ? 'There is little ice to mine here: a landing pad brings water with each cargo lander.' : 'Add an ice extractor to mine water ice.')
  if (r.failed?.cause === 'food' || r.food[r.hours] < 5) out.push('Add greenhouse farms, or a landing pad so cargo landers bring food every 30 days.')
  const dose60 = r.dose[r.hours]
  if (dose60 > 40) out.push(`The crew took ${Math.round(dose60)} mSv in ${SIM_DAYS} days (${Math.round((dose60 / 600) * 100)}% of NASA's 600 mSv career limit). Regolith printers can bury habitats under shielding berms.`)
  if (!out.length) out.push('Your base came through. Try a bigger crew, or a harder site.')
  return out
}

/** Short plain-English reason for a failure. */
export const CAUSE_TEXT: Record<Cause, string> = {
  power: 'the batteries ran flat and life support lost power',
  oxygen: 'the crew ran out of oxygen',
  water: 'the crew ran out of water',
  food: 'the crew ran out of food',
}
