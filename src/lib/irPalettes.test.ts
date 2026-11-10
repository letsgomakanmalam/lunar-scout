import { describe, expect, it } from 'vitest'
import { cleanIrTempC, cloudAlpha, viirsTempK } from './irPalettes'

// Spot checks against entries of NASA GIBS colormaps/v1.3/Clean_Longwave_Infrared_Window_Band.xml (°C, bin centres)
describe('Band 13 palette (GOES and Himawari)', () => {
  it.each([
    [[197, 197, 197], -18.85], [[148, 148, 148], 0.15], [[96, 96, 96], 20.15], [[2, 2, 2], 56.65],
    [[0, 255, 255], -19.35], [[0, 13, 122], -28.85], [[0, 0, 125], -29.35], [[0, 21, 105], -30.35], [[0, 42, 96], -30.85],
    [[0, 64, 86], -31.6], [[0, 234, 10], -39.6], [[0, 255, 0], -40.6], [[230, 255, 0], -49.6], [[255, 255, 0], -50.6],
    [[255, 26, 0], -59.6], [[255, 0, 0], -60.6], [[26, 0, 0], -69.6], [[5, 5, 5], -70.6], [[27, 27, 27], -71.6],
    [[230, 230, 230], -79.6], [[255, 127, 203], -80.6], [[127, 0, 127], -90.6], [[255, 255, 255], -91.6],
  ])('%j decodes to about %d °C', (rgb, c) => {
    expect(cleanIrTempC(rgb[0], rgb[1], rgb[2])).toBeCloseTo(c as number, 0)
  })
  it('tells the cold greys from the warm greys', () => {
    expect(cleanIrTempC(155, 155, 155)).toBeCloseTo(-76.6, 1) // a cold-band grey
    expect(cleanIrTempC(156, 156, 156)).toBeGreaterThan(-5) // its warm neighbour
    expect(Number.isNaN(cleanIrTempC(0, 0, 0))).toBe(true) // outside the disk
  })
})

// Spot checks against VIIRS_Brightness_Temp_BandI5.xml (K): a ramp from dark navy (cold) to white (warm)
describe('VIIRS I5 palette', () => {
  it.each([
    [[0, 0, 22], 180.3], [[60, 61, 137], 210.1], [[143, 95, 152], 240.2], [[180, 117, 142], 260.3],
    [[196, 127, 136], 270.3], [[244, 220, 190], 300.4], [[255, 251, 228], 320.5], [[255, 255, 255], 340],
  ])('%j decodes to about %d K', (rgb, k) => {
    expect(Math.abs(viirsTempK(rgb[0], rgb[1], rgb[2]) - (k as number))).toBeLessThan(4)
  })
  it('reads warm as bright, unlike a weather picture', () => {
    expect(viirsTempK(244, 220, 190)).toBeGreaterThan(viirsTempK(60, 61, 137))
  })
})

describe('cloud from temperature', () => {
  it('keeps warm ground and sea clear and cold cloud tops solid', () => {
    expect(cloudAlpha(300, 3)).toBe(0) // tropical sea
    expect(cloudAlpha(200, 3)).toBe(1) // deep convection
    expect(cloudAlpha(260, 3)).toBeGreaterThan(0.4)
  })
  it('allows for frozen ground near the poles', () => {
    expect(cloudAlpha(243, 75)).toBeLessThan(0.1) // -30 °C snow in polar night: mostly clear
    expect(cloudAlpha(213, 75)).toBeGreaterThan(0.6) // -60 °C cloud top over it
    expect(cloudAlpha(NaN, 0)).toBe(0)
  })
})
