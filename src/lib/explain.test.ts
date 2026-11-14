import { describe, expect, it } from 'vitest'
import { EARTH_SITES } from '../data/earthSites'
import { TARGETS, targetById } from '../data/targets'
import { FACTOR_KEYS } from '../data/types'
import { probeSite } from './probe'
import { computeASI } from './scoring'
import { profileMission } from './twins'
import { REHEARSE, TEST_LABEL, compareTwins, explainTwin, pointRows, testsFor, whereToTest } from './explain'

const site = (id: string) => EARTH_SITES.find(s => s.id === id)!

describe('ask why', () => {
  it('splits the score into points that add up to the Analog Similarity Index', () => {
    for (const t of TARGETS) for (const s of EARTH_SITES) {
      const { rows, asi } = pointRows(s, t)
      const earned = rows.reduce((a, r) => a + r.earned, 0), carried = rows.reduce((a, r) => a + r.carries, 0)
      expect(carried).toBeCloseTo(100, 6)
      expect(Math.round(Number(earned.toFixed(6)))).toBe(asi)
      for (const r of rows) expect(r.earned + r.lost).toBeCloseTo(r.carries, 9)
    }
  })
  it('explains a strong match with its reasons, its gap, its processes and what to rehearse', () => {
    const e = explainTwin(site('haughton'), targetById('shackleton'))
    expect(e.asi).toBe(computeASI(site('haughton'), targetById('shackleton'), profileMission(targetById('shackleton'))).asi)
    expect(e.verdict).toMatch(/Haughton Crater.*strong match for Connecting Ridge, Shackleton \(83 of 100\)/)
    expect(e.why.length).toBeGreaterThan(1)
    expect(e.why.every(p => p.tone === 'good' && /earns \d+ points? of \d+/.test(p.title))).toBe(true)
    expect(e.whyNot[0].title).toMatch(/Highland rock \(anorthosite\): loses \d+ points/)
    expect(e.notes.find(n => n.title === 'Same processes at work')!.text).toMatch(/impact cratering and ice and frozen ground/)
    expect(e.notes.some(n => n.title === 'What to rehearse here')).toBe(true)
    expect(e.notes.find(n => n.title === 'How far to trust this')!.text).toMatch(/team estimates|measured or computed/)
  })
  it('says so when a match is in conditions only, and when there is nothing to compare', () => {
    const e = explainTwin(site('mulu'), targetById('shackleton'))
    expect(e.verdict).toMatch(/poor match/)
    expect(e.notes[0].title).toBe('Alike in conditions only')
    expect(e.whyNot.length).toBe(3)
    // A probe with no measurements at all for this profile
    const empty = probeSite('probe-none', 10, 10, null, {})
    for (const k of FACTOR_KEYS) empty.factors[k] = { ...empty.factors[k], value: null }
    const none = explainTwin(empty, targetById('gale'))
    expect(none.asi).toBeNull()
    expect(none.verdict).toMatch(/cannot be compared/)
  })
  it('never invents a number: every figure in the text comes from the data', () => {
    const t = targetById('gale'), s = site('qaidam')
    const e = explainTwin(s, t)
    const { rows } = pointRows(s, t)
    for (const p of [...e.why, ...e.whyNot]) {
      const n = Number(/(?:earns|loses) (\d+)/.exec(p.title)![1])
      expect(rows.some(r => Math.round(r.earned) === n || Math.round(r.lost) === n)).toBe(true)
    }
    expect(explainTwin(s, t)).toEqual(e) // same question, same answer
  })
  it('compares two sites: who wins, on what, and whether to visit both', () => {
    const t = targetById('shackleton')
    const c = compareTwins(site('haughton'), site('kamestastin'), t)
    expect(c.verdict).toMatch(/^Haughton Crater, Devon Island beats Kamestastin .* by \d+ points \(83 against 55\)/)
    expect(c.bLeads[0].key).toBe('anorthosite') // the Labrador crater is in lunar-highland rock
    expect(c.together).toBeGreaterThan(Math.max(...c.alone))
    expect(c.advice).toMatch(/^Use both: together they cover \d+%/)
    const back = compareTwins(site('kamestastin'), site('haughton'), t)
    expect(back.aLeads).toEqual(c.bLeads)
    expect(back.verdict).toMatch(/^Haughton Crater, Devon Island beats/)
    const same = compareTwins(site('atacama'), site('atacama'), targetById('oxia'))
    expect(same.verdict).toMatch(/score the same/)
    expect(same.advice).toMatch(/adds little/)
  })
  it('has something to rehearse for every factor', () => {
    for (const k of FACTOR_KEYS) { expect(REHEARSE[k].length).toBeGreaterThan(15); expect(TEST_LABEL[k]).toBeTruthy() }
  })
  it('says where to rehearse one kind of test, and only offers tests the site really calls for', () => {
    const moon = targetById('shackleton')
    expect(testsFor(moon).slice(0, 2).sort()).toEqual(['cold', 'lowsun']) // the two heaviest parts of the Moon Base profile
    expect(testsFor(moon)).not.toContain('wind') // no wind on the Moon
    expect(testsFor(moon)).not.toContain('caves')
    expect(testsFor(targetById('utopia'))).toContain('wind')
    const a = whereToTest(moon, EARTH_SITES, 'anorthosite')
    expect(a.picks[0].site.id).toBe('kamestastin')
    expect(a.text).toMatch(/^To rehearse reading the pale highland rock .* go to Kamestastin/)
    expect(a.text).toMatch(/Next best: /)
    const d = whereToTest(targetById('utopia'), EARTH_SITES, 'wind')
    expect(d.picks[0].site.id).toBe('qaidam')
    for (let i = 1; i < d.picks.length; i++) expect(d.picks[i].sim).toBeLessThanOrEqual(d.picks[i - 1].sim)
    expect(whereToTest(moon, EARTH_SITES, 'wind').picks).toEqual([])
  })
})
