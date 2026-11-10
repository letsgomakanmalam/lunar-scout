/**
 * "Live satellite" tiles without black holes.
 *
 * NASA's daily VIIRS picture (through GIBS) is black wherever it has no daytime data:
 *   - polar night, such as the whole Arctic from November to February;
 *   - the last orbits of a day that is still being processed, which cross the Pacific near the
 *     date line (this is the black wedge that shows when the newest day is used too early).
 * We use the newest COMPLETE day, and draw each tile over NASA's Blue Marble: where the daily picture
 * is black, a dimmed Blue Marble shows through, so it reads as "no live picture here" instead of a
 * broken map. Tiles are composited in the browser through a MapLibre custom protocol.
 */
import maplibregl from 'maplibre-gl'

export const PROTOCOL = 'livefill'

/** NASA's near-real-time pictures arrive within about 3 hours, so a UTC day is complete about 4 hours after it ends. */
export function liveDate(now: Date = new Date()): string {
  return new Date(now.getTime() - 28 * 3600e3).toISOString().slice(0, 10)
}

export const liveTileUrl = (date: string) => `${PROTOCOL}://${date}/{z}/{y}/{x}`

/**
 * Replaces no-data black in a daily tile with a dimmed backup (Blue Marble) pixel, in place.
 * Dark ocean is never pure black, so only near-zero pixels (allowing for JPEG noise) are swapped.
 * Returns how many pixels were filled.
 */
export function fillGaps(live: Uint8ClampedArray, backup: Uint8ClampedArray | null, dim = 0.55): number {
  let filled = 0
  for (let i = 0; i < live.length; i += 4) {
    const r = live[i], g = live[i + 1], b = live[i + 2]
    if (r + g + b > 18 || r > 8 || g > 8 || b > 8) continue
    filled++
    if (!backup) continue
    live[i] = backup[i] * dim
    live[i + 1] = backup[i + 1] * dim
    live[i + 2] = backup[i + 2] * dim
  }
  return filled
}

/** Where a tile sits inside its ancestor at a coarser zoom (Blue Marble stops at zoom 8). */
export function ancestor(z: number, y: number, x: number, maxZ: number) {
  const dz = Math.max(0, z - maxZ)
  const n = 1 << dz
  const size = 256 / n
  return { z: z - dz, y: y >> dz, x: x >> dz, sx: (x % n) * size, sy: (y % n) * size, size }
}

type Canvas = OffscreenCanvas | HTMLCanvasElement
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
async function bitmap(url: string, signal: AbortSignal): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    return null
  }
}

let installed = false

/**
 * Registers the `livefill://date/z/y/x` protocol once.
 * live(date, z, y, x) and backup(z, y, x) give the real tile URLs; backupMaxZoom is the backup's deepest level.
 */
export function installLiveProtocol(live: (date: string, z: number, y: number, x: number) => string, backup: (z: number, y: number, x: number) => string, backupMaxZoom = 8) {
  if (installed) return
  installed = true
  maplibregl.addProtocol(PROTOCOL, async (params, abort) => {
    const m = /^livefill:\/\/(\d{4}-\d{2}-\d{2})\/(\d+)\/(\d+)\/(\d+)/.exec(params.url)
    if (!m) throw new Error(`Bad live tile address: ${params.url}`)
    const [, date, zs, ys, xs] = m
    const z = Number(zs), y = Number(ys), x = Number(xs)
    const a = ancestor(z, y, x, backupMaxZoom)
    const [day, back] = await Promise.all([bitmap(live(date, z, y, x), abort.signal), bitmap(backup(a.z, a.y, a.x), abort.signal)])
    if (!day && !back) throw new Error('No imagery for this tile')
    const c = makeCanvas()
    const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) throw new Error('No 2D canvas')
    if (!day) {
      ctx.drawImage(back!, a.sx, a.sy, a.size, a.size, 0, 0, 256, 256) // no daily picture yet: plain Blue Marble
      return { data: await toBytes(c) }
    }
    ctx.drawImage(day, 0, 0, 256, 256)
    const img = ctx.getImageData(0, 0, 256, 256)
    let fill: Uint8ClampedArray | null = null
    if (back) {
      const bc = makeCanvas()
      const bctx = bc.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
      if (bctx) {
        bctx.drawImage(back, a.sx, a.sy, a.size, a.size, 0, 0, 256, 256)
        fill = bctx.getImageData(0, 0, 256, 256).data
      }
    }
    if (fillGaps(img.data, fill) > 0 && fill) ctx.putImageData(img, 0, 0)
    return { data: await toBytes(c) }
  })
}
