/**
 * Astronomy and engineering notes: short explanations of WHY the Moon and Mars are the way they are,
 * and what that means for building there. Shown where they matter: astronomy on each Moon or Mars
 * site in the Twin finder, an engineering note on every building in the Base, and all of them on
 * the About page.
 *
 * Numbers come from the constants below (each with a source) and are worked out here, not typed
 * into the sentences, so the tests can check the arithmetic.
 */
import type { ModuleId, World } from './types'

/** Measured values, with where they come from (ids in data/sources.ts) */
export const K = {
  // NASA Planetary Fact Sheets
  gEarth: 9.8, gMoon: 1.62, gMars: 3.73, // surface gravity, m/s²
  earthKm: 12756, moonKm: 3475, // diameters
  lunarDayH: 708.7, // one full day and night on the Moon, hours
  solH: 24.6597, marsYearD: 686.98, marsTiltDeg: 25.19, earthTiltDeg: 23.4,
  sunEarth: 1361, sunMars: 586.2, // sunlight above the air, W/m²
  marsPressureMb: 6.36, earthPressureMb: 1013, marsCo2Pct: 95.1,
  marsSynodicD: 779.94, marsNearKm: 54.6e6, marsFarKm: 401.4e6,
  moonDistKm: 384400,
  // LRO illumination studies: the Moon's spin axis leans this little from upright to its path round the Sun
  moonTiltDeg: 1.5,
  // LRO Diviner
  moonNoonC: 127, moonNightC: -173, pitC: 17,
  // Radiation: Chang'e 4, Curiosity RAD, NASA career limit
  doseMoon: 1.37, doseMars: 0.64, doseLimit: 600,
  // NASA crew needs (BVAD), kg per person per day
  o2PerDay: 0.82, foodPerDay: 1.8,
  // Perseverance's MOXIE experiment
  moxiePeakGh: 12, moxieTotalG: 122, moxieRuns: 16,
  // Hardware targets used in the base
  arrayKW: 10, reactorKW: 40,
  apolloSamplesKg: 382,
  // Physics
  lightKmS: 299792.458, sigma: 5.670374e-8,
  /** A round figure for a lithium-ion battery pack, Wh per kg. An assumption, to show the scale. */
  batteryWhKg: 200,
}

/* ---------- Worked out from the constants ---------- */

/** Seconds for a radio signal to cross a distance */
export const lightSeconds = (km: number) => km / K.lightKmS
/** Energy to run a base through the dark, kWh */
export const nightEnergyKWh = (kw: number, hours: number) => kw * hours
/** Battery mass to store that energy, tonnes */
export const batteryTonnes = (kwh: number, whPerKg = K.batteryWhKg) => (kwh * 1000) / whPerKg / 1000
/** Days on the open surface before the career radiation limit */
export const daysToLimit = (mSvPerDay: number) => K.doseLimit / mSvPerDay
/** Heat a perfect radiator sheds to space from one side, W/m² (Stefan-Boltzmann law) */
export const radiatorWm2 = (celsius: number) => K.sigma * Math.pow(celsius + 273.15, 4)
/** Water split to make 1 kg of oxygen: 2 H2O -> 2 H2 + O2 */
export const WATER_PER_O2 = (2 * 18.015) / 31.998
/** How many MOXIE-sized units at peak output one person's breathing needs */
export const moxiesPerPerson = () => (K.o2PerDay * 1000) / 24 / K.moxiePeakGh

const r = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
const moonNightH = K.lunarDayH / 2
const marsNightH = K.solH / 2
const sol = (() => { const s = Math.round(K.solH * 3600); return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min ${s % 60} s` })()

export interface Note {
  id: string
  kind: 'astronomy' | 'engineering'
  title: string
  text: string
  /** The sum behind the note, if there is one */
  math?: string
  sourceId: string
}

/* ---------- Astronomy: why each world is the way it is ---------- */

export const ASTRONOMY: Record<World, Note[]> = {
  moon: [
    { id: 'moon-tilt', kind: 'astronomy', sourceId: 'lola', title: 'Why the Sun skims the horizon at the pole',
      text: `Earth leans ${r(K.earthTiltDeg, 1)}° and has seasons. The Moon stands almost upright, leaning only about ${r(K.moonTiltDeg, 1)}°. So at its poles the Sun never climbs more than about ${r(K.moonTiltDeg, 1)}° above the horizon: crater floors stay dark for billions of years and can trap ice, while a few high ridges are sunlit most of the time. That is why NASA chose a ridge.` },
    { id: 'moon-day', kind: 'astronomy', sourceId: 'nssdc', title: 'A day that lasts a month',
      text: `One day and night on the Moon takes ${r(K.lunarDayH, 1)} hours, about ${r(K.lunarDayH / 24, 1)} Earth days. Away from the poles that means about ${r(moonNightH / 24, 1)} days of sunlight, then ${r(moonNightH / 24, 1)} days of darkness.`,
      math: `${r(K.lunarDayH, 1)} h ÷ 24 = ${r(K.lunarDayH / 24, 1)} days; half of that is night` },
    { id: 'moon-lock', kind: 'astronomy', sourceId: 'nssdc', title: 'Earth hangs still in the sky',
      text: `The Moon turns once for every trip round Earth, so the same side always faces us. From a base on the near side, Earth stays in almost the same spot in the sky and never sets. It looks ${r(K.earthKm / K.moonKm, 1)} times wider than the Moon looks from Earth. From the poles it sits on the horizon, which is why facing Earth matters for radio.`,
      math: `${r(K.earthKm)} km ÷ ${r(K.moonKm)} km = ${r(K.earthKm / K.moonKm, 1)}` },
    { id: 'moon-air', kind: 'astronomy', sourceId: 'diviner', title: 'No air: a black sky and brutal swings',
      text: `With no air to scatter light, the sky is black even at noon and shadows are hard-edged. With no air to carry heat, the ground reaches about ${K.moonNoonC} °C in sunlight and falls to about ${K.moonNightC} °C at night. Inside a lava-tube pit, the shaded floor stays near ${K.pitC} °C all the time.` },
    { id: 'moon-gravity', kind: 'astronomy', sourceId: 'nssdc', title: 'One sixth of your weight',
      text: `Gravity at the Moon's surface is ${K.gMoon} m/s², ${r((K.gMoon / K.gEarth) * 100)}% of Earth's. You keep all your mass, so you are just as hard to stop, but you press on the ground with one sixth of the force. No place on Earth can copy that.`,
      math: `${K.gMoon} ÷ ${K.gEarth} = ${r(K.gMoon / K.gEarth, 2)}` },
  ],
  mars: [
    { id: 'mars-sol', kind: 'astronomy', sourceId: 'nssdc', title: 'A day almost like ours',
      text: `Mars turns once in ${sol}. This day is called a sol. Crews and rover teams on "Mars time" start work about 40 minutes later every Earth day.` },
    { id: 'mars-seasons', kind: 'astronomy', sourceId: 'nssdc', title: 'Seasons twice as long',
      text: `Mars leans ${r(K.marsTiltDeg, 1)}°, close to Earth's ${r(K.earthTiltDeg, 1)}°, so it has seasons. Its year is ${r(K.marsYearD)} Earth days, so each season lasts about twice as long as ours. Winter means months of weak sunlight for solar panels.`,
      math: `${r(K.marsYearD)} ÷ 365.25 = ${r(K.marsYearD / 365.25, 2)} Earth years` },
    { id: 'mars-sun', kind: 'astronomy', sourceId: 'nssdc', title: 'Less than half the sunlight',
      text: `Mars is about one and a half times as far from the Sun as Earth. Sunlight spreads out with the square of the distance, so Mars gets ${r(K.sunMars)} W/m² where Earth gets ${r(K.sunEarth)}: ${r((K.sunMars / K.sunEarth) * 100)}%. Dust in the air takes more.`,
      math: `${r(K.sunMars)} ÷ ${r(K.sunEarth)} = ${r(K.sunMars / K.sunEarth, 2)}` },
    { id: 'mars-air', kind: 'astronomy', sourceId: 'nssdc', title: 'Thin air, butterscotch sky, blue sunsets',
      text: `The air pressure is about ${r(K.marsPressureMb, 1)} millibars, ${r((K.marsPressureMb / K.earthPressureMb) * 100, 1)}% of Earth's, and ${r(K.marsCo2Pct)}% of it is carbon dioxide. Fine dust hanging in it colours the daytime sky tan and scatters blue light forward, so the sky around the setting Sun glows blue.`,
      math: `${r(K.marsPressureMb, 2)} ÷ ${r(K.earthPressureMb)} = ${r((K.marsPressureMb / K.earthPressureMb) * 100, 1)}%` },
    { id: 'mars-window', kind: 'astronomy', sourceId: 'nssdc', title: 'A launch window every 26 months',
      text: `Earth laps Mars on the inside track once every ${r(K.marsSynodicD)} days, about ${r(K.marsSynodicD / 30.44)} months. Only then are the two planets placed for a cheap trip. A base on Mars has to last from one window to the next without help.`,
      math: `${r(K.marsSynodicD)} days ÷ 30.44 = ${r(K.marsSynodicD / 30.44, 1)} months` },
    { id: 'mars-gravity', kind: 'astronomy', sourceId: 'nssdc', title: 'Just over a third of your weight',
      text: `Gravity on Mars is ${K.gMars} m/s², ${r((K.gMars / K.gEarth) * 100)}% of Earth's. Nobody yet knows whether that is enough to keep bones and muscles healthy for years.`,
      math: `${K.gMars} ÷ ${K.gEarth} = ${r(K.gMars / K.gEarth, 2)}` },
  ],
}

/* ---------- Engineering: one note per building ---------- */

const moonNightKWh = nightEnergyKWh(K.arrayKW, moonNightH), marsNightKWh = nightEnergyKWh(K.arrayKW, marsNightH)

export const ENGINEERING: Record<ModuleId, Note> = {
  habitat: { id: 'eng-habitat', kind: 'engineering', sourceId: 'change4-rad', title: 'Radiation sets how long a crew can stay',
    text: `Without air or a magnetic field, the open surface gives about ${K.doseMoon} mSv a day on the Moon and ${K.doseMars} on Mars. At NASA's career limit of ${K.doseLimit} mSv that is about ${r(daysToLimit(K.doseMoon))} days on the Moon or ${r(daysToLimit(K.doseMars))} on Mars, so habitats are buried under regolith or put in lava tubes.`,
    math: `${K.doseLimit} ÷ ${K.doseMoon} = ${r(daysToLimit(K.doseMoon))} days; ${K.doseLimit} ÷ ${K.doseMars} = ${r(daysToLimit(K.doseMars))} days` },
  power: { id: 'eng-power', kind: 'engineering', sourceId: 'moonbase', title: 'Why polar solar arrays stand upright',
    text: `A panel makes the most power when it faces the Sun. At the lunar pole the Sun is on the horizon and circles the sky once a month, so the arrays stand on tall masts and turn to follow it. The mast lifts them above the shadows of nearby hills. On Mars the same panel makes ${r((K.sunMars / K.sunEarth) * 100)}% of what it would near Earth, before dust.` },
  battery: { id: 'eng-battery', kind: 'engineering', sourceId: 'computed', title: 'Sizing a battery: power times time',
    text: `Energy stored = power needed × hours of darkness. A ${K.arrayKW} kW base through a ${r(moonNightH / 24, 1)}-day lunar night needs ${r(moonNightKWh)} kWh. At about ${K.batteryWhKg} Wh per kg that is roughly ${r(batteryTonnes(moonNightKWh))} tonnes of batteries. A Martian night needs ${r(marsNightKWh)} kWh, about ${r(Math.round((batteryTonnes(marsNightKWh) * 1000) / 10) * 10)} kg. That gap is why Moon bases go to the poles or use reactors.`,
    math: `${K.arrayKW} kW × ${r(moonNightH, 1)} h = ${r(moonNightKWh)} kWh; ÷ ${K.batteryWhKg} Wh/kg = ${r(batteryTonnes(moonNightKWh), 1)} t` },
  reactor: { id: 'eng-reactor', kind: 'engineering', sourceId: 'moonbase', title: 'Power that ignores the Sun, and why it sits far away',
    text: `A fission reactor makes the same ${K.reactorKW} kW at noon, at midnight and in a dust storm. Its radiation thins out with the square of the distance: twice as far away means a quarter of the dose. So the reactor is half buried and kept away from where people live.`,
    math: 'dose ∝ 1 ÷ distance²' },
  comms: { id: 'eng-comms', kind: 'engineering', sourceId: 'computed', title: 'The speed of light is the limit',
    text: `A radio signal takes ${r(lightSeconds(K.moonDistKm), 2)} seconds to reach the Moon, so talking works with a short pause. Mars is between ${r(lightSeconds(K.marsNearKm) / 60, 1)} and ${r(lightSeconds(K.marsFarKm) / 60, 1)} minutes away each way. Nobody can steer a Mars rover by joystick: it has to decide for itself.`,
    math: `${r(K.moonDistKm)} km ÷ ${r(K.lightKmS)} km/s = ${r(lightSeconds(K.moonDistKm), 2)} s` },
  farm: { id: 'eng-farm', kind: 'engineering', sourceId: 'background', title: 'Why the grow lights are pink',
    text: `Leaves use red and blue light best and bounce most green light away, which is why they look green. Grow lamps save power by making mostly red and blue, and the mix looks pink. Each person needs about ${K.foodPerDay} kg of food a day, and the plants turn the crew's carbon dioxide back into oxygen.` },
  pad: { id: 'eng-pad', kind: 'engineering', sourceId: 'background', title: 'With no air, rocket dust never slows down',
    text: `On Earth, air stops blown dust within metres. On the Moon nothing does: grains thrown up by a landing engine fly like bullets for kilometres. Apollo 12 landed near the old Surveyor 3 probe and sandblasted it. So landing pads are hardened and built well away from homes and solar arrays.` },
  lab: { id: 'eng-lab', kind: 'engineering', sourceId: 'background', title: 'Why analyse rocks on the spot',
    text: `Every kilogram flown home costs fuel all the way. The Apollo crews brought back ${K.apolloSamplesKg} kg in six landings. A lab at the base lets the crew test many rocks and send only the best ones home.` },
  ice: { id: 'eng-ice', kind: 'engineering', sourceId: 'diviner', title: 'Ice as hard as rock',
    text: `Ice in permanently dark craters sits near −180 °C, where it is as hard as stone. In a vacuum, warmed ice turns straight into vapour without melting, so extractors heat the soil in a sealed chamber and catch the vapour. Each kilogram of water holds ${r((31.998 / (2 * 18.015)) * 100)}% oxygen by mass.`,
    math: `O ÷ H₂O = 16.00 ÷ 18.02 = ${r(31.998 / (2 * 18.015), 2)}` },
  oxygen: { id: 'eng-oxygen', kind: 'engineering', sourceId: 'moxie', title: 'Making air from water or from the sky',
    text: `Splitting ${r(WATER_PER_O2, 2)} kg of water with electricity gives 1 kg of oxygen. On Mars, Perseverance's MOXIE made oxygen straight from the carbon dioxide air: ${K.moxieTotalG} g over ${K.moxieRuns} runs, up to ${K.moxiePeakGh} g an hour. One person breathes about ${r((K.o2PerDay * 1000) / 24)} g an hour, so a crew needs units many times larger.`,
    math: `${K.o2PerDay} kg ÷ 24 h = ${r((K.o2PerDay * 1000) / 24)} g/h, about ${r(moxiesPerPerson(), 1)} times MOXIE's best rate` },
  rover: { id: 'eng-rover', kind: 'engineering', sourceId: 'computed', title: 'Less weight means less grip',
    text: `A wheel grips in proportion to the weight pressing it down. On the Moon a rover weighs ${r((K.gMoon / K.gEarth) * 100)}% of what it does on Earth, and on Mars ${r((K.gMars / K.gEarth) * 100)}%, but its mass is unchanged, so it is just as hard to stop and much easier to spin or slide. This is why rover tests on Earth's slopes are only part of the story.`,
    math: 'grip ≈ friction × mass × gravity' },
  printer: { id: 'eng-printer', kind: 'engineering', sourceId: 'background', title: 'Build with what is already there',
    text: `Everything launched from Earth has to be lifted out of Earth's gravity, braked at the Moon and landed. Loose regolith is free and already there. Piled or melted into a thick wall, it stops radiation and small meteorites and evens out the temperature swings.` },
  telescope: { id: 'eng-telescope', kind: 'engineering', sourceId: 'background', title: 'The quietest place for radio',
    text: `Earth's upper air blocks radio waves below about 10 MHz and blurs those just above, and our own transmitters drown out much of the rest. Among those long waves are faint signals from before the first stars. The Moon has no such layer of air, and its far side is shielded from all of Earth's radio noise.` },
}

/** Notes that hold for the whole base, not one building */
export const GENERAL_ENGINEERING: Note[] = [
  { id: 'eng-heat', kind: 'engineering', sourceId: 'computed', title: 'In a vacuum, heat can only leave as light',
    text: `With no air or water to carry heat away, a base cools itself with radiator panels that glow in infrared. A perfect panel at 27 °C sheds about ${r(radiatorWm2(27))} W from each square metre. A panel twice as hot (on the absolute scale) sheds sixteen times more, which is why reactors run hot radiators.`,
    math: `5.67 × 10⁻⁸ × (300 K)⁴ = ${r(radiatorWm2(27))} W/m²` },
  { id: 'eng-dust', kind: 'engineering', sourceId: 'background', title: 'Moon dust is broken glass',
    text: 'On Earth, wind and water round off every grain. Lunar dust has never been weathered: it is sharp, glassy and charged with static, so it clings to everything. It scratched visors, wore at Apollo suit fabric and clogged joints within days. Dusty, dry test sites on Earth are softer than the real thing.' },
]

export const ALL_NOTES: Note[] = [...ASTRONOMY.moon, ...ASTRONOMY.mars, ...Object.values(ENGINEERING), ...GENERAL_ENGINEERING]
