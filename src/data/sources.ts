import type { DataSource } from './types'

export const SOURCES: DataSource[] = [
  { id: 'modis-lst', name: 'MODIS Land Surface Temperature (MOD11A2)', agency: 'NASA', url: 'https://lpdaac.usgs.gov/products/mod11a2v061/' },
  { id: 'power', name: 'NASA POWER (precipitation, humidity)', agency: 'NASA', url: 'https://power.larc.nasa.gov/' },
  { id: 'nasadem', name: 'NASADEM elevation (slope, roughness)', agency: 'NASA', url: 'https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001' },
  { id: 'glim', name: 'GLiM Global Lithological Map', agency: 'Other', url: 'https://doi.pangaea.de/10.1594/PANGAEA.788537' },
  { id: 'eid', name: 'Earth Impact Database (PASSC)', agency: 'Other', url: 'http://www.passc.net/EarthImpactDatabase/' },
  { id: 'usgs-caves', name: 'USGS / NPS lava tube and cave records', agency: 'USGS', url: 'https://www.usgs.gov/' },
  { id: 'sedac-gpw', name: 'SEDAC Gridded Population of the World v4', agency: 'NASA', url: 'https://sedac.ciesin.columbia.edu/data/collection/gpw-v4' },
  { id: 'diviner', name: 'LRO Diviner Lunar Radiometer', agency: 'NASA', url: 'https://www.diviner.ucla.edu/' },
  { id: 'lola', name: 'LRO LOLA topography & illumination', agency: 'NASA', url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm' },
  { id: 'lroc', name: 'LROC images and lunar pit catalog', agency: 'NASA', url: 'https://www.lroc.asu.edu/' },
  { id: 'usgs-moon', name: 'USGS Unified Geologic Map of the Moon', agency: 'USGS', url: 'https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020' },
  { id: 'gibs', name: 'NASA GIBS Blue Marble basemap', agency: 'NASA', url: 'https://nasa-gibs.github.io/gibs-api-docs/' },
  { id: 'moontrek', name: 'NASA Moon Trek', agency: 'NASA', url: 'https://trek.nasa.gov/moon/' },
]

export const sourceById = (id: string) => SOURCES.find(s => s.id === id)
