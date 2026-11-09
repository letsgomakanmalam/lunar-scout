import type { DataSource } from './types'

export const SOURCES: DataSource[] = [
  // Earth: climate, terrain, vegetation, people (used for curated sites and live probes)
  { id: 'power', name: 'NASA POWER climatology (temperature, temperature range, precipitation)', agency: 'NASA', url: 'https://power.larc.nasa.gov/' },
  { id: 'modis-lst', name: 'MODIS Land Surface Temperature (MOD11A2)', agency: 'NASA', url: 'https://lpdaac.usgs.gov/products/mod11a2v061/' },
  { id: 'modis-ndvi', name: 'MODIS vegetation index (MOD13Q1 NDVI, via ORNL DAAC)', agency: 'NASA', url: 'https://lpdaac.usgs.gov/products/mod13q1v061/' },
  { id: 'nasadem', name: 'NASADEM elevation (slope, roughness)', agency: 'NASA', url: 'https://www.earthdata.nasa.gov/data/catalog/lpcloud-nasadem-hgt-001' },
  { id: 'cop-dem', name: 'Copernicus DEM GLO-90 (via Open-Meteo Elevation API)', agency: 'ESA', url: 'https://open-meteo.com/en/docs/elevation-api' },
  { id: 'sedac-gpw', name: 'SEDAC Gridded Population of the World v4', agency: 'NASA', url: 'https://sedac.ciesin.columbia.edu/data/collection/gpw-v4' },
  { id: 'nsidc-permafrost', name: 'NSIDC Circum-Arctic Map of Permafrost and Ground-Ice Conditions', agency: 'NASA', url: 'https://nsidc.org/data/ggd318' },
  { id: 'glim', name: 'GLiM Global Lithological Map', agency: 'Other', url: 'https://doi.pangaea.de/10.1594/PANGAEA.788537' },
  { id: 'macrostrat', name: 'Macrostrat geologic map units (live rock type)', agency: 'Other', url: 'https://macrostrat.org/' },
  { id: 'eid', name: 'Earth Impact Database (PASSC, University of New Brunswick)', agency: 'Other', url: 'http://www.passc.net/EarthImpactDatabase/' },
  { id: 'usgs-caves', name: 'USGS / NPS lava tube and cave records', agency: 'USGS', url: 'https://www.usgs.gov/' },
  { id: 'solar-geometry', name: 'Solar position equations (NOAA), computed in the app', agency: 'Other', url: 'https://gml.noaa.gov/grad/solcalc/' },
  { id: 'koppen', name: 'Köppen-Geiger climate zones, 1986–2010, 100 arc-second map (Rubel et al.)', agency: 'Other', url: 'https://doi.org/10.1127/metz/2016/0816' },
  { id: 'geonames', name: 'GeoNames towns of 1,000+ people (remoteness)', agency: 'Other', url: 'https://www.geonames.org/' },
  { id: 'gvp', name: 'Smithsonian Global Volcanism Program, Holocene volcanoes', agency: 'Other', url: 'https://volcano.si.edu/' },
  { id: 'natural-earth', name: 'Natural Earth salt flats, glaciers, regions and countries', agency: 'Other', url: 'https://www.naturalearthdata.com/' },
  { id: 'literature', name: 'Published field studies of the site (see site notes)', agency: 'Other', url: 'https://www.lpi.usra.edu/lunar/analogs/' },

  // Moon
  { id: 'moonbase', name: 'NASA Moon Base: location and plan', agency: 'NASA', url: 'https://www.nasa.gov/reference/moonbase-about/' },
  { id: 'artemis3', name: 'Artemis III candidate landing regions (NASA, 2024 update)', agency: 'NASA', url: 'https://ntrs.nasa.gov/citations/20250011660' },
  { id: 'ridge-light', name: 'Connecting Ridge illumination from LRO LOLA (Gläser et al., 2014)', agency: 'Other', url: 'https://elib.dlr.de/94242/' },
  { id: 'lola', name: 'LRO LOLA topography & illumination', agency: 'NASA', url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm' },
  { id: 'diviner', name: 'LRO Diviner Lunar Radiometer (surface temperature)', agency: 'NASA', url: 'https://www.diviner.ucla.edu/' },
  { id: 'lroc', name: 'LROC images and lunar pit catalog', agency: 'NASA', url: 'https://www.lroc.asu.edu/' },
  { id: 'usgs-moon', name: 'USGS Unified Geologic Map of the Moon', agency: 'USGS', url: 'https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020' },
  { id: 'kaguya', name: 'JAXA SELENE (Kaguya) Multiband Imager and Terrain Camera', agency: 'JAXA', url: 'https://darts.isas.jaxa.jp/planet/project/selene/' },
  { id: 'chandrayaan', name: 'ISRO Chandrayaan-2 data (OHRC, DFSAR) via PRADAN', agency: 'ISRO', url: 'https://pradan.issdc.gov.in/' },
  { id: 'change4-rad', name: "Chang'e 4 lunar surface radiation dose (Zhang et al., 2020)", agency: 'CNSA', url: 'https://doi.org/10.1126/sciadv.aaz1334' },
  { id: 'moontrek', name: 'NASA Moon Trek', agency: 'NASA', url: 'https://trek.nasa.gov/moon/' },

  // Mars
  { id: 'swim', name: 'Mars Subsurface Water Ice Mapping, SWIM (Morgan et al., 2021)', agency: 'NASA', url: 'https://doi.org/10.1038/s41550-020-01290-z' },
  { id: 'mola', name: 'MGS MOLA topography', agency: 'NASA', url: 'https://pds-geosciences.wustl.edu/missions/mgs/mola.html' },
  { id: 'hirise', name: 'MRO HiRISE images', agency: 'NASA', url: 'https://www.uahirise.org/' },
  { id: 'themis', name: 'Mars Odyssey THEMIS (cave skylights, Cushing et al., 2007)', agency: 'NASA', url: 'https://doi.org/10.1029/2007GL030709' },
  { id: 'crism', name: 'MRO CRISM mineral maps', agency: 'NASA', url: 'http://crism.jhuapl.edu/' },
  { id: 'msl', name: 'Curiosity rover (MSL) and its RAD radiation detector', agency: 'NASA', url: 'https://science.nasa.gov/mission/msl-curiosity/' },
  { id: 'm2020', name: 'Perseverance rover (Mars 2020)', agency: 'NASA', url: 'https://science.nasa.gov/mission/mars-2020-perseverance/' },
  { id: 'exomars', name: 'ESA ExoMars Rosalind Franklin rover (Oxia Planum)', agency: 'ESA', url: 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Exploration/ExoMars' },
  { id: 'hrsc', name: 'ESA Mars Express HRSC', agency: 'ESA', url: 'https://www.esa.int/Science_Exploration/Space_Science/Mars_Express' },
  { id: 'tianwen1', name: 'CNSA Tianwen-1 / Zhurong data (Lunar and Planetary Data Release System)', agency: 'CNSA', url: 'https://moon.bao.ac.cn/' },
  { id: 'marstrek', name: 'NASA Mars Trek', agency: 'NASA', url: 'https://trek.nasa.gov/mars/' },

  // Analog programmes
  { id: 'csa-analog', name: 'Canadian Space Agency analogue missions', agency: 'CSA', url: 'https://www.asc-csa.gc.ca/eng/' },
  { id: 'isro-hope', name: 'ISRO HOPE analog mission, Tso Kar (2025)', agency: 'ISRO', url: 'https://www.isro.gov.in/Space_Analog_Mission.html' },
  { id: 'jett5', name: 'NASA JETT5 Artemis moonwalk tests, Arizona (USGS)', agency: 'USGS', url: 'https://usgs.gov/centers/astrogeology-science-center/news/artemis-iii-mission-tests-san-francisco-volcanic-field' },
  { id: 'gibs', name: 'NASA GIBS imagery (Blue Marble, VIIRS)', agency: 'NASA', url: 'https://nasa-gibs.github.io/gibs-api-docs/' },
]

export const sourceById = (id: string) => SOURCES.find(s => s.id === id)
