import { describe, expect, it } from 'vitest'
import { moonTextureSteps, runToEnd } from './moonTexture'
import { prepareGlobe, projectToView, renderMoon } from './globe'

const tex = runToEnd(moonTextureSteps(256))

/** Mean brightness (0..255) of the texture in a small lat/lon box. */
function meanAlbedo(lat: number, lon: number, half = 3) {
  let sum = 0
  let n = 0
  for (let la = lat - half; la <= lat + half; la += 0.5) {
    for (let lo = lon - half; lo <= lon + half; lo += 0.5) {
      const j = Math.min(tex.h - 1, Math.floor(((90 - la) / 180) * tex.h))
      const i = Math.min(tex.w - 1, Math.floor(((lo + 180) / 360) * tex.w))
      sum += tex.albedo[j * tex.w + i]
      n++
    }
  }
  return sum / n
}

describe('title-screen Moon', () => {
  it('is the same every time (seeded)', () => {
    expect(runToEnd(moonTextureSteps(256)).albedo).toEqual(tex.albedo)
  })

  it('draws the maria darker than the highlands, at their real positions', () => {
    const highlands = meanAlbedo(-30, 5)
    const maria = [['Tranquillitatis', 8.5, 31.4], ['Imbrium', 32.8, -15.6], ['Crisium', 17, 59.1], ['Serenitatis', 28, 17.5]] as const
    for (const [name, lat, lon] of maria) expect(meanAlbedo(lat, lon), name).toBeLessThan(highlands - 30)
  })

  it('puts the view centre in the middle and hides the far side', () => {
    const c = projectToView(20, 30, 30, 20)!
    expect(c.x).toBeCloseTo(0.5, 6)
    expect(c.y).toBeCloseTo(0.5, 6)
    expect(projectToView(20, 210, 30, 20)).toBeNull()
  })

  it('renders an opaque disc and leaves the corners empty', () => {
    const size = 64
    const prep = prepareGlobe(size, 0, [-0.5, 0.2, 0.8], tex.w, tex.h)
    const out = new Uint8ClampedArray(size * size * 4)
    renderMoon(prep, tex, 0, out)
    const alphaAt = (x: number, y: number) => out[(y * size + x) * 4 + 3]
    expect(alphaAt(32, 32)).toBe(255)
    expect(alphaAt(0, 0)).toBe(0)
  })
})
