export type FactorKey =
  | 'thermal' | 'aridity' | 'roughness' | 'basalt'
  | 'crater' | 'caves' | 'cold' | 'isolation'

export const FACTOR_KEYS: FactorKey[] = ['thermal', 'aridity', 'roughness', 'basalt', 'crater', 'caves', 'cold', 'isolation']

export const FACTOR_LABELS: Record<FactorKey, string> = {
  thermal: 'Temperature swing',
  aridity: 'Dryness',
  roughness: 'Slope & roughness',
  basalt: 'Volcanic rock',
  crater: 'Impact craters',
  caves: 'Caves & lava tubes',
  cold: 'Extreme cold',
  isolation: 'Remoteness',
}

/** value is normalized 0..1, where 1 = as Moon-like as anywhere on Earth gets. */
export interface FactorValue {
  value: number | null
  raw: string
  sourceId: string
  estimate: boolean
}

export interface DataSource {
  id: string
  name: string
  agency: 'NASA' | 'USGS' | 'ESA' | 'JAXA' | 'Other'
  url: string
}

export interface EarthSite {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  status: 'known' | 'candidate' | 'local'
  environment: 'desert' | 'polar' | 'volcanic' | 'impact' | 'cave' | 'highland'
  description: string
  factors: Record<FactorKey, FactorValue>
}

export interface LunarTarget {
  id: string
  name: string
  lat: number
  lon: number
  description: string
  landable: boolean
  landing?: {
    difficulty: 'Easy' | 'Medium' | 'Hard'
    costMultiplier: number
    powerBonus: number
    perks: string[]
  }
  factors: Partial<Record<FactorKey, number>>
}

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
