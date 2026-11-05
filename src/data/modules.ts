import type { ModuleId } from './types'

export interface ModuleDef {
  id: ModuleId
  name: string
  icon: string
  /** Energy to build. Energy refills over time. */
  energy: number
  /** Research points, the reference price (upgrades use upgradeCost). */
  cost: number
  upgradeCost: number
  power: [number, number] // power at level 1 and level 2 (positive = produces)
  description: string
  startsUnlocked: boolean
}

export const MODULES: ModuleDef[] = [
  { id: 'habitat', name: 'Habitat', icon: '🏠', energy: 4, cost: 60, upgradeCost: 90, power: [-2, -3], description: 'Living space for 2 crew (4 when upgraded).', startsUnlocked: true },
  { id: 'power', name: 'Solar array', icon: '☀️', energy: 2, cost: 40, upgradeCost: 60, power: [4, 7], description: 'Makes power and refills energy faster. The upgrade adds batteries for the lunar night.', startsUnlocked: true },
  { id: 'comms', name: 'Comms tower', icon: '📡', energy: 3, cost: 50, upgradeCost: 70, power: [-1, -1], description: 'Links the base to Earth. The upgrade adds a far-side relay.', startsUnlocked: true },
  { id: 'farm', name: 'Greenhouse farm', icon: '🌱', energy: 3, cost: 50, upgradeCost: 80, power: [-1, -2], description: 'Grows food under glass with LED light. Plants also recycle air and water.', startsUnlocked: false },
  { id: 'battery', name: 'Battery bank', icon: '🔋', energy: 2, cost: 40, upgradeCost: 60, power: [0, 1], description: 'Stores 6 more energy (10 when upgraded), so you can build more at once.', startsUnlocked: false },
  { id: 'pad', name: 'Landing pad', icon: '🛬', energy: 3, cost: 50, upgradeCost: 70, power: [0, 0], description: 'Supply landers bring parts, so energy refills faster. Rocket dust annoys nearby homes and farms.', startsUnlocked: false },
  { id: 'lab', name: 'Science lab', icon: '🔬', energy: 4, cost: 80, upgradeCost: 110, power: [-2, -3], description: 'Analyzes regolith samples. Unlocked by the crater mission.', startsUnlocked: false },
  { id: 'ice', name: 'Ice extractor', icon: '🧊', energy: 5, cost: 90, upgradeCost: 120, power: [-3, -4], description: 'Mines water ice for drinking water, oxygen and fuel. Unlocked by the polar ice mission.', startsUnlocked: false },
  { id: 'rover', name: 'Rover garage', icon: '🚙', energy: 3, cost: 70, upgradeCost: 90, power: [-1, -2], description: 'Shelters a pressurized rover. Unlocked by the rover mission.', startsUnlocked: false },
  { id: 'oxygen', name: 'Oxygen plant', icon: '🫧', energy: 4, cost: 80, upgradeCost: 110, power: [-2, -3], description: 'Splits water from the ice into oxygen to breathe and hydrogen for fuel.', startsUnlocked: false },
  { id: 'printer', name: 'Regolith printer', icon: '🏗️', energy: 4, cost: 90, upgradeCost: 120, power: [-2, -3], description: 'Prints shelters and roads from Moon dust, so less has to come from Earth.', startsUnlocked: false },
  { id: 'telescope', name: 'Radio telescope', icon: '🔭', energy: 5, cost: 120, upgradeCost: 150, power: [-1, -1], description: 'Listens to the early universe from the quiet Moon. Needs peace: other buildings nearby cost points.', startsUnlocked: false },
]

export const moduleById = (id: ModuleId) => MODULES.find(m => m.id === id)!
