import type { PlanetTarget, World } from './types'

/*
 * Where future bases and landings will be, on the Moon and on Mars.
 * Factor values use the "Earth-best proxy": 1 means the place is at least as extreme as the
 * most extreme place on Earth for that factor (see How scoring works). `profile` says what
 * matters most for a crew there; the Twin finder ranks Earth sites with it.
 */
export const TARGETS: PlanetTarget[] = [
  /* ---------- Moon: the permanent base at the south pole ---------- */
  {
    id: 'shackleton', world: 'moon', kind: 'base', name: 'Connecting Ridge, Shackleton (Moon Base)', lat: -89.44, lon: -137.2,
    program: 'NASA Moon Base, primary site',
    description: "NASA's chosen site for its permanent Moon Base: a ridge between Shackleton and de Gerlache craters. Sunlit most of the time, with permanently shadowed, icy craters next door.",
    facts: [
      'NASA plans its Moon Base near the lunar south pole, and the first Moon Base mission targets this ridge.',
      'Sunlit about 88% of the time at 2 m height, with dark spells of only a few days (Gläser et al., 2014).',
      'At the pole the Sun never climbs more than about 1.5° above the horizon, so shadows stretch for kilometres.',
      "Shackleton's shadowed floor averages about 90 K (−183 °C) and can trap water ice.",
    ],
    processes: ['impact', 'ice'],
    sourceIds: ['moonbase', 'ridge-light', 'lola', 'diviner', 'kaguya', 'chandrayaan'],
    landable: true,
    landing: {
      difficulty: 'Hard', costMultiplier: 1.25, powerBonus: 3, discounts: { ice: 0.7 },
      perks: ['Sunlit almost all the time: +3 power per solar array', 'Ice next door: ice extractors cost 30% less', 'Modules cost 25% more (steep, rough polar terrain)'],
    },
    factors: { thermal: 0.7, aridity: 1, roughness: 0.6, basalt: 0.1, anorthosite: 0.85, crater: 1, caves: 0, cold: 1, isolation: 1, ice: 1, sediment: 0, lowsun: 1, barren: 1 },
    profile: { lowsun: 0.2, cold: 0.2, ice: 0.15, anorthosite: 0.15, crater: 0.1, roughness: 0.1, barren: 0.1 },
  },
  {
    id: 'malapert', world: 'moon', kind: 'landing', name: 'Malapert Massif', lat: -85.8, lon: 0, approx: true,
    program: 'Artemis III candidate region',
    description: 'A high mountain on the Earth-facing side of the south pole and one of the nine Artemis III candidate landing regions. Facing Earth makes direct radio links home easier.',
    facts: [
      'One of nine Artemis III candidate landing regions (NASA, 2024 update).',
      "Intuitive Machines' IM-1 lander came to rest near Malapert A crater in 2024.",
      'Pale highland rock, not the dark lava of the Apollo sites.',
    ],
    processes: ['impact'],
    sourceIds: ['artemis3', 'lola', 'lroc', 'kaguya'],
    landable: true,
    landing: {
      difficulty: 'Medium', costMultiplier: 1.1, powerBonus: 2, discounts: { comms: 0.7 },
      perks: ['Earth in view most of the time: comms towers cost 30% less', 'Good sunlight on the high slopes: +2 power per solar array', 'Modules cost 10% more (steep massif)'],
    },
    factors: { thermal: 0.8, aridity: 1, roughness: 0.85, basalt: 0.1, anorthosite: 0.9, crater: 0.8, caves: 0, cold: 0.95, isolation: 1, ice: 0.7, sediment: 0, lowsun: 1, barren: 1 },
    profile: { lowsun: 0.2, roughness: 0.2, anorthosite: 0.15, cold: 0.15, crater: 0.15, barren: 0.15 },
  },
  {
    id: 'mons-mouton', world: 'moon', kind: 'landing', name: 'Mons Mouton plateau', lat: -84.6, lon: 31.0,
    program: 'Artemis III candidate regions',
    description: 'A flat-topped mountain about 6 km high between Nobile and Malapert craters. Two Artemis III candidate regions lie on and around it.',
    facts: [
      'Mons Mouton and Mons Mouton Plateau are both Artemis III candidate regions.',
      'Flat top about 6 km above its base, from LRO laser altimetry.',
      "Picked for NASA's VIPER ice rover; the IM-2 Athena lander touched down here on 6 March 2025.",
    ],
    processes: ['impact', 'ice'],
    sourceIds: ['artemis3', 'lola', 'lroc'],
    landable: true,
    landing: {
      difficulty: 'Easy', costMultiplier: 1.0, powerBonus: 1,
      perks: ['Broad, flat plateau top: modules cost the normal price', 'High ground catches sunlight: +1 power per solar array'],
    },
    factors: { thermal: 0.8, aridity: 1, roughness: 0.45, basalt: 0.1, anorthosite: 0.9, crater: 0.8, caves: 0, cold: 0.95, isolation: 1, ice: 0.6, sediment: 0, lowsun: 1, barren: 1 },
    profile: { lowsun: 0.2, anorthosite: 0.2, barren: 0.15, cold: 0.15, roughness: 0.15, crater: 0.15 },
  },
  {
    id: 'marius-hills', world: 'moon', kind: 'base', name: 'Marius Hills pit (lava tube)', lat: 14.09, lon: -56.23,
    program: 'Lava-tube shelter concept',
    description: 'A 65 m skylight into what may be a lava tube. A tube could shelter a long-term base from radiation, micrometeorites and temperature swings.',
    facts: [
      "Found in 2009 in images from JAXA's Kaguya orbiter, then studied by NASA's LRO.",
      'Lava tubes are a leading idea for long-term shelters on both the Moon and Mars.',
      'Near the equator, so the Sun climbs high and nights last two weeks.',
    ],
    processes: ['volcanism', 'impact'],
    sourceIds: ['kaguya', 'lroc', 'usgs-moon'],
    landable: true,
    landing: {
      difficulty: 'Medium', costMultiplier: 1.1, powerBonus: 0, habitatPower: 1,
      perks: ['Lava-tube shelter: habitats use 1 less power', 'Modules cost 10% more (rough volcanic terrain)'],
    },
    factors: { thermal: 1, aridity: 1, roughness: 0.7, basalt: 1, anorthosite: 0, crater: 0.3, caves: 1, cold: 0.4, isolation: 1, ice: 0, sediment: 0, lowsun: 0, barren: 1 },
    profile: { caves: 0.35, basalt: 0.25, barren: 0.15, aridity: 0.15, roughness: 0.1 },
  },

  /* ---------- Mars: first human bases and rover sites ---------- */
  {
    id: 'arcadia', world: 'mars', kind: 'base', name: 'Arcadia Planitia', lat: 47.2, lon: -175.7, approx: true,
    program: 'Candidate human base region (SWIM ice maps)',
    description: 'Broad volcanic plains where NASA-funded SWIM maps show ice-rich ground close to the surface. Ice there means drinking water, oxygen and rocket fuel for the trip home.',
    facts: [
      'SWIM rates Arcadia and Deuteronilus Mensae the most promising buried-ice areas for human landing sites (Morgan et al., 2021).',
      'Smooth plains laid down by ancient lava flows: good for landing.',
      "About 0.6% of Earth's air pressure, mostly CO₂, and 0.38 g gravity.",
    ],
    processes: ['volcanism', 'ice', 'wind'],
    sourceIds: ['swim', 'mola', 'hirise', 'hrsc'],
    landable: true,
    landing: {
      difficulty: 'Medium', costMultiplier: 1.3, powerBonus: -1, discounts: { ice: 0.6, oxygen: 0.7 },
      perks: ['Ice under the dust: ice extractors cost 40% less', "CO₂ air: oxygen plants cost 30% less (Perseverance's MOXIE made oxygen from it)", 'Weaker sunlight: −1 power per solar array', 'Everything costs 30% more (Mars is far from Earth)'],
    },
    factors: { thermal: 1, aridity: 1, roughness: 0.3, basalt: 0.8, anorthosite: 0, crater: 0.5, caves: 0, cold: 1, isolation: 1, ice: 1, sediment: 0.3, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { ice: 0.25, cold: 0.2, basalt: 0.15, aridity: 0.1, barren: 0.1, roughness: 0.1, wind: 0.1 },
  },
  {
    id: 'deuteronilus', world: 'mars', kind: 'base', name: 'Deuteronilus Mensae', lat: 43.9, lon: 22.6, approx: true,
    program: 'Candidate human base region (SWIM ice maps)',
    description: 'Mesas wrapped in debris-covered glaciers: thick ice hidden under rock and dust. One of the two best ice regions for human landing sites in the SWIM maps.',
    facts: [
      'Orbital radar shows the aprons around the mesas are mostly ice under a rocky cover.',
      'Rough mesa terrain makes landing harder than on the plains.',
    ],
    processes: ['ice', 'wind'],
    sourceIds: ['swim', 'hirise', 'hrsc'],
    landable: false,
    factors: { thermal: 1, aridity: 1, roughness: 0.7, basalt: 0.5, anorthosite: 0, crater: 0.4, caves: 0, cold: 1, isolation: 1, ice: 1, sediment: 0.4, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { ice: 0.3, cold: 0.2, aridity: 0.15, roughness: 0.15, barren: 0.1, wind: 0.1 },
  },
  {
    id: 'jezero', world: 'mars', kind: 'landing', name: 'Jezero Crater', lat: 18.38, lon: 77.58,
    program: 'NASA Perseverance rover',
    description: 'A 45 km crater that once held a lake, with a river delta Perseverance has explored since 2021, collecting rock samples for possible return to Earth.',
    facts: [
      'Lake and delta deposits about 3.5 billion years old.',
      'Perseverance landed on 18 February 2021.',
      'Volcanic rocks on the crater floor as well as water-laid sediments.',
    ],
    processes: ['water', 'impact', 'volcanism', 'wind'],
    sourceIds: ['m2020', 'crism', 'hirise'],
    landable: true,
    landing: {
      difficulty: 'Hard', costMultiplier: 1.4, powerBonus: 0, discounts: { lab: 0.7 },
      perks: ['Sample science on your doorstep: science labs cost 30% less', 'Closer to the equator: no solar penalty', 'Everything costs 40% more (rough crater floor, far from Earth)'],
    },
    factors: { thermal: 1, aridity: 1, roughness: 0.5, basalt: 0.6, anorthosite: 0, crater: 1, caves: 0, cold: 0.9, isolation: 1, ice: 0.1, sediment: 1, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { sediment: 0.3, crater: 0.2, life: 0.15, aridity: 0.1, barren: 0.1, roughness: 0.1, basalt: 0.05 },
  },
  {
    id: 'gale', world: 'mars', kind: 'science', name: 'Gale Crater and Mount Sharp', lat: -5.4, lon: 137.8,
    program: 'NASA Curiosity rover',
    description: 'A 154 km crater with a mountain of layered rock about 5 km high. Curiosity has climbed Mount Sharp since 2014, from clay-rich layers into salty sulfate layers.',
    facts: [
      'Curiosity landed on 6 August 2012 (UTC).',
      'Its rocks show the crater once held lakes and groundwater.',
      "Curiosity's RAD measured about 0.64 mSv of radiation a day at the surface.",
    ],
    processes: ['water', 'salt', 'wind', 'impact'],
    sourceIds: ['msl', 'crism', 'hirise'],
    landable: false,
    factors: { thermal: 1, aridity: 1, roughness: 0.8, basalt: 0.5, anorthosite: 0, crater: 1, caves: 0, cold: 0.85, isolation: 1, ice: 0.05, sediment: 1, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { sediment: 0.3, roughness: 0.2, crater: 0.15, aridity: 0.1, barren: 0.1, wind: 0.1, life: 0.05 },
  },
  {
    id: 'arsia-caves', world: 'mars', kind: 'science', name: 'Arsia Mons cave skylights', lat: -8.35, lon: -120.09, approx: true,
    program: 'Cave science target',
    description: 'Seven dark pits 100 to 225 m across on the flanks of the giant volcano Arsia Mons. They may open into caves: cooler than the ground by day and warmer by night.',
    facts: [
      "Spotted by Mars Odyssey's THEMIS camera (Cushing et al., 2007).",
      'Very high on the volcano where the air is even thinner: better for cave science than for a base.',
    ],
    processes: ['volcanism'],
    sourceIds: ['themis', 'hirise', 'mola'],
    landable: false,
    factors: { thermal: 1, aridity: 1, roughness: 0.75, basalt: 1, anorthosite: 0, crater: 0.2, caves: 1, cold: 1, isolation: 1, ice: 0.1, sediment: 0, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { caves: 0.35, basalt: 0.25, cold: 0.15, barren: 0.15, roughness: 0.1 },
  },
  {
    id: 'utopia', world: 'mars', kind: 'landing', name: 'Utopia Planitia (Zhurong)', lat: 25.07, lon: 109.93,
    program: 'CNSA Tianwen-1 and Zhurong rover',
    description: "Vast northern plains where China's Zhurong rover landed in May 2021, the first rover from outside the US to drive on Mars. Its radar looked down through layers under the plains.",
    facts: [
      "Tianwen-1 was China's first Mars mission: orbiter, lander and rover together.",
      'Ground-penetrating radar mapped buried layers in the top tens of metres.',
    ],
    processes: ['ice', 'wind'],
    sourceIds: ['tianwen1', 'hirise', 'mola'],
    landable: false,
    factors: { thermal: 1, aridity: 1, roughness: 0.3, basalt: 0.6, anorthosite: 0, crater: 0.4, caves: 0, cold: 0.95, isolation: 1, ice: 0.5, sediment: 0.5, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { barren: 0.2, aridity: 0.2, basalt: 0.2, ice: 0.15, wind: 0.15, roughness: 0.1 },
  },
  {
    id: 'oxia', world: 'mars', kind: 'landing', name: 'Oxia Planum (Rosalind Franklin)', lat: 18.2, lon: -24.3, approx: true,
    program: 'ESA ExoMars Rosalind Franklin rover',
    description: "Clay-rich plains about 4 billion years old, chosen for ESA's Rosalind Franklin rover, which will drill 2 m down to look for signs of past life.",
    facts: [
      'Clay minerals form after long contact with water.',
      'The rover is planned to launch in 2028.',
    ],
    processes: ['water', 'wind'],
    sourceIds: ['exomars', 'crism', 'hrsc'],
    landable: false,
    factors: { thermal: 1, aridity: 1, roughness: 0.3, basalt: 0.3, anorthosite: 0, crater: 0.4, caves: 0, cold: 0.9, isolation: 1, ice: 0.05, sediment: 1, lowsun: 0, barren: 1, wind: 1, life: 1 },
    profile: { sediment: 0.35, life: 0.15, barren: 0.15, aridity: 0.15, isolation: 0.1, roughness: 0.1 },
  },
]

export const targetById = (id: string) => TARGETS.find(t => t.id === id)!
export const targetsOf = (world: World) => TARGETS.filter(t => t.world === world)
