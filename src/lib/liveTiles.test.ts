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
