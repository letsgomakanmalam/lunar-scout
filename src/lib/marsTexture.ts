/**
 * Procedural Mars for the globe views. An artistic render, not survey data, but the big features
 * sit where they really are: the Tharsis volcanoes and Olympus Mons, Valles Marineris, the Hellas,
 * Argyre and Isidis basins, the dark albedo regions (Syrtis Major, Acidalia, Erythraeum...), both
 * polar caps, the smooth northern lowlands, and Gale and Jezero craters for the rover targets.
 * Like the Moon texture it is a step generator, so the work can be spread over frames.
 */
import { GRAD_Q, makeNoise, mulberry32 } from './moonTexture'

const D2R = Math.PI / 180

export interface MarsTexture {
  w: number
  h: number
  rgb: Uint8Array // 3 bytes per texel
  gx: Int8Array // slope toward east, quantized by GRAD_Q
  gy: Int8Array // slope toward north
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

interface Cap { x: number; y: number; z: number; r: number; k: number; la: number }
const cap = (la: number, lo: number, r: number, k: number): Cap => {
  const c = Math.cos(la * D2R)
  return { x: c * Math.sin(lo * D2R), y: Math.sin(la * D2R), z: c * Math.cos(lo * D2R), r: r * D2R, k, la }
}

// Dark albedo regions [lat, lon, radius°, darkness]. Overlapping caps make the irregular shapes.
const DARK: Cap[] = [
  cap(10, 68, 9, 0.75), cap(2, 70, 7, 0.7), cap(17, 66, 5, 0.55), // Syrtis Major
  cap(46, -28, 11, 0.55), cap(38, -18, 7, 0.45), cap(55, -40, 8, 0.4), // Acidalia
  cap(-3, 3, 6, 0.55), cap(-8, 18, 8, 0.6), cap(-10, 35, 8, 0.55), // Meridiani, Sabaeus
  cap(-24, -40, 11, 0.55), cap(-19, -24, 8, 0.5), cap(-27, -55, 7, 0.4), // Erythraeum
  cap(-15, 110, 10, 0.55), cap(-20, 95, 8, 0.5), // Tyrrhenum
  cap(-22, 145, 10, 0.55), cap(-25, 168, 9, 0.5), // Cimmerium
  cap(-30, -150, 10, 0.5), cap(-27, -166, 8, 0.45), // Sirenum
  cap(-26, -85, 6, 0.45), // Solis Lacus, the "Eye of Mars"
  cap(47, 110, 13, 0.3), cap(62, 60, 10, 0.3), // Utopia, northern dark collar
  cap(-62, 10, 14, 0.35), cap(-60, 130, 12, 0.3), // Mare Australe
]

// Bright, dusty regions [lat, lon, radius°, brightness].
const BRIGHT: Cap[] = [
  cap(-42.4, 70.5, 19, 0.55), cap(-49.7, -43.4, 15, 0.45), // Hellas, Argyre (dust-filled basins)
  cap(5, -110, 26, 0.45), cap(20, 5, 20, 0.4), cap(25, 147, 12, 0.35), cap(15, -160, 15, 0.4), // Tharsis, Arabia, Elysium, Amazonis
]

// Height: [lat, lon, radius°, height]; positive = shield or bulge, negative = basin.
const RELIEF: Cap[] = [
  cap(0, -105, 32, 0.006), // Tharsis bulge
  cap(18.65, -133.8, 5.2, 0.016), // Olympus Mons
  cap(-8.35, -120.09, 3.8, 0.01), cap(1.48, -112.96, 3.2, 0.009), cap(11.92, -104.08, 3.2, 0.01), // Arsia, Pavonis, Ascraeus
  cap(40.47, -109.6, 9, 0.004), cap(24.8, 146.9, 3, 0.006), // Alba, Elysium Mons
  cap(-42.4, 70.5, 19, -0.012), cap(-49.7, -43.4, 15, -0.008), cap(12.9, 87, 10, -0.006), // Hellas, Argyre, Isidis
]

// Valles Marineris as a chain of trough segments [lat, lon]
const VALLES: [number, number][] = [[-7, -101], [-7, -92], [-7.5, -84], [-8.5, -76], [-10, -68], [-13, -60], [-13, -51], [-11, -44], [-8, -38]]

interface Crater { lat: number; lon: number; r: number; age?: number }
const NAMED: Crater[] = [
  { lat: -5.4, lon: 137.8, r: 1.3, age: 0.3 }, // Gale (with Mount Sharp)
  { lat: 18.38, lon: 77.58, r: 0.4, age: 0.2 }, // Jezero
  { lat: -13.9, lon: 55.6, r: 3.8, age: 0.6 }, // Huygens
  { lat: -2.7, lon: 16.7, r: 3.9, age: 0.7 }, // Schiaparelli
  { lat: 50.8, lon: 29.3, r: 1.9, age: 0.2 }, // Lyot
]

function bucket(list: Cap[], h: number, reach: number) {
  const out: Cap[][] = Array.from({ length: h }, () => [])
  for (const c of list) {
    const rr = (c.r / D2R) * reach
    const top = Math.max(0, Math.floor(((90 - (c.la + rr)) / 180) * h))
    const bot = Math.min(h - 1, Math.ceil(((90 - (c.la - rr)) / 180) * h))
    for (let j = top; j <= bot; j++) out[j].push(c)
  }
  return out
}

export function* marsTextureSteps(w = 768, seed = 23): Generator<number, MarsTexture> {
  const h = w >> 1
  const n = w * h
  const alb = new Float32Array(n)
  const height = new Float32Array(n)
  const ice = new Float32Array(n)
  const { fbm, noise } = makeNoise(seed)
  const darkRows = bucket(DARK, h, 1.5), brightRows = bucket(BRIGHT, h, 1.4), reliefRows = bucket(RELIEF, h, 1.6)
  const vm = VALLES.map(([la, lo]) => cap(la, lo, 2.4, 1))

  for (let j = 0; j < h; j++) {
    if (j % 24 === 23) yield (j / h) * 0.6
    const latDeg = 90 - ((j + 0.5) * 180) / h
    const la = latDeg * D2R, sl = Math.sin(la), cl = Math.cos(la)
    for (let i = 0; i < w; i++) {
      const lo = (((i + 0.5) * 360) / w - 180) * D2R
      const px = cl * Math.sin(lo), py = sl, pz = cl * Math.cos(lo)
      const k = j * w + i
      const n0 = fbm(px * 2.2 + 3.1, py * 2.2 + 7.4, pz * 2.2 + 1.9, 3)
      const n1 = fbm(px * 9 + 11.7, py * 9 + 2.3, pz * 9 + 5.1, 3)
      // Crustal dichotomy: the smooth, low northern plains, with a wavy edge
      const edge = 28 + 14 * Math.sin(lo * 1.0 + 0.6) + (n0 - 0.5) * 18
      const north = smooth(edge - 6, edge + 6, latDeg)
      let a = 0.55 + (n0 - 0.5) * 0.35 + (n1 - 0.5) * 0.2
      for (const c of darkRows[j]) {
        const d = Math.sqrt(Math.max(0, 2 - 2 * (px * c.x + py * c.y + pz * c.z))) / c.r + (n1 - 0.5) * 0.9
        a -= c.k * (1 - smooth(0.55, 1.15, d)) * 0.5
      }
      for (const c of brightRows[j]) {
        const d = Math.sqrt(Math.max(0, 2 - 2 * (px * c.x + py * c.y + pz * c.z))) / c.r + (n0 - 0.5) * 0.5
        a += c.k * (1 - smooth(0.5, 1.2, d)) * 0.35
      }
      let ht = -0.004 * north + (1 - north) * (n1 - 0.5) * 0.004 + (n0 - 0.5) * 0.002
      for (const c of reliefRows[j]) {
        const dot = px * c.x + py * c.y + pz * c.z
        const t = Math.sqrt(Math.max(0, 2 - 2 * dot)) / c.r
        if (c.k > 0) ht += c.k * Math.exp(-t * t * 2.2) * (t < 0.12 && c.r < 6 * D2R ? 0.6 : 1) // shield with a summit caldera
        else ht += c.k * (1 - smooth(0.6, 1.0, t)) + -c.k * 0.35 * Math.exp(-(((t - 1) / 0.12) ** 2))
      }
      if (latDeg < 2 && latDeg > -18 && lo > -105 * D2R && lo < -33 * D2R) {
        let best = 9
        for (const c of vm) best = Math.min(best, Math.sqrt(Math.max(0, 2 - 2 * (px * c.x + py * c.y + pz * c.z))) / c.r)
        const trough = 1 - smooth(0.25, 0.9 + (n1 - 0.5) * 0.5, best)
        ht -= trough * 0.012
        a -= trough * 0.08
      }
      // Residual polar caps: the north cap is big and swirly, the south cap small and offset
      const swirl = noise(px * 14 + Math.atan2(px, pz) * 3, py * 14, pz * 14)
      const northIce = smooth(78.5, 82.5, latDeg + (swirl - 0.5) * 6)
      const sc = cap(-87, -45, 4.2, 1)
      const sd = Math.sqrt(Math.max(0, 2 - 2 * (px * sc.x + py * sc.y + pz * sc.z))) / sc.r + (swirl - 0.5) * 0.5
      const southIce = 1 - smooth(0.7, 1.1, sd)
      ice[k] = Math.max(northIce, southIce)
      alb[k] = a
      height[k] = ht
    }
  }

  // Craters: named ones plus a random population, denser in the old southern highlands
  const rnd = mulberry32(seed * 7)
  const craters: Crater[] = [...NAMED]
  for (let q = 0; q < w * 2.2; q++) {
    const lat = Math.asin(2 * rnd() - 1) / D2R
    const south = lat < 25 ? 1 : 0.25
    if (rnd() > south) continue
    craters.push({ lat, lon: rnd() * 360 - 180, r: Math.min(5, 0.35 * Math.pow(Math.max(1e-6, rnd()), -0.55)), age: 0.3 + rnd() * 0.7 })
  }
  const texel = 360 / w
  for (let idx = 0; idx < craters.length; idx++) {
    const c = craters[idx]
    if (c.r < texel * 1.2) continue
    const r = c.r * D2R, ext = r * 1.8
    const cl0 = Math.cos(c.lat * D2R)
    const cx = cl0 * Math.sin(c.lon * D2R), cy = Math.sin(c.lat * D2R), cz = cl0 * Math.cos(c.lon * D2R)
    const depth = r * 0.06 * (1 - 0.6 * (c.age ?? 0.5))
    const j0 = Math.max(0, Math.floor(((90 - (c.lat + c.r * 1.8)) / 180) * h)), j1 = Math.min(h - 1, Math.ceil(((90 - (c.lat - c.r * 1.8)) / 180) * h))
    for (let j = j0; j <= j1; j++) {
      const la = (90 - ((j + 0.5) * 180) / h) * D2R, sl = Math.sin(la), cl = Math.cos(la)
      const span = cl > 0.02 ? ext / cl : Math.PI
      const i0 = span >= Math.PI ? 0 : Math.floor(((c.lon * D2R - span + Math.PI) / (2 * Math.PI)) * w)
      const i1 = span >= Math.PI ? w - 1 : Math.ceil(((c.lon * D2R + span + Math.PI) / (2 * Math.PI)) * w)
      for (let ii = i0; ii <= i1; ii++) {
        const i = ((ii % w) + w) % w
        const lo = (((i + 0.5) * 360) / w - 180) * D2R
        const dot = cl * Math.sin(lo) * cx + sl * cy + cl * Math.cos(lo) * cz
        const t = Math.sqrt(Math.max(0, 2 - 2 * dot)) / r
        if (t > 1.8) continue
        const k = j * w + i
        if (t < 1) height[k] -= depth * (1 - t * t)
        height[k] += depth * 0.35 * Math.exp(-(((t - 1) / 0.22) ** 2))
        if (t < 0.9) alb[k] += 0.03 // dust settles on crater floors
      }
    }
    if (idx % 400 === 0) yield 0.6 + (idx / craters.length) * 0.3
  }

  // Colour, then slopes for bump lighting
  const rgb = new Uint8Array(n * 3)
  const gx = new Int8Array(n), gy = new Int8Array(n)
  const tw = (2 * Math.PI) / w, dn = Math.PI / h
  const grain = mulberry32(seed + 3)
  for (let j = 0; j < h; j++) {
    const la = (90 - ((j + 0.5) * 180) / h) * D2R
    const de = tw * Math.max(0.06, Math.cos(la))
    const ju = Math.max(0, j - 1), jd = Math.min(h - 1, j + 1)
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      const a = Math.min(1, Math.max(0, alb[k] + (grain() - 0.5) * 0.03))
      // ochre ramp: dark basaltic sand -> rust -> bright dust
      let r = 70 + a * 160, g = 42 + a * 98 + a * a * 20, b = 30 + a * 58
      const ic = ice[k]
      r = r * (1 - ic) + 238 * ic; g = g * (1 - ic) + 234 * ic; b = b * (1 - ic) + 228 * ic
      rgb[k * 3] = Math.min(255, r); rgb[k * 3 + 1] = Math.min(255, g); rgb[k * 3 + 2] = Math.min(255, b)
      const il = i === 0 ? w - 1 : i - 1, ir = i === w - 1 ? 0 : i + 1
      const sx = (height[j * w + ir] - height[j * w + il]) / (2 * de)
      const sy = (height[ju * w + i] - height[jd * w + i]) / ((jd - ju) * dn)
      gx[k] = Math.max(-127, Math.min(127, Math.round(sx * GRAD_Q)))
      gy[k] = Math.max(-127, Math.min(127, Math.round(sy * GRAD_Q)))
    }
  }
  yield 1
  return { w, h, rgb, gx, gy }
}
