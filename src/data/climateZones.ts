/**
 * Köppen-Geiger climate zones (Rubel et al., 1986–2010 map) and the analog factors the Global
 * search reads from them. These are SCREENING PROXIES for a whole ~55 km cell, not measurements:
 * a hot desert is dry, bare and swings hard between day and night; an ice cap is cold, icy and
 * very dry; tundra sits on permafrost. Bare ground means exposed rock and soil, as on the Moon and Mars,
 * so ice sheets score low on it even though nothing grows there. The live probe then measures the exact spot.
 * Index = the class number stored in public/data/earth-grid.bin.
 */
export interface ClimateZone {
  code: string
  label: string
  aridity: number
  cold: number
  thermal: number
  ice: number
  barren: number
}

const z = (code: string, label: string, aridity: number, cold: number, thermal: number, ice: number, barren: number): ClimateZone =>
  ({ code, label, aridity, cold, thermal, ice, barren })

export const CLIMATE_ZONES: ClimateZone[] = [
  z('', 'Ocean', 0, 0, 0, 0, 0),
  z('Af', 'tropical rainforest', 0.02, 0, 0.1, 0, 0),
  z('Am', 'tropical monsoon', 0.05, 0, 0.12, 0, 0),
  z('As', 'tropical savanna, dry summer', 0.2, 0, 0.35, 0, 0.15),
  z('Aw', 'tropical savanna, dry winter', 0.2, 0, 0.35, 0, 0.15),
  z('BSh', 'hot steppe', 0.6, 0, 0.65, 0, 0.45),
  z('BSk', 'cold steppe', 0.6, 0.3, 0.65, 0.1, 0.4),
  z('BWh', 'hot desert', 0.92, 0, 0.85, 0, 0.9),
  z('BWk', 'cold desert', 0.88, 0.35, 0.85, 0.15, 0.85),
  z('Cfa', 'humid subtropical', 0.08, 0.05, 0.3, 0, 0.05),
  z('Cfb', 'temperate oceanic', 0.08, 0.15, 0.2, 0, 0.05),
  z('Cfc', 'subpolar oceanic', 0.1, 0.35, 0.15, 0.1, 0.3),
  z('Csa', 'hot-summer Mediterranean', 0.35, 0.05, 0.45, 0, 0.2),
  z('Csb', 'warm-summer Mediterranean', 0.3, 0.12, 0.35, 0, 0.15),
  z('Csc', 'cool-summer Mediterranean', 0.3, 0.3, 0.3, 0.1, 0.3),
  z('Cwa', 'monsoon-influenced humid subtropical', 0.15, 0.05, 0.45, 0, 0.05),
  z('Cwb', 'subtropical highland', 0.2, 0.15, 0.5, 0, 0.1),
  z('Cwc', 'cold subtropical highland', 0.25, 0.3, 0.45, 0.1, 0.2),
  z('Dfa', 'hot-summer humid continental', 0.12, 0.35, 0.45, 0.05, 0.05),
  z('Dfb', 'warm-summer humid continental', 0.12, 0.45, 0.4, 0.15, 0.05),
  z('Dfc', 'subarctic', 0.2, 0.65, 0.4, 0.55, 0.15),
  z('Dfd', 'extremely cold subarctic', 0.3, 0.9, 0.45, 0.9, 0.2),
  z('Dsa', 'Mediterranean-influenced continental', 0.35, 0.35, 0.55, 0.05, 0.25),
  z('Dsb', 'Mediterranean-influenced continental', 0.35, 0.4, 0.55, 0.1, 0.25),
  z('Dsc', 'Mediterranean-influenced subarctic', 0.35, 0.6, 0.5, 0.45, 0.3),
  z('Dsd', 'Mediterranean-influenced extremely cold subarctic', 0.4, 0.85, 0.5, 0.8, 0.35),
  z('Dwa', 'monsoon-influenced continental', 0.2, 0.4, 0.55, 0.1, 0.05),
  z('Dwb', 'monsoon-influenced continental', 0.2, 0.45, 0.55, 0.15, 0.05),
  z('Dwc', 'monsoon-influenced subarctic', 0.3, 0.65, 0.55, 0.6, 0.15),
  z('Dwd', 'monsoon-influenced extremely cold subarctic', 0.35, 0.9, 0.55, 0.9, 0.2),
  z('EF', 'ice cap', 0.85, 1, 0.35, 1, 0.3), // very dry and cold, but ice-covered: little bare rock or regolith
  z('ET', 'tundra', 0.5, 0.8, 0.35, 0.8, 0.6),
]
