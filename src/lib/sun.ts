/**
 * How low the Sun stays at a place on Earth, day by day.
 *
 * At the lunar south pole the Sun never climbs more than about 1.5° above the horizon
 * (a few degrees on the rims further out), so shadows are kilometres long and glare is
 * blinding. NASA rehearses this at night with spotlights. These functions find the real
 * days when the Sun behaves like that on Earth, from first principles.
 *
 * Declination uses Spencer's series (as in NOAA's solar calculator, about 0.05° accurate).
 */
const RAD = Math.PI / 180

/** The Moon's spin axis is tilted 1.54° to the ecliptic, so polar Sun heights wobble by that much. */
export const LUNAR_TILT = 1.54

/** Sun heights at or below this count as "polar Sun" for the factor (the south polar rims and plateaus). */
export const LOW_SUN_DEG = 7

/** Solar declination in degrees on a day of the year (1 = 1 January). */
export function declination(day: number): number {
  const g = ((2 * Math.PI) / 365) * (day - 1)
  return (
    (0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
      0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)) / RAD
  )
}

/** Highest Sun of the day (at local noon), degrees above the horizon. Negative = polar night. */
export const noonHeight = (lat: number, day: number) => 90 - Math.abs(lat - declination(day))

/** Lowest Sun of the day (at local midnight). Positive = midnight Sun. */
export const midnightHeight = (lat: number, day: number) => Math.abs(lat + declination(day)) - 90

/** Hours of daylight, with the usual allowance for refraction and the Sun's disc. */
export function dayLength(lat: number, day: number): number {
  const d = declination(day) * RAD, p = lat * RAD
  const c = (Math.sin(-0.833 * RAD) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d))
  if (c >= 1) return 0
  if (c <= -1) return 24
  return (2 * Math.acos(c)) / RAD / 15
}

/** Highest the Sun gets at a lunar latitude: the pole is at 90° minus |lat|, plus the axial wobble. */
export const lunarMaxSun = (lat: number) => Math.max(0.5, 90 - Math.abs(lat) + LUNAR_TILT)

/** Days when the Sun rises but never climbs above maxDeg: lunar-pole style light all day. */
export function grazingDays(lat: number, maxDeg = LOW_SUN_DEG): number[] {
  const out: number[] = []
  for (let day = 1; day <= 365; day++) {
    const h = noonHeight(lat, day)
    if (h > 0 && h <= maxDeg) out.push(day)
  }
  return out
}

export interface LightWindow { start: number; end: number; days: number; label: string }

const fmtDay = (day: number) => new Date(Date.UTC(2027, 0, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** The same days grouped into date ranges, e.g. "7 Oct to 22 Oct". */
export function lightWindows(lat: number, maxDeg = LOW_SUN_DEG): LightWindow[] {
  const days = grazingDays(lat, maxDeg)
  const out: LightWindow[] = []
  for (const d of days) {
    const last = out[out.length - 1]
    if (last && d === last.end + 1) last.end = d
    else out.push({ start: d, end: d, days: 0, label: '' })
  }
  // A window running over New Year is one season, not two
  if (out.length > 1 && out[0].start === 1 && out[out.length - 1].end === 365) {
    const tail = out.pop()!
    out[0].start = tail.start - 365
  }
  for (const w of out) {
    w.days = w.end - w.start + 1
    const s = w.start < 1 ? w.start + 365 : w.start
    w.label = w.days === 1 ? fmtDay(s) : `${fmtDay(s)} to ${fmtDay(w.end)}`
  }
  return out
}

/** 0..1: how long the low-Sun season lasts. 40 days or more a year scores 1. */
export function lowSunValue(lat: number): number {
  return Math.min(1, grazingDays(lat).length / 40)
}

/** A one-line, human description of the low-Sun season, for factor tooltips and reports. */
export function lowSunRaw(lat: number): string {
  const n = grazingDays(lat).length
  if (!n) return `Noon Sun never drops below ${LOW_SUN_DEG}° here`
  return `${n} days a year with the Sun below ${LOW_SUN_DEG}° all day`
}
