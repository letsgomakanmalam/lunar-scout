/** 20.19° N style coordinates, easier to read than signed numbers. */
export const fmtLat = (lat: number, digits = 2) => `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}`
export const fmtLon = (lon: number, digits = 2) => `${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? 'E' : 'W'}`
export const fmtCoords = (lat: number, lon: number, digits = 2) => `${fmtLat(lat, digits)}, ${fmtLon(lon, digits)}`

/** 1st, 2nd, 3rd, 4th... 11th, 12th, 13th, 21st. */
export function ordinal(n: number) {
  const v = Math.round(n), t = v % 100
  const s = t >= 11 && t <= 13 ? 'th' : v % 10 === 1 ? 'st' : v % 10 === 2 ? 'nd' : v % 10 === 3 ? 'rd' : 'th'
  return `${v}${s}`
}
