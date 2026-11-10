/**
 * "Live satellite" tiles that follow the computer's clock, without black holes.
 *
 * NASA's daily VIIRS picture (through GIBS) builds up orbit by orbit during the day, and is black
 * wherever it has no daytime data: parts of the planet not photographed yet today, and polar night
 * (the whole Arctic from November to February). Each tile is therefore built newest first:
 *
 *   1. the computer's own date ("today"), refetched every hour as new orbits arrive;
 *   2. the two days before, for places today's orbits have not reached yet (real pictures, so they blend in);
 *   3. NASA's Blue Marble, dimmed, where there is no recent picture at all (polar night).
 *
 * The same rule applies whether one pixel or a whole tile is missing, so there are no seams along
 * tile edges. Tiles are composited in the browser through MapLibre custom protocols.
 *
 * "Live Earth" goes further: three geostationary weather satellites photograph their half of the
 * planet every 10 minutes (NOAA's GOES-East and GOES-West, JMA's Himawari, served by NASA GIBS).
 * Their infrared pictures, which work day and night, become a live cloud layer over a cloud-free
 * Blue Marble ground, the same colours everywhere. Europe, Africa and the poles have no geostationary
 * picture in GIBS, so there the clouds come from the newest daily picture instead, drawn the same way.
 */
import maplibregl from 'maplibre-gl'

export const PROTOCOL = 'livefill'
/** How many earlier days fill the places today's orbits have not reached */
export const LOOKBACK = 2
/** Brightness of Blue Marble where there is no recent picture (it reads as "no live picture here") */
export const BACKUP_DIM = 0.75

const pad = (n: number) => String(n).padStart(2, '0')

/** The computer's own calendar date, YYYY-MM-DD (local time, not UTC). */
export function localDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The date n days before a YYYY-MM-DD date. */
export function dayBefore(date: string, n = 1): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) - n * 86400e3
  return new Date(t).toISOString().slice(0, 10)
}

/** The computer's date, plus a key that changes every hour so today's tiles are fetched again. */
export function liveStamp(now: Date = new Date()) {
  const date = localDay(now)
  return { date, refresh: `${date}T${pad(now.getHours())}` }
}

export const liveTileUrl = (date: string, refresh = '') => `${PROTOCOL}://${date}/{z}/{y}/{x}${refresh ? `?r=${refresh}` : ''}`

/** No-data black, allowing for JPEG noise. Dark ocean is never this dark. */
export const isNoData = (r: number, g: number, b: number) => r + g + b <= 18 && r <= 8 && g <= 8 && b <= 8

export function countNoData(px: Uint8ClampedArray): number {
  let n = 0
  for (let i = 0; i < px.length; i += 4) if (isNoData(px[i], px[i + 1], px[i + 2])) n++
  return n
}

/**
 * No-data pixels, plus the dark JPEG fringe within `fringe` pixels of them. JPEG smears the edge of a
 * black gap into dark grey; without this, every filled gap would keep a thin dark outline.
 */
export function noDataMask(px: Uint8ClampedArray, w = 256, h = 256, fringe = 2): Uint8Array {
  const n = w * h
  const core = new Uint8Array(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) if (isNoData(px[i], px[i + 1], px[i + 2])) core[p] = 1
  if (!fringe) return core
  const out = core.slice()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4
      if (core[p] || px[i] + px[i + 1] + px[i + 2] > 75) continue // only dark pixels can be fringe
      let near = false
      for (let dy = -fringe; dy <= fringe && !near; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -fringe; dx <= fringe; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < w && core[yy * w + xx]) { near = true; break }
        }
      }
      if (near) out[p] = 1
    }
  }
  return out
}

/**
 * Wherever dst has no data and src does, copies src (times dim) into dst, in place.
 * Returns how many no-data pixels remain in dst.
 */
export function fillFrom(dst: Uint8ClampedArray, src: Uint8ClampedArray | null, dim = 1, w = 256, h = 256, fringe = 2): number {
  const need = noDataMask(dst, w, h, fringe)
  const empty = src ? noDataMask(src, w, h, fringe) : null
  let left = 0
  for (let p = 0, i = 0; p < need.length; p++, i += 4) {
    if (!need[p]) continue
    if (!src || empty![p]) { left++; continue }
    dst[i] = src[i] * dim
    dst[i + 1] = src[i + 1] * dim
    dst[i + 2] = src[i + 2] * dim
    dst[i + 3] = 255
  }
  return left
}

/** Where a tile sits inside its ancestor at a coarser zoom (Blue Marble stops at zoom 8). */
export function ancestor(z: number, y: number, x: number, maxZ: number) {
  const dz = Math.max(0, z - maxZ)
  const n = 1 << dz
  const size = 256 / n
  return { z: z - dz, y: y >> dz, x: x >> dz, sx: (x % n) * size, sy: (y % n) * size, size }
}


/* ---------- Live Earth: geostationary satellites ---------- */

/** Sub-satellite longitudes: NOAA GOES-East (75.2°W), GOES-West (137.2°W), JMA Himawari (140.7°E). */
export const GEO_SATS = [
  { id: 'GOES-East_ABI_Band13_Clean_Infrared', name: 'GOES-East', lon: -75.2 },
  { id: 'GOES-West_ABI_Band13_Clean_Infrared', name: 'GOES-West', lon: -137.2 },
  { id: 'Himawari_AHI_Band13_Clean_Infrared', name: 'Himawari', lon: 140.7 },
] as const

/** Live pictures appear within about 20 minutes; aim 30 minutes back so the newest picture is normally ready. */
export const CLOUD_DELAY_MIN = 30

/** The newest 10-minute picture time that should exist, as GIBS writes it: 2026-11-10T00:40:00Z. */
export function cloudStamp(now: Date = new Date(), stepsBack = 0): string {
  const step = 10 * 60e3
  const t = Math.floor((now.getTime() - CLOUD_DELAY_MIN * 60e3) / step) * step - stepsBack * step
  return new Date(t).toISOString().slice(0, 19) + 'Z'
}

/** Live clouds for a 10-minute picture time; the date picks the daily picture used where no satellite sees. */
export const cloudTileUrl = (time: string, date: string) => `liveclouds://${time}/{z}/{y}/{x}?d=${date}`

const RAD = Math.PI / 180
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Angle (degrees) between a place and the point under a geostationary satellite. */
export const viewAngle = (lat: number, lon: number, satLon: number) => Math.acos(Math.max(-1, Math.min(1, Math.cos(lat * RAD) * Math.cos((lon - satLon) * RAD)))) / RAD

/** 1 where a geostationary satellite sees a place well, fading to 0 towards the edge of its disk. */
export function geoWeight(lat: number, lon: number): number {
  let best = 0
  for (const s of GEO_SATS) best = Math.max(best, 1 - smooth(58, 70, viewAngle(lat, lon, s.lon)))
  return best
}

/** Longitude and latitude of a pixel centre in a Web Mercator tile. */
export function pixelLonLat(z: number, x: number, y: number, px: number, py: number) {
  const n = 256 * 2 ** z
  const lon = ((x * 256 + px + 0.5) / n) * 360 - 180
  const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * 256 + py + 0.5)) / n))) / RAD
  return { lon, lat }
}

/** Cold cloud tops look bright in infrared; warm ground looks dark. Below LO is clear, above HI is solid cloud. */
export const IR_LO = 95, IR_HI = 215

/** Turns an infrared tile into white clouds on transparency, weighted by how well the satellite sees each pixel. */
export function irToCloud(ir: Uint8ClampedArray, out: Uint8ClampedArray, weight?: Float32Array): void {
  for (let i = 0, p = 0; i < ir.length; i += 4, p++) {
    const a = ir[i + 3]
    if (!a) continue
    const c = Math.min(1, Math.max(0, (Math.max(ir[i], ir[i + 1], ir[i + 2]) - IR_LO) / (IR_HI - IR_LO)))
    const alpha = 255 * Math.pow(c, 1.3) * 0.92 * (a / 255) * (weight ? weight[p] : 1)
    if (alpha <= out[i + 3]) continue // keep the clearer view where two satellites overlap
    out[i] = 246; out[i + 1] = 248; out[i + 2] = 252; out[i + 3] = alpha
  }
}

/**
 * Clouds from a true-colour daily picture: bright, nearly grey pixels (cloud, also snow and ice) become
 * white on transparency; coloured ground, sea and no-data black stay clear. weight fades it in.
 */
export function visToCloud(px: Uint8ClampedArray, out: Uint8ClampedArray, weight?: Float32Array): void {
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const r = px[i], g = px[i + 1], b = px[i + 2]
    const lo = Math.min(r, g, b), hi = Math.max(r, g, b)
    if (hi < 60) continue
    const bright = Math.min(1, Math.max(0, (lo - 120) / (215 - 120)))
    const grey = 1 - Math.min(1, Math.max(0, ((hi - lo) / hi - 0.18) / 0.25))
    const alpha = 255 * Math.pow(bright * grey, 1.2) * 0.9 * (weight ? weight[p] : 1)
    if (alpha <= out[i + 3]) continue
    out[i] = 246; out[i + 1] = 248; out[i + 2] = 252; out[i + 3] = alpha
  }
}

/** Per-pixel view weight of one satellite over a tile (1 = straight down, 0 = beyond its edge). */
function satWeights(z: number, x: number, y: number, satLon: number): Float32Array {
  const w = new Float32Array(256 * 256)
  const cosLat = new Float32Array(256), cosLon = new Float32Array(256)
  for (let py = 0; py < 256; py++) cosLat[py] = Math.cos(pixelLonLat(z, x, y, 0, py).lat * RAD)
  for (let px = 0; px < 256; px++) cosLon[px] = Math.cos((pixelLonLat(z, x, y, px, 0).lon - satLon) * RAD)
  for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
    const d = Math.acos(Math.max(-1, Math.min(1, cosLat[py] * cosLon[px]))) / RAD
    w[py * 256 + px] = 1 - smooth(58, 70, d)
  }
  return w
}

type Canvas = OffscreenCanvas | HTMLCanvasElement
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
const makeCanvas = (): Canvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(256, 256)
  const c = document.createElement('canvas')
  c.width = c.height = 256
  return c
}
const toBytes = async (c: Canvas, type = 'image/jpeg'): Promise<ArrayBuffer> => {
  if ('convertToBlob' in c) return (await c.convertToBlob({ type, quality: 0.9 })).arrayBuffer()
  const blob = await new Promise<Blob | null>(res => (c as HTMLCanvasElement).toBlob(res, type, 0.9))
  if (!blob) throw new Error('Could not encode tile')
  return blob.arrayBuffer()
}
async function bitmap(url: string, signal: AbortSignal, fresh = false): Promise<ImageBitmap | null> {
  try {
    // Today's picture keeps growing during the day, so it skips the browser cache
    const res = await fetch(url, { signal, cache: fresh ? 'no-cache' : 'default' })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    return null
  }
}
const parse = (scheme: string, url: string) => {
  const m = new RegExp(`^${scheme}://([^/]+)/(\\d+)/(\\d+)/(\\d+)`).exec(url)
  if (!m) throw new Error(`Bad tile address: ${url}`)
  return { key: m[1], z: Number(m[2]), y: Number(m[3]), x: Number(m[4]) }
}

type Urls = {
  live: (date: string, z: number, y: number, x: number) => string
  backup: (z: number, y: number, x: number) => string
  geo: (layer: string, time: string, matrixSet: string, z: number, y: number, x: number) => string
}

let installed = false
/** Which GIBS tile matrix set works for each geostationary layer (2 km layers: Level 6; tried in order). */
const MATRIX_SETS = ['GoogleMapsCompatible_Level6', 'GoogleMapsCompatible_Level7']
type Found = { set: string; time: string }
/** Per asked-for picture time: which tile matrix set and picture time work for each satellite (probed once). */
const probes = new Map<string, Promise<Record<string, Found | null>>>()

/** A picture time n ten-minute steps earlier. */
export const stepBack = (time: string, n: number) => new Date(Date.parse(time) - n * 600e3).toISOString().slice(0, 19) + 'Z'

/** Lets the map know whether live clouds are arriving, and from which picture time. */
export const CLOUD_EVENT = 'ls-clouds'
const report = (ok: boolean, time?: string) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CLOUD_EVENT, { detail: { ok, time } })) }

/** Registers the livefill:// (daily picture) and liveclouds:// (live clouds) protocols once. */
export function installLiveProtocol(urls: Urls, backupMaxZoom = 8) {
  if (installed) return
  installed = true

  const canvases = () => {
    const c = makeCanvas(), scratch = makeCanvas()
    const ctx = c.getContext('2d') as Ctx | null, sctx = scratch.getContext('2d') as Ctx | null
    if (!ctx || !sctx) throw new Error('No 2D canvas')
    const read = (img: ImageBitmap, crop?: { sx: number; sy: number; size: number }) => {
      sctx.clearRect(0, 0, 256, 256)
      if (crop) sctx.drawImage(img, crop.sx, crop.sy, crop.size, crop.size, 0, 0, 256, 256)
      else sctx.drawImage(img, 0, 0, 256, 256)
      return sctx.getImageData(0, 0, 256, 256).data
    }
    return { c, ctx, read }
  }

  /** Newest daily picture for a tile: today, the days before, then dimmed Blue Marble. */
  async function daily(date: string, z: number, y: number, x: number, signal: AbortSignal, read: (img: ImageBitmap, crop?: { sx: number; sy: number; size: number }) => Uint8ClampedArray, ctx: Ctx, withBackup = true) {
    let out: ImageData | null = null
    let missing = 256 * 256
    const add = (px: Uint8ClampedArray, dim = 1) => {
      if (!out) out = ctx.createImageData(256, 256) // starts all "no data"
      missing = fillFrom(out.data, px, dim)
    }
    const days = Array.from({ length: LOOKBACK + 1 }, (_, i) => dayBefore(date, i))
    const first = await Promise.all(days.slice(0, 2).map((d, i) => bitmap(urls.live(d, z, y, x), signal, i === 0)))
    for (const img of first) if (img && missing) add(read(img))
    for (const d of days.slice(2)) {
      if (!missing) break
      const img = await bitmap(urls.live(d, z, y, x), signal)
      if (img) add(read(img))
    }
    if (missing && withBackup) {
      const a = ancestor(z, y, x, backupMaxZoom)
      const img = await bitmap(urls.backup(a.z, a.y, a.x), signal)
      if (img) add(read(img, a), BACKUP_DIM)
    }
    return out as ImageData | null
  }

  maplibregl.addProtocol(PROTOCOL, async (params, abort) => {
    const { key: date, z, y, x } = parse(PROTOCOL, params.url)
    const { c, ctx, read } = canvases()
    const out = await daily(date, z, y, x, abort.signal, read, ctx)
    if (!out) throw new Error('No imagery for this tile')
    ctx.putImageData(out, 0, 0)
    return { data: await toBytes(c) }
  })

  /**
   * Finds, once per 10-minute picture, which tile matrix set and picture time each satellite has:
   * the newest picture can be late, so it steps back 10 and then 20 minutes. One small world tile each.
   */
  const probe = (time: string) => {
    let job = probes.get(time)
    if (!job) {
      job = Promise.all(GEO_SATS.map(async s => {
        for (const t of [time, stepBack(time, 1), stepBack(time, 2)]) {
          for (const set of MATRIX_SETS) {
            const ok = await bitmap(urls.geo(s.id, t, set, 0, 0, 0), new AbortController().signal).catch(() => null)
            if (ok) return [s.id, { set, time: t }] as const
          }
        }
        return [s.id, null] as const
      })).then(rows => Object.fromEntries(rows))
      probes.set(time, job)
      if (probes.size > 4) probes.delete(probes.keys().next().value!) // keep the last few
    }
    return job
  }

  // Live clouds: each geostationary satellite's infrared picture as white cloud on transparency.
  maplibregl.addProtocol('liveclouds', async (params, abort) => {
    const { key: time, z, y, x } = parse('liveclouds', params.url)
    const date = /[?&]d=(\d{4}-\d{2}-\d{2})/.exec(params.url)?.[1]
    const { c, ctx, read } = canvases()
    // Satellites that can see some of this tile
    const corners = [[0, 0], [255, 0], [0, 255], [255, 255], [128, 128]].map(([px, py]) => pixelLonLat(z, x, y, px, py))
    const sats = GEO_SATS.filter(s => corners.some(p => viewAngle(p.lat, p.lon, s.lon) < 72))
    const out = ctx.createImageData(256, 256)
    const found = sats.length ? await probe(time) : {}
    const gz = Math.min(z, 6), dz = Math.max(0, z - 6)
    const imgs = await Promise.all(sats.map(s => {
      const f = found[s.id]
      return f ? bitmap(urls.geo(s.id, f.time, f.set, gz, y >> dz, x >> dz), abort.signal) : Promise.resolve(null)
    }))
    let got = 0, newest = ''
    // How well some satellite sees each pixel; the daily picture covers the rest
    const seen = new Float32Array(256 * 256)
    sats.forEach((s, i) => {
      const img = imgs[i]
      if (!img) return
      got++
      const t = found[s.id]!.time
      if (t > newest) newest = t
      const crop = dz ? { sx: (x % (1 << dz)) * (256 >> dz), sy: (y % (1 << dz)) * (256 >> dz), size: 256 >> dz } : undefined
      const w = satWeights(z, x, y, s.lon)
      for (let p = 0; p < w.length; p++) if (w[p] > seen[p]) seen[p] = w[p]
      irToCloud(read(img, crop), out.data, w)
    })
    if (date) {
      const rest = new Float32Array(256 * 256)
      let need = false
      for (let p = 0; p < rest.length; p++) { rest[p] = 1 - seen[p]; if (rest[p] > 0.001) need = true }
      if (need) {
        const day = await daily(date, Math.min(z, 9), y, x, abort.signal, read, ctx, false)
        if (day) visToCloud(day.data, out.data, rest)
      }
    }
    if (sats.length) report(got > 0, newest || time)
    // Add ?lsdebug to the page address to inspect cloud tiles in the console (window.__lsClouds)
    if (typeof location !== 'undefined' && location.search.includes('lsdebug')) {
      let sum = 0
      for (let i = 3; i < out.data.length; i += 4) sum += out.data[i]
      ;((window as unknown as { __lsClouds?: unknown[] }).__lsClouds ??= []).push({ z, x, y, sats: sats.map(s => s.name), got, alpha: Math.round(sum / 255) })
    }
    ctx.putImageData(out, 0, 0)
    return { data: await toBytes(c, 'image/png') }
  })
}
