/**
 * Nature at the base: the things that happen on the Moon and Mars without anyone doing anything,
 * when they happen, and WHY. Plain functions of the site and the mission hour, so the same hour
 * always shows the same sky, and so they can be tested. The 3D scene draws them (BaseScene) and the
 * Base screen explains them.
 *
 * Shown more often than in reality, on purpose, so a player sees them: a visible meteoroid flash near
 * one base is rare, and big solar storms come a few times a year. Dust devils are shown in the Martian
 * winter too, although they are commonest in spring and summer. Phobos follows a simplified path.
 */
import type { SiteEnv, SunNow } from './baseSim'

export type NatureId = 'earthshine' | 'long-shadows' | 'impact' | 'thermal-quake' | 'solar-storm' | 'dust-devil' | 'dust-storm' | 'blue-sunset' | 'phobos'

export interface NatureInfo {
  id: NatureId
  world: 'moon' | 'mars' | 'both'
  title: string
  /** What you see */
  what: string
  /** Why it happens */
  why: string
  /** What it means for the base */
  so: string
  sourceId: string
  /** Something the crew has to react to */
  warn?: boolean
}

export const NATURE: Record<NatureId, NatureInfo> = {
  earthshine: { id: 'earthshine', world: 'moon', title: 'Earthshine', sourceId: 'background',
    what: 'The Sun is hidden, yet the ground is still faintly lit, with a bluish tint.',
    why: 'Earth hangs in the lunar sky, nearly four times wider than the Moon looks from Earth, and its clouds and oceans reflect far more sunlight than the dark lunar soil does. That reflected light falls on the night side of the Moon. You can see it from Earth as the faint glow on the dark part of a crescent Moon.',
    so: 'Crews can see enough to move carefully, but there is no power in it: solar arrays make nothing.' },
  'long-shadows': { id: 'long-shadows', world: 'moon', title: 'Shadows kilometres long, and pitch black', sourceId: 'lola',
    what: 'Every rock and building throws a very long shadow with a sharp edge, and nothing can be seen inside it.',
    why: 'The Sun is only a few degrees above the horizon, so a shadow is many times longer than the thing that casts it: at 2° up, a 1 m rock casts a 29 m shadow. On Earth the sky scatters light into shadows. The Moon has no air, so its sky is black and shadows are filled only by light bounced off the ground.',
    so: 'A crater or a boulder can hide in shadow in plain sight. Crews carry lamps even in daylight, and rovers map with lasers.' },
  impact: { id: 'impact', world: 'moon', title: 'Meteoroid flash', sourceId: 'background', warn: true,
    what: 'A sudden silent flash on the plain, then a spray of dust that flies out in clean arcs.',
    why: 'Earth\'s air burns up small meteoroids as shooting stars. The Moon has no air, so even a pebble reaches the ground at tens of kilometres a second and its energy turns to heat and light in an instant. There is no sound, because there is no air to carry it, and the dust flies in perfect arcs because nothing slows it.',
    so: 'This is one reason habitats are covered in regolith. Telescopes on Earth watch the Moon\'s night side for these flashes to count how often they come.' },
  'thermal-quake': { id: 'thermal-quake', world: 'moon', title: 'Thermal moonquake', sourceId: 'background', warn: true,
    what: 'The ground trembles for a moment as sunlight arrives or leaves.',
    why: 'When the Sun rises or sets on the Moon the surface temperature changes by hundreds of degrees. Rock and soil swell and shrink, and the crust creaks and cracks. Seismometers left by the Apollo crews recorded these small quakes at every lunar sunrise and sunset.',
    so: 'They are too weak to harm a base, but joints, seals and foundations must cope with the same swelling and shrinking.' },
  'solar-storm': { id: 'solar-storm', world: 'both', title: 'Solar particle storm', sourceId: 'msl', warn: true,
    what: 'White specks flicker across the camera view and the crew stays inside.',
    why: 'An eruption on the Sun has thrown out protons moving at a large fraction of the speed of light. Earth\'s magnetic field and thick air stop them. The Moon has neither and Mars has only thin air, so the particles reach the ground. The specks are particles striking the camera\'s sensor, as they do on real spacecraft cameras.',
    so: 'Radiation outside rises sharply for hours to days, so all work outside stops and the crew shelters behind the thickest shielding.' },
  'dust-devil': { id: 'dust-devil', world: 'mars', title: 'Dust devil', sourceId: 'background',
    what: 'A tall spinning column of dust wanders across the plain.',
    why: 'By early afternoon the Sun has heated the ground far more than the thin air above it. Warm air rises in a column, the air rushing in underneath starts to spin, and the whirl lifts fine dust. Because the air is so thin they can grow kilometres tall, yet push only gently.',
    so: 'Mostly helpful: dust devils swept the solar panels of the Spirit and Opportunity rovers clean more than once. They also raise static charge and fine grit.' },
  'dust-storm': { id: 'dust-storm', world: 'mars', title: 'Dust storm', sourceId: 'msl', warn: true,
    what: 'The sky turns dark and brown, far hills vanish and the Sun dims.',
    why: 'Sunlight warms dust in the air, the warm air rises and stirs up stronger winds, and those lift more dust: the storm feeds itself. In some years storms merge and cover the whole planet for weeks. The wind itself is weak, because the air is so thin.',
    so: 'Solar power falls steeply for days or weeks. The Opportunity rover was lost to the 2018 global storm. Bases need stored energy or a reactor.' },
  'blue-sunset': { id: 'blue-sunset', world: 'mars', title: 'Blue glow around the low Sun', sourceId: 'msl',
    what: 'The sky is tan, but turns blue around the Sun when it is near the horizon.',
    why: 'It is the reverse of Earth. Our air molecules scatter blue light in all directions, so our sky is blue and sunsets are red. Martian dust grains are just the right size to scatter blue light forwards, along the beam, so blue piles up around the Sun while the rest of the sky stays dusty tan.',
    so: 'Rover cameras measure this glow to work out how much dust is in the air, and so how much power to expect tomorrow.' },
  phobos: { id: 'phobos', world: 'mars', title: 'Phobos crossing the sky backwards', sourceId: 'nssdc',
    what: 'A small bright moon rises in the west and sets in the east a few hours later.',
    why: 'Phobos orbits so close to Mars that it goes round in 7 hours 39 minutes, faster than Mars turns. So it overtakes the ground and crosses the sky the "wrong" way, twice each sol. It looks about a third as wide as our Moon, and from near the poles of Mars it is never seen, because the curve of the planet hides it.',
    so: 'Tides are slowly pulling Phobos inwards. Rovers time its passes across the Sun to measure its orbit.' },
}

/** A repeatable number from 0 to 1 for a whole number, so the same mission hour always gives the same events. */
export const chance = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

/** Solar particle storms: the first on day 12 at 06:00, then every 29 days, each lasting 30 hours. */
export const SOLAR_STORM = { firstH: 11 * 24 + 6, everyH: 29 * 24, lastsH: 30 }
/** Strength of the solar particle storm at this mission hour, 0 (none) to 1 (peak): a fast rise, a slow fade. */
export function solarStormAt(hour: number): number {
  const t = hour - SOLAR_STORM.firstH
  if (t < 0) return 0
  const m = t % SOLAR_STORM.everyH
  if (m >= SOLAR_STORM.lastsH) return 0
  return m < 3 ? m / 3 : 1 - ((m - 3) / (SOLAR_STORM.lastsH - 3)) * 0.85
}

/** Meteoroid flashes are decided per quarter-hour of mission time; about one in twelve has one. */
const IMPACT_ODDS = 1 / 12
/** Phobos: from one rise to the next, and how long each pass is above the horizon, hours */
export const PHOBOS = { everyH: 11.1, upH: 4.2 }

export interface NatureNow {
  /** What is happening now, most urgent first */
  active: NatureId[]
  /** A meteoroid flash: a new id for each one, with where it lands (direction in radians, distance in scene units) */
  impact: { id: number; angle: number; dist: number } | null
  /** A thermal moonquake: a new id for each tremor */
  quake: number | null
  /** Solar particle storm strength, 0..1 */
  solar: number
  /** Mars dust storm strength, 0..1 (how much dust is in the air beyond the usual haze) */
  dust: number
  /** How many dust devils are out */
  dustDevils: number
  /** Where Phobos is, in the same angles as the Sun (degrees), or null when it is down */
  phobos: { az: number; elev: number } | null
}

const ORDER: NatureId[] = ['solar-storm', 'dust-storm', 'impact', 'thermal-quake', 'dust-devil', 'phobos', 'blue-sunset', 'earthshine', 'long-shadows']

/**
 * What nature is doing at a base at this mission hour.
 * sunFn gives the Sun at any hour (the live base and the 60-day test count hours differently).
 * hod is the local time of day on a 24-hour clock.
 */
export function natureAt(env: SiteEnv, site: { lat: number; lon: number }, hour: number, hod: number, sunFn: (h: number) => SunNow): NatureNow {
  const sun = sunFn(hour)
  const on = new Set<NatureId>()
  const solar = solarStormAt(hour)
  if (solar > 0) on.add('solar-storm')
  let impact: NatureNow['impact'] = null, quake: number | null = null, dustDevils = 0, phobos: NatureNow['phobos'] = null
  const dust = env.kind === 'mars' ? Math.min(1, Math.max(0, ((sun.tau ?? 0.5) - 0.7) / 3)) : 0

  if (env.kind === 'mars') {
    const storm = (sun.tau ?? 0) > 2
    if (storm) on.add('dust-storm')
    if (!storm && hod >= 11 && hod < 15.5 && sun.elev > 8 && (sun.tau ?? 0) < 1.5) {
      dustDevils = 1 + (chance(Math.floor(hour / 24.66)) > 0.5 ? 1 : 0)
      on.add('dust-devil')
    }
    if (!storm && sun.elev > -4 && sun.elev < 8) on.add('blue-sunset')
    const k = (((hour % PHOBOS.everyH) + PHOBOS.everyH) % PHOBOS.everyH) / PHOBOS.upH
    if (sun.dark && !storm && k < 1 && Math.abs(site.lat) < 69) {
      // West (where the Sun sets) to east, highest in the middle of the pass and lower far from the equator
      const top = Math.min(70, Math.max(8, 75 - Math.abs(site.lat)))
      phobos = { az: 90 - 180 * k, elev: Math.sin(Math.PI * k) * top }
      on.add('phobos')
    }
  } else {
    const slot = Math.floor(hour * 4)
    if (chance(slot * 1.7 + 3) < IMPACT_ODDS) {
      impact = { id: slot, angle: chance(slot + 0.5) * Math.PI * 2, dist: 14 + chance(slot + 0.9) * 45 }
      on.add('impact')
    }
    // The ground creaks for a couple of hours after sunlight arrives or leaves
    if (sunFn(hour - 2).dark !== sun.dark) { quake = Math.floor(hour); on.add('thermal-quake') }
    const earthUp = Math.cos((site.lat * Math.PI) / 180) * Math.cos((site.lon * Math.PI) / 180) > -0.12 // a little past the edge: the Moon rocks slightly
    if (sun.dark && earthUp) on.add('earthshine')
    if (!sun.dark && sun.elev < 6) on.add('long-shadows')
  }
  return { active: ORDER.filter(id => on.has(id)), impact, quake, solar, dust, dustDevils, phobos }
}

/** Everything that can happen at a site on this world, for the "can also happen here" list. */
export const natureOf = (world: 'moon' | 'mars') => ORDER.map(id => NATURE[id]).filter(n => n.world === world || n.world === 'both')
/** Length of a shadow as a multiple of the height of the thing casting it, for a Sun this many degrees up. */
export const shadowLength = (sunElevDeg: number) => 1 / Math.tan((Math.max(0.1, sunElevDeg) * Math.PI) / 180)

/** Events that can be shown on demand, whatever the hour (the others depend on where the Sun is) */
export const PREVIEWABLE: NatureId[] = ['dust-storm', 'dust-devil', 'solar-storm', 'impact', 'thermal-quake']

/** The same moment with one event switched on, for the "Show me" buttons. seed makes each press a new event. */
export function withPreview(n: NatureNow, id: NatureId, seed: number): NatureNow {
  const out: NatureNow = { ...n, active: [id, ...n.active.filter(x => x !== id)] }
  if (id === 'dust-storm') { out.dust = 1; out.dustDevils = 0; out.active = out.active.filter(x => x !== 'dust-devil') }
  if (id === 'dust-devil') out.dustDevils = 2
  if (id === 'solar-storm') out.solar = 1
  if (id === 'impact') out.impact = { id: -seed, angle: chance(seed) * Math.PI * 2, dist: 16 + chance(seed + 1) * 14 }
  if (id === 'thermal-quake') out.quake = -seed
  return out
}

/** The first sentence of the reason, for a pop-up when something starts. */
export const shortWhy = (id: NatureId) => `${NATURE[id].title}: ${NATURE[id].why.split('. ')[0]}.`
