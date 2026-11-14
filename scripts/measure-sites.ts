/**
 * Measures every listed Earth site from open data and writes src/data/measured.json.
 * The app then uses these measured values instead of the team's estimates.
 *
 *   npm run measure                       measure all sites (needs an internet connection)
 *   npm run measure -- --only=atacama,svalbard
 *   npm run measure -- --dry              print results without writing the file
 *
 * Replaced: temperature swing, dryness, extreme cold (NASA POWER), slope & roughness
 * (Copernicus DEM) and bare ground (MODIS NDVI). Kept as reviewed estimates: rock type, ground
 * ice, craters, caves, remoteness, wind and limits of life, because one map point can miss what a site is known for
 * (use the in-app "Check against live data" to compare those). Run `npm test` afterwards: the
 * data tests check that every mission can still be passed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EARTH_SITES } from '../src/data/earthSites'
import { FACTOR_LABELS, type FactorKey } from '../src/data/types'
import { probeFactors } from '../src/lib/probe'
import { runProbe } from '../src/lib/probeFetch'

const REPLACE: FactorKey[] = ['thermal', 'aridity', 'cold', 'roughness', 'barren']
const here = dirname(fileURLToPath(import.meta.url))
const file = resolve(here, '../src/data/measured.json')
const args = process.argv.slice(2)
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean)
const dry = args.includes('--dry')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Entry = { value: number | null; raw: string; sourceId: string }
interface MeasuredFile { generated: string | null; note?: string; sites: Record<string, Partial<Record<FactorKey, Entry>>> }

const prev: MeasuredFile = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { generated: null, sites: {} }
const result: MeasuredFile = { ...prev, sites: { ...prev.sites } }
const list = only ? EARTH_SITES.filter(s => only.includes(s.id)) : EARTH_SITES
if (only && list.length !== only.length) console.warn(`Unknown site ids: ${only.filter(id => !EARTH_SITES.some(s => s.id === id)).join(', ')}`)

let measuredSites = 0
for (const s of list) {
  const res = await runProbe(s.lat, s.lon, { skipPlace: true, timeoutMs: 30000 })
  const f = probeFactors(s.lat, s.lon, res)
  const got: Partial<Record<FactorKey, Entry>> = {}
  for (const k of REPLACE) if (f[k].value != null) got[k] = { value: f[k].value, raw: f[k].raw, sourceId: f[k].sourceId }
  const n = Object.keys(got).length
  if (n) { result.sites[s.id] = got; measuredSites++ }
  const changes = (Object.keys(got) as FactorKey[]).map(k => {
    const est = s.factors[k].value
    return `${FACTOR_LABELS[k]} ${est == null ? '–' : est.toFixed(2)}→${got[k]!.value!.toFixed(2)}`
  })
  console.log(`${s.name}: ${n ? changes.join(', ') : 'nothing measured'}${res.failed.length ? `  (no answer: ${res.failed.join(', ')})` : ''}`)
  await sleep(1200) // be gentle with free public services
}

if (!measuredSites) {
  console.error('\nNo site could be measured. Check the internet connection and try again. measured.json was not changed.')
  process.exit(1)
}
result.generated = new Date().toISOString()
if (dry) console.log(`\nDry run: ${measuredSites} sites measured, file not written.`)
else {
  writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
  console.log(`\nWrote ${measuredSites} sites to src/data/measured.json. Now run: npm test`)
}
