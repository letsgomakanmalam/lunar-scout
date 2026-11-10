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
 * tile edges. Tiles are composited in the browser through a MapLibre custom protocol.
 */
import maplibregl from 'maplibre-gl'

export const PROTOCOL = 'livefill'
/** How many earlier days fill the places today's orbits have not reached */
export const LOOKBACK = 2
/** Brightness of Blue Marble where there is no recent picture (it reads as "no live picture here") */
export const BACKUP_DIM = 0.55

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

type Canvas = OffscreenCanvas | HTMLCanvasElement
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
const makeCanvas = (): Canvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(256, 256)
  const c = document.createElement('canvas')
  c.width = c.height = 256
  return c
}
const toBytes = async (c: Canvas): Promise<ArrayBuffer> => {
  if ('convertToBlob' in c) return (await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()
  const blob = await new Promise<Blob | null>(res => (c as HTMLCanvasElement).toBlob(res, 'image/jpeg', 0.9))
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

let installed = false

/**
 * Registers the `livefill://date/z/y/x` protocol once. live(date, z, y, x) and backup(z, y, x)
 * give the real tile URLs; backupMaxZoom is the backup's deepest level.
 */
export function installLiveProtocol(live: (date: string, z: number, y: number, x: number) => string, backup: (z: number, y: number, x: number) => string, backupMaxZoom = 8) {
  if (installed) return
  installed = true
  maplibregl.addProtocol(PROTOCOL, async (params, abort) => {
    const m = /^livefill:\/\/(\d{4}-\d{2}-\d{2})\/(\d+)\/(\d+)\/(\d+)/.exec(params.url)
    if (!m) throw new Error(`Bad live tile address: ${params.url}`)
    const [, date, zs, ys, xs] = m
    const z = Number(zs), y = Number(ys), x = Number(xs)
    const c = makeCanvas(), scratch = makeCanvas()
    const ctx = c.getContext('2d') as Ctx | null, sctx = scratch.getContext('2d') as Ctx | null
    if (!ctx || !sctx) throw new Error('No 2D canvas')
    const read = (img: ImageBitmap, crop?: { sx: number; sy: number; size: number }) => {
      sctx.clearRect(0, 0, 256, 256)
      if (crop) sctx.drawImage(img, crop.sx, crop.sy, crop.size, crop.size, 0, 0, 256, 256)
      else sctx.drawImage(img, 0, 0, 256, 256)
      return sctx.getImageData(0, 0, 256, 256).data
    }
    let out: ImageData | null = null
    let missing = 256 * 256
    const add = (px: Uint8ClampedArray, dim = 1) => {
      if (!out) { out = ctx.createImageData(256, 256) } // starts all "no data"
      missing = fillFrom(out.data, px, dim)
    }

    // Newest first: today (fresh) and yesterday together, then older days only while gaps remain
    const days = Array.from({ length: LOOKBACK + 1 }, (_, i) => dayBefore(date, i))
    const first = await Promise.all(days.slice(0, 2).map((d, i) => bitmap(live(d, z, y, x), abort.signal, i === 0)))
    for (const img of first) if (img && missing) add(read(img))
    for (const d of days.slice(2)) {
      if (!missing) break
      const img = await bitmap(live(d, z, y, x), abort.signal)
      if (img) add(read(img))
    }
    if (missing) {
      const a = ancestor(z, y, x, backupMaxZoom)
      const img = await bitmap(backup(a.z, a.y, a.x), abort.signal)
      if (img) add(read(img, a), BACKUP_DIM)
    }
    if (!out) throw new Error('No imagery for this tile')
    ctx.putImageData(out, 0, 0)
    return { data: await toBytes(c) }
  })
}
