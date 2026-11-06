/**
 * What no place on Earth can copy, and where teams test those things instead.
 * An honest analog tool says what it cannot do: field sites are combined with chambers,
 * flights and simulants. Values are rounded and sourced.
 */
export interface Gap {
  id: string
  label: string
  earth: string
  moon: string
  mars: string
  /** How analog campaigns cover this gap */
  instead: string
  sourceIds: string[]
}

export const GAPS: Gap[] = [
  {
    id: 'gravity', label: 'Gravity',
    earth: '1 g (9.8 m/s²)', moon: '0.17 g (1.6 m/s²)', mars: '0.38 g (3.7 m/s²)',
    instead: 'Parabolic flights, cable offloading rigs and underwater training pools.',
    sourceIds: ['lola', 'mola'],
  },
  {
    id: 'air', label: 'Air',
    earth: '1,013 hPa, breathable', moon: 'Practically none: a near vacuum', mars: 'About 6 hPa (0.6% of Earth), mostly CO₂',
    instead: 'Thermal-vacuum and Mars-pressure chambers for suits, seals and electronics.',
    sourceIds: ['msl'],
  },
  {
    id: 'radiation', label: 'Radiation at the surface',
    earth: 'About 0.007 mSv a day', moon: 'About 1.4 mSv a day (Chang\'e 4)', mars: 'About 0.64 mSv a day (Curiosity RAD)',
    instead: 'Particle-beam facilities such as NASA\'s Space Radiation Laboratory; caves and regolith shielding studies.',
    sourceIds: ['change4-rad', 'msl'],
  },
  {
    id: 'temperature', label: 'Temperature',
    earth: 'Records from −89 °C to +57 °C', moon: 'About −170 °C to +120 °C at the equator; below −230 °C in shadowed polar craters', mars: 'Average about −60 °C; from about −125 °C to +20 °C',
    instead: 'Thermal chambers, plus polar field sites for the cold end.',
    sourceIds: ['diviner', 'msl'],
  },
  {
    id: 'day', label: 'Day and night',
    earth: '24 hours', moon: '29.5 Earth days per lunar day; at the pole the Sun circles the horizon', mars: '24 hours 39 minutes per sol',
    instead: 'Mission control rehearsals on simulated time, spotlights for polar lighting, and the light calendar in this tool.',
    sourceIds: ['ridge-light', 'jett5'],
  },
  {
    id: 'dust', label: 'Dust and soil',
    earth: 'Weathered and rounded by water and wind', moon: 'Sharp, glassy, electrostatically clingy', mars: 'Fine, oxidizing and salty (perchlorates), lifted by global dust storms',
    instead: 'Regolith simulants made from Earth rock (for example lunar highland and Mars global simulants).',
    sourceIds: ['lroc', 'crism'],
  },
]
