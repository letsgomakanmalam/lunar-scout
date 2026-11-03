import type { ModuleId } from './types'

export interface ModuleDef {
  id: ModuleId
  name: string
  icon: string
  cost: number
  upgradeCost: number
  power: [number, number] // power at level 1 and level 2 (positive = produces)
  description: string
  startsUnlocked: boolean
}

export const MODULES: ModuleDef[] = [
  { id: 'habitat', name: 'Habitat', icon: '🏠', cost: 60, upgradeCost: 90, power: [-2, -3], description: 'Living space for 2 crew (4 when upgraded).', startsUnlocked: true },
  { id: 'power', name: 'Solar array', icon: '☀️', cost: 40, upgradeCost: 60, power: [4, 7], description: 'Makes power. The upgrade adds batteries for the lunar night.', startsUnlocked: true },
  { id: 'comms', name: 'Comms tower', icon: '📡', cost: 50, upgradeCost: 70, power: [-1, -1], description: 'Links the base to Earth. The upgrade adds a far-side relay.', startsUnlocked: true },
  { id: 'lab', name: 'Science lab', icon: '🔬', cost: 80, upgradeCost: 110, power: [-2, -3], description: 'Analyzes regolith samples. Unlocked by the crater mission.', startsUnlocked: false },
  { id: 'ice', name: 'Ice extractor', icon: '🧊', cost: 90, upgradeCost: 120, power: [-3, -4], description: 'Mines water ice for drinking water, oxygen and fuel. Unlocked by the polar ice mission.', startsUnlocked: false },
  { id: 'rover', name: 'Rover garage', icon: '🚙', cost: 70, upgradeCost: 90, power: [-1, -2], description: 'Shelters a pressurized rover. Unlocked by the rover mission.', startsUnlocked: false },
]

export const moduleById = (id: ModuleId) => MODULES.find(m => m.id === id)!
