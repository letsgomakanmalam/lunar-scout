import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SITE_ENV, simulateBase, sunAt } from './baseSim'
import { emptyGrid, type BaseGrid } from './base'
import { targetById } from '../data/targets'
import type { ModuleId } from '../data/types'
import BaseSim from '../components/BaseSim'

const make = (mods: [ModuleId, 1 | 2][]): BaseGrid => {
  const g = emptyGrid()
  mods.forEach(([id, level], i) => { g[i] = { id, level } })
  return g
}
const run = (site: string, mods: [ModuleId, 1 | 2][]) => simulateBase(make(mods), targetById(site))

describe('site light', () => {
  it('reproduces the published illumination of the Shackleton ridge: about 88%, dark spells of 3 to 5 days', () => {
    let lit = 0, dark = 0, longest = 0
    const year = Math.round(346.6 * 24)
    for (let h = 0; h < year; h++) {
      if (sunAt(SITE_ENV.shackleton, -89.44, h).dark) { dark++; longest = Math.max(longest, dark) } else { lit++; dark = 0 }
    }
    expect(lit / year).toBeGreaterThan(0.86)
    expect(lit / year).toBeLessThan(0.91)
    expect(longest / 24).toBeGreaterThanOrEqual(3)
    expect(longest / 24).toBeLessThanOrEqual(5)
  })
  it('gives Marius Hills a two-week night first, then a two-week day', () => {
    expect(sunAt(SITE_ENV['marius-hills'], 14.09, 7 * 24).dark).toBe(true)
    expect(sunAt(SITE_ENV['marius-hills'], 14.09, 22 * 24).dark).toBe(false)
  })
  it('dims Martian noon in the dust storm', () => {
    const noon = (sol: number) => sunAt(SITE_ENV.jezero, 18.38, Math.round((sol + 0.5) * 24.66)).light
    expect(noon(26)).toBeLessThan(noon(5) * 0.5)
  })
})

describe('mission simulation', () => {
  it('fails a small solar base in the first polar dark spell, and says how much storage it needs', () => {
    const r = run('shackleton', [['habitat', 1], ['power', 1], ['power', 1], ['battery', 1], ['pad', 1]])
    expect(r.failed?.cause).toBe('power')
    expect(r.failed!.hour / 24).toBeLessThan(10)
    expect(r.advice[0]).toMatch(/battery bank/)
  })
  it('asks for more power, not batteries, when the base is short even in sunlight', () => {
    const r = run('shackleton', [['habitat', 2], ['habitat', 1], ['power', 2], ['power', 2], ['battery', 2], ['farm', 1], ['ice', 1], ['oxygen', 1], ['pad', 1]])
    expect(r.sunUsed).toBeGreaterThan(r.sunMade)
    expect(r.advice[0]).toMatch(/solar array/)
    expect(r.advice[0]).not.toMatch(/battery bank/)
    expect(r.deficitKWh).toBeLessThan(10000) // one dark spell (about 5,400 kWh at 48 kW), not all 60 days (27,000+)
  })
  it('lets fuel cells carry a solar base through the dark', () => {
    const r = run('shackleton', [['habitat', 1], ['power', 2], ['power', 2], ['battery', 2], ['battery', 2], ['battery', 2], ['battery', 2], ['battery', 2], ['pad', 1]])
    expect(r.failed).toBeNull()
    expect(r.minSoc.value).toBeGreaterThan(0)
  })
  it('keeps a reactor base powered and growing its own oxygen and water', () => {
    const r = run('shackleton', [['habitat', 2], ['power', 1], ['reactor', 1], ['ice', 1], ['oxygen', 1], ['farm', 1], ['pad', 1]])
    expect(r.failed).toBeNull()
    expect(r.crew).toBe(4)
    expect(r.o2[r.hours]).toBeGreaterThan(r.o2[0])
  })
  it('shields the crew in a lava tube and behind printed berms', () => {
    const tube = run('marius-hills', [['habitat', 1], ['reactor', 1], ['pad', 1]])
    const open = run('shackleton', [['habitat', 1], ['reactor', 1], ['pad', 1]])
    const bermed = run('shackleton', [['habitat', 1], ['reactor', 1], ['pad', 1], ['printer', 2]])
    expect(tube.dose[tube.hours]).toBeLessThan(open.dose[open.hours] * 0.1)
    expect(bermed.dose[bermed.hours]).toBeCloseTo(open.dose[open.hours] * 0.5, 0)
  })
  it('runs out of supplies without a landing pad or local production', () => {
    const r = run('mons-mouton', [['habitat', 1], ['reactor', 1]])
    expect(r.failed?.cause).toBe('oxygen')
    expect(r.failed!.hour / 24).toBeCloseTo(30, 0)
  })
  it('shows why Mars bases need fission power', () => {
    const solar = run('jezero', [['habitat', 1], ['power', 2], ['power', 2], ['power', 2], ['battery', 2], ['pad', 1]])
    expect(solar.failed?.cause).toBe('power')
    expect(solar.advice[0]).toMatch(/fission/)
    expect(run('arcadia', [['habitat', 1], ['reactor', 1], ['pad', 1]]).failed).toBeNull()
  })
  it('asks for a habitat when there is no crew', () => {
    const r = run('shackleton', [['power', 1]])
    expect(r.crew).toBe(0)
    expect(r.failed).toBeNull()
    expect(r.advice[0]).toMatch(/habitat/)
  })
  it('renders the panel', () => {
    const html = renderToStaticMarkup(createElement(BaseSim, { grid: make([['habitat', 1], ['power', 1], ['battery', 1]]), site: targetById('shackleton'), onSun: () => {} }))
    expect(html).toContain('What would help')
    expect(html).toContain('Day ')
  })
})
