/**
 * Turns NASA GIBS infrared colours back into temperatures, then into cloud.
 *
 * GIBS draws brightness temperature with colour palettes, published at
 * https://gibs.earthdata.nasa.gov/colormaps/v1.3/ :
 *   - Clean_Longwave_Infrared_Window_Band.xml (GOES-East, GOES-West, Himawari Band 13, °C): warm greys
 *     getting darker as they warm, then cyan, blue, green, yellow, red, dark red, cold greys, magenta and
 *     white for the coldest cloud tops. The cold greys use values the warm greys never use, so every
 *     colour decodes to exactly one temperature.
 *   - VIIRS_Brightness_Temp_BandI5.xml (VIIRS I5, K): one smooth ramp, dark navy at 180 K to white at 340 K,
 *     so warm is bright and cold is dark, the opposite of a weather picture.
 * Reading brightness as "cloud" would get both wrong, so we decode temperature first.
 */

/** Cold-band greys of the Band 13 palette, from -79.6 °C to -70.6 °C (1 °C apart). */
const COLD_GREYS = [230, 204, 177, 155, 129, 102, 76, 54, 27, 5]

/** Band 13 (10.3 µm) brightness temperature in °C from its exact palette colour, or NaN for no data. */
export function cleanIrTempC(r: number, g: number, b: number): number {
  if (r === 0 && g === 0 && b === 0) return NaN // outside the satellite's disk
  if (r === g && g === b) {
    const cold = COLD_GREYS.indexOf(r)
    if (cold >= 0) return -79.6 + cold
    if (r === 255) return -91.6
    return (197 - r) / 2.5833 - 18.85 // 197 grey = -18.85 °C ... 1 grey = +57 °C
  }
  if (g === 0 && b === 0) return -69.6 + (r - 26) / 25.44 // dark red to red: -69.6 ... -60.6
  if (r === 255 && b === 0) return -59.6 + (g - 26) / 25.44 // red to yellow: -59.6 ... -50.6
  if (g === 255 && b === 0) return -49.6 + (230 - r) / 25.56 // yellow-green to green: -49.6 ... -40.6
  if (r === 0) {
    if (b < 92) return -39.6 + (234 - g) / 21.25 // green to teal: -39.6 ... -31.6
    if (g === 0) return b >= 120 ? -29.35 : -29.85
    if (b <= 106 && g <= 42) return g >= 32 ? -30.85 : -30.35
    return -28.85 + (g - 13) * 0.03926 // blue to cyan: -28.85 ... -19.35
  }
  if (r > g && b > g) return -90.6 + (r - 127) / 12.8 // magenta to pink: -90.6 ... -80.6
  return NaN
}

/** Control points of the VIIRS I5 ramp: [K, r, g, b], every 16th palette entry. */
export const VIIRS_I5_STOPS: [number, number, number, number][] = [
  [180.3, 0, 0, 22], [190.0, 19, 33, 100], [200.0, 40, 48, 121], [210.1, 60, 61, 137], [220.1, 86, 72, 144],
  [230.1, 114, 83, 148], [240.2, 143, 95, 152], [250.2, 164, 106, 148], [260.3, 180, 117, 142], [270.3, 196, 127, 136],
  [280.3, 213, 151, 145], [290.4, 229, 186, 168], [300.4, 244, 220, 190], [310.5, 255, 245, 211], [320.5, 255, 251, 228],
  [330.5, 255, 253, 242], [340.0, 255, 255, 255],
]

/** Temperature (K) of the nearest point on the VIIRS ramp to a colour. */
function projectViirs(r: number, g: number, b: number): number {
  let best = Infinity, temp = NaN
  for (let i = 1; i < VIIRS_I5_STOPS.length; i++) {
    const [ta, ar, ag, ab] = VIIRS_I5_STOPS[i - 1], [tb, br, bg, bb] = VIIRS_I5_STOPS[i]
    const dr = br - ar, dg = bg - ag, db = bb - ab
    const len = dr * dr + dg * dg + db * db
    const t = Math.min(1, Math.max(0, ((r - ar) * dr + (g - ag) * dg + (b - ab) * db) / len))
    const er = ar + t * dr - r, eg = ag + t * dg - g, eb = ab + t * db - b
    const d = er * er + eg * eg + eb * eb
    if (d < best) { best = d; temp = ta + t * (tb - ta) }
  }
  return temp
}

let lut: Float32Array | null = null
/** VIIRS I5 brightness temperature (K) from a palette colour, via a 32×32×32 lookup built once. */
export function viirsTempK(r: number, g: number, b: number): number {
  if (!lut) {
    lut = new Float32Array(32 * 32 * 32)
    for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) for (let k = 0; k < 32; k++) lut[(i << 10) | (j << 5) | k] = projectViirs(i * 8 + 4, j * 8 + 4, k * 8 + 4)
  }
  return lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]
}

/**
 * How cloudy a pixel is (0..1) from its infrared temperature. Clear ground and sea are warm; cloud tops
 * are colder. The clear threshold falls towards the poles, where the ground itself is very cold
 * (one infrared band cannot fully separate cloud from frozen ground in polar winter).
 */
export function cloudAlpha(tempK: number, lat: number): number {
  if (!(tempK > 0)) return 0
  const clear = 285 - 0.55 * Math.abs(lat)
  const t = (clear - tempK) / 40
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}
