export type FactorKey =
  | 'thermal' | 'aridity' | 'roughness' | 'basalt' | 'anorthosite'
  | 'crater' | 'caves' | 'cold' | 'isolation' | 'ice' | 'sediment' | 'lowsun' | 'barren'

export const FACTOR_KEYS: FactorKey[] = ['thermal', 'aridity', 'roughness', 'basalt', 'anorthosite', 'crater', 'caves', 'cold', 'isolation', 'ice', 'sediment', 'lowsun', 'barren']

export const FACTOR_LABELS: Record<FactorKey, string> = {
  thermal: 'Temperature swing',
  aridity: 'Dryness',
  roughness: 'Slope & roughness',
  basalt: 'Volcanic rock (basalt)',
  anorthosite: 'Highland rock (anorthosite)',
  crater: 'Impact craters',
  caves: 'Caves & lava tubes',
  cold: 'Extreme cold',
  isolation: 'Remoteness',
  ice: 'Ground ice & permafrost',
  sediment: 'Water-laid rock & salts',
  lowsun: 'Low polar Sun',
  barren: 'Bare ground (no plants)',
}

/** One line on what each factor measures and why it matters off Earth. */
export const FACTOR_HINTS: Record<FactorKey, string> = {
  thermal: 'How far the temperature swings between day and night. Heaters, batteries and seals have to cope.',
  aridity: 'How little rain falls. The Moon and Mars are drier than anywhere on Earth.',
  roughness: 'Local relief and slopes. Rovers, landers and moonwalkers need practice on the right ground.',
  basalt: 'Dark volcanic rock like the lunar maria and most of Mars.',
  anorthosite: 'Pale feldspar-rich rock that makes up the lunar highlands, including the south pole.',
  crater: 'Impact craters to practise reading ejecta, breccia and crater walls.',
  caves: 'Lava tubes and caves that could shelter a base from radiation and temperature swings.',
  cold: 'How cold it gets on average. Polar Moon craters and Mars are colder than anywhere on Earth.',
  isolation: 'How few people live nearby. Remote places keep tests clean and mimic isolation.',
  ice: 'Frozen ground and buried ice, the water source for a Moon or Mars base.',
  sediment: 'Rock laid down by water, clays and salts: where Mars rovers look for signs of past life.',
  lowsun: 'How often the Sun stays just above the horizon all day, as it does at the lunar south pole.',
  barren: 'How bare the ground is. No plants, like on the Moon and Mars.',
}

/** value is normalized 0..1, where 1 = as Moon- or Mars-like as anywhere on Earth gets. */
export interface FactorValue {
  value: number | null
  raw: string
  sourceId: string
  estimate: boolean
}

export type Agency = 'NASA' | 'USGS' | 'ESA' | 'JAXA' | 'ISRO' | 'CNSA' | 'CSA' | 'Other'

export interface DataSource {
  id: string
  name: string
  agency: Agency
  url: string
}

export type World = 'moon' | 'mars'
export const WORLD_LABEL: Record<World, string> = { moon: 'Moon', mars: 'Mars' }

export type Environment = 'desert' | 'polar' | 'volcanic' | 'impact' | 'cave' | 'highland' | 'sedimentary' | 'acidic'

export interface EarthSite {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  /** known = used by space agencies; candidate = little-used or new; local = Malaysian comparison; discovery = found by the player with live data */
  status: 'known' | 'candidate' | 'local' | 'discovery'
  environment: Environment
  description: string
  /** Who has used it for space analog work, if anyone */
  analogUse?: string
  factors: Record<FactorKey, FactorValue>
  /** For player discoveries: when and where it was probed */
  probedAt?: string
}

export interface Landing {
  difficulty: 'Easy' | 'Medium' | 'Hard'
  costMultiplier: number
  /** Extra power per solar array (negative where sunlight is weaker) */
  powerBonus: number
  perks: string[]
  /** Price multipliers for single buildings, e.g. 0.7 = 30% cheaper */
  discounts?: Partial<Record<ModuleId, number>>
  /** Power each habitat saves (lava-tube shelter) */
  habitatPower?: number
}

/** A place on the Moon or Mars: a base site, a landing site or a science target. */
export interface PlanetTarget {
  id: string
  world: World
  kind: 'base' | 'landing' | 'science'
  name: string
  lat: number
  lon: number
  /** Coordinates are a region centre, not a surveyed point */
  approx?: boolean
  description: string
  /** Who is going there, e.g. "NASA Moon Base" */
  program?: string
  facts: string[]
  sourceIds: string[]
  landable: boolean
  landing?: Landing
  /** Earth-best proxy values, 0..1 (see How scoring works) */
  factors: Partial<Record<FactorKey, number>>
  /** What matters most for a base or crew here: weights the Twin finder uses */
  profile: Partial<Record<FactorKey, number>>
}

/** Kept so older imports still read naturally. */
export type LunarTarget = PlanetTarget

export type ModuleId = 'habitat' | 'power' | 'comms' | 'farm' | 'battery' | 'pad' | 'lab' | 'ice' | 'rover' | 'oxygen' | 'printer' | 'telescope'

export interface Mission {
  id: string
  title: string
  brief: string
  targetId: string
  weights: Partial<Record<FactorKey, number>>
  passAsi: number
  reward: number
  unlocks?: ModuleId
  equipmentTip: string
}
