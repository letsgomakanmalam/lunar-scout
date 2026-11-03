import { useEffect, useState } from 'react'
import { PROBES_PER_MISSION, useGame } from '../store'
import EarthMap from '../components/EarthMap'
import MoonGlobe from '../components/MoonGlobe'
import AsiRadar from '../components/AsiRadar'
import Icon from '../components/Icon'
import RewardOverlay, { type CertifyResult } from '../components/RewardOverlay'
import { AsiGauge, Scanner } from '../components/ScanFx'
import { EARTH_SITES } from '../data/earthSites'
import { LUNAR_TARGETS, MISSIONS, missionById, targetById } from '../data/moon'
import { FACTOR_LABELS, type FactorKey } from '../data/types'
import { sourceById } from '../data/sources'
import { computeASI, strengthsAndWeaknesses } from '../lib/scoring'
import { fmtCoords } from '../lib/format'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion } from '../lib/motion'

const STATUS_LABEL = { known: 'Known analog', candidate: 'New candidate', local: 'Malaysia' } as const
const MARKERS = LUNAR_TARGETS.map(t => ({ id: t.id, lat: t.lat, lon: t.lon, label: t.name }))

export default function Explore() {
  const g = useGame()
  const mission = missionById(g.activeMissionId)
  const missionNo = MISSIONS.findIndex(m => m.id === mission.id) + 1
  const target = targetById(mission.targetId)
  const scannedIds = g.scanned[mission.id] ?? []
  const probesLeft = PROBES_PER_MISSION - (g.probesUsed[mission.id] ?? 0)
  const site = EARTH_SITES.find(s => s.id === g.selectedSiteId) ?? null
  const isScanned = site ? scannedIds.includes(site.id) : false
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reward, setReward] = useState<CertifyResult | null>(null)

  useEffect(() => setMessage(null), [g.selectedSiteId, mission.id])
  useEffect(() => {
    if (!scanning) return
    const t = setTimeout(() => setScanning(false), prefersReducedMotion() ? 0 : 1800)
    return () => clearTimeout(t)
  }, [scanning])

  const doScan = () => {
    if (!site) return
    const res = g.scan(site.id)
    if (res === 'no-probes') {
      sfx('error')
      return setMessage('No probes left for this mission. Certify your best scanned site, or pick another mission.')
    }
    sfx('scan')
    setScanning(true)
  }

  const doCertify = () => { if (site) setReward(g.certify(site.id)) }

  const result = site && isScanned ? computeASI(site, target, mission) : null
  const sw = result ? strengthsAndWeaknesses(result) : null
  const pass = result?.asi != null && result.asi >= mission.passAsi
  const weightKeys = Object.keys(mission.weights) as FactorKey[]
  const scanLines = weightKeys.map(k => ({
    label: FACTOR_LABELS[k],
    source: (sourceById(site?.factors[k].sourceId ?? '')?.name ?? 'Unknown source').split(' (')[0],
  }))

  return (
    <div className="explore">
      <aside className="panel brief">
        <header className="brief-head">
          <span className="mission-no" aria-label={`Mission ${missionNo}`}>{String(missionNo).padStart(2, '0')}</span>
          <h2>{mission.title}</h2>
        </header>
        <div className="target-view">
          <MoonGlobe size={176} maxRes={320} target={target} markers={MARKERS} label={`The Moon, turned to ${target.name}`} />
          <p className="target-name">{target.name}</p>
          <p className="coords">{fmtCoords(target.lat, target.lon)}</p>
        </div>
        <p>{mission.brief}</p>
        <p className="tip"><Icon name="tip" size={18} /><span>Hint: {mission.equipmentTip}</span></p>
        <h3>What counts</h3>
        <ul className="weights">
          {Object.entries(mission.weights).map(([k, w]) => (
            <li key={k}>
              <span>{FACTOR_LABELS[k as FactorKey]}</span>
              <span className="bar seg"><span style={{ width: `${(w ?? 0) * 100 * 2}%` }} /></span>
            </li>
          ))}
        </ul>
        <div className="probe-row" aria-live="polite">
          <span className="probe-label"><Icon name="probe" size={16} />Probes</span>
          <span className="pips" role="img" aria-label={`${probesLeft} of ${PROBES_PER_MISSION} probes left`}>
            {Array.from({ length: PROBES_PER_MISSION }, (_, i) => <i key={i} className={i < probesLeft ? 'on' : ''} />)}
          </span>
          <span className="pass-mark">Pass mark <strong>{mission.passAsi}</strong></span>
        </div>
        <button className="btn ghost cut small" onClick={() => g.go('missions')}>Change mission</button>
      </aside>

      <section className="map-col">
        <EarthMap selectedId={g.selectedSiteId} scannedIds={scannedIds} onSelect={g.selectSite} />
      </section>

      <aside className="panel scan">
        {!site && (
          <div className="pick">
            <h2>Pick a site</h2>
            <p className="meta">Tap a marker on the map, or choose from the list.</p>
            <select aria-label="Choose a site" onChange={e => g.selectSite(e.target.value || null)} value="">
              <option value="">Choose a site…</option>
              {EARTH_SITES.map(s => <option key={s.id} value={s.id}>{s.name}, {s.country}</option>)}
            </select>
            <p className="pick-hint"><Icon name="probe" size={16} />{probesLeft} of {PROBES_PER_MISSION} probes left for this mission.</p>
          </div>
        )}

        {site && (
          <>
            <div className="site-head">
              <span className={`chip st-${site.status}`}>{STATUS_LABEL[site.status]}</span>
              <h2>{site.name}</h2>
              <p className="coords">{site.country}, {fmtCoords(site.lat, site.lon)}</p>
            </div>
            <p>{site.description}</p>

            {!isScanned && (
              <button className="btn primary cut wide" data-sfx="none" onClick={doScan} disabled={probesLeft <= 0}>
                <Icon name="scan" size={18} />Scan this site<span className="cost">uses 1 probe</span>
              </button>
            )}

            {isScanned && scanning && <Scanner siteName={site.name} lines={scanLines} />}

            {isScanned && !scanning && result && (
              <div className="result" aria-live="polite">
                <div className="verdict">
                  <AsiGauge asi={result.asi ?? 0} pass={mission.passAsi} />
                  <div className="verdict-text">
                    <p className={`verdict-line ${pass ? 'pass' : 'fail'}`}>{pass ? 'Passes this mission' : `Needs ${mission.passAsi} to pass`}</p>
                    <p className="meta">Analog similarity, 0 to 100</p>
                    <div className="confidence">
                      <span>Data confidence</span>
                      <span className="bar"><span style={{ width: `${result.confidence * 100}%` }} /></span>
                      <strong>{Math.round(result.confidence * 100)}%</strong>
                    </div>
                  </div>
                </div>
                <p className="meta">Values are team estimates from the sources below.</p>
                <AsiRadar result={result} />
                {sw && (sw.strengths.length > 0 || sw.weaknesses.length > 0) && (
                  <div className="sw">
                    {sw.strengths.length > 0 && <p><span className="sw-label">Strengths</span>{sw.strengths.map(k => <span key={k} className="chip good">{FACTOR_LABELS[k]}</span>)}</p>}
                    {sw.weaknesses.length > 0 && <p><span className="sw-label">Weak points</span>{sw.weaknesses.map(k => <span key={k} className="chip bad">{FACTOR_LABELS[k]}</span>)}</p>}
                  </div>
                )}
                <details>
                  <summary>Data sources</summary>
                  <ul className="sources">
                    {result.factors.map(f => {
                      const src = sourceById(site.factors[f.key].sourceId)
                      return (
                        <li key={f.key}>
                          {FACTOR_LABELS[f.key]}: {src ? <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a> : 'unknown'}
                        </li>
                      )
                    })}
                  </ul>
                </details>
                <button className="btn primary cut wide" data-sfx="none" onClick={doCertify}><Icon name="check" size={18} />Certify this site</button>
              </div>
            )}
            {message && <p className="message" role="status">{message}</p>}
            <button className="btn ghost cut small" data-sfx="back" onClick={() => g.selectSite(null)}>Back to site list</button>
          </>
        )}
      </aside>

      <RewardOverlay
        result={reward}
        missionNumber={missionNo}
        missionTitle={mission.title}
        passAsi={mission.passAsi}
        siteName={site ? `${site.name}, ${site.country}` : ''}
        weakPoints={sw?.weaknesses.map(k => FACTOR_LABELS[k]) ?? []}
        hasLanding={!!g.landingId}
        onClose={() => setReward(null)}
        onMissions={() => { setReward(null); g.go('missions') }}
        onBase={() => { setReward(null); g.go(g.landingId ? 'build' : 'land') }}
      />
    </div>
  )
}
