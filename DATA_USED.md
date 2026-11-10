# Data Used

Every source below is also listed, with links, on the About screen and in each downloaded Analog Passport.

## NASA
- NASA Moon Base plan and location (Shackleton Connecting Ridge); Artemis III candidate landing regions (2024 update)
- LRO LOLA (topography, polar illumination), LRO Diviner (surface temperature), LROC (images, lunar pit catalog)
- NASA Moon Trek and Mars Trek; NASA SVS CGI Moon Kit
- MGS MOLA (Mars topography), MRO HiRISE and CRISM (images, minerals), Mars Odyssey THEMIS (Arsia Mons cave skylights)
- SWIM, Mars Subsurface Water Ice Mapping (Morgan et al., 2021): buried-ice regions for human landing sites
- Curiosity (including RAD radiation dose) and Perseverance rover missions
- NASA POWER climatology: temperature, daily temperature range, precipitation (**live in the probe**)
- MODIS NDVI MOD13Q1 through the ORNL DAAC web service (**live in the probe**); MODIS Land Surface Temperature
- NASADEM elevation; SEDAC Gridded Population of the World; NSIDC Circum-Arctic Map of Permafrost
- NASA GIBS imagery (Blue Marble, VIIRS daily)
- JETT5 Artemis III field test in Arizona (reported by USGS), the motivation for the light calendar

## Other space agencies
- **ESA**: Copernicus DEM GLO-90 through the Open-Meteo Elevation API (**live in the probe**); Mars Express HRSC; ExoMars Rosalind Franklin (Oxia Planum); PANGAEA training sites
- **JAXA**: SELENE (Kaguya), which found the Marius Hills pit
- **ISRO**: Chandrayaan-2 data (PRADAN); HOPE analog mission at Tso Kar, Ladakh (2025)
- **CNSA**: Tianwen-1 and Zhurong (Utopia Planitia); Chang'e 4 lunar surface radiation dose
- **Canadian Space Agency**: analogue missions at Kamestastin (Mistastin) Lake crater

## Other open data
- USGS Unified Geologic Map of the Moon; USGS and NPS lava tube records
- Macrostrat geologic map units (**live in the probe**: rock type at any point)
- Earth Impact Database (PASSC, University of New Brunswick), 85 structures with coordinates, built into the app for crater scoring
- GLiM Global Lithological Map
- NOAA solar position equations, used to compute the low polar Sun factor and the light calendar
- Published field studies for individual sites (named in each site's notes)

## Global search grid (public/data/earth-grid.*)
| Dataset | Used for | Licence and credit |
|---|---|---|
| Köppen-Geiger climate classification, 1986–2010, 100 arc-second map (Rubel et al.; via the kgcpy package) | Climate-zone proxies for dryness, cold, temperature swing, ground ice, bare ground | Credit Rubel, Brugger, Haslinger and Auer (2017), doi:10.1127/metz/2016/0816; koeppen-geiger.vu-wien.ac.at |
| GeoNames cities1000 (via the geonamescache package) | Distance to the nearest town of 1,000+ people (remoteness), also used by live probes | CC BY 4.0, GeoNames |
| Smithsonian Global Volcanism Program volcano list (copy in plotly/datasets) | Young volcanoes near each cell (volcanic rock proxy) | Smithsonian GVP; check the current list at volcano.si.edu |
| Earth Impact Database list (85 structures with coordinates, in the app) | Impact structures in or near each cell | PASSC, University of New Brunswick |
| Natural Earth 10m playas, glaciated areas, geography regions; 50m countries | Salt flats, glaciers, region and country names | Public domain, naturalearthdata.com |

## Live probe services
| Service | What it gives the probe | Notes |
|---|---|---|
| NASA POWER climatology API | Temperature swing, extreme cold, dryness, ground-ice proxy | Keyless, allows browser requests |
| Open-Meteo Elevation API (Copernicus DEM GLO-90, ESA) | Slope and roughness from a 5 x 5 grid over 4 km | Keyless |
| ORNL DAAC MODIS web service (MOD13Q1) | Bare ground from peak-season NDVI | Keyless |
| Macrostrat API | Volcanic rock, anorthosite, water-laid rock and salts | Keyless, CC-BY 4.0 data |
| Photon by Komoot (reverse geocoding) | The place name of a probe | Only the coordinates are sent |

Only the probed coordinates are sent to these services. Caves and remoteness are not measured live.

## Map layers and services (Explore Earth map)

| Layer or service | Provider | Use in the game | Licence and credit |
|---|---|---|---|
| VIIRS NOAA-20 Corrected Reflectance (True Color), daily, near real-time | NASA GIBS | *Live Earth*: the latest full day of the whole planet | NASA open data |
| Blue Marble Shaded Relief and Bathymetry | NASA GIBS | *Blue Marble* map type | NASA open data |
| Sentinel-2 cloudless 2024 (https://s2maps.eu) | EOX IT Services GmbH, from ESA Copernicus Sentinel-2 | *Satellite* and the zoomed-in part of *Live Earth* | CC BY-NC-SA 4.0 (non-commercial). Credit: "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)" |
| OpenFreeMap Liberty street map (https://openfreemap.org) | OpenFreeMap, OpenMapTiles | *Map* type, plus place names and roads on the imagery | Data © OpenStreetMap contributors (ODbL); credit shown on the map |
| Photon geocoder (https://photon.komoot.io) | Komoot, OpenStreetMap data | Place search | Fair use of the public service; © OpenStreetMap contributors |
| Sun and Moon positions, day and night | Computed in the browser (low-precision formulas, following SunCalc's method) | Live day and night shading, Sun and Moon overhead | n/a |

## Live clouds (Live Earth map type)
| Layer | Satellite (operator) | Use | Credit |
|---|---|---|---|
| GOES-East_ABI_Band13_Clean_Infrared | GOES-East (NOAA) | Live clouds over the Americas and Atlantic, every 10 minutes | NOAA via NASA GIBS |
| GOES-West_ABI_Band13_Clean_Infrared | GOES-West (NOAA) | Live clouds over the Pacific and western Americas | NOAA via NASA GIBS |
| Himawari_AHI_Band13_Clean_Infrared | Himawari (JMA) | Live clouds over Asia, including Malaysia, and Australia | JMA via NASA GIBS |

| VIIRS_NOAA20_Brightness_Temp_BandI5_Night / _Day | NOAA-20 VIIRS (NASA/NOAA) | Clouds over Europe, Africa and the poles, including polar night (daily night and day passes) | NASA GIBS |

Infrared works day and night. GIBS draws these layers with colour palettes (colormaps/v1.3/Clean_Longwave_Infrared_Window_Band.xml and VIIRS_Brightness_Temp_BandI5.xml), so the app decodes each colour back to a brightness temperature, then treats cold pixels as cloud. The clear-sky cut-off is 285 K at the equator, falling by 0.55 K per degree of latitude, because the ground itself is very cold near the poles.

A commercial version would need a licence for Sentinel-2 cloudless (or a different satellite layer).
