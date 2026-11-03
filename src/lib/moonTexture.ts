/**
 * Procedural textures for the title-screen Moon and Earth.
 *
 * The Moon is an artistic render, not survey data, but its big features sit where they
 * really are: maria at their IAU centres, named craters (Tycho, Copernicus, Plato...) at
 * their true positions and sizes, Orientale's rings on the western limb and the dark
 * Tsiolkovskiy floor on the far side. Everything else is seeded noise and random craters.
 *
 * Generation is a generator function so the UI can spread the work over several frames.
 */

const D2R = Math.PI / 180

export interface MoonTexture {
  w: number
  h: number
  albedo: Uint8Array // 0..255 surface brightness
  gx: Int8Array // slope toward east, quantized by GRAD_Q
  gy: Int8Array // slope toward north, quantized by GRAD_Q
}

export interface EarthTexture {
  w: number
  h: number
  rgb: Uint8Array // 3 bytes per texel
  cloud: Uint8Array // 0..255 cloud cover
  ocean: Uint8Array // 255 = water (for sun glint)
}

export const GRAD_Q = 96

/* ---------- seeded randomness and noise ---------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeNoise(seed: number) {
  const rnd = mulberry32(seed)
  const perm = new Uint8Array(512)
  const vals = new Float32Array(256)
  const p = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  for (let i = 0; i < 256; i++) vals[i] = rnd()

  /** 3D value noise in 0..1 */
  const noise = (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
    const xf = x - xi, yf = y - yi, zf = z - zi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
    const X = xi & 255, Y = yi & 255, Z = zi & 255
    const a = perm[X] + Y, b = perm[X + 1] + Y
    const aa = perm[a] + Z, ab = perm[a + 1] + Z, ba = perm[b] + Z, bb = perm[b + 1] + Z
    const x1 = vals[perm[aa]] + (vals[perm[ba]] - vals[perm[aa]]) * u
    const x2 = vals[perm[ab]] + (vals[perm[bb]] - vals[perm[ab]]) * u
    const x3 = vals[perm[aa + 1]] + (vals[perm[ba + 1]] - vals[perm[aa + 1]]) * u
    const x4 = vals[perm[ab + 1]] + (vals[perm[bb + 1]] - vals[perm[ab + 1]]) * u
    const y1 = x1 + (x2 - x1) * v
    const y2 = x3 + (x4 - x3) * v
    return y1 + (y2 - y1) * w
  }

  /** fractal sum, roughly 0..1 */
  const fbm = (x: number, y: number, z: number, octaves: number) => {
    let sum = 0, amp = 0.5, norm = 0
    for (let o = 0; o < octaves; o++) {
      sum += noise(x, y, z) * amp
      norm += amp
      x *= 2.03; y *= 2.03; z *= 2.03
      amp *= 0.5
    }
    return sum / norm
  }
  return { noise, fbm }
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* ---------- real lunar features ---------- */

// [lat, lon, angular radius in degrees, albedo]. Irregular maria use several overlapping caps
// so neighbours merge the way Imbrium, Procellarum and Nubium do on the real near side.
const MARIA: [number, number, number, number][] = [
  [32.8, -15.6, 17.5, 0.27], [44.1, -31.5, 4.6, 0.28], // Imbrium, Sinus Iridum
  [28.0, 17.5, 11.5, 0.31], // Serenitatis
  [8.5, 31.4, 12.0, 0.22], [2.0, 23.0, 7.5, 0.23], [15.0, 39.0, 6.5, 0.23], [-2.0, 36.0, 5.0, 0.24], // Tranquillitatis
  [17.0, 59.1, 9.0, 0.25], // Crisium
  [-7.8, 51.3, 10.5, 0.27], [-3.0, 46.0, 7.0, 0.27], [-14.0, 49.0, 6.0, 0.28], // Fecunditatis
  [-15.2, 35.5, 5.8, 0.27], // Nectaris
  [-21.3, -16.6, 11.0, 0.29], [-15.0, -10.0, 6.0, 0.29], // Nubium
  [-10.0, -23.0, 7.5, 0.29], // Cognitum
  [-24.4, -38.6, 6.5, 0.26], // Humorum
  [7.5, -30.9, 9.5, 0.28], // Insularum
  [13.3, 3.6, 5.0, 0.29], [2.4, 1.7, 4.2, 0.3], [10.9, -8.8, 5.0, 0.28], [26.5, 0.4, 4.5, 0.29], // Vaporum, Medii, Aestuum, Putredinis
  [38.0, 29.0, 5.0, 0.32], // Lacus Somniorum
  [56.5, -46.0, 4.4, 0.32], [57.1, -39.0, 4.4, 0.32], [56.5, -32.0, 4.4, 0.32], [57.1, -25.0, 4.4, 0.32], [56.5, -18.0, 4.4, 0.32], [57.1, -11.0, 4.4, 0.32], [56.5, -4.0, 4.4, 0.32], [57.1, 3.0, 4.4, 0.32], [56.5, 10.0, 4.4, 0.32], [57.1, 17.0, 4.4, 0.32], [56.5, 24.0, 4.4, 0.32], [57.1, 31.0, 4.4, 0.32], [56.5, 38.0, 4.4, 0.32], [57.1, 45.0, 4.4, 0.32], // Frigoris
  [25.0, -57.0, 13.0, 0.25], [10.0, -52.0, 13.0, 0.25], [-4.0, -45.0, 10.5, 0.26], [36.0, -47.0, 10.0, 0.26], [15.0, -64.0, 9.0, 0.25], [-12.0, -40.0, 8.0, 0.27], [45.0, -55.0, 7.0, 0.26], [0.0, -60.0, 8.0, 0.25], // Procellarum
  [-1.3, 87.0, 5.5, 0.3], [13.3, 86.1, 4.5, 0.32], [-38.9, 93.0, 6.5, 0.33], [56.8, 81.5, 3.6, 0.31], // limb maria
  [27.3, 147.9, 3.6, 0.27], [-33.7, 163.5, 2.6, 0.32], // far side: Moscoviense, Ingenii
]

// Very large, subtle albedo regions: [lat, lon, radius, albedo shift]
const BROAD: [number, number, number, number][] = [
  [-53, -169, 38, -0.07], // South Pole–Aitken basin, darker mafic floor
]

interface Crater {
  lat: number
  lon: number
  r: number // angular radius, degrees
  fresh?: number // 0..1 brightness of a young crater
  age?: number // 0 crisp .. 1 worn down
  rays?: number // ray length in crater radii
  dark?: boolean // lava-flooded dark floor
  rings?: number[] // basin rings as fractions of r
}

// Diameters from the IAU gazetteer, converted at ~30.3 km per degree.
const OLD_NAMED: Crater[] = [
  { lat: -19.4, lon: -92.8, r: 15.3, rings: [1, 0.66, 0.43], dark: true }, // Orientale
  { lat: 2.6, lon: -128.7, r: 9.4, rings: [1, 0.55] }, // Hertzsprung
  { lat: -4.0, lon: -157.4, r: 7.2, rings: [1, 0.5] }, // Korolev
  { lat: -36.1, lon: -151.8, r: 8.6, rings: [1, 0.5] }, // Apollo basin
  { lat: -58.4, lon: -14.4, r: 3.7, age: 0.55 }, // Clavius
  { lat: -9.3, lon: -1.9, r: 2.5, dark: true, age: 0.6 }, // Ptolemaeus
  { lat: -13.4, lon: -3.2, r: 1.8, age: 0.5 }, // Alphonsus
  { lat: -25.1, lon: 60.4, r: 2.9, age: 0.35 }, // Petavius
  { lat: -5.2, lon: -68.6, r: 2.85, dark: true }, // Grimaldi
  { lat: 51.6, lon: -9.4, r: 1.67, dark: true }, // Plato
  { lat: 29.7, lon: -4.0, r: 1.34, dark: true }, // Archimedes
  { lat: -20.4, lon: 129.1, r: 3.05, dark: true }, // Tsiolkovskiy
  { lat: -89.9, lon: 129.8, r: 0.35 }, // Shackleton
]

const YOUNG_NAMED: Crater[] = [
  { lat: -8.9, lon: 61.1, r: 2.18, fresh: 0.3, age: 0.1 }, // Langrenus
  { lat: -11.4, lon: 26.4, r: 1.65, fresh: 0.3, age: 0.1 }, // Theophilus
  { lat: 14.5, lon: -11.3, r: 0.96, fresh: 0.15, age: 0.2 }, // Eratosthenes
  { lat: 9.62, lon: -20.08, r: 1.53, fresh: 0.85, rays: 11, age: 0 }, // Copernicus
  { lat: 8.1, lon: -38.0, r: 0.51, fresh: 0.8, rays: 13, age: 0 }, // Kepler
  { lat: 23.7, lon: -47.4, r: 0.66, fresh: 1, rays: 8, age: 0 }, // Aristarchus
  { lat: 16.1, lon: 46.8, r: 0.46, fresh: 0.9, rays: 14, age: 0 }, // Proclus
  { lat: -43.31, lon: -11.36, r: 1.4, fresh: 1, rays: 24, age: 0 }, // Tycho
]

/* ---------- Moon ---------- */

type Noise = ReturnType<typeof makeNoise>
interface Cap { la: number; x: number; y: number; z: number; r: number; reach: number; cosR: number; a: number }

const toCap = (la: number, lo: number, r: number, a: number): Cap => {
  const cl = Math.cos(la * D2R)
  return { la, x: cl * Math.sin(lo * D2R), y: Math.sin(la * D2R), z: cl * Math.cos(lo * D2R), r: r * D2R, reach: r * 1.6, cosR: Math.cos(r * 1.6 * D2R), a }
}

/** Working buffers shared by the passes. Hot loops live in plain functions so V8 can optimize them. */
interface Work {
  w: number; h: number; w2: number; h2: number
  height: Float32Array; alb: Float32Array; mare: Uint8Array
  sinLat: Float32Array; cosLat: Float32Array; sinLon: Float32Array; cosLon: Float32Array
  N0: Float32Array; N1: Float32Array; M: Float32Array; MA: Float32Array
  rowCaps: Cap[][]; rowBroad: Cap[][]
  noise: Noise; grain: () => number
}

function bucketRows(list: Cap[], h: number) {
  const out: Cap[][] = Array.from({ length: h }, () => [])
  for (const c of list) {
    const top = Math.max(0, Math.floor(((90 - (c.la + c.reach)) / 180) * h))
    const bot = Math.min(h - 1, Math.ceil(((90 - (c.la - c.reach)) / 180) * h))
    for (let j = top; j <= bot; j++) out[j].push(c)
  }
  return out
}

/** Smooth fields (large-scale tone, mare masks) at half resolution. */
function fieldRows(wk: Work, j0: number, j1: number) {
  const { w2, h2, h, N0, N1, M, MA, rowCaps, rowBroad } = wk
  const fbm = wk.noise.fbm
  for (let j = j0; j < j1; j++) {
    const la = (90 - ((j + 0.5) * 180) / h2) * D2R
    const sl = Math.sin(la), cl = Math.cos(la)
    const fj = Math.min(h - 1, Math.floor(((j + 0.5) / h2) * h))
    const rc = rowCaps[fj], rb = rowBroad[fj]
    for (let i = 0; i < w2; i++) {
      const lo = (((i + 0.5) * 360) / w2 - 180) * D2R
      const px = cl * Math.sin(lo), py = sl, pz = cl * Math.cos(lo)
      const k = j * w2 + i
      const n0 = fbm(px * 1.6 + 4.2, py * 1.6 + 8.1, pz * 1.6 + 1.3, 2)
      const n1 = fbm(px * 5 + 11.3, py * 5 + 2.1, pz * 5 + 5.7, 3)
      let m = 0, ma = 0.28, edge = -1, shift = 0
      for (let c = 0; c < rc.length; c++) {
        const cap = rc[c]
        const dot = px * cap.x + py * cap.y + pz * cap.z
        if (dot < cap.cosR) continue
        if (edge < 0) edge = fbm(px * 5 + 3.1, py * 5 + 5.3, pz * 5 + 7.7, 2) * 0.62 + wk.noise.noise(px * 22 + 1, py * 22 + 2, pz * 22 + 3) * 0.38
        const d = Math.sqrt(Math.max(0, 2 - 2 * dot)) / cap.r + (edge - 0.5) * 1.15
        const mm = 1 - smoothstep(0.62, 1.0, d)
        if (mm > m) { m = mm; ma = cap.a }
      }
      for (let c = 0; c < rb.length; c++) {
        const cap = rb[c]
        const dot = px * cap.x + py * cap.y + pz * cap.z
        if (dot < cap.cosR) continue
        const d = Math.sqrt(Math.max(0, 2 - 2 * dot)) / cap.r
        shift += cap.a * (1 - smoothstep(0.5, 1.1, d + (n1 - 0.5) * 0.3))
      }
      N0[k] = n0 + shift / 0.22
      N1[k] = n1
      M[k] = m
      MA[k] = ma
    }
  }
}

/** Full resolution: upsample the smooth fields, add mottling, roughness and grain. */
function detailRows(wk: Work, j0: number, j1: number, xa: Int32Array, xb: Int32Array, tx: Float32Array) {
  const { w, w2, h2, N0, N1, M, MA, alb, height, mare, sinLat, cosLat, sinLon, cosLon, grain } = wk
  const fbm = wk.noise.fbm
  for (let j = j0; j < j1; j++) {
    const fy = (j + 0.5) / 2 - 0.5
    const fl = Math.floor(fy)
    const ya = Math.max(0, fl) * w2
    const yb = Math.min(h2 - 1, fl + 1) * w2
    const ty = Math.max(0, Math.min(1, fy - fl))
    const sl = sinLat[j], cl = cosLat[j]
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      const a0 = ya + xa[i], a1 = ya + xb[i], b0 = yb + xa[i], b1 = yb + xb[i], t = tx[i]
      const n0t = N0[a0] + (N0[a1] - N0[a0]) * t, n0b = N0[b0] + (N0[b1] - N0[b0]) * t
      const n1t = N1[a0] + (N1[a1] - N1[a0]) * t, n1b = N1[b0] + (N1[b1] - N1[b0]) * t
      const mt = M[a0] + (M[a1] - M[a0]) * t, mb = M[b0] + (M[b1] - M[b0]) * t
      const at = MA[a0] + (MA[a1] - MA[a0]) * t, ab = MA[b0] + (MA[b1] - MA[b0]) * t
      const n0 = n0t + (n0b - n0t) * ty, n1 = n1t + (n1b - n1t) * ty
      const m = mt + (mb - mt) * ty, ma = at + (ab - at) * ty
      const px = cl * sinLon[i], pz = cl * cosLon[i]
      const n2 = fbm(px * 18 + 1.7, sl * 18 + 9.2, pz * 18 + 4.4, 2)
      // fbm values cluster near 0.5, so the tone ranges are scaled up to read at a glance
      const highland = 0.6 + (n0 - 0.5) * 0.42 + (n1 - 0.5) * 0.38 + (n2 - 0.5) * 0.34
      const mareTone = ma - 0.025 - m * m * 0.025 + (n0 - 0.5) * 0.3 + (n1 - 0.5) * 0.26 + (n2 - 0.5) * 0.12
      alb[k] = highland * (1 - m) + mareTone * m + (grain() - 0.5) * 0.04
      height[k] = -0.0015 * m + (n1 - 0.5) * 0.002 + (n2 - 0.5) * 0.004 * (1 - 0.75 * m)
      mare[k] = (m * 255) | 0
    }
  }
}

const rowOf = (latRad: number, h: number) => Math.min(h - 1, Math.max(0, Math.floor(((Math.PI / 2 - latRad) / Math.PI) * h)))

/** Adds one crater (or ringed basin, or rayed crater) to the height and albedo maps. */
function stampCrater(wk: Work, c: Crater) {
  const { w, h, height, alb, sinLat, cosLat, sinLon, cosLon } = wk
  const noise = wk.noise.noise
  const texel = (2 * Math.PI) / w
  const r = c.r * D2R
  const ext = Math.min(Math.PI * 0.75, r * (c.rays ? c.rays : c.rings ? 1.25 : 2.3))
  const clat = c.lat * D2R, clon = c.lon * D2R
  const ccl = Math.cos(clat)
  const cx = ccl * Math.sin(clon), cy = Math.sin(clat), cz = ccl * Math.cos(clon)
  const ex = Math.cos(clon), ez = -Math.sin(clon)
  const nx = -Math.sin(clat) * Math.sin(clon), ny = ccl, nz = -Math.sin(clat) * Math.cos(clon)
  const cosExt = Math.cos(ext)
  const rd = c.r
  const age = c.age ?? 0.4
  const ratio = rd < 0.6 ? 0.16 : rd < 1.2 ? 0.1 : rd < 3 ? 0.06 : 0.03
  const depth = 2 * r * ratio * (c.rings ? 0.5 : 1) * (0.3 + 0.7 * Math.pow(1 - age, 1.4))
  const floor = rd < 0.6 ? 0 : rd < 1.2 ? 0.35 : 0.55
  const peak = rd >= 0.6 && rd <= 3.2 && !c.dark ? depth * 0.45 : 0
  const rimH = depth * (0.34 - 0.16 * age)
  const rimW = 0.2 + 0.3 * age
  const fresh = c.fresh ?? 0
  const rings = c.rings
  const dark = !!c.dark
  const rnd = mulberry32(Math.floor((c.lat + 91) * 1000 + (c.lon + 181) * 7))
  const rays = c.rays
    ? Array.from({ length: 22 + Math.floor(rnd() * 14) }, () => ({
        th: rnd() * Math.PI * 2,
        w: 0.035 + rnd() * 0.08,
        len: 2.5 + rnd() * (c.rays! - 2.5),
        k: 0.35 + rnd() * 0.65,
      }))
    : null

  const j0 = rowOf(clat + ext, h), j1 = rowOf(clat - ext, h)
  for (let j = j0; j <= j1; j++) {
    const cl = cosLat[j], sl = sinLat[j]
    const span = cl > 1e-3 ? ext / cl + 2 * texel : Math.PI
    let i0: number, i1: number
    if (span >= Math.PI) { i0 = 0; i1 = w - 1 } else {
      i0 = Math.floor(((clon - span + Math.PI) / (2 * Math.PI)) * w)
      i1 = Math.ceil(((clon + span + Math.PI) / (2 * Math.PI)) * w)
    }
    for (let ii = i0; ii <= i1; ii++) {
      const i = ii < 0 ? ii + w : ii >= w ? ii - w : ii
      const k = j * w + i
      const px = cl * sinLon[i], py = sl, pz = cl * cosLon[i]
      const dot = px * cx + py * cy + pz * cz
      if (dot < cosExt) continue
      const t = Math.sqrt(Math.max(0, 2 - 2 * dot)) / r
      let dh = 0
      let da = 0
      if (rings) {
        if (t < 1) dh -= depth * (1 - smoothstep(0, 1, t))
        for (let q = 0; q < rings.length; q++) {
          const g = (t - rings[q]) / 0.035
          dh += depth * 0.55 * Math.exp(-g * g)
        }
        if (dark) da -= 0.4 * (1 - smoothstep(0.24, 0.34, t + (noise(px * 20, py * 20, pz * 20) - 0.5) * 0.08)) * (alb[k] - 0.26)
      } else {
        if (t < 1) {
          const s = floor > 0 ? smoothstep(floor, 1, t) : t
          dh -= depth * (1 - s * s)
          if (peak) { const g = t / 0.13; dh += peak * Math.exp(-g * g) }
          if (dark) da += (0.24 - alb[k]) * (1 - smoothstep(0.82, 0.95, t))
        }
        const gr = (t - 1) / rimW
        dh += rimH * Math.exp(-gr * gr)
        if (t > 1) dh += rimH * 0.45 * Math.exp(-(t - 1) / 0.5)
        if (fresh) {
          const gf = (t - 0.9) / 0.5
          da += fresh * 0.2 * Math.exp(-gf * gf)
          if (t > 1) da += fresh * 0.14 * Math.exp(-(t - 1) / 0.8)
        }
        if (rays && t > 0.9) {
          const qx = px - cx * dot, qy = py - cy * dot, qz = pz - cz * dot
          const th = Math.atan2(qx * nx + qy * ny + qz * nz, qx * ex + qz * ez)
          let ray = 0
          for (let q = 0; q < rays.length; q++) {
            const ry = rays[q]
            if (t > ry.len) continue
            let dth = th - ry.th
            dth -= Math.round(dth / (2 * Math.PI)) * 2 * Math.PI
            const g = dth / ry.w
            if (g > 3 || g < -3) continue
            ray += Math.exp(-g * g) * ry.k * Math.pow(1 - (t - 0.9) / (ry.len - 0.9), 1.1)
          }
          if (ray > 0) da += fresh * 0.36 * Math.min(1, ray) * (0.4 + 0.6 * noise(px * 26, py * 26, pz * 26))
        }
      }
      height[k] += dh
      alb[k] += da
    }
  }
}

function slopesAndQuantize(wk: Work): MoonTexture {
  const { w, h, height, alb, cosLat } = wk
  const n = w * h
  const albedo = new Uint8Array(n)
  const gx = new Int8Array(n)
  const gy = new Int8Array(n)
  const texel = (2 * Math.PI) / w
  const dn = Math.PI / h
  for (let j = 0; j < h; j++) {
    const de = texel * Math.max(0.06, cosLat[j])
    const ju = Math.max(0, j - 1), jd = Math.min(h - 1, j + 1)
    const inv = 1 / ((jd - ju) * dn)
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      const il = i === 0 ? w - 1 : i - 1, ir = i === w - 1 ? 0 : i + 1
      const sx = (height[j * w + ir] - height[j * w + il]) / (2 * de)
      const sy = (height[ju * w + i] - height[jd * w + i]) * inv
      gx[k] = Math.max(-127, Math.min(127, Math.round(sx * GRAD_Q)))
      gy[k] = Math.max(-127, Math.min(127, Math.round(sy * GRAD_Q)))
      albedo[k] = Math.max(0, Math.min(255, Math.round(alb[k] * 255)))
    }
  }
  return { w, h, albedo, gx, gy }
}

/**
 * Builds the Moon texture step by step. Each `yield` (progress 0..1) is a good place to
 * hand control back to the browser. Run to completion with `runToEnd(moonTextureSteps())`.
 */
export function* moonTextureSteps(w = 1024, seed = 11): Generator<number, MoonTexture> {
  const h = w >> 1
  const w2 = w >> 1, h2 = h >> 1
  const sinLat = new Float32Array(h), cosLat = new Float32Array(h)
  const sinLon = new Float32Array(w), cosLon = new Float32Array(w)
  for (let j = 0; j < h; j++) {
    const la = (90 - ((j + 0.5) * 180) / h) * D2R
    sinLat[j] = Math.sin(la); cosLat[j] = Math.cos(la)
  }
  for (let i = 0; i < w; i++) {
    const lo = (((i + 0.5) * 360) / w - 180) * D2R
    sinLon[i] = Math.sin(lo); cosLon[i] = Math.cos(lo)
  }
  const wk: Work = {
    w, h, w2, h2,
    height: new Float32Array(w * h), alb: new Float32Array(w * h), mare: new Uint8Array(w * h),
    sinLat, cosLat, sinLon, cosLon,
    N0: new Float32Array(w2 * h2), N1: new Float32Array(w2 * h2), M: new Float32Array(w2 * h2), MA: new Float32Array(w2 * h2),
    rowCaps: bucketRows(MARIA.map(m => toCap(...m)), h),
    rowBroad: bucketRows(BROAD.map(m => toCap(...m)), h),
    noise: makeNoise(seed),
    grain: mulberry32(seed + 101),
  }

  // 1. Smooth fields at half resolution, then detail at full resolution
  const step1 = Math.max(4, Math.floor(30000 / w2))
  for (let j = 0; j < h2; j += step1) {
    fieldRows(wk, j, Math.min(h2, j + step1))
    yield (Math.min(h2, j + step1) / h2) * 0.3
  }
  const xa = new Int32Array(w), xb = new Int32Array(w), tx = new Float32Array(w)
  for (let i = 0; i < w; i++) {
    const fx = (i + 0.5) / 2 - 0.5
    const x0 = Math.floor(fx)
    xa[i] = (x0 + w2) % w2; xb[i] = (x0 + 1) % w2; tx[i] = fx - x0
  }
  const step2 = Math.max(4, Math.floor(60000 / w))
  for (let j = 0; j < h; j += step2) {
    detailRows(wk, j, Math.min(h, j + step2), xa, xb, tx)
    yield 0.3 + (Math.min(h, j + step2) / h) * 0.25
  }

  // 2. Craters: old basins first, then the random population, then young rayed craters on top
  for (const c of OLD_NAMED) stampCrater(wk, c)
  yield 0.62
  const rnd = mulberry32(seed * 7919)
  const rMin = Math.max(0.2, (360 / w) * 1.0)
  const total = Math.round(w * 7)
  for (let q = 0; q < total; q++) {
    const u = rnd(), v = rnd(), s = rnd(), f = rnd(), keep = rnd(), ag = rnd()
    const r = Math.min(8, 0.2 * Math.pow(Math.max(1e-6, s), -0.5))
    if (r < rMin) continue
    const lat = Math.asin(2 * v - 1) / D2R
    const k = rowOf(lat * D2R, h) * w + Math.min(w - 1, Math.floor(u * w))
    if (keep < (wk.mare[k] / 255) * 0.82) continue // maria are younger, with fewer craters
    const young = f < 0.07
    stampCrater(wk, { lat, lon: u * 360 - 180, r, age: young ? 0.05 : 0.25 + ag * 0.75, fresh: young ? 0.35 + f * 6 : 0 })
    if (q % 800 === 0) yield 0.62 + (q / total) * 0.28
  }
  for (const c of YOUNG_NAMED) stampCrater(wk, c)
  yield 0.92

  // 3. Slopes for bump lighting, then quantize
  const tex = slopesAndQuantize(wk)
  yield 1
  return tex
}

/* ---------- Earth ---------- */

// Rough continents as [lat, lon, radius] caps. Small at title size, but recognisable.
const LAND: [number, number, number][] = [
  [5, 20, 24], [-15, 26, 14], [20, 12, 16], [24, 30, 10], [-25, 25, 9], [-19, 47, 3.5], // Africa, Madagascar
  [50, 15, 11], [60, 30, 11], [44, 0, 6], [41, -4, 4], [64, 15, 6], [54, -2, 2.6], // Europe, UK
  [50, 90, 28], [32, 82, 14], [60, 120, 18], [35, 108, 14], [21, 78, 8], [15, 102, 7], [65, 150, 12], [70, 100, 12], [36, 138, 3], // Asia
  [24, 45, 8], [3.5, 102, 2.6], [1, 114, 4.5], [-3, 121, 3], [-6, 141, 5], [-7, 110, 2.5], // Arabia, Malaysia, Borneo, Indonesia
  [52, -100, 21], [40, -96, 14], [60, -122, 15], [64, -152, 8], [21, -101, 7], [14, -88, 3.5], [72, -40, 11], [67, -75, 7], // N. America, Greenland
  [-10, -58, 17], [-28, -62, 10], [-43, -69, 6], [5, -68, 8], // S. America
  [-25, 134, 14], [-41, 174, 3], // Australia, NZ
]

export function buildEarthTexture(w = 512, seed = 5): EarthTexture {
  const h = w >> 1
  const rgb = new Uint8Array(w * h * 3)
  const cloud = new Uint8Array(w * h)
  const ocean = new Uint8Array(w * h)
  const { fbm } = makeNoise(seed)
  const caps = LAND.map(([la, lo, r]) => {
    const cl = Math.cos(la * D2R)
    return { x: cl * Math.sin(lo * D2R), y: Math.sin(la * D2R), z: cl * Math.cos(lo * D2R), r: r * D2R }
  })
  for (let j = 0; j < h; j++) {
    const latDeg = 90 - ((j + 0.5) * 180) / h
    const la = latDeg * D2R
    for (let i = 0; i < w; i++) {
      const lo = (((i + 0.5) * 360) / w - 180) * D2R
      const px = Math.cos(la) * Math.sin(lo), py = Math.sin(la), pz = Math.cos(la) * Math.cos(lo)
      const k = j * w + i
      const e = fbm(px * 6 + 1, py * 6 + 2, pz * 6 + 3, 4)
      let land = 0
      for (const c of caps) {
        const d = Math.sqrt(Math.max(0, 2 - 2 * (px * c.x + py * c.y + pz * c.z))) / c.r + (e - 0.5) * 0.9
        land = Math.max(land, 1 - smoothstep(0.85, 1.0, d))
      }
      if (latDeg < -66) land = 1
      const isLand = land > 0.5
      const t = fbm(px * 14, py * 14, pz * 14, 3)
      let r: number, g: number, b: number
      if (isLand) {
        const ice = smoothstep(58, 70, Math.abs(latDeg) + (t - 0.5) * 14)
        const desert = Math.exp(-(((Math.abs(latDeg) - 24) / 11) ** 2)) * smoothstep(0.35, 0.6, e + 0.15)
        r = 38 + desert * 125 + t * 22; g = 74 + desert * 58 + t * 22; b = 34 + desert * 32 + t * 10
        r = r * (1 - ice) + 232 * ice; g = g * (1 - ice) + 238 * ice; b = b * (1 - ice) + 242 * ice
      } else {
        const coast = smoothstep(0.15, 0.5, land)
        r = 8 + coast * 18; g = 34 + coast * 40 + t * 8; b = 78 + coast * 40 + t * 14
        ocean[k] = 255
      }
      rgb[k * 3] = Math.min(255, r); rgb[k * 3 + 1] = Math.min(255, g); rgb[k * 3 + 2] = Math.min(255, b)
      const band = 0.18 * Math.exp(-((latDeg / 8) ** 2)) + 0.12 * Math.exp(-(((Math.abs(latDeg) - 52) / 12) ** 2))
      const cl = fbm(px * 5 + 9, py * 11 + 4, pz * 5 + 1, 5) + band
      cloud[k] = Math.round(smoothstep(0.53, 0.8, cl) * 235)
    }
  }
  return { w, h, rgb, cloud, ocean }
}

/** Runs a step generator synchronously (tests, or when there is no frame to wait for). */
export function runToEnd<T>(gen: Generator<unknown, T>): T {
  for (;;) {
    const s = gen.next()
    if (s.done) return s.value
  }
}
