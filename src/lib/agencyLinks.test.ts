import { describe, expect, it } from 'vitest'
import { agencyLinks } from './agencyLinks'

describe('agency data links', () => {
  it('covers NASA and the three partner agencies the challenge names, with safe links', () => {
    const l = agencyLinks(-24.08, -70.17)
    for (const a of ['NASA', 'ESA', 'CSA', 'JAXA']) expect(l.some(x => x.name.includes(a)), a).toBe(true)
    for (const x of l) expect(x.url.startsWith('https://')).toBe(true)
    expect(l[0].url).toContain('v=-73.170,-25.580,-67.170,-22.580')
    expect(l[2].url).toContain('lat=-24.080&lng=-70.170')
  })
  it('keeps the view box on the globe at the poles and the date line', () => {
    const [wv] = agencyLinks(89.5, 179.5)
    const [w, s, e, n] = wv.url.split('v=')[1].split(',').map(Number)
    expect(w).toBeLessThan(e)
    expect(e).toBeLessThanOrEqual(180)
    expect(n).toBeLessThanOrEqual(90)
    expect(s).toBeLessThan(n)
  })
})
