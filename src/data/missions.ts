import type { Mission, World } from './types'
import { targetById } from './targets'

/** Two campaigns: the Moon Base at the lunar south pole, then the first bases on Mars. */
export const MISSIONS: Mission[] = [
  /* ---------- Moon: south-pole base ---------- */
  {
    id: 'tutorial', title: 'First light (tutorial)', targetId: 'shackleton', passAsi: 50, reward: 50,
    brief: "NASA's Moon Base will sit on a sunlit ridge beside Shackleton crater. Crews rehearse on Earth first. Scan any site and certify one that scores at least 50.",
    weights: { aridity: 0.35, barren: 0.35, isolation: 0.3 },
    equipmentTip: 'Any dry, bare, remote site works for a first test.',
  },
  {
    id: 'ice', title: 'Polar ice prospecting', targetId: 'shackleton', passAsi: 65, reward: 150, unlocks: 'ice',
    brief: 'Water ice hides in the permanently dark craters beside the base ridge. Test an ice drill where the ground stays frozen, dry and remote.',
    weights: { ice: 0.35, cold: 0.3, aridity: 0.2, isolation: 0.15 },
    equipmentTip: 'Polar deserts beat snowy mountains.',
  },
  {
    id: 'lowsun', title: 'Grazing-Sun moonwalks', targetId: 'malapert', passAsi: 60, reward: 140,
    brief: 'At the south pole the Sun skims the horizon and shadows stretch for kilometres. NASA fakes this at night with spotlights. Find a place where the real Sun does it.',
    weights: { lowsun: 0.4, roughness: 0.25, barren: 0.2, cold: 0.15 },
    equipmentTip: 'Think far north or far south, and check the light calendar after you scan.',
  },
  {
    id: 'crater', title: 'Highland crater geology', targetId: 'mons-mouton', passAsi: 60, reward: 120, unlocks: 'lab',
    brief: 'The south pole is pale highland rock called anorthosite, not the dark lava Apollo crews trained on. Find an impact crater in the right kind of rock.',
    weights: { crater: 0.35, anorthosite: 0.3, barren: 0.2, isolation: 0.15 },
    equipmentTip: 'Very few craters on Earth formed in anorthosite. One is in Labrador.',
  },
  {
    id: 'rover', title: 'Regolith rover trials', targetId: 'mons-mouton', passAsi: 60, reward: 120, unlocks: 'rover',
    brief: 'Rovers will scout the polar plateaus before crews arrive. Find rough, bare, dry ground to test wheels and navigation.',
    weights: { roughness: 0.3, barren: 0.3, aridity: 0.2, isolation: 0.2 },
    equipmentTip: 'Fresh lava fields and rocky deserts are good rover test beds.',
  },
  {
    id: 'lavatube', title: 'Lava-tube shelter', targetId: 'marius-hills', passAsi: 65, reward: 150,
    brief: 'An inflatable habitat could sit inside a lunar lava tube, safe from radiation. Find a volcanic cave site to test it.',
    weights: { caves: 0.45, basalt: 0.3, aridity: 0.15, isolation: 0.1 },
    equipmentTip: 'Limestone caves are not volcanic. Check the rock type.',
  },
  {
    id: 'night', title: 'Lunar night survival', targetId: 'shackleton', passAsi: 65, reward: 160,
    brief: 'Even on the sunny ridge, darkness can last days and the cold is brutal. Test heaters and batteries somewhere very cold and dry.',
    weights: { cold: 0.4, thermal: 0.25, aridity: 0.2, isolation: 0.15 },
    equipmentTip: 'The coldest dry places on Earth are polar deserts.',
  },

  /* ---------- Mars: first human bases and rover sites ---------- */
  {
    id: 'mars-ice', title: 'Buried ice for fuel', targetId: 'arcadia', passAsi: 65, reward: 150,
    brief: 'SWIM maps show ice just under the plains of Arcadia Planitia: water, oxygen and rocket fuel for the trip home. Test a drill in frozen, dry ground.',
    weights: { ice: 0.35, cold: 0.25, aridity: 0.2, isolation: 0.2 },
    equipmentTip: 'Look for permafrost where it hardly ever rains or snows.',
  },
  {
    id: 'mars-delta', title: 'Delta sample hunt', targetId: 'jezero', passAsi: 60, reward: 140,
    brief: 'Perseverance is sampling an ancient river delta in Jezero crater. Train sample-hunters on dry, bare, water-laid rocks.',
    weights: { sediment: 0.35, aridity: 0.25, barren: 0.2, crater: 0.2 },
    equipmentTip: 'Sandstone badlands and salt flats are made by water.',
  },
  {
    id: 'mars-layers', title: 'Mount Sharp layers', targetId: 'gale', passAsi: 60, reward: 140,
    brief: 'Curiosity is climbing through layers of clay and salty sulfate rock. Find layered, salty sediments on steep ground for rover drivers to practise on.',
    weights: { sediment: 0.35, roughness: 0.25, aridity: 0.2, barren: 0.2 },
    equipmentTip: 'Eroded badlands show their layers best.',
  },
  {
    id: 'mars-caves', title: 'Martian cave refuge', targetId: 'arsia-caves', passAsi: 60, reward: 150,
    brief: 'Skylights on Arsia Mons may lead into caves. Practise cave robotics in volcanic tubes somewhere cold and dry.',
    weights: { caves: 0.45, basalt: 0.3, cold: 0.15, aridity: 0.1 },
    equipmentTip: 'Lava tubes, not limestone caves.',
  },
  {
    id: 'mars-plains', title: 'Zhurong plains drive', targetId: 'utopia', passAsi: 65, reward: 130,
    brief: "China's Zhurong rover drove the plains of Utopia Planitia. Test a landing pad and rover on flat, bare, empty volcanic ground.",
    weights: { barren: 0.3, aridity: 0.3, basalt: 0.2, isolation: 0.2 },
    equipmentTip: 'Remote lava deserts work well.',
  },
  {
    id: 'mars-clay', title: 'Clay drill rehearsal', targetId: 'oxia', passAsi: 65, reward: 150,
    brief: "ESA's Rosalind Franklin rover will drill 2 m into the clay plains of Oxia Planum. Find old, dry, water-laid rock to rehearse the drill.",
    weights: { sediment: 0.4, barren: 0.25, aridity: 0.2, isolation: 0.15 },
    equipmentTip: 'Clay badlands and salt basins in hyper-arid places.',
  },
]

export const missionById = (id: string) => MISSIONS.find(m => m.id === id)!
export const worldOfMission = (m: Mission): World => targetById(m.targetId).world
export const missionsOf = (world: World) => MISSIONS.filter(m => worldOfMission(m) === world)
