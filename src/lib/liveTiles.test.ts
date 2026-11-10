import { describe, expect, it } from 'vitest'
import { ancestor, countNoData, dayBefore, fillFrom, liveStamp, liveTileUrl, localDay } from './liveTiles'

describe('live satellite tiles', () => {
  it("follows the computer's own date and refreshes every hour", () => {
    const at = new Date(2026, 10, 10, 8, 30) // 10 Nov, 08:30 on this computer's clock
    expect(localDay(at)).toBe('2026-11-10')
    expect(liveStamp(at)).toEqual({ date: '2026-11-10', refresh: '2026-11-10T08' })
    expect(liveStamp(new Date(2026, 10, 10, 9, 1)).refresh).toBe('2026-11-10T09')
    expect(liveTileUrl('2026-11-10', '2026-11-10T08')).toBe('livefill://2026-11-10/{z}/{y}/{x}?r=2026-11-10T08')
  })
  it('steps back through days across month and year ends', () => {
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
    expect(dayBefore('2026-01-01', 2)).toBe('2025-12-30')
  })
  it('fills only no-data pixels, never dark ocean, and only from sources that have data', () => {
    const dst = new Uint8ClampedArray([0, 0, 0, 0, 3, 4, 2, 255, 10, 20, 40, 255, 0, 0, 0, 0])
    const src = new Uint8ClampedArray([100, 150, 200, 255, 100, 150, 200, 255, 100, 150, 200, 255, 0, 0, 0, 255])
    expect(countNoData(dst)).toBe(3)
    expect(fillFrom(dst, src, 0.5, 4, 1, 0)).toBe(1) // the last pixel stays empty: the source has no data there either
    expect(Array.from(dst.slice(0, 8))).toEqual([50, 75, 100, 255, 50, 75, 100, 255])
    expect(Array.from(dst.slice(8, 12))).toEqual([10, 20, 40, 255]) // dark ocean untouched
    expect(fillFrom(new Uint8ClampedArray([0, 0, 0, 255]), null, 1, 1, 1)).toBe(1)
  })
  it('also fills the dark JPEG fringe around a gap, but not dark pixels further away', () => {
    // a row of 7: gap, dark fringe, three normal pixels, dark ocean 5 pixels from the gap, normal
    const row = [0, 0, 0, 20, 20, 20, 100, 100, 100, 100, 100, 100, 100, 100, 100, 10, 20, 40, 100, 100, 100]
    const dst = new Uint8ClampedArray(row.flatMap((v, i) => (i % 3 === 2 ? [v, 255] : [v])))
    const src = new Uint8ClampedArray(7 * 4).fill(200)
    expect(fillFrom(dst, src, 1, 7, 1, 2)).toBe(0)
    expect(Array.from(dst.slice(0, 8))).toEqual([200, 200, 200, 255, 200, 200, 200, 255]) // gap and its fringe filled
    expect(Array.from(dst.slice(20, 24))).toEqual([10, 20, 40, 255]) // distant dark ocean kept
  })
  it('finds the Blue Marble ancestor tile beyond its deepest zoom', () => {
    expect(ancestor(5, 10, 20, 8)).toEqual({ z: 5, y: 10, x: 20, sx: 0, sy: 0, size: 256 })
    expect(ancestor(9, 5, 3, 8)).toEqual({ z: 8, y: 2, x: 1, sx: 128, sy: 128, size: 128 })
  })
})

import { btToCloud, cloudStamp, cloudTileUrl, geoWeight, irToCloud, pixelLonLat, stepBack, viewAngle } from './liveTiles'

describe('live clouds', () => {
  it('asks for the newest 10-minute picture that should exist, about 30 minutes back', () => {
    expect(cloudStamp(new Date('2026-11-10T00:30:00Z'))).toBe('2026-11-10T00:00:00Z')
    expect(cloudStamp(new Date('2026-11-10T00:39:59Z'))).toBe('2026-11-10T00:00:00Z')
    expect(cloudStamp(new Date('2026-11-10T00:40:00Z'))).toBe('2026-11-10T00:10:00Z')
    expect(stepBack('2026-11-10T00:00:00Z', 1)).toBe('2026-11-09T23:50:00Z')
    expect(cloudTileUrl('2026-11-10T00:00:00Z', '2026-11-10')).toBe('liveclouds://2026-11-10T00:00:00Z/{z}/{y}/{x}?d=2026-11-10')
  })
  it('knows where geostationary satellites see well', () => {
    expect(geoWeight(3.14, 101.69)).toBe(1) // Kuala Lumpur: Himawari
    expect(geoWeight(19.4, -99.1)).toBe(1) // Mexico City: GOES-East
    expect(geoWeight(0, -170)).toBe(1) // central Pacific: GOES-West
    expect(geoWeight(51.5, 0)).toBe(0) // London: none of them
    expect(geoWeight(-1.3, 36.8)).toBe(0) // Nairobi: none of them
    expect(viewAngle(0, 140.7, 140.7)).toBeCloseTo(0, 5)
  })
  it('places tile pixels correctly', () => {
    const p = pixelLonLat(0, 0, 0, 128, 128)
    expect(p.lon).toBeCloseTo(0.7, 0)
    expect(p.lat).toBeCloseTo(-0.7, 0)
    expect(pixelLonLat(0, 0, 0, 0, 0).lat).toBeGreaterThan(84.9) // half a pixel below the 85.05° map edge
  })
  it('turns cold infrared into white cloud and warm ground into transparency (GIBS Band 13 palette)', () => {
    // warm grey (+42 °C ground), cold grey (-79.6 °C), mid grey (-12 °C), outside the disk
    const ir = new Uint8ClampedArray([40, 40, 40, 255, 230, 230, 230, 255, 180, 180, 180, 255, 255, 255, 255, 0])
    const out = new Uint8ClampedArray(16)
    irToCloud(ir, out)
    expect(out[3]).toBe(0)
    expect(out[7]).toBeGreaterThan(220)
    expect(out[11]).toBeGreaterThan(60)
    expect(out[11]).toBeLessThan(180)
    expect(out[15]).toBe(0)
    const half = new Uint8ClampedArray(16)
    irToCloud(ir, half, new Float32Array([1, 0.5, 1, 1]))
    expect(half[7]).toBeLessThan(out[7]) // near the disk edge clouds fade
  })
  it('draws the coldest storm tops as solid cloud, not holes', () => {
    // dark red (-69.6 °C), red (-60.6), near-black (-70.6), magenta (-90.6): dark colours, coldest clouds
    const ir = new Uint8ClampedArray([26, 0, 0, 255, 255, 0, 0, 255, 5, 5, 5, 255, 127, 0, 127, 255])
    const out = new Uint8ClampedArray(16)
    irToCloud(ir, out)
    for (const i of [3, 7, 11, 15]) expect(out[i]).toBeGreaterThan(220)
  })
  it('fills VIIRS infrared clouds only where nothing else has data', () => {
    // VIIRS palette: navy = 190 K (cold cloud), beige = 300 K (warm ground), no data
    const px = new Uint8ClampedArray([19, 33, 100, 255, 244, 220, 190, 255, 0, 0, 0, 0])
    const out = new Uint8ClampedArray(12)
    const covered = new Uint8Array(3)
    const left = btToCloud(px, out, new Float32Array([1, 1, 1]), new Float32Array(256), covered)
    expect(out[3]).toBeGreaterThan(220)
    expect(out[7]).toBe(0)
    expect(left).toBe(1) // the empty pixel still needs an older pass
    expect(Array.from(covered)).toEqual([1, 1, 0])
  })
})
