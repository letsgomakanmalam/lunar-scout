import type { EarthSite, FactorKey, FactorValue } from './types'
import { FACTOR_KEYS } from './types'
import { lowSunRaw, lowSunValue } from '../lib/sun'
import measuredFile from './measured.json'

/*
 * Values are normalized 0..1 (1 = as Moon- or Mars-like as anywhere on Earth gets).
 * Most are team ESTIMATES read from the cited datasets and are labelled as estimates in the app.
 * "Low polar Sun" is computed from latitude (estimate: false). Running `npm run measure` with an
 * internet connection fills src/data/measured.json from NASA POWER, Copernicus DEM, MODIS and
 * Macrostrat; measured values then replace the estimates below.
 */

type Est = Record<Exclude<FactorKey, 'lowsun'>, number | null>
interface Note { source?: string; raw?: string }

const DEFAULT_SOURCE: Record<Exclude<FactorKey, 'lowsun'>, string> = {
  thermal: 'modis-lst', aridity: 'power', roughness: 'nasadem', basalt: 'glim', anorthosite: 'glim',
  crater: 'eid', caves: 'usgs-caves', cold: 'modis-lst', isolation: 'sedac-gpw',
  ice: 'nsidc-permafrost', sediment: 'glim', barren: 'modis-ndvi',
}

function site(base: Omit<EarthSite, 'factors'>, v: Est, notes: Partial<Record<FactorKey, Note>> = {}): EarthSite {
  const factors = {} as Record<FactorKey, FactorValue>
  for (const k of FACTOR_KEYS) {
    if (k === 'lowsun') {
      factors.lowsun = { value: Number(lowSunValue(base.lat).toFixed(3)), raw: lowSunRaw(base.lat), sourceId: 'solar-geometry', estimate: false }
      continue
    }
    const n = notes[k]
    factors[k] = { value: v[k], raw: n?.raw ?? 'Team estimate, see source', sourceId: n?.source ?? DEFAULT_SOURCE[k], estimate: true }
  }
  return { ...base, factors }
}

const SITES: EarthSite[] = [
  /* ---------- Established analogs (used by space agencies) ---------- */
  site({ id: 'haughton', name: 'Haughton Crater, Devon Island', country: 'Canada', lat: 75.38, lon: -89.68, status: 'known', environment: 'impact',
    description: "A 23 km impact crater in polar desert, with permafrost underfoot. Home of NASA's Haughton-Mars Project.",
    analogUse: 'NASA Haughton-Mars Project (since 1997)' },
  { thermal: 0.55, aridity: 0.8, roughness: 0.6, basalt: 0.1, anorthosite: 0, crater: 0.95, caves: 0.1, cold: 0.9, isolation: 0.95, ice: 0.95, sediment: 0.6, barren: 0.85 }),

  site({ id: 'atacama', name: 'Atacama Desert (Yungay)', country: 'Chile', lat: -24.08, lon: -70.17, status: 'known', environment: 'desert',
    description: 'One of the driest places on Earth. Its salty, nearly sterile soils are used to test life-detection drills for Mars.',
    analogUse: 'NASA rover and drilling tests (ARADS)' },
  { thermal: 0.75, aridity: 1.0, roughness: 0.5, basalt: 0.3, anorthosite: 0, crater: 0.1, caves: 0, cold: 0.3, isolation: 0.85, ice: 0, sediment: 0.7, barren: 1.0 }),

  site({ id: 'dryvalleys', name: 'McMurdo Dry Valleys', country: 'Antarctica', lat: -77.5, lon: 161.5, status: 'known', environment: 'polar',
    description: 'Cold, dry, wind-scoured valleys with almost no snow. Ancient buried glacier ice lies under the gravel, like the ice under Mars mid-latitudes.',
    analogUse: 'Mars ice and life studies (NASA, NSF)' },
  { thermal: 0.5, aridity: 0.95, roughness: 0.6, basalt: 0.4, anorthosite: 0, crater: 0.1, caves: 0, cold: 1.0, isolation: 1.0, ice: 1.0, sediment: 0.5, barren: 1.0 },
  { ice: { source: 'literature', raw: 'Buried glacial ice in Beacon Valley (team estimate)' } }),

  site({ id: 'cratersmoon', name: 'Craters of the Moon', country: 'USA', lat: 43.42, lon: -113.52, status: 'known', environment: 'volcanic',
    description: 'Basalt lava fields and tubes where Apollo astronauts trained to read volcanic rock.',
    analogUse: 'Apollo astronaut training (1969); NASA FINESSE field team' },
  { thermal: 0.6, aridity: 0.55, roughness: 0.75, basalt: 1.0, anorthosite: 0, crater: 0, caves: 0.8, cold: 0.5, isolation: 0.7, ice: 0.1, sediment: 0.05, barren: 0.75 }),

  site({ id: 'lavabeds', name: 'Lava Beds National Monument', country: 'USA', lat: 41.71, lon: -121.51, status: 'known', environment: 'cave',
    description: 'Over 700 lava tube caves in basaltic flows, some holding ice all year.',
    analogUse: 'NASA BRAILLE cave-robot project' },
  { thermal: 0.55, aridity: 0.5, roughness: 0.6, basalt: 0.95, anorthosite: 0, crater: 0, caves: 1.0, cold: 0.45, isolation: 0.65, ice: 0.2, sediment: 0.05, barren: 0.5 },
  { ice: { source: 'usgs-caves', raw: 'Perennial ice in some lava tubes (team estimate)' } }),

  site({ id: 'meteor', name: 'Meteor Crater (Barringer)', country: 'USA', lat: 35.03, lon: -111.02, status: 'known', environment: 'impact',
    description: 'A young, well-preserved 1.2 km simple impact crater. Apollo crews trained here.',
    analogUse: 'Apollo astronaut geology training' },
  { thermal: 0.7, aridity: 0.75, roughness: 0.55, basalt: 0.2, anorthosite: 0, crater: 1.0, caves: 0, cold: 0.35, isolation: 0.6, ice: 0, sediment: 0.6, barren: 0.7 }),

  site({ id: 'maunakea', name: 'Mauna Kea slopes', country: 'USA', lat: 19.82, lon: -155.47, status: 'known', environment: 'volcanic',
    description: 'High-altitude basaltic volcanic terrain used for regolith mining (ISRU) and rover tests.',
    analogUse: 'NASA and PISCES ISRU field tests' },
  { thermal: 0.4, aridity: 0.5, roughness: 0.6, basalt: 0.95, anorthosite: 0, crater: 0.1, caves: 0.4, cold: 0.55, isolation: 0.6, ice: 0.25, sediment: 0.05, barren: 0.85 }),

  site({ id: 'lanzarote', name: 'Timanfaya, Lanzarote', country: 'Spain', lat: 29.0, lon: -13.75, status: 'known', environment: 'volcanic',
    description: "Young basaltic lava fields and lava tubes used by ESA's PANGAEA astronaut geology course.",
    analogUse: 'ESA PANGAEA training' },
  { thermal: 0.45, aridity: 0.75, roughness: 0.7, basalt: 0.95, anorthosite: 0, crater: 0, caves: 0.6, cold: 0.1, isolation: 0.4, ice: 0, sediment: 0.1, barren: 0.9 }),

  site({ id: 'ries', name: 'Ries Crater', country: 'Germany', lat: 48.88, lon: 10.56, status: 'known', environment: 'impact',
    description: 'A 24 km impact crater with suevite breccia. Apollo 14 crew trained here; today it is farmland.',
    analogUse: 'Apollo 14 training (1970); ESA PANGAEA' },
  { thermal: 0.3, aridity: 0.2, roughness: 0.3, basalt: 0.1, anorthosite: 0, crater: 0.9, caves: 0, cold: 0.3, isolation: 0.1, ice: 0, sediment: 0.5, barren: 0.1 }),

  site({ id: 'svalbard', name: 'Bockfjord volcanic complex, Svalbard', country: 'Norway', lat: 79.43, lon: 13.3, status: 'known', environment: 'polar',
    description: 'Arctic volcanoes on permafrost, with basalt and ice side by side. Used to test Mars instruments.',
    analogUse: 'AMASE expeditions (NASA, ESA)' },
  { thermal: 0.4, aridity: 0.6, roughness: 0.65, basalt: 0.8, anorthosite: 0, crater: 0, caves: 0.2, cold: 0.95, isolation: 0.95, ice: 0.95, sediment: 0.3, barren: 0.85 }),

  site({ id: 'holuhraun', name: 'Holuhraun lava field', country: 'Iceland', lat: 64.85, lon: -16.83, status: 'known', environment: 'volcanic',
    description: 'Fresh 2014 to 2015 basalt flow on a barren highland plain, used for Mars rover field tests.',
    analogUse: 'Mars rover field tests (NASA-funded SAND-E)' },
  { thermal: 0.4, aridity: 0.45, roughness: 0.8, basalt: 1.0, anorthosite: 0, crater: 0, caves: 0.3, cold: 0.7, isolation: 0.85, ice: 0.2, sediment: 0.1, barren: 1.0 }),

  site({ id: 'deathvalley', name: 'Death Valley', country: 'USA', lat: 36.5, lon: -117.08, status: 'known', environment: 'desert',
    description: 'Extreme heat, salt flats and big day to night swings. Named in the NASA challenge as a classic analog.',
    analogUse: 'NASA Mars field tests' },
  { thermal: 0.95, aridity: 0.9, roughness: 0.5, basalt: 0.4, anorthosite: 0, crater: 0.1, caves: 0, cold: 0.15, isolation: 0.75, ice: 0, sediment: 0.85, barren: 0.9 }),

  site({ id: 'kamestastin', name: 'Kamestastin (Mistastin) Lake crater', country: 'Canada', lat: 55.88, lon: -63.3, status: 'known', environment: 'impact',
    description: 'A 28 km crater blasted into anorthosite, the pale rock of the lunar highlands where the Moon Base will sit. The Canadian Space Agency trains astronauts here, including Artemis II crew member Jeremy Hansen.',
    analogUse: 'Canadian Space Agency analogue missions' },
  { thermal: 0.45, aridity: 0.45, roughness: 0.6, basalt: 0.05, anorthosite: 0.95, crater: 0.85, caves: 0, cold: 0.7, isolation: 0.95, ice: 0.35, sediment: 0.1, barren: 0.35 },
  { anorthosite: { source: 'csa-analog', raw: 'Target rock largely anorthosite (Mader & Osinski field mapping)' } }),

  site({ id: 'sudbury', name: 'Sudbury impact structure', country: 'Canada', lat: 46.6, lon: -81.18, status: 'known', environment: 'impact',
    description: 'A 1.85 billion year old, 130 km impact structure. Apollo astronauts came here to learn to recognise impact rocks.',
    analogUse: 'Apollo astronaut geology training' },
  { thermal: 0.4, aridity: 0.25, roughness: 0.5, basalt: 0.2, anorthosite: 0.3, crater: 0.6, caves: 0, cold: 0.5, isolation: 0.2, ice: 0.05, sediment: 0.2, barren: 0.3 },
  { anorthosite: { source: 'literature', raw: 'Norite of the Sudbury Igneous Complex, kin to highland rock (team estimate)' } }),

  site({ id: 'sfvf', name: 'San Francisco Volcanic Field, Arizona', country: 'USA', lat: 35.5, lon: -111.6, status: 'known', environment: 'volcanic',
    description: 'Cinder cones and lava flows north of Flagstaff. NASA rehearsed Artemis III moonwalks here in 2024 (JETT5), some at night under spotlights to fake the low south-pole Sun.',
    analogUse: 'NASA JETT5 Artemis III rehearsal (2024)' },
  { thermal: 0.65, aridity: 0.65, roughness: 0.6, basalt: 0.95, anorthosite: 0, crater: 0.2, caves: 0.4, cold: 0.45, isolation: 0.6, ice: 0.05, sediment: 0.1, barren: 0.6 }),

  site({ id: 'mdrs', name: 'Mars Desert Research Station, Utah', country: 'USA', lat: 38.41, lon: -110.79, status: 'known', environment: 'sedimentary',
    description: "The Mars Society's station among red sandstone and clay badlands. Crews have lived and worked here as if on Mars since 2001.",
    analogUse: 'Mars Society crews' },
  { thermal: 0.8, aridity: 0.8, roughness: 0.55, basalt: 0.05, anorthosite: 0, crater: 0, caves: 0, cold: 0.35, isolation: 0.8, ice: 0, sediment: 0.95, barren: 0.9 }),

  site({ id: 'riotinto', name: 'Río Tinto', country: 'Spain', lat: 37.7, lon: -6.57, status: 'known', environment: 'acidic',
    description: "An acidic, iron-red river with jarosite and iron oxides like those Opportunity found at Meridiani Planum. NASA's MARTE drilling experiment worked here.",
    analogUse: 'NASA MARTE drill tests' },
  { thermal: 0.6, aridity: 0.5, roughness: 0.4, basalt: 0.2, anorthosite: 0, crater: 0, caves: 0, cold: 0.1, isolation: 0.4, ice: 0, sediment: 0.95, barren: 0.45 },
  { sediment: { source: 'literature', raw: 'Acid-sulfate minerals such as jarosite (team estimate)' } }),

  site({ id: 'pilbara', name: 'Pilbara (Strelley Pool)', country: 'Australia', lat: -21.17, lon: 119.73, status: 'known', environment: 'sedimentary',
    description: "Some of Earth's oldest fossil microbial mats (stromatolites, about 3.4 billion years old). Mars scientists study them to learn what signs of ancient life could look like in rocks like Jezero's.",
    analogUse: 'Astrobiology field studies' },
  { thermal: 0.8, aridity: 0.7, roughness: 0.5, basalt: 0.5, anorthosite: 0, crater: 0.3, caves: 0, cold: 0.1, isolation: 0.9, ice: 0, sediment: 0.9, barren: 0.7 }),

  site({ id: 'ramon', name: 'Makhtesh Ramon, Negev', country: 'Israel', lat: 30.6, lon: 34.8, status: 'known', environment: 'desert',
    description: "A 40 km erosion cirque (not an impact crater) in the Negev desert. The Austrian Space Forum's AMADEE-20 Mars simulation took place here.",
    analogUse: 'AMADEE-20 Mars simulation (Austrian Space Forum)' },
  { thermal: 0.75, aridity: 0.85, roughness: 0.65, basalt: 0.2, anorthosite: 0, crater: 0.05, caves: 0.05, cold: 0.15, isolation: 0.6, ice: 0, sediment: 0.8, barren: 0.9 }),

  site({ id: 'tsokar', name: 'Tso Kar, Ladakh', country: 'India', lat: 33.31, lon: 78.0, status: 'known', environment: 'highland',
    description: "A salt-lake basin at 4,530 m. ISRO chose it for its HOPE analog mission in 2025 for its strong UV, thin air, cold and salty frozen ground.",
    analogUse: 'ISRO HOPE analog mission (2025)' },
  { thermal: 0.8, aridity: 0.8, roughness: 0.5, basalt: 0.05, anorthosite: 0, crater: 0, caves: 0, cold: 0.6, isolation: 0.85, ice: 0.6, sediment: 0.7, barren: 0.85 },
  { ice: { source: 'isro-hope', raw: 'Saline permafrost reported by ISRO' } }),

  /* ---------- New and under-used candidates ---------- */
  site({ id: 'lonar', name: 'Lonar Crater', country: 'India', lat: 19.98, lon: 76.51, status: 'candidate', environment: 'impact',
    description: 'A rare impact crater formed in basalt, very similar to craters on the lunar maria and on Mars.' },
  { thermal: 0.6, aridity: 0.45, roughness: 0.5, basalt: 1.0, anorthosite: 0, crater: 0.95, caves: 0, cold: 0.1, isolation: 0.3, ice: 0, sediment: 0.3, barren: 0.2 }),

  site({ id: 'khaybar', name: 'Harrat Khaybar', country: 'Saudi Arabia', lat: 25.0, lon: 39.9, status: 'candidate', environment: 'volcanic',
    description: 'Huge basaltic volcanic field in hyper-arid desert, with lava tubes.' },
  { thermal: 0.85, aridity: 0.95, roughness: 0.7, basalt: 1.0, anorthosite: 0, crater: 0.1, caves: 0.7, cold: 0.2, isolation: 0.85, ice: 0, sediment: 0.1, barren: 0.95 }),

  site({ id: 'pinacate', name: 'El Pinacate', country: 'Mexico', lat: 31.77, lon: -113.5, status: 'candidate', environment: 'volcanic',
    description: 'Basaltic shield field with maar craters in the Sonoran Desert.' },
  { thermal: 0.85, aridity: 0.85, roughness: 0.65, basalt: 0.95, anorthosite: 0, crater: 0.5, caves: 0.3, cold: 0.15, isolation: 0.8, ice: 0, sediment: 0.2, barren: 0.8 }),

  site({ id: 'qaidam', name: 'Qaidam Basin salt playas', country: 'China', lat: 38.3, lon: 92.2, status: 'candidate', environment: 'desert',
    description: 'A hyper-arid salt basin on the Tibetan Plateau with wind-carved yardangs and sulfate and chloride salts. Chinese teams study it as a Mars analog; it is little used elsewhere.' },
  { thermal: 0.8, aridity: 0.9, roughness: 0.45, basalt: 0, anorthosite: 0, crater: 0, caves: 0, cold: 0.5, isolation: 0.85, ice: 0.2, sediment: 1.0, barren: 0.95 }),

  site({ id: 'danakil', name: 'Dallol, Danakil Depression', country: 'Ethiopia', lat: 14.24, lon: 40.3, status: 'candidate', environment: 'acidic',
    description: 'Hot, salty and extremely acidic pools below sea level, among the harshest water on Earth. A test bed for how life copes with Mars-like brines.' },
  { thermal: 0.7, aridity: 0.95, roughness: 0.4, basalt: 0.4, anorthosite: 0, crater: 0, caves: 0, cold: 0, isolation: 0.85, ice: 0, sediment: 1.0, barren: 1.0 }),

  site({ id: 'ijen', name: 'Kawah Ijen acid crater lake', country: 'Indonesia', lat: -8.06, lon: 114.24, status: 'candidate', environment: 'acidic',
    description: "The world's largest acidic crater lake (pH about 0.4). Its sulfate brines are studied as a guide to the acid water that once soaked parts of Mars. A two-hour flight from Kuala Lumpur.",
    analogUse: 'Mars acid-brine lab studies' },
  { thermal: 0.45, aridity: 0.1, roughness: 0.75, basalt: 0.4, anorthosite: 0, crater: 0.1, caves: 0, cold: 0.1, isolation: 0.3, ice: 0, sediment: 0.8, barren: 0.55 },
  { sediment: { source: 'literature', raw: 'Sulfate-chloride brine, pH about 0.4 (Delmelle & Bernard, 1994)' } }),

  site({ id: 'tengger', name: 'Tengger Sand Sea (Bromo)', country: 'Indonesia', lat: -7.94, lon: 112.95, status: 'candidate', environment: 'volcanic',
    description: "A huge caldera around Mount Bromo floored with black volcanic sand. Grit like this could test rover wheels, seals and suits close to Malaysia." },
  { thermal: 0.5, aridity: 0.25, roughness: 0.5, basalt: 0.7, anorthosite: 0, crater: 0.1, caves: 0, cold: 0.2, isolation: 0.3, ice: 0, sediment: 0.15, barren: 0.85 }),

  /* ---------- Malaysian comparison sites ---------- */
  site({ id: 'mulu', name: 'Gunung Mulu caves, Sarawak', country: 'Malaysia', lat: 4.05, lon: 114.92, status: 'local', environment: 'cave',
    description: 'Giant limestone caves. Great cave factor, but wet rainforest and limestone, not basalt.' },
  { thermal: 0.1, aridity: 0, roughness: 0.8, basalt: 0, anorthosite: 0, crater: 0, caves: 1.0, cold: 0, isolation: 0.6, ice: 0, sediment: 0.45, barren: 0 }),

  site({ id: 'batu', name: 'Batu Caves, Selangor', country: 'Malaysia', lat: 3.237, lon: 101.684, status: 'local', environment: 'cave',
    description: 'Limestone caves near Kuala Lumpur. Easy to reach, but very humid and busy.' },
  { thermal: 0.1, aridity: 0, roughness: 0.6, basalt: 0, anorthosite: 0, crater: 0, caves: 0.8, cold: 0, isolation: 0, ice: 0, sediment: 0.45, barren: 0.1 }),

  site({ id: 'kinabalu', name: 'Mount Kinabalu summit plateau', country: 'Malaysia', lat: 6.075, lon: 116.558, status: 'local', environment: 'highland',
    description: 'Bare granite summit with cold nights, but frequent rain and cloud.' },
  { thermal: 0.45, aridity: 0.15, roughness: 0.85, basalt: 0, anorthosite: 0, crater: 0, caves: 0, cold: 0.4, isolation: 0.55, ice: 0, sediment: 0, barren: 0.7 }),
]

/* ---------- Measured values (from `npm run measure`) replace the estimates ---------- */

interface MeasuredFile {
  generated: string | null
  sites: Record<string, Partial<Record<FactorKey, { value: number | null; raw: string; sourceId: string }>>>
}

export const MEASURED = measuredFile as unknown as MeasuredFile

function applyMeasured(list: EarthSite[], m: MeasuredFile): EarthSite[] {
  return list.map(s => {
    const got = m.sites[s.id]
    if (!got) return s
    const factors = { ...s.factors }
    for (const k of Object.keys(got) as FactorKey[]) {
      const v = got[k]
      if (v && v.value != null) factors[k] = { value: v.value, raw: v.raw, sourceId: v.sourceId, estimate: false }
    }
    return { ...s, factors }
  })
}

export const EARTH_SITES: EarthSite[] = applyMeasured(SITES, MEASURED)

/** Share of all factor values that are measured rather than estimated. */
export const measuredShare = (sites: EarthSite[] = EARTH_SITES) => {
  let n = 0, m = 0
  for (const s of sites) for (const k of FACTOR_KEYS) { n++; if (!s.factors[k].estimate) m++ }
  return n ? m / n : 0
}
