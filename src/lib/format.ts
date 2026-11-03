/** 20.19° N style coordinates, easier to read than signed numbers. */
export const fmtLat = (lat: number, digits = 2) => `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}`
export const fmtLon = (lon: number, digits = 2) => `${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? 'E' : 'W'}`
export const fmtCoords = (lat: number, lon: number, digits = 2) => `${fmtLat(lat, digits)}, ${fmtLon(lon, digits)}`
