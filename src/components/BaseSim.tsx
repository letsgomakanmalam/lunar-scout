import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanetTarget } from '../data/types'
import type { BaseGrid } from '../lib/base'
import { CAUSE_TEXT, SIM_DAYS, simulateBase } from '../lib/baseSim'
import Icon from './Icon'

/** Where the Sun is in the simulation, for the 3D scene's light. */
export interface SimSun { elev: number; az: number; light: number; dark: boolean; hour: number; failed: boolean }

interface Props {
  grid: BaseGrid
  site: PlanetTarget
  onSun: (sun: SimSun | null) => void
}

const W = 320, H = 150, PAD = 6
const MARS_FULL = 715 / 1361 // the brightest Mars sunlight, as a share of the Moon's

/**
 * Runs the base hour by hour for 60 days at its landing site and shows what happens:
 * light and darkness, power, storage, oxygen, water, food and radiation.
 */
export default function BaseSim({ grid, site, onSun }: Props) {
  const r = useMemo(() => simulateBase(grid, site), [grid, site])
  const mars = r.env.kind === 'mars'
  const dayLen = mars ? 24.66 : 24
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  useEffect(() => { setT(0); setPlaying(false) }, [r])
  useEffect(() => {
    if (!playing) return
    const step = () => {
      setT(v => {
        if (v >= r.hours) { setPlaying(false); return v }
        return Math.min(r.hours, v + 2)
      })
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, r.hours])
  // The 3D Sun follows the timeline while this panel is open
  useEffect(() => {
    const light = mars ? Math.min(1, r.light[t] / MARS_FULL) : r.light[t]
    onSun({ elev: r.elev[t], az: r.az[t], light, dark: mars ? r.elev[t] <= 0 : r.light[t] < 0.5, hour: t, failed: !!r.failed && t >= r.failed.hour })
  }, [t, r, mars, onSun])
  useEffect(() => () => onSun(null), [onSun])

  const x = (h: number) => PAD + (h / r.hours) * (W - 2 * PAD)
  const y = (v: number) => H - PAD - v * (H - 2 * PAD)
  const maxKW = Math.max(1, ...Array.from(r.load), ...Array.from(r.gen))
  const path = (f: (h: number) => number) => {
    let d = ''
    for (let h = 0; h <= r.hours; h += 4) d += `${d ? 'L' : 'M'}${x(h).toFixed(1)},${y(Math.max(0, Math.min(1, f(h)))).toFixed(1)}`
    return d
  }
  const longestDark = r.darkSpells.reduce((m, [a, b]) => Math.max(m, b - a), 0) / 24
  const dose = r.dose[r.hours]
  const day = (h: number) => (h / dayLen).toFixed(1)
  const unit = mars ? 'sol' : 'day'

  if (!r.crew) {
    return (
      <div className="sim">
        <p className="meta">Build a habitat first: the simulation keeps a crew alive for {SIM_DAYS} {unit}s at {site.name}.</p>
      </div>
    )
  }

  return (
    <div className="sim">
      <div className={`sim-verdict ${r.failed ? 'bad' : 'good'}`} role="status">
        <Icon name={r.failed ? 'cross' : 'check'} size={18} />
        {r.failed
          ? <span><strong>{unit === 'sol' ? 'Sol' : 'Day'} {day(r.failed.hour)}:</strong> {CAUSE_TEXT[r.failed.cause]}.</span>
          : <span><strong>Crew of {r.crew} safe for {SIM_DAYS} {unit}s.</strong> Lowest battery {Math.round(r.minSoc.value * 100)}%.</span>}
      </div>

      <ul className="sim-facts">
        <li>Sun up {Math.round(r.lit * 100)}% of the time{r.env.yearLit ? ` (${Math.round(r.env.yearLit * 100)}% over a year)` : ''}</li>
        {!mars && <li>Longest dark spell {longestDark.toFixed(1)} days</li>}
        {r.storm && <li>Dust storm, {unit}s {Math.round(r.storm[0] / dayLen)} to {Math.round(r.storm[1] / dayLen)}</li>}
        <li>Night {r.env.nightC} °C{r.env.lavaTube ? ', but a steady −20 °C in the lava tube' : ''}</li>
        <li>Radiation {Math.round(dose)} mSv ({Math.round((dose / 600) * 100)}% of NASA's career limit)</li>
      </ul>

      <svg className="sim-chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${SIM_DAYS} ${unit}s at ${site.name}: battery, power and oxygen over time${r.failed ? `; failure on ${unit} ${day(r.failed.hour)}` : ''}`}>
        {r.darkSpells.map(([a, b]) => <rect key={a} className="sim-dark" x={x(a)} y={PAD} width={Math.max(0.6, x(b) - x(a))} height={H - 2 * PAD} />)}
        {r.storm && <rect className="sim-storm" x={x(r.storm[0])} y={PAD} width={x(r.storm[1]) - x(r.storm[0])} height={H - 2 * PAD} />}
        <path className="sim-gen" d={path(h => r.gen[h] / maxKW)} />
        <path className="sim-load" d={path(h => r.load[h] / maxKW)} />
        <path className="sim-o2" d={path(h => r.o2[h] / 60)} />
        <path className="sim-soc" d={path(h => r.soc[h])} />
        {r.failed && <line className="sim-fail" x1={x(r.failed.hour)} x2={x(r.failed.hour)} y1={PAD} y2={H - PAD} />}
        <line className="sim-now" x1={x(t)} x2={x(t)} y1={PAD} y2={H - PAD} />
      </svg>
      <div className="sim-legend" aria-hidden="true">
        <span><b className="soc" />Battery</span><span><b className="gen" />Power made</span><span><b className="load" />Power used</span><span><b className="o2" />Oxygen (days)</span><span><b className="dark" />Dark</span>
      </div>

      <div className="sim-time">
        <button className="btn ghost cut small" onClick={() => { if (t >= r.hours) setT(0); setPlaying(p => !p) }} aria-label={playing ? 'Pause' : 'Play the simulation'}>
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <input type="range" min={0} max={r.hours} step={1} value={t} onChange={e => { setPlaying(false); setT(Number(e.target.value)) }}
          aria-label={`Time: ${unit} ${day(t)}`} />
        <span className="sim-day">{unit} {day(t)}</span>
      </div>
      <dl className="sim-now-read">
        <div title={r.env.kind === 'polar' ? 'From a high ridge the horizon dips below flat, so the Sun can shine from just below 0°' : undefined}>
          <dt>Sun</dt><dd>{r.elev[t].toFixed(1)}°, {r.light[t] > 0.02 ? 'shining' : 'hidden'}</dd>
        </div>
        <div><dt>Made</dt><dd>{r.gen[t].toFixed(1)} kW</dd></div>
        <div><dt>Used</dt><dd>{r.load[t].toFixed(1)} kW{r.shed[t] ? ` (${r.shed[t]} off)` : ''}</dd></div>
        <div><dt>Battery</dt><dd>{Math.round(r.soc[t] * 100)}%</dd></div>
        <div><dt>Oxygen</dt><dd>{r.o2[t].toFixed(0)} days</dd></div>
        <div><dt>Water</dt><dd>{r.water[t].toFixed(0)} days</dd></div>
        <div><dt>Food</dt><dd>{r.food[t].toFixed(0)} days</dd></div>
        <div><dt>Dose</dt><dd>{r.dose[t].toFixed(0)} mSv</dd></div>
      </dl>

      <h4>What would help</h4>
      <ul className="sim-advice">{r.advice.map(a => <li key={a}>{a}</li>)}</ul>
      <p className="meta sim-method">
        Hourly model in the hardest season, with simplified engineering numbers: 10 kW solar arrays (NASA VSAT),
        40 kW fission reactors (NASA Fission Surface Power), crew needs from NASA's BVAD, radiation from
        {mars ? ' Curiosity RAD' : " Chang'e 4"}. {r.env.yearLit ? 'The ridge horizon is fitted to published illumination; from this height the horizon dips below flat, so the Sun can shine from just below 0°.' : r.env.kind === 'polar' ? 'Light here is estimated from latitude and height only.' : ''}
      </p>
    </div>
  )
}
