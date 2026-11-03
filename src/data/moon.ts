import type { LunarTarget, Mission } from './types'

// Target values use the "Earth-best proxy": 1 means the Moon is at least as extreme
// as the most extreme place on Earth for that factor (see How scoring works).
export const LUNAR_TARGETS: LunarTarget[] = [
  {
    id: 'taurus-littrow', name: 'Taurus-Littrow Valley (Apollo 17)', lat: 20.19, lon: 30.77, landable: true,
    description: 'A mare-basalt valley between highland massifs. A proven landing site with a smooth floor.',
    landing: { difficulty: 'Easy', costMultiplier: 1.0, powerBonus: 0, perks: ['Smooth valley floor: modules cost the normal price', 'Basalt regolith is good for building-material tests'] },
    factors: { thermal: 1, aridity: 1, roughness: 0.5, basalt: 0.85, crater: 0.6, caves: 0, cold: 0.4, isolation: 1 },
  },
  {
    id: 'marius-hills', name: 'Marius Hills Pit', lat: 14.09, lon: -56.23, landable: true,
    description: 'A 65 m skylight into a possible lava tube. Natural shelter from radiation and temperature swings.',
    landing: { difficulty: 'Medium', costMultiplier: 1.1, powerBonus: 0, perks: ['Lava-tube shelter: habitats use 1 less power', 'Modules cost 10% more (rough volcanic terrain)'] },
    factors: { thermal: 1, aridity: 1, roughness: 0.7, basalt: 1, crater: 0.3, caves: 1, cold: 0.4, isolation: 1 },
  },
  {
    id: 'shackleton', name: 'Shackleton Crater Rim (south pole)', lat: -89.9, lon: 0, landable: true,
    description: 'Near-constant sunlight on the rim and permanently shadowed ice inside. An Artemis focus region.',
    landing: { difficulty: 'Hard', costMultiplier: 1.25, powerBonus: 3, perks: ['Near-constant sunlight: +3 power per solar array', 'Ice extractors cost 30% less', 'Modules cost 25% more (steep, rough terrain)'] },
    factors: { thermal: 1, aridity: 1, roughness: 0.85, basalt: 0.1, crater: 1, caves: 0, cold: 1, isolation: 1 },
  },
  {
    id: 'copernicus', name: 'Copernicus Crater', lat: 9.62, lon: -20.08, landable: false,
    description: 'A young 93 km complex crater with terraced walls and central peaks.',
    factors: { thermal: 1, aridity: 1, roughness: 0.75, basalt: 0.4, crater: 1, caves: 0, cold: 0.4, isolation: 1 },
  },
]

export const MISSIONS: Mission[] = [
  {
    id: 'tutorial', title: 'First light (tutorial)', targetId: 'taurus-littrow', passAsi: 50, reward: 50,
    brief: 'Apollo 17 crews trained on Earth before landing at Taurus-Littrow. Scan any site and certify one that scores at least 50.',
    weights: { aridity: 0.4, roughness: 0.3, isolation: 0.3 },
    equipmentTip: 'Any dry, remote site works for a first test.',
  },
  {
    id: 'rover', title: 'Regolith rover trials', targetId: 'taurus-littrow', passAsi: 60, reward: 120, unlocks: 'rover',
    brief: 'Find rough, dry, basaltic ground to test a pressurized rover before it drives the Taurus-Littrow valley.',
    weights: { roughness: 0.3, basalt: 0.25, aridity: 0.25, isolation: 0.2 },
    equipmentTip: 'Look for volcanic fields in deserts.',
  },
  {
    id: 'crater', title: 'Impact crater geology', targetId: 'copernicus', passAsi: 60, reward: 120, unlocks: 'lab',
    brief: 'Geologists must learn to read crater walls and ejecta. Find a well-preserved impact crater in a dry, remote place.',
    weights: { crater: 0.45, aridity: 0.2, isolation: 0.2, roughness: 0.15 },
    equipmentTip: 'Craters erode fast in wet climates.',
  },
  {
    id: 'lavatube', title: 'Lava-tube habitat', targetId: 'marius-hills', passAsi: 65, reward: 150,
    brief: 'An inflatable habitat could sit inside a lunar lava tube. Find a volcanic cave site to test it.',
    weights: { caves: 0.45, basalt: 0.3, aridity: 0.15, isolation: 0.1 },
    equipmentTip: 'Limestone caves are not volcanic. Check the rock type.',
  },
  {
    id: 'ice', title: 'Polar ice prospecting', targetId: 'shackleton', passAsi: 65, reward: 150, unlocks: 'ice',
    brief: "Water ice hides in Shackleton's shadows. Test an ice drill somewhere cold, dry and remote.",
    weights: { cold: 0.4, aridity: 0.25, isolation: 0.2, crater: 0.15 },
    equipmentTip: 'Polar deserts beat snowy mountains.',
  },
  {
    id: 'night', title: 'Lunar night survival', targetId: 'taurus-littrow', passAsi: 70, reward: 180,
    brief: 'A lunar night lasts 14 Earth days. Test heaters and batteries where temperatures swing hard and nothing is wet.',
    weights: { thermal: 0.45, aridity: 0.35, isolation: 0.2 },
    equipmentTip: 'The biggest day–night swings happen in hot deserts.',
  },
]

export const targetById = (id: string) => LUNAR_TARGETS.find(t => t.id === id)!
export const missionById = (id: string) => MISSIONS.find(m => m.id === id)!
