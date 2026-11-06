import { GRAD_Q, type EarthTexture, type MoonTexture } from './moonTexture'
import type { MarsTexture } from './marsTexture'

const D2R = Math.PI / 180

export type Vec3 = [number, number, number]

/**
 * Per-pixel lookup tables for one globe size, tilt and light direction.
 * The globe spins around its own axis, so each frame only shifts the longitude:
 * normals, lighting and the local east/north frame stay fixed per screen pixel.
 */
export interface GlobePrep {
  size: number
  tiltDeg: number
  count: number
  texW: number
  pix: Int32Array // screen pixel index
  row: Int32Array // texture row * texW
  col: Float32Array // texture column when the view longitude is 0
  mu: Float32Array // cosine toward the viewer
  base: Float32Array // n·L
  le: Float32Array // east·L (bump lighting)
  ln: Float32Array // north·L (bump lighting)
  alpha: Float32Array // antialiased edge
  spec: Float32Array // sun glint (Earth oceans)
}

export const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Builds the lookup tables a few rows at a time; see `runSteps` / `runStepsAsync`. */
export function* prepareGlobeSteps(size: number, tiltDeg: number, light: Vec3, texW: number, texH: number): Generator<number, GlobePrep> {
  const L = normalize(light)
  const R = size / 2
  const f0 = tiltDeg * D2R
  const sf = Math.sin(f0), cf = Math.cos(f0)
  const cap = size * size
  const pix = new Int32Array(cap), row = new Int32Array(cap), col = new Float32Array(cap)
  const mu = new Float32Array(cap), base = new Float32Array(cap), le = new Float32Array(cap)
  const ln = new Float32Array(cap), alpha = new Float32Array(cap), spec = new Float32Array(cap)
  let n = 0
  for (let py = 0; py < size; py++) {
    if (py % 48 === 47) yield py / size
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - R) / R
      const y = -(py + 0.5 - R) / R
      const r = Math.sqrt(x * x + y * y)
      const a = Math.min(1, Math.max(0, (1 - r) * R + 0.5))
      if (a <= 0) continue
      const s = r > 1 ? 1 / r : 1
      const xs = x * s, ys = y * s
      const z = Math.sqrt(Math.max(0, 1 - xs * xs - ys * ys))
      // view -> moon-fixed frame
      const yw = ys * cf + z * sf
      const zw = -ys * sf + z * cf
      const lat = Math.asin(Math.max(-1, Math.min(1, yw)))
      const lon = Math.atan2(xs, zw)
      const j = Math.min(texH - 1, Math.max(0, Math.floor(((Math.PI / 2 - lat) / Math.PI) * texH)))
      const sl = Math.sin(lon), cl = Math.cos(lon), sp = Math.sin(lat), cp = Math.cos(lat)
      // local east / north vectors, rotated into view space
      const ex = cl, ey = sl * sf, ez = -sl * cf
      const nx = -sp * sl, ny = cp * cf + sp * cl * sf, nz = cp * sf - sp * cl * cf
      const nl = xs * L[0] + ys * L[1] + z * L[2]
      pix[n] = py * size + px
      row[n] = j * texW
      col[n] = ((lon / (2 * Math.PI)) + 0.5) * texW
      mu[n] = z
      base[n] = nl
      le[n] = ex * L[0] + ey * L[1] + ez * L[2]
      ln[n] = nx * L[0] + ny * L[1] + nz * L[2]
      alpha[n] = a
      const rv = 2 * nl * z - L[2] // reflection of the sun toward the viewer
      spec[n] = rv > 0 ? Math.pow(rv, 120) : 0
      n++
    }
  }
  return {
    size, tiltDeg, count: n, texW,
    pix: pix.slice(0, n), row: row.slice(0, n), col: col.slice(0, n), mu: mu.slice(0, n),
    base: base.slice(0, n), le: le.slice(0, n), ln: ln.slice(0, n), alpha: alpha.slice(0, n), spec: spec.slice(0, n),
  }
}

export const prepareGlobe = (size: number, tiltDeg: number, light: Vec3, texW: number, texH: number) =>
  runSteps(prepareGlobeSteps(size, tiltDeg, light, texW, texH))

/** Runs a step generator to the end right away. */
export function runSteps<T>(gen: Generator<unknown, T>): T {
  for (;;) {
    const s = gen.next()
    if (s.done) return s.value
  }
}

/** Runs a step generator with a time budget per animation frame. Resolves null if cancelled. */
export async function runStepsAsync<T>(gen: Generator<unknown, T>, cancelled: () => boolean, budgetMs = 10): Promise<T | null> {
  let start = performance.now()
  for (;;) {
    if (cancelled()) return null
    const s = gen.next()
    if (s.done) return s.value
    if (performance.now() - start > budgetMs) {
      await new Promise<void>(r => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)))
      start = performance.now()
    }
  }
}

// Soft filmic roll-off then display gamma, as a lookup table over linear 0..4.
const LUT_SIZE = 2048
const LUT = new Uint8ClampedArray(LUT_SIZE)
for (let i = 0; i < LUT_SIZE; i++) {
  const x = (i / LUT_SIZE) * 4
  LUT[i] = Math.round(255 * Math.pow(1 - Math.exp(-1.45 * x), 1 / 2.2))
}
const tone = (v: number) => LUT[v <= 0 ? 0 : v >= 4 ? LUT_SIZE - 1 : (v * (LUT_SIZE / 4)) | 0]

export interface MoonLook {
  bump: number // relief exaggeration
  earthshine: number // faint light on the night side
  exposure: number
}

export const DEFAULT_LOOK: MoonLook = { bump: 1.25, earthshine: 0.03, exposure: 1.05 }

/** Writes RGBA pixels of the Moon into `out` (size*size*4). Pixels outside the disc are left alone. */
export function renderMoon(p: GlobePrep, tex: MoonTexture, viewLonDeg: number, out: Uint8ClampedArray, look: MoonLook = DEFAULT_LOOK) {
  const w = tex.w
  const off = (((viewLonDeg / 360) * w) % w + w) % w
  const { albedo, gx, gy } = tex
  const k = look.bump / GRAD_Q
  const es = look.earthshine
  const ex = look.exposure
  for (let q = 0; q < p.count; q++) {
    let c = (p.col[q] + off) | 0
    if (c >= w) c -= w
    const t = p.row[q] + c
    const a = albedo[t] * (1 / 255)
    const mu = p.mu[q]
    const fade = mu < 0.4 ? mu * 2.5 : 1 // relief flattens toward the limb
    const mu0 = p.base[q] - k * fade * (gx[t] * p.le[q] + gy[t] * p.ln[q])
    let lit = 0
    if (mu0 > 0) lit = 0.55 * ((2 * mu0) / (mu0 + mu + 0.1)) + 0.45 * mu0
    const v = a * lit * ex
    const e = a * es * (0.35 + 0.65 * mu)
    const o = p.pix[q] * 4
    out[o] = tone(v + e * 0.55)
    out[o + 1] = tone(v * 0.975 + e * 0.72)
    out[o + 2] = tone(v * 0.935 + e * 1.0)
    out[o + 3] = p.alpha[q] * 255
  }
}

/** Writes RGBA pixels of Mars: coloured surface, bump lighting and a thin dusty haze at the limb. */
export function renderMars(p: GlobePrep, tex: MarsTexture, viewLonDeg: number, out: Uint8ClampedArray, look: MoonLook = DEFAULT_LOOK) {
  const w = tex.w
  const off = (((viewLonDeg / 360) * w) % w + w) % w
  const { rgb, gx, gy } = tex
  const k = (look.bump * 0.8) / GRAD_Q
  const ex = look.exposure * 1.08
  for (let q = 0; q < p.count; q++) {
    let c = (p.col[q] + off) | 0
    if (c >= w) c -= w
    const t = p.row[q] + c
    const mu = p.mu[q]
    const fade = mu < 0.4 ? mu * 2.5 : 1
    const mu0 = p.base[q] - k * fade * (gx[t] * p.le[q] + gy[t] * p.ln[q])
    let lit = 0
    if (mu0 > 0) lit = 0.35 * ((2 * mu0) / (mu0 + mu + 0.1)) + 0.65 * mu0
    const day = Math.min(1, Math.max(0, p.base[q] * 3 + 0.3))
    const haze = Math.pow(1 - mu, 3) * day * 0.55 // dust in the thin air glows at the edge of the day side
    const o = p.pix[q] * 4
    out[o] = tone((rgb[t * 3] / 255) * lit * ex + haze * 0.62)
    out[o + 1] = tone((rgb[t * 3 + 1] / 255) * lit * ex + haze * 0.36)
    out[o + 2] = tone((rgb[t * 3 + 2] / 255) * lit * ex + haze * 0.26)
    out[o + 3] = p.alpha[q] * 255
  }
}

/** Writes RGBA pixels of the Earth with clouds, sun glint and an atmospheric rim. */
export function renderEarth(p: GlobePrep, tex: EarthTexture, viewLonDeg: number, cloudLonDeg: number, out: Uint8ClampedArray) {
  const w = tex.w
  const off = (((viewLonDeg / 360) * w) % w + w) % w
  const offC = (((cloudLonDeg / 360) * w) % w + w) % w
  const { rgb, cloud, ocean } = tex
  for (let q = 0; q < p.count; q++) {
    let c = (p.col[q] + off) | 0
    if (c >= w) c -= w
    let cc = (p.col[q] + offC) | 0
    if (cc >= w) cc -= w
    const t = p.row[q] + c
    const tc = p.row[q] + cc
    const nl = p.base[q]
    const tw = Math.min(1, Math.max(0, (nl + 0.12) / 0.24)) // twilight band across the terminator
    const day = (nl > 0 ? nl : 0) + tw * tw * 0.02
    const soft = Math.min(1, Math.max(0, nl * 3 + 0.25))
    const cl = cloud[tc] * (1 / 255)
    let r = (rgb[t * 3] / 255) * day * 1.25
    let g = (rgb[t * 3 + 1] / 255) * day * 1.25
    let b = (rgb[t * 3 + 2] / 255) * day * 1.25
    if (ocean[t] && cl < 0.3) {
      const s = p.spec[q] * 0.5 * (1 - cl)
      r += s; g += s * 0.95; b += s * 0.85
    }
    const cw = day * 1.1
    r = r * (1 - cl) + cw * cl
    g = g * (1 - cl) + cw * cl
    b = b * (1 - cl) + cw * 1.02 * cl
    const mu = p.mu[q]
    const rim = Math.pow(1 - mu, 2.6) * soft
    r += rim * 0.1; g += rim * 0.26; b += rim * 0.62
    r += 0.00012; g += 0.00018; b += 0.0004 // night side matches the colour of space behind it
    const o = p.pix[q] * 4
    out[o] = tone(r)
    out[o + 1] = tone(g)
    out[o + 2] = tone(b)
    out[o + 3] = p.alpha[q] * 255
  }
}

/** Screen position (0..1 across the canvas) of a lat/lon on a globe, or null when it is on the far side. */
export function projectToView(latDeg: number, lonDeg: number, viewLonDeg: number, tiltDeg: number) {
  const la = latDeg * D2R
  const lo = (lonDeg - viewLonDeg) * D2R
  const f0 = tiltDeg * D2R
  const xw = Math.cos(la) * Math.sin(lo), yw = Math.sin(la), zw = Math.cos(la) * Math.cos(lo)
  const x = xw
  const y = yw * Math.cos(f0) - zw * Math.sin(f0)
  const z = yw * Math.sin(f0) + zw * Math.cos(f0)
  if (z < 0.02) return null
  return { x: 0.5 + x / 2, y: 0.5 - y / 2, z }
}
