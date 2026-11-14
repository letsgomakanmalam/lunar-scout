import { describe, expect, it } from 'vitest'
import { MODULES } from './modules'
import { SOURCES } from './sources'
import { ALL_NOTES, ASTRONOMY, ENGINEERING, K, WATER_PER_O2, batteryTonnes, daysToLimit, lightSeconds, moxiesPerPerson, nightEnergyKWh, radiatorWm2 } from './knowledge'

describe('astronomy and engineering notes', () => {
  it('has astronomy for both worlds and an engineering note for every building, all with known sources', () => {
    expect(ASTRONOMY.moon.length).toBeGreaterThanOrEqual(4)
    expect(ASTRONOMY.mars.length).toBeGreaterThanOrEqual(4)
    for (const m of MODULES) expect(ENGINEERING[m.id], m.id).toBeDefined()
    const ids = ALL_NOTES.map(n => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const n of ALL_NOTES) {
      expect(SOURCES.some(s => s.id === n.sourceId), `${n.id} source ${n.sourceId}`).toBe(true)
      expect(n.title.length).toBeGreaterThan(8)
      expect(n.text.length).toBeGreaterThan(80)
      expect(n.text).not.toMatch(/NaN|undefined|Infinity/)
      expect(n.math ?? '').not.toMatch(/NaN|undefined|Infinity/)
    }
  })
  it('gets the sums right', () => {
    expect(lightSeconds(K.moonDistKm)).toBeCloseTo(1.28, 2)
    expect(lightSeconds(K.marsNearKm) / 60).toBeCloseTo(3.0, 1)
    expect(lightSeconds(K.marsFarKm) / 60).toBeCloseTo(22.3, 1)
    expect(nightEnergyKWh(10, K.lunarDayH / 2)).toBeCloseTo(3543.5, 1)
    expect(batteryTonnes(3543.5)).toBeCloseTo(17.7, 1)
    expect(daysToLimit(K.doseMoon)).toBeCloseTo(438, 0)
    expect(daysToLimit(K.doseMars)).toBeCloseTo(937.5, 1)
    expect(radiatorWm2(27)).toBeCloseTo(460, 0)
    expect(radiatorWm2(327) / radiatorWm2(27)).toBeCloseTo(16, 1) // twice the absolute temperature
    expect(WATER_PER_O2).toBeCloseTo(1.126, 3)
    expect(moxiesPerPerson()).toBeCloseTo(2.85, 2)
    expect(K.sunMars / K.sunEarth).toBeCloseTo(0.43, 2)
    expect(K.gMoon / K.gEarth).toBeCloseTo(0.165, 3)
    expect(K.earthKm / K.moonKm).toBeCloseTo(3.67, 2)
  })
  it('writes those results into the sentences', () => {
    const text = (id: string) => ALL_NOTES.find(n => n.id === id)!.text
    expect(text('eng-battery')).toMatch(/3,544 kWh.*roughly 18 tonnes.*123 kWh, about 620 kg/)
    expect(text('eng-habitat')).toMatch(/about 438 days on the Moon or 938 on Mars/)
    expect(text('eng-comms')).toMatch(/1\.28 seconds.*between 3\.0 and 22\.3 minutes/)
    expect(text('mars-sol')).toMatch(/24 h 39 min 35 s/)
    expect(text('mars-sun')).toMatch(/586 W\/m² where Earth gets 1,361: 43%/)
    expect(text('moon-day')).toMatch(/708\.7 hours, about 29\.5 Earth days.*14\.8 days of sunlight/)
    expect(text('eng-oxygen')).toMatch(/1\.13 kg of water.*122 g over 16 runs, up to 12 g an hour.*about 34 g an hour/)
  })
})
