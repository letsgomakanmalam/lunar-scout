/** Timeline and labels for the opening zoom, from the edge of the universe to Earth and the Moon. */

/** Keyframes: [seconds, log10 of the metres across the screen]. Dwells on each stage, rushes between. */
export const ZOOM_KEYS: [number, number][] = [
  [0, 26.95], [0.9, 26.3], [1.6, 22.4], [2.3, 21.6], [2.95, 14.6], [3.55, 13.15], [4.6, 9.25],
]
export const ZOOM_END = ZOOM_KEYS[ZOOM_KEYS.length - 1][0]

/** Smooth curve through the keyframes that never overshoots (monotone cubic) and lands at rest. */
export function makeCurve(keys: [number, number][]) {
  const n = keys.length
  const x = keys.map(k => k[0]), y = keys.map(k => k[1])
  const d = x.slice(0, -1).map((_, i) => (y[i + 1] - y[i]) / (x[i + 1] - x[i]))
  const m = y.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i] }
  }
  return (t: number) => {
    if (t <= x[0]) return y[0]
    if (t >= x[n - 1]) return y[n - 1]
    let i = 0
    while (t > x[i + 1]) i++
    const h = x[i + 1] - x[i], u = (t - x[i]) / h
    return (2 * u ** 3 - 3 * u ** 2 + 1) * y[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * y[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1]
  }
}

export const STAGES = [
  { from: Infinity, name: 'Observable universe', sub: 'Billions of galaxies, 93 billion light-years across' },
  { from: 23.5, name: 'Milky Way', sub: 'Our galaxy, 100,000 light-years across' },
  { from: 16.5, name: 'Solar System', sub: 'Eight planets around one star' },
  { from: 10.8, name: 'Earth and Moon', sub: '384,400 km apart. Next stop: the Moon.' },
]

/** Which stage a field of view belongs to. */
export const stageAt = (fov: number) => STAGES.reduce((s, st, i) => (fov <= st.from ? i : s), 0)

const LY = 9.4607e15
/** "93 billion light-years", "2.0 million km": the width of the view in words. */
export function fovLabel(fov: number) {
  const m = 10 ** fov
  const ly = m / LY
  const big = (v: number, unit: string) => `${v.toFixed(v >= 10 ? 0 : 1)} ${unit}`
  if (ly >= 1e9) return big(ly / 1e9, 'billion light-years')
  if (ly >= 1e6) return big(ly / 1e6, 'million light-years')
  if (ly >= 1) return `${Math.round(ly).toLocaleString('en-US')} light-years`
  const km = m / 1000
  if (km >= 1e9) return big(km / 1e9, 'billion km')
  if (km >= 1e6) return big(km / 1e6, 'million km')
  return `${Math.round(km).toLocaleString('en-US')} km`
}
