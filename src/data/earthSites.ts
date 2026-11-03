import type { EarthSite } from './types'

// Values are normalized 0..1 team ESTIMATES based on the cited datasets.
// Replace them with values computed from the data and set estimate: false.
const f = (value: number, sourceId: string, raw = 'Team estimate, see source') => ({ value, raw, sourceId, estimate: true })

export const EARTH_SITES: EarthSite[] = [
  {
    id: 'haughton', name: "Haughton Crater, Devon Island", country: 'Canada', lat: 75.38, lon: -89.68, status: 'known', environment: 'impact',
    description: "A 23 km impact crater in polar desert. Home of NASA's Haughton-Mars Project.",
    factors: { thermal: f(0.55, 'modis-lst'), aridity: f(0.8, 'power'), roughness: f(0.6, 'nasadem'), basalt: f(0.1, 'glim'), crater: f(0.95, 'eid'), caves: f(0.1, 'usgs-caves'), cold: f(0.9, 'modis-lst'), isolation: f(0.95, 'sedac-gpw') },
  },
  {
    id: 'atacama', name: "Atacama Desert (Yungay)", country: 'Chile', lat: -24.08, lon: -70.17, status: 'known', environment: 'desert',
    description: "One of the driest places on Earth. Soils are nearly sterile, like lunar regolith.",
    factors: { thermal: f(0.75, 'modis-lst'), aridity: f(1.0, 'power'), roughness: f(0.5, 'nasadem'), basalt: f(0.3, 'glim'), crater: f(0.1, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(0.3, 'modis-lst'), isolation: f(0.85, 'sedac-gpw') },
  },
  {
    id: 'dryvalleys', name: "McMurdo Dry Valleys", country: 'Antarctica', lat: -77.5, lon: 161.5, status: 'known', environment: 'polar',
    description: "Cold, dry, wind-scoured valleys with almost no snow cover.",
    factors: { thermal: f(0.5, 'modis-lst'), aridity: f(0.95, 'power'), roughness: f(0.6, 'nasadem'), basalt: f(0.4, 'glim'), crater: f(0.1, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(1.0, 'modis-lst'), isolation: f(1.0, 'sedac-gpw') },
  },
  {
    id: 'cratersmoon', name: "Craters of the Moon", country: 'USA', lat: 43.42, lon: -113.52, status: 'known', environment: 'volcanic',
    description: "Basalt lava fields and tubes used by Apollo astronauts for training.",
    factors: { thermal: f(0.6, 'modis-lst'), aridity: f(0.55, 'power'), roughness: f(0.75, 'nasadem'), basalt: f(1.0, 'glim'), crater: f(0.0, 'eid'), caves: f(0.8, 'usgs-caves'), cold: f(0.5, 'modis-lst'), isolation: f(0.7, 'sedac-gpw') },
  },
  {
    id: 'lavabeds', name: "Lava Beds National Monument", country: 'USA', lat: 41.71, lon: -121.51, status: 'known', environment: 'cave',
    description: "Over 700 lava tube caves in basaltic flows.",
    factors: { thermal: f(0.55, 'modis-lst'), aridity: f(0.5, 'power'), roughness: f(0.6, 'nasadem'), basalt: f(0.95, 'glim'), crater: f(0.0, 'eid'), caves: f(1.0, 'usgs-caves'), cold: f(0.45, 'modis-lst'), isolation: f(0.65, 'sedac-gpw') },
  },
  {
    id: 'meteor', name: "Meteor Crater (Barringer)", country: 'USA', lat: 35.03, lon: -111.02, status: 'known', environment: 'impact',
    description: "A young, well-preserved 1.2 km simple impact crater. Apollo training site.",
    factors: { thermal: f(0.7, 'modis-lst'), aridity: f(0.75, 'power'), roughness: f(0.55, 'nasadem'), basalt: f(0.2, 'glim'), crater: f(1.0, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(0.35, 'modis-lst'), isolation: f(0.6, 'sedac-gpw') },
  },
  {
    id: 'maunakea', name: "Mauna Kea slopes", country: 'USA', lat: 19.82, lon: -155.47, status: 'known', environment: 'volcanic',
    description: "High-altitude basaltic volcanic terrain used for regolith and ISRU tests.",
    factors: { thermal: f(0.4, 'modis-lst'), aridity: f(0.5, 'power'), roughness: f(0.6, 'nasadem'), basalt: f(0.95, 'glim'), crater: f(0.1, 'eid'), caves: f(0.4, 'usgs-caves'), cold: f(0.55, 'modis-lst'), isolation: f(0.6, 'sedac-gpw') },
  },
  {
    id: 'lanzarote', name: "Timanfaya, Lanzarote", country: 'Spain', lat: 29.0, lon: -13.75, status: 'known', environment: 'volcanic',
    description: "Young basaltic lava fields used by ESA's PANGAEA astronaut training.",
    factors: { thermal: f(0.45, 'modis-lst'), aridity: f(0.75, 'power'), roughness: f(0.7, 'nasadem'), basalt: f(0.95, 'glim'), crater: f(0.0, 'eid'), caves: f(0.6, 'usgs-caves'), cold: f(0.1, 'modis-lst'), isolation: f(0.4, 'sedac-gpw') },
  },
  {
    id: 'ries', name: "Ries Crater", country: 'Germany', lat: 48.88, lon: 10.56, status: 'known', environment: 'impact',
    description: "A 24 km impact crater with suevite breccia. Apollo 14 crew trained here.",
    factors: { thermal: f(0.3, 'modis-lst'), aridity: f(0.2, 'power'), roughness: f(0.3, 'nasadem'), basalt: f(0.1, 'glim'), crater: f(0.9, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(0.3, 'modis-lst'), isolation: f(0.1, 'sedac-gpw') },
  },
  {
    id: 'svalbard', name: "Bockfjord volcanic complex, Svalbard", country: 'Norway', lat: 79.43, lon: 13.3, status: 'known', environment: 'polar',
    description: "Arctic volcanoes with ice and basalt. Used to test Mars and Moon instruments.",
    factors: { thermal: f(0.4, 'modis-lst'), aridity: f(0.6, 'power'), roughness: f(0.65, 'nasadem'), basalt: f(0.8, 'glim'), crater: f(0.0, 'eid'), caves: f(0.2, 'usgs-caves'), cold: f(0.95, 'modis-lst'), isolation: f(0.95, 'sedac-gpw') },
  },
  {
    id: 'holuhraun', name: "Holuhraun lava field", country: 'Iceland', lat: 64.85, lon: -16.83, status: 'known', environment: 'volcanic',
    description: "Fresh 2014–15 basalt flow on a barren highland plain.",
    factors: { thermal: f(0.4, 'modis-lst'), aridity: f(0.45, 'power'), roughness: f(0.8, 'nasadem'), basalt: f(1.0, 'glim'), crater: f(0.0, 'eid'), caves: f(0.3, 'usgs-caves'), cold: f(0.7, 'modis-lst'), isolation: f(0.85, 'sedac-gpw') },
  },
  {
    id: 'deathvalley', name: "Death Valley", country: 'USA', lat: 36.5, lon: -117.08, status: 'known', environment: 'desert',
    description: "Extreme heat, dryness and big day–night swings.",
    factors: { thermal: f(0.95, 'modis-lst'), aridity: f(0.9, 'power'), roughness: f(0.5, 'nasadem'), basalt: f(0.4, 'glim'), crater: f(0.1, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(0.15, 'modis-lst'), isolation: f(0.75, 'sedac-gpw') },
  },
  {
    id: 'lonar', name: "Lonar Crater", country: 'India', lat: 19.98, lon: 76.51, status: 'candidate', environment: 'impact',
    description: "A rare impact crater formed in basalt, very similar to craters on the lunar maria.",
    factors: { thermal: f(0.6, 'modis-lst'), aridity: f(0.45, 'power'), roughness: f(0.5, 'nasadem'), basalt: f(1.0, 'glim'), crater: f(0.95, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(0.1, 'modis-lst'), isolation: f(0.3, 'sedac-gpw') },
  },
  {
    id: 'khaybar', name: "Harrat Khaybar", country: 'Saudi Arabia', lat: 25.0, lon: 39.9, status: 'candidate', environment: 'volcanic',
    description: "Huge basaltic volcanic field in hyper-arid desert, with lava tubes.",
    factors: { thermal: f(0.85, 'modis-lst'), aridity: f(0.95, 'power'), roughness: f(0.7, 'nasadem'), basalt: f(1.0, 'glim'), crater: f(0.1, 'eid'), caves: f(0.7, 'usgs-caves'), cold: f(0.2, 'modis-lst'), isolation: f(0.85, 'sedac-gpw') },
  },
  {
    id: 'pinacate', name: "El Pinacate", country: 'Mexico', lat: 31.77, lon: -113.5, status: 'candidate', environment: 'volcanic',
    description: "Basaltic shield field with maar craters in the Sonoran Desert.",
    factors: { thermal: f(0.85, 'modis-lst'), aridity: f(0.85, 'power'), roughness: f(0.65, 'nasadem'), basalt: f(0.95, 'glim'), crater: f(0.5, 'eid'), caves: f(0.3, 'usgs-caves'), cold: f(0.15, 'modis-lst'), isolation: f(0.8, 'sedac-gpw') },
  },
  {
    id: 'mulu', name: "Gunung Mulu caves, Sarawak", country: 'Malaysia', lat: 4.05, lon: 114.92, status: 'local', environment: 'cave',
    description: "Giant limestone caves. Great cave factor, but wet rainforest and limestone, not basalt.",
    factors: { thermal: f(0.1, 'modis-lst'), aridity: f(0.0, 'power'), roughness: f(0.8, 'nasadem'), basalt: f(0.0, 'glim'), crater: f(0.0, 'eid'), caves: f(1.0, 'usgs-caves'), cold: f(0.0, 'modis-lst'), isolation: f(0.6, 'sedac-gpw') },
  },
  {
    id: 'batu', name: "Batu Caves, Selangor", country: 'Malaysia', lat: 3.237, lon: 101.684, status: 'local', environment: 'cave',
    description: "Limestone caves near Kuala Lumpur. Easy to reach, but very humid and busy.",
    factors: { thermal: f(0.1, 'modis-lst'), aridity: f(0.0, 'power'), roughness: f(0.6, 'nasadem'), basalt: f(0.0, 'glim'), crater: f(0.0, 'eid'), caves: f(0.8, 'usgs-caves'), cold: f(0.0, 'modis-lst'), isolation: f(0.0, 'sedac-gpw') },
  },
  {
    id: 'kinabalu', name: "Mount Kinabalu summit plateau", country: 'Malaysia', lat: 6.075, lon: 116.558, status: 'local', environment: 'highland',
    description: "Bare granite summit with cold nights, but frequent rain and cloud.",
    factors: { thermal: f(0.45, 'modis-lst'), aridity: f(0.15, 'power'), roughness: f(0.85, 'nasadem'), basalt: f(0.0, 'glim'), crater: f(0.0, 'eid'), caves: f(0.0, 'usgs-caves'), cold: f(0.4, 'modis-lst'), isolation: f(0.55, 'sedac-gpw') },
  },
]
