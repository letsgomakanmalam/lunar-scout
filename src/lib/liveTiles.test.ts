import { describe, expect, it } from 'vitest'
import { ancestor, fillGaps, liveDate, liveTileUrl } from './liveTiles'

describe('live satellite tiles', () => {
  it('uses the newest complete UTC day, never one still being processed', () => {
    expect(liveDate(new Date('2026-11-10T00:30:00Z'))).toBe('2026-11-08') // 08:30 in Kuala Lumpur: 9 Nov is not finished yet
    expect(liveDate(new Date('2026-11-10T05:00:00Z'))).toBe('2026-11-09')
    expect(liveDate(new Date('2026-11-10T23:59:00Z'))).toBe('2026-11-09')
    expect(liveTileUrl('2026-11-09')).toBe('livefill://2026-11-09/{z}/{y}/{x}')
  })
  it('fills only no-data black, never dark ocean', () => {
    const live = new Uint8ClampedArray([0, 0, 0, 255, 3, 4, 2, 255, 10, 20, 40, 255, 200, 180, 160, 255])
    const back = new Uint8ClampedArray([100, 150, 200, 255, 100, 150, 200, 255, 100, 150, 200, 255, 100, 150, 200, 255])
    expect(fillGaps(live, back, 0.5)).toBe(2)
    expect(Array.from(live.slice(0, 8))).toEqual([50, 75, 100, 255, 50, 75, 100, 255]) // black and JPEG-noise black filled, dimmed
    expect(Array.from(live.slice(8, 16))).toEqual([10, 20, 40, 255, 200, 180, 160, 255]) // dark ocean and land untouched
    expect(fillGaps(new Uint8ClampedArray([0, 0, 0, 255]), null)).toBe(1)
  })
  it('finds the Blue Marble ancestor tile beyond its deepest zoom', () => {
    expect(ancestor(5, 10, 20, 8)).toEqual({ z: 5, y: 10, x: 20, sx: 0, sy: 0, size: 256 })
    expect(ancestor(9, 5, 3, 8)).toEqual({ z: 8, y: 2, x: 1, sx: 128, sy: 128, size: 128 })
  })
})
