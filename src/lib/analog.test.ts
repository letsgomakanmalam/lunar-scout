import { describe, expect, it } from 'vitest'
import { dayLength, declination, grazingDays, lightWindows, lowSunValue, lunarMaxSun, noonHeight } from './sun'
import { windFactor, climateFactors, craterFactor, looksLikeSea, ndviFactor, parseElevations, parseMacrostrat, parseNdvi, parsePower, probeFactors, probeSite, reliefFactor, reliefGrid, rockFactors } from './probe'
import { elevationUrl, geologyUrl, ndviUrl, parsePlace, powerUrl, runProbe } from './probeFetch'
import { coverage, planCampaign, rankTwins } from './twins'
import { passportJson, passportMarkdown, slug, twinReportMarkdown, matchesFor } from './passport'
import { EARTH_SITES } from '../data/earthSites'
import { TARGETS, targetById } from '../data/targets'
import { FACTOR_KEYS, FACTOR_LABELS } from '../data/types'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const monthly = (vals: number[], ann: number) => ({ ...Object.fromEntries(MONTHS.map((m, i) => [m, vals[i]])), ANN: ann })
const POWER = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [-70.17, -24.08, 1200.5] },
  properties: { parameter: {
    T2M: monthly([20, 20, 19, 17, 15, 13, 12, 13, 14, 16, 18, 19], 16.2),
    T2M_MIN: monthly([8, 8, 6, 3, 1, -1, -2.5, -1, 0, 3, 5, 7], -3.0),
    T2M_RANGE: { ANN: 17.4 },
    PRECTOTCORR: { ANN: 0.01 },
  } },
  header: { fill_value: -999 },
  parameters: { PRECTOTCORR: { units: 'mm/day' } },
}
const MACRO = { success: { v: 2, data: [
  { map_id: 1, scale: 'small', name: 'Mesozoic rocks', lith: 'Major:{sandstone}' },
  { map_id: 2, scale: 'large', name: 'Snake River Group', lith: 'Major:{basalt}', descrip: 'olivine basalt flows' },
] } }
const NDVI = { subset: [{ band: '250m_16_days_NDVI', data: [1000, 1200, -3000, 800] }] }
const PLACE = { features: [{ properties: { name: 'Yungay', state: 'Antofagasta', country: 'Chile' } }] }

describe('sun geometry', () => {
  it('gets declination and noon height right at the solstices and equinox', () => {
    expect(declination(172)).toBeCloseTo(23.44, 0)
    expect(declination(355)).toBeCloseTo(-23.44, 0)
    expect(Math.abs(declination(80))).toBeLessThan(1)
    expect(noonHeight(0, 80)).toBeGreaterThan(89)
    expect(dayLength(0, 80)).toBeCloseTo(12.1, 0)
    expect(dayLength(78, 172)).toBe(24)
    expect(dayLength(78, 355)).toBe(0)
  })
  it('finds low-Sun seasons only at high latitudes', () => {
    expect(grazingDays(0)).toHaveLength(0)
    expect(grazingDays(45)).toHaveLength(0)
    const svalbard = grazingDays(78).length
    expect(svalbard).toBeGreaterThan(30)
    expect(svalbard).toBeLessThan(45)
    expect(lowSunValue(10)).toBe(0)
    expect(lowSunValue(78)).toBeGreaterThan(0.9)
  })
  it('merges a season that runs over New Year into one window', () => {
    const w = lightWindows(66.5)
    expect(w).toHaveLength(1)
    expect(w[0].label).toMatch(/Nov.*Feb/)
  })
  it('knows how high the Sun gets at lunar south-pole sites', () => {
    expect(lunarMaxSun(-89.44)).toBeCloseTo(2.1, 1)
    expect(lunarMaxSun(-84.6)).toBeCloseTo(6.94, 1)
  })
})

describe('field probe converters', () => {
  it('reads NASA POWER climatology, including units and fill values', () => {
    const c = parsePower(POWER)!
    expect(c.meanC).toBe(16.2)
    expect(c.minC).toBe(-2.5)
    expect(c.rangeC).toBe(17.4)
    expect(c.rainMm).toBeCloseTo(3.65, 1)
    expect(c.elevation).toBe(1200.5)
    const f = climateFactors(c)
    expect(f.thermal!.value).toBeCloseTo(0.827, 2)
    expect(f.cold!.value).toBe(0)
    expect(f.ice!.value).toBe(0)
    expect(f.aridity!.value).toBeGreaterThan(0.99)
    expect(f.aridity!.estimate).toBe(false)
    const filled = parsePower({ ...POWER, properties: { parameter: { T2M: { ANN: -999 } } } })!
    expect(filled.meanC).toBeNull()
    expect(parsePower({ nope: 1 })).toBeNull()
  })
  it('treats a frozen place as cold with ground ice', () => {
    const f = climateFactors({ meanC: -20, rangeC: 6, minC: -50, rainMm: 30, elevation: 100 })
    expect(f.cold!.value).toBe(1)
    expect(f.ice!.value).toBe(1)
    expect(f.ice!.raw).toMatch(/permafrost very likely/)
  })
  it('builds a 5 x 5 terrain grid and turns relief into roughness', () => {
    const grid = reliefGrid(10, 20)
    expect(grid).toHaveLength(25)
    expect(Math.max(...grid.map(p => p.lat)) - Math.min(...grid.map(p => p.lat))).toBeCloseTo(4 / 111.32, 3)
    expect(parseElevations({ elevation: [1, 2, 'x', 4] })).toEqual([1, 2, 4])
    expect(reliefFactor([100, 350, 200, 120])!.value).toBe(0.5)
    expect(looksLikeSea([0, 0, 0])).toBe(true)
    expect(looksLikeSea([0, 5])).toBe(false)
  })
  it('reads MODIS NDVI and scores bare ground', () => {
    expect(parseNdvi(NDVI)).toBeCloseTo(0.1, 5)
    expect(ndviFactor(0.1).value).toBe(1)
    expect(ndviFactor(0.6).value).toBe(0)
  })
  it('prefers the most detailed geologic map unit and reads rock types', () => {
    const g = parseMacrostrat(MACRO)!
    expect(g.name).toBe('Snake River Group')
    const r = rockFactors(g)
    expect(r.basalt!.value).toBe(1)
    expect(r.anorthosite!.value).toBe(0)
    expect(rockFactors({ name: 'Nain', lith: 'Major:{anorthosite}', text: 'major:{anorthosite}' }).anorthosite!.value).toBe(1)
    expect(rockFactors({ name: 'Playa', lith: 'Major:{evaporite,mudstone}', text: 'major:{evaporite,mudstone}' }).sediment!.value).toBe(1)
  })
  it('scores impact craters by distance and age', () => {
    expect(craterFactor(35.0275, -111.02278).value).toBe(1)
    expect(craterFactor(35.0275, -111.02278).raw).toMatch(/Meteor Crater/)
    expect(craterFactor(0, -150).value).toBe(0)
  })
  it('measures wind and blowing dust, and how many months have liquid water', () => {
    // A hyper-arid desert: warm all year, almost no rain, a steady breeze
    const desert = parsePower({ ...POWER, properties: { parameter: { ...POWER.properties.parameter, PRECTOTCORR: monthly(Array(12).fill(0.01), 0.01), WS2M: { ANN: 3.5 } } } })!
    expect(desert.wetMonths).toBe(0)
    expect(desert.windMs).toBe(3.5)
    expect(climateFactors(desert).life!.value).toBe(1)
    // A rainy place with a frozen winter: liquid water only in the months above 0 °C
    const boreal = parsePower({ ...POWER, properties: { parameter: { ...POWER.properties.parameter, T2M: monthly([-20, -15, -8, -1, 6, 12, 15, 13, 7, 0.5, -9, -16], -1.3), PRECTOTCORR: monthly(Array(12).fill(2), 2) } } })!
    expect(boreal.wetMonths).toBe(6)
    expect(climateFactors(boreal).life!.value).toBe(0.5)
    expect(boreal.windMs).toBeNull()
    // Wind only raises dust from dry, bare ground
    expect(windFactor(6, 1, 1)!.value).toBe(1)
    expect(windFactor(6, 0, 0)!.value).toBe(0)
    expect(windFactor(3.5, 1, 0.8)!.value).toBeCloseTo(0.45, 2)
    expect(windFactor(0.5, 1, 1)!.value).toBe(0)
    expect(windFactor(4, null, null)).toBeNull()
    const f = probeFactors(-24.08, -70.17, { climate: desert, ndvi: 0.1 })
    expect(f.wind.value).toBeCloseTo(0.5, 1)
    expect(f.wind.raw).toMatch(/3\.5 m\/s/)
    expect(f.life.raw).toMatch(/0 months/)
    // Without wind data the factor is simply missing, never guessed
    expect(probeFactors(-24.08, -70.17, { climate: parsePower(POWER), ndvi: 0.1 }).wind.value).toBeNull()
  })
  it('asks NASA POWER for wind, and carries on without it if the service refuses', async () => {
    expect(powerUrl(1, 2)).toContain('WS2M')
    const asked: string[] = []
    const fake = (async (url: string) => {
      asked.push(url)
      if (url.includes('power.larc') && url.includes('WS2M')) return { ok: false, status: 422, json: async () => ({}) }
      if (url.includes('power.larc')) return { ok: true, status: 200, json: async () => POWER }
      return { ok: false, status: 500, json: async () => ({}) }
    }) as unknown as typeof fetch
    const res = await runProbe(-24.08, -70.17, { fetch: fake, skipPlace: true, timeoutMs: 500 })
    expect(res.climate?.rangeC).toBe(17.4)
    expect(res.climate?.windMs ?? null).toBeNull()
    expect(asked.filter(u => u.includes('power.larc'))).toHaveLength(2)
  })
  it('builds a full 15-factor discovery, leaving caves and remoteness as no data', () => {
    const f = probeFactors(-24.08, -70.17, { climate: parsePower(POWER), ndvi: 0.1, geology: parseMacrostrat(MACRO), elevations: [1000, 1100, 1180, 1050] })
    expect(Object.keys(f).sort()).toEqual([...FACTOR_KEYS].sort())
    expect(f.caves.value).toBeNull()
    expect(f.isolation.value).toBeNull()
    expect(FACTOR_KEYS.filter(k => f[k].value != null)).toHaveLength(11)
    const s = probeSite('probe-x', -24.08, -70.17, 'Yungay, Antofagasta, Chile', { climate: parsePower(POWER) })
    expect(s.status).toBe('discovery')
    expect(s.country).toBe('Chile')
    expect(s.name).toContain('Yungay')
  })
})

describe('live probe requests', () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const route = (fail: string[] = [], powerFirst422 = false) => {
    let powerCalls = 0
    return (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (fail.some(h => url.includes(h))) throw new Error('offline')
      if (url.includes('power.larc')) { powerCalls++; return powerFirst422 && powerCalls === 1 ? ok({ error: 'bad parameter' }, 422) : ok(POWER) }
      if (url.includes('open-meteo')) return ok({ elevation: Array.from({ length: 25 }, (_, i) => 1000 + i * 8) })
      if (url.includes('modis.ornl')) return ok(NDVI)
      if (url.includes('macrostrat')) return ok(MACRO)
      if (url.includes('photon')) return ok(PLACE)
      return ok({}, 404)
    }) as typeof fetch
  }
  it('builds the right service URLs', () => {
    expect(powerUrl(1.23456, -7.5)).toContain('latitude=1.235&format=JSON')
    expect(powerUrl(1, 2)).toContain('community=AG')
    expect(elevationUrl(reliefGrid(1, 2)).split('latitude=')[1].split('&')[0].split(',')).toHaveLength(25)
    expect(ndviUrl(10, 10)).toContain('A2024193')
    expect(ndviUrl(-10, 10)).toContain('A2024017')
    expect(geologyUrl(1, 2)).toContain('lng=2.0000')
    expect(parsePlace(PLACE)).toBe('Yungay, Antofagasta, Chile')
  })
  it('collects every service and names the place', async () => {
    const steps: string[] = []
    const r = await runProbe(-24.08, -70.17, { fetch: route(), onStep: (id, st) => steps.push(`${id}:${st}`) })
    expect(r.failed).toEqual([])
    expect(r.place).toBe('Yungay, Antofagasta, Chile')
    expect(r.climate!.meanC).toBe(16.2)
    expect(r.elevations).toHaveLength(25)
    expect(steps).toContain('rocks:ok')
  })
  it('keeps going when a service fails, and retries POWER with fewer parameters', async () => {
    const r = await runProbe(-24.08, -70.17, { fetch: route(['macrostrat'], true), skipPlace: true })
    expect(r.failed).toEqual(['rocks'])
    expect(r.geology).toBeNull()
    expect(r.climate!.meanC).toBe(16.2)
    expect(r.place).toBeNull()
  })
})

describe('twin finder and campaigns', () => {
  const base = targetById('shackleton')
  it('ranks Earth twins best first', () => {
    const rows = rankTwins(base, EARTH_SITES)
    expect(rows.length).toBe(EARTH_SITES.length)
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].result.asi!).toBeGreaterThanOrEqual(rows[i].result.asi!)
  })
  it('builds a campaign that beats any single site and covers highland rock', () => {
    const plan = planCampaign(base, EARTH_SITES, 3)
    expect(plan.sites).toHaveLength(3)
    expect(plan.coverage).toBeGreaterThanOrEqual(plan.single!.coverage)
    expect(plan.coverage).toBeLessThanOrEqual(1)
    expect(plan.sites.some(s => (s.factors.anorthosite.value ?? 0) > 0.5)).toBe(true)
    expect(coverage(base, []).value).toBe(0)
  })
  it('works for every target on both worlds', () => {
    for (const t of TARGETS) {
      const plan = planCampaign(t, EARTH_SITES, 3)
      expect(plan.coverage, t.id).toBeGreaterThan(0.6)
    }
  })
})

describe('reports', () => {
  const svalbard = EARTH_SITES.find(s => s.id === 'svalbard')!
  it('writes an Analog Passport with every factor, all matches and the light calendar', () => {
    const md = passportMarkdown(svalbard, 'Analog Scout', new Date('2026-11-14T00:00:00Z'))
    expect(md).toContain('# Analog Passport: Bockfjord volcanic complex, Svalbard')
    expect(md).toContain('2026-11-14')
    for (const k of FACTOR_KEYS) expect(md).toContain(FACTOR_LABELS[k])
    expect(md).toContain('Connecting Ridge')
    expect(md).toContain('Days when the Sun stays below 7°')
    const j = passportJson(svalbard, 'Analog Scout')
    expect(Object.keys(j.factors)).toHaveLength(15)
    expect(j.site.processes).toEqual(['volcanism', 'ice'])
    expect(md).toContain('Shared processes')
    expect(j.matches).toHaveLength(TARGETS.length)
    expect(j.lightWindows.length).toBeGreaterThan(0)
    expect(matchesFor(svalbard)[0].asi).toBeGreaterThanOrEqual(matchesFor(svalbard)[1].asi)
  })
  it('writes a twin report and safe file names', () => {
    const md = twinReportMarkdown(targetById('arcadia'), EARTH_SITES, 'Analog Scout')
    expect(md).toContain('# Earth twins for Arcadia Planitia (Mars)')
    expect(md).toContain('Best three-site field campaign')
    expect(slug('Río Tinto, Spain!')).toBe('rio-tinto-spain')
  })
})
