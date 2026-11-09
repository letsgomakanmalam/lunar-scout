import { useEffect, useMemo, useRef, useState } from 'react'
import type { EarthSite, PlanetTarget } from '../data/types'
import { FACTOR_LABELS } from '../data/types'
import { sourceById } from '../data/sources'
import { CLIMATE_ZONES } from '../data/climateZones'
import { SCREENED, cellAt, cellCenter, cellFactors, findCandidates, loadEarthGrid, paintScores, placeOf, screen, screenConfidence, validate, type EarthGrid } from '../lib/earthGrid'
import { rankTwins } from '../lib/twins'
import { download, slug } from '../lib/passport'
import { fmtCoords, ordinal } from '../lib/format'
import Icon from './Icon'

interface Props {
  target: PlanetTarget
  /** Listed analogs plus the player's discoveries: candidates must be new, so they keep away from these */
  sites: EarthSite[]
  onProbe: (lat: number, lon: number, note: string) => void
}

const X = (lon: number) => (lon + 180) * 2
const Y = (lat: number) => (90 - lat) * 2
const short = (t: PlanetTarget) => t.name.split(' (')[0]

/**
 * Systematic search for NEW analogs: every land cell on Earth scored against one Moon or Mars site,
 * the best unlisted places picked, and a check that known analogs come out on top.
 */
export default function GlobalSearch({ target, sites, onProbe }: Props) {
  const [grid, setGrid] = useState<EarthGrid | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let alive = true
    loadEarthGrid().then(g => { if (alive) setGrid(g) }, () => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])
  useEffect(() => setPicked(null), [target.id])

  const scores = useMemo(() => (grid ? screen(grid, target) : null), [grid, target])
  const candidates = useMemo(() => (grid && scores ? findCandidates(grid, scores, sites, 8) : []), [grid, scores, sites])
  const check = useMemo(() => {
    if (!grid || !scores) return null
    const known = rankTwins(target, sites).filter(r => r.site.status === 'known').slice(0, 5).map(r => r.site)
    return validate(grid, scores, known)
  }, [grid, scores, target, sites])

  useEffect(() => {
    const c = canvas.current
    if (!c || !grid || !scores) return
    c.width = grid.meta.w
    c.height = grid.meta.h
    const ctx = c.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(grid.meta.w, grid.meta.h)
    paintScores(grid, scores, img.data)
    ctx.putImageData(img, 0, 0)
  }, [grid, scores])

  if (failed) return <p className="meta">The global search data could not load. It ships with the app in public/data; rebuild it with scripts/build-earth-grid.py.</p>
  if (!grid || !scores) return <p className="meta"><i className="ps-spin inline" /> Loading the global screening grid…</p>

  const conf = Math.round(screenConfidence(target) * 100)
  const screenedHere = SCREENED.filter(k => target.profile[k])
  const clickMap = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const lon = ((e.clientX - r.left) / r.width) * 360 - 180
    const lat = 90 - ((e.clientY - r.top) / r.height) * 180
    const cell = cellAt(grid, lat, lon)
    setPicked(cell >= 0 ? cell : null)
  }
  const probe = (cell: number) => {
    const c = cellCenter(grid, cell)
    onProbe(c.lat, c.lon, `Flagged by the global search for ${short(target)} (screening score ${Math.round(scores[cell])}).`)
  }
  const exportCsv = () => {
    const rows = findCandidates(grid, scores, sites, 25)
    const head = 'rank,name,lat,lon,screening_score,climate_zone,km_to_town_1000,nearest_listed_analog,km_to_listed'
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const body = rows.map((c, i) => [i + 1, esc(c.name), c.lat.toFixed(2), c.lon.toFixed(2), c.score, esc(c.climate), c.townKm, esc(c.nearestListed?.name ?? ''), Math.round(c.nearestListed?.km ?? 0)].join(','))
    download(`new-analog-candidates-${slug(target.name)}.csv`, [head, ...body].join('\n') + '\n', 'text/csv')
  }
  const pf = picked != null ? cellFactors(grid, picked) : null
  const pPlace = picked != null ? placeOf(grid, picked) : null

  return (
    <div className="global-search">
      <p className="meta">
        Every land cell on Earth ({grid.meta.land.toLocaleString('en-US')} cells of 0.5°, about 55 km) scored against {short(target)} on
        the {screenedHere.length} factors open global maps can see, covering {conf}% of what matters here. Slope, highland rock and caves
        need the live probe. Tap the map to inspect any cell.
      </p>
      <div className="gs-map" onClick={clickMap} role="img" aria-label={`World map of how much each place on Earth resembles ${target.name}. Best new candidates: ${candidates.map(c => c.name).join('; ')}`}>
        <canvas ref={canvas} />
        <svg className="gs-overlay" viewBox="0 0 720 360" preserveAspectRatio="none" aria-hidden="true">
          {sites.map(s => <circle key={s.id} cx={X(s.lon)} cy={Y(s.lat)} r={2.6} className={`gs-site st-${s.status}`} />)}
          {candidates.map((c, i) => (
            <g key={c.cell} className="gs-cand" transform={`translate(${X(c.lon)} ${Y(c.lat)})`}>
              <circle r={7.5} />
              <text y={3.2}>{i + 1}</text>
            </g>
          ))}
          {picked != null && (() => { const c = cellCenter(grid, picked); return <circle cx={X(c.lon)} cy={Y(c.lat)} r={11} className="gs-pick" /> })()}
        </svg>
      </div>
      <div className="gs-legend" aria-hidden="true">
        <span>Less like {short(target)}</span><i /><span>More like it</span>
        <span className="gs-key"><b className="known" />Listed analogs</span>
        <span className="gs-key"><b className="cand" />New candidates</span>
      </div>

      {picked != null && pf && pPlace && (
        <div className="gs-cell cut">
          <button className="pc-close" aria-label="Close" onClick={() => setPicked(null)}><Icon name="cross" size={16} /></button>
          <h3>{pPlace.name}</h3>
          <p className="coords">{fmtCoords(cellCenter(grid, picked).lat, cellCenter(grid, picked).lon, 2)} · screening score <strong>{Math.round(scores[picked])}</strong> · {CLIMATE_ZONES[grid.climate[picked]]?.code} {CLIMATE_ZONES[grid.climate[picked]]?.label}</p>
          <ul className="gs-factors">
            {SCREENED.map(k => (
              <li key={k} className={target.profile[k] ? 'on' : ''}>
                <span>{FACTOR_LABELS[k]}</span><strong>{pf[k].value?.toFixed(2)}</strong><small title={sourceById(pf[k].sourceId)?.name}>{pf[k].raw}</small>
              </li>
            ))}
          </ul>
          <button className="btn primary cut small" onClick={() => probe(picked)}><Icon name="target" size={16} />Probe this spot live</button>
        </div>
      )}

      {check && check.rows.length > 0 && (
        <p className="gs-check">
          <Icon name="check" size={16} />
          <span>
            <strong>Validation:</strong> the {check.rows.length} best known analogs for this site sit at the {ordinal(check.median * 100)} percentile of Earth's land (median),
            so the screening agrees with where agencies already train:{' '}
            {check.rows.map(r => <span key={r.id} className="chip">{r.name.split(',')[0]} {Math.round(r.percentile * 100)}</span>)}
          </span>
        </p>
      )}

      <h3>Best new candidates</h3>
      <p className="meta">The highest-scoring cells at least 300 km from every listed analog and 450 km from each other.</p>
      <ol className="gs-list">
        {candidates.map((c, i) => (
          <li key={c.cell} className={picked === c.cell ? 'on' : ''}>
            <span className="tr-rank">{i + 1}</span>
            <span className="tr-name">
              <button className="pc-link" onClick={() => setPicked(c.cell)}>{c.name}</button>
              <small>{c.climate} · {c.townKm >= 510 ? '510+' : c.townKm} km from towns{c.nearestListed ? ` · ${Math.round(c.nearestListed.km).toLocaleString('en-US')} km from ${c.nearestListed.name.split(',')[0]}` : ''}</small>
            </span>
            <span className="gs-score"><strong>{c.score}</strong></span>
            <button className="btn ghost cut small" onClick={() => probe(c.cell)}><Icon name="target" size={14} />Probe live</button>
          </li>
        ))}
      </ol>
      <div className="report-row">
        <button className="btn ghost cut small" onClick={exportCsv}><Icon name="download" size={16} />Top 25 candidates (CSV)</button>
      </div>
    </div>
  )
}
