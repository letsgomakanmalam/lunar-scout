import { useEffect, useMemo, useState } from 'react'
import type { PlanetTarget } from '../data/types'
import { cellCenter, loadEarthGrid, placeOf, screen, type EarthGrid } from '../lib/earthGrid'
import { HOMES, MAX_KM, MIN_KM, bestWithin, distancesFrom, kmOfSlider, reachFrontier, sliderOfKm, type Home } from '../lib/reach'
import { formatDistance, type LatLon, type Units } from '../lib/geo'
import Icon from './Icon'

interface Props {
  target: PlanetTarget
  /** The player's own position, if they shared it on the map */
  myLocation: LatLon | null
  units: Units
  onProbe: (lat: number, lon: number, note: string) => void
}

const W = 640, H = 230, L = 38, R = 12, T = 12, B = 30
const xOf = (km: number) => L + ((W - L - R) * Math.log(Math.min(MAX_KM, Math.max(MIN_KM, km)) / MIN_KM)) / Math.log(MAX_KM / MIN_KM)
const yOf = (score: number) => T + (H - T - B) * (1 - score / 100)
const TICKS = [100, 300, 1000, 3000, 10000, 20000]
const short = (t: PlanetTarget) => t.name.split(' (')[0]

/**
 * Analog within reach: from your own city, the best Moon- or Mars-like place you can get to,
 * and what each extra kilometre of travel buys (lib/reach).
 */
export default function AnalogReach({ target, myLocation, units, onProbe }: Props) {
  const [grid, setGrid] = useState<EarthGrid | null>(null)
  const [failed, setFailed] = useState(false)
  const [homeName, setHomeName] = useState(HOMES[0].name)
  const [slider, setSlider] = useState(() => sliderOfKm(3500))

  useEffect(() => {
    let alive = true
    loadEarthGrid().then(g => { if (alive) setGrid(g) }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const homes = useMemo<Home[]>(() => (myLocation ? [{ name: 'My location', ...myLocation }, ...HOMES] : HOMES), [myLocation])
  const home = homes.find(h => h.name === homeName) ?? homes[0]
  const scores = useMemo(() => (grid ? screen(grid, target) : null), [grid, target])
  const km = useMemo(() => (grid ? distancesFrom(grid, home) : null), [grid, home.lat, home.lon]) // eslint-disable-line react-hooks/exhaustive-deps
  const curve = useMemo(() => (scores && km ? reachFrontier(scores, km, 1) : []), [scores, km])
  const stops = useMemo(() => (scores && km ? reachFrontier(scores, km, 5).filter(s => s.score >= 10).slice(-7) : []), [scores, km])

  if (failed) return <p className="meta">The global search data could not load, so reach cannot be worked out.</p>
  if (!grid || !scores || !km || !curve.length) return <p className="meta"><i className="ps-spin inline" /> Working out what is within reach…</p>

  const radius = kmOfSlider(slider)
  const here = bestWithin(scores, km, radius)
  const world = curve[curve.length - 1]
  const dist = (v: number) => formatDistance(v, units)
  const share = here && world.score > 0 ? Math.round((here.score / world.score) * 100) : 0
  const closer = here && here.km > 0 ? world.km / here.km : 1
  const place = here ? placeOf(grid, here.cell) : null
  const probe = (cell: number, score: number) => {
    const c = cellCenter(grid, cell)
    onProbe(c.lat, c.lon, `Best match for ${short(target)} within reach of ${home.name} (screening score ${Math.round(score)}).`)
  }
  // The frontier as a staircase: the score stays flat until travelling further finally finds something better
  let path = `M${xOf(MIN_KM)} ${yOf(0)}`
  let last = 0
  for (const s of curve) { path += ` L${xOf(s.km).toFixed(1)} ${yOf(last).toFixed(1)} L${xOf(s.km).toFixed(1)} ${yOf(s.score).toFixed(1)}`; last = s.score }
  path += ` L${xOf(MAX_KM)} ${yOf(last).toFixed(1)}`

  return (
    <div className="reach">
      <p className="meta">
        The best analogs are in Antarctica and the high Arctic, where most teams can never go. Pick where you start and how far you can
        travel: this finds the most {short(target)}-like place you can actually reach, and shows what each extra kilometre buys.
      </p>
      <div className="reach-controls">
        <label>
          <span>Starting from</span>
          <select value={home.name} onChange={e => setHomeName(e.target.value)}>
            {homes.map(h => <option key={h.name} value={h.name}>{h.name}</option>)}
          </select>
        </label>
        <label className="reach-slider">
          <span>I can travel up to <strong>{dist(radius)}</strong></span>
          <input type="range" min={0} max={100} step={0.5} value={slider} onChange={e => setSlider(Number(e.target.value))} aria-valuetext={dist(radius)} />
        </label>
      </div>

      {here && place ? (
        <div className="reach-result cut">
          <div>
            <small>Best within reach</small>
            <h3>{place.name}</h3>
            <p className="meta">{dist(here.km)} from {home.name} · screening score <strong>{Math.round(here.score)}</strong> of 100</p>
            <p className="reach-claim">
              {here.cell === world.cell || share >= 99
                ? <>This is as good as anywhere on Earth for {short(target)}.</>
                : <><strong>{share}%</strong> as good as the best place on Earth ({placeOf(grid, world.cell).name}, score {Math.round(world.score)}), and <strong>{closer >= 10 ? Math.round(closer) : closer.toFixed(1)} times closer</strong>.</>}
            </p>
          </div>
          <button className="btn primary cut" onClick={() => probe(here.cell, here.score)}><Icon name="probe" size={16} />Probe it live</button>
        </div>
      ) : <p className="meta">No land that close. Move the slider to travel further.</p>}

      <svg className="reach-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Best similarity to ${target.name} against distance from ${home.name}. ${stops.map(s => `${Math.round(s.score)} at ${dist(s.km)}`).join('; ')}.`}>
        <rect x={L} y={T} width={Math.max(0, xOf(radius) - L)} height={H - T - B} className="rc-reach" />
        {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} className="rc-grid" /><text x={L - 6} y={yOf(v) + 3.5} className="rc-tick" textAnchor="end">{v}</text></g>)}
        {TICKS.map((v, i) => <text key={v} x={xOf(v)} y={H - 10} className={`rc-tick ${i % 2 ? 'rc-minor' : ''}`} textAnchor={i === 0 ? 'start' : i === TICKS.length - 1 ? 'end' : 'middle'}>{dist(v)}</text>)}
        <path d={path} className="rc-line" />
        <line x1={xOf(radius)} x2={xOf(radius)} y1={T} y2={H - B} className="rc-radius" />
        {stops.map(s => <circle key={s.cell} cx={xOf(s.km)} cy={yOf(s.score)} r={3.2} className="rc-stop" />)}
        {here && <circle cx={xOf(here.km)} cy={yOf(here.score)} r={6} className="rc-here" />}
      </svg>
      <p className="meta rc-caption">Best score you can reach (up) against how far you travel from {home.name} (right; each step right is about three times further). The shaded part is within your reach.</p>

      <h3 className="sub-h">Where going further pays off</h3>
      <ol className="reach-stops">
        {stops.map(s => {
          const p = placeOf(grid, s.cell)
          return (
            <li key={s.cell} className={here && s.cell === here.cell ? 'on' : ''}>
              <button className="pc-link" onClick={() => setSlider(sliderOfKm(s.km) + 0.5)} title="Set my travel distance to here">{p.name}</button>
              <span>{dist(s.km)}</span>
              <span className="bar"><span style={{ width: `${s.score}%` }} /></span>
              <strong>{Math.round(s.score)}</strong>
              <button className="chip-btn" onClick={() => probe(s.cell, s.score)}>Probe</button>
            </li>
          )
        })}
      </ol>
      <p className="meta">Same screening scores as the global search above: coarse values for a cell of about 55 km, so probe a place live before trusting it. Distances are straight lines, not travel time or cost.</p>
    </div>
  )
}
