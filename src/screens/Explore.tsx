import { useEffect, useRef, useState } from 'react'
import { PROBES_PER_MISSION, allSites, siteById, useGame } from '../store'
import EarthMap from '../components/EarthMap'
import MoonGlobe from '../components/MoonGlobe'
import AsiRadar from '../components/AsiRadar'
import Icon from '../components/Icon'
import LightCalendar from '../components/LightCalendar'
import RewardOverlay, { type CertifyResult } from '../components/RewardOverlay'
import { AsiGauge, Scanner } from '../components/ScanFx'
import { EARTH_SITES } from '../data/earthSites'
import { MISSIONS, missionById } from '../data/missions'
import { targetById, targetsOf } from '../data/targets'
import { FACTOR_KEYS, FACTOR_LABELS, PROCESS_LABELS, WORLD_LABEL, type FactorKey, type FactorValue } from '../data/types'
import { sourceById } from '../data/sources'
import { computeASI, strengthsAndWeaknesses } from '../lib/scoring'
import { fmtCoords } from '../lib/format'
import { distanceKm, formatDistance, nearest } from '../lib/geo'
import { STEPS, runProbe, type StepId, type StepState } from '../lib/probeFetch'
import { NEW_ANALOG_ASI, NEW_ANALOG_KM, looksLikeSea, probeFactors, probeSite } from '../lib/probe'
import { download, matchesFor, passportJson, passportMarkdown, slug } from '../lib/passport'
import { lunarMaxSun } from '../lib/sun'
import { cellAt, loadEarthGrid } from '../lib/earthGrid'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion, useMedia } from '../lib/motion'
import { APP_NAME } from '../brand'

const STATUS_LABEL = { known: 'Known analog', candidate: 'New candidate', local: 'Malaysia', discovery: 'Live discovery' } as const

type Steps = Partial<Record<StepId, StepState>>

function ProbeSteps({ steps, skip = [] }: { steps: Steps; skip?: StepId[] }) {
  return (
    <ul className="probe-steps" aria-live="polite">
      {STEPS.filter(s => !skip.includes(s.id)).map(s => {
        const v = steps[s.id]
        return (
          <li key={s.id} className={`ps-${v ?? 'wait'}`}>
            <span className="ps-icon" aria-hidden="true">{v === 'ok' ? <Icon name="check" size={14} /> : v === 'fail' ? <Icon name="cross" size={14} /> : <i className="ps-spin" />}</span>
            <span>{s.label}</span>
            <span className="ps-src">{s.source}</span>
            <span className="sr-only">{v === 'ok' ? 'received' : v === 'fail' ? 'not available' : 'loading'}</span>
          </li>
        )
      })}
    </ul>
  )
}

export default function Explore() {
  const g = useGame()
  const mission = missionById(g.activeMissionId)
  const missionNo = MISSIONS.findIndex(m => m.id === mission.id) + 1
  const target = targetById(mission.targetId)
  const scannedIds = g.scanned[mission.id] ?? []
  const probesLeft = PROBES_PER_MISSION - (g.probesUsed[mission.id] ?? 0)
  const sites = allSites(g)
  const site = siteById(g, g.selectedSiteId)
  const isScanned = site ? scannedIds.includes(site.id) : false
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reward, setReward] = useState<CertifyResult | null>(null)
  const [probe, setProbe] = useState<{ lat: number; lon: number; steps: Steps; error?: string } | null>(null)
  const [check, setCheck] = useState<{ siteId: string; steps: Steps; factors: Record<FactorKey, FactorValue> | null } | null>(null)
  const compact = useMedia('(max-width: 899px)')
  const scanPanel = useRef<HTMLElement>(null)
  const { tutorialEvent, tutorialDone } = g
  const markers = targetsOf(target.world).map(t => ({ id: t.id, lat: t.lat, lon: t.lon, label: t.name }))

  useEffect(() => setMessage(null), [g.selectedSiteId, mission.id])
  useEffect(() => { if (g.selectedSiteId) tutorialEvent('site') }, [g.selectedSiteId, tutorialEvent])
  useEffect(() => {
    if (!scanning) return
    const t = setTimeout(() => { setScanning(false); tutorialEvent('scanned') }, prefersReducedMotion() ? 0 : 1800)
    return () => clearTimeout(t)
  }, [scanning, tutorialEvent])
  // On phones the scan panel sits under the map: bring it up when a site is picked.
  useEffect(() => {
    if (site && compact && tutorialDone) scanPanel.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [site?.id, compact, tutorialDone]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const doCertify = () => {
    if (!site) return
    const r = g.certify(site.id)
    setReward(r)
    if (r.stars > 0) tutorialEvent('certified')
  }

  /** Distance to the nearest town of 1,000+ people from the bundled global grid (works offline). */
  const townKmAt = async (lat: number, lon: number) => {
    const grid = await loadEarthGrid().catch(() => null)
    const cell = grid ? cellAt(grid, lat, lon) : -1
    return grid && cell >= 0 ? grid.townKm[cell] : null
  }

  /** Characterize any point on Earth from live open data, then add it to the map as a discovery. */
  const startProbe = async (lat: number, lon: number, note?: string) => {
    if (probe && !probe.error) return
    const id = `probe-${Date.now().toString(36)}`
    g.selectSite(null)
    setProbe({ lat, lon, steps: {} })
    sfx('scan')
    const [res, townKm] = await Promise.all([
      runProbe(lat, lon, { onStep: (sid, st) => setProbe(p => (p && p.lat === lat && p.lon === lon ? { ...p, steps: { ...p.steps, [sid]: st } } : p)) }),
      townKmAt(lat, lon),
    ])
    const fail = (error: string) => { sfx('error'); setProbe(p => (p && p.lat === lat && p.lon === lon ? { ...p, error } : p)) }
    if (!res.climate && !res.elevations && res.ndvi == null && !res.geology) return fail('No data service answered. Check the internet connection and try again.')
    if (res.elevations && looksLikeSea(res.elevations)) return fail('That point looks like open water. Probe a place on land.')
    const found = probeSite(id, lat, lon, res.place, { ...res, townKm })
    if (note) found.description = `${found.description} ${note}`
    g.addDiscovery(found)
    g.selectSite(found.id)
    setProbe(null)
  }

  /** Measure a listed site live and compare with the team's estimates. */
  const startCheck = async () => {
    if (!site) return
    const { id, lat, lon } = site
    setCheck({ siteId: id, steps: {}, factors: null })
    const [res, townKm] = await Promise.all([
      runProbe(lat, lon, { skipPlace: true, onStep: (sid, st) => setCheck(c => (c && c.siteId === id ? { ...c, steps: { ...c.steps, [sid]: st } } : c)) }),
      townKmAt(lat, lon),
    ])
    setCheck(c => (c && c.siteId === id ? { ...c, factors: probeFactors(lat, lon, { ...res, townKm }) } : c))
  }

  // The Twin finder's Global search can hand over a spot to probe as soon as this screen opens
  const handoff = useRef(false)
  useEffect(() => {
    const p = g.pendingProbe
    if (!p || handoff.current) return
    handoff.current = true
    g.setPendingProbe(null)
    void startProbe(p.lat, p.lon, p.note)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const armProbe = () => {
    window.dispatchEvent(new Event('ls-arm-probe'))
    if (compact) document.querySelector('.map-col')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }

  const result = site && isScanned ? computeASI(site, target, mission) : null
  const sw = result ? strengthsAndWeaknesses(result) : null
  const pass = result?.asi != null && result.asi >= mission.passAsi
  const weightKeys = Object.keys(mission.weights) as FactorKey[]
  const scanLines = weightKeys.map(k => ({
    label: FACTOR_LABELS[k],
    source: (sourceById(site?.factors[k].sourceId ?? '')?.name ?? 'Unknown source').split(' (')[0],
  }))
  const estimates = result ? result.factors.filter(f => site!.factors[f.key].estimate).length : 0
  const dataNote = !result ? '' : estimates === 0
    ? 'All values here are measured or computed from the sources below.'
    : estimates === result.factors.length ? 'Values are team estimates from the sources below.' : `${estimates} of ${result.factors.length} values are team estimates; the rest are measured or computed.`
  const polar = target.world === 'moon' && (target.factors.lowsun ?? 0) >= 0.5

  // A strong live discovery far from every listed analog is a new analog candidate
  const best = site?.status === 'discovery' ? matchesFor(site)[0] : null
  const nearestListed = site?.status === 'discovery' ? nearest(site, EARTH_SITES) : null
  const isNewAnalog = !!best && best.asi >= NEW_ANALOG_ASI && !!nearestListed && nearestListed.km > NEW_ANALOG_KM
  const liveRows = check?.factors && site && check.siteId === site.id
    ? FACTOR_KEYS.filter(k => check.factors![k].value != null && check.factors![k].sourceId !== 'solar-geometry')
    : []

  return (
    <div className="explore">
      <aside className="panel brief" data-tut="brief">
        <header className="brief-head">
          <span className="mission-no" aria-label={`Mission ${missionNo}`}>{String(missionNo).padStart(2, '0')}</span>
          <h2>{mission.title}</h2>
        </header>
        <div className="target-view">
          <MoonGlobe size={compact ? 112 : 176} maxRes={320} target={target} markers={markers} world={target.world} label={`${WORLD_LABEL[target.world]}, turned to ${target.name}`} />
          <p className="target-name"><span className={`chip world-${target.world}`}>{WORLD_LABEL[target.world]}</span>{target.name}</p>
          <p className="coords">{target.approx ? '≈ ' : ''}{fmtCoords(target.lat, target.lon)}</p>
          {target.program && <p className="coords">{target.program}</p>}
        </div>
        <p>{mission.brief}</p>
        <p className="tip"><Icon name="tip" size={18} /><span>Hint: {mission.equipmentTip}</span></p>
        <h3>What counts</h3>
        <ul className="weights" data-tut="weights">
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
        <div className="brief-actions">
          <button className="btn ghost cut small" onClick={() => g.go('missions')}>Change mission</button>
          <button className="btn ghost cut small" onClick={() => { g.setTwinTarget(target.id); g.go('twins') }}><Icon name="twins" size={16} />Twin finder</button>
        </div>
      </aside>

      <section className="map-col" data-tut="map">
        <EarthMap selectedId={g.selectedSiteId} scannedIds={scannedIds} onSelect={g.selectSite} sites={sites} onProbe={startProbe} probing={probe && !probe.error ? probe : null} />
      </section>

      <aside className="panel scan" ref={scanPanel}>
        {probe && (
          <div className="probe-live">
            <h2>{probe.error ? 'Probe failed' : 'Probing with live data'}</h2>
            <p className="coords">{fmtCoords(probe.lat, probe.lon, 3)}</p>
            <ProbeSteps steps={probe.steps} />
            {probe.error
              ? <><p className="message" role="alert">{probe.error}</p><button className="btn ghost cut small" onClick={() => setProbe(null)}>Close</button></>
              : <p className="meta">Reading climate, terrain, vegetation and rock type for this exact spot. Caves and remoteness need field surveys, so they stay as no data.</p>}
          </div>
        )}

        {!site && !probe && (
          <div className="pick">
            <h2>Pick a site</h2>
            <p className="meta">Tap a marker on the map, or choose from the list.</p>
            <select aria-label="Choose a site" onChange={e => g.selectSite(e.target.value || null)} value="">
              <option value="">Choose a site…</option>
              {g.discoveries.length > 0 && (
                <optgroup label="Your discoveries">
                  {g.discoveries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              )}
              <optgroup label="Listed analog sites">
                {EARTH_SITES.map(s => <option key={s.id} value={s.id}>{s.name}, {s.country}</option>)}
              </optgroup>
            </select>
            <p className="pick-hint"><Icon name="probe" size={16} />{probesLeft} of {PROBES_PER_MISSION} probes left for this mission.</p>
            <div className="discover-card cut">
              <h3>Find a new analog</h3>
              <p>Probe any point on Earth. The app reads NASA POWER climate, ESA Copernicus terrain, NASA MODIS vegetation and the geologic map for that spot, then scores it against every Moon and Mars site.</p>
              <button className="btn primary cut small" onClick={armProbe}><Icon name="target" size={16} />Arm the probe tool</button>
              <p className="meta">Or search a place on the map and press "Probe here".</p>
            </div>
          </div>
        )}

        {site && !probe && (
          <>
            <div className="site-head">
              <span className={`chip st-${site.status}`}>{STATUS_LABEL[site.status]}</span>
              {isNewAnalog && <span className="chip gold new-analog"><Icon name="star" size={12} />New analog candidate</span>}
              <h2>{site.name}</h2>
              <p className="coords">{site.country}, {fmtCoords(site.lat, site.lon)}</p>
              {g.myLocation && <p className="coords from-you"><Icon name="target" size={13} />{formatDistance(distanceKm(g.myLocation, site), g.mapPrefs.units)} from you</p>}
            </div>
            <p>{site.description}</p>
            {site.analogUse && <p className="meta"><Icon name="flag" size={14} /> Used for: {site.analogUse}</p>}
            {!!site.processes?.length && <ul className="proc-chips" aria-label="Processes at work here">{site.processes.map(p => <li key={p}>{PROCESS_LABELS[p]}</li>)}</ul>}
            {site.status === 'discovery' && best && nearestListed && (
              <p className="tip"><Icon name="info" size={18} /><span>
                Best match: {best.target.name} ({WORLD_LABEL[best.target.world]}), {best.asi}. Nearest listed analog: {nearestListed.item.name}, {formatDistance(nearestListed.km, g.mapPrefs.units)} away.
                {isNewAnalog ? ' Strong and far from known analogs: worth a field visit.' : ` New analog candidates score ${NEW_ANALOG_ASI}+ and sit over ${NEW_ANALOG_KM} km from listed sites.`}
              </span></p>
            )}

            {!isScanned && (
              <button className="btn primary cut wide" data-sfx="none" data-tut="scan-button" onClick={doScan} disabled={probesLeft <= 0}>
                <Icon name="scan" size={18} />Scan this site<span className="cost">uses 1 probe</span>
              </button>
            )}

            {isScanned && scanning && <Scanner siteName={site.name} lines={scanLines} />}

            {isScanned && !scanning && result && (
              <div className="result" aria-live="polite" data-tut="result">
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
                <p className="meta">{dataNote}</p>
                <AsiRadar result={result} />
                {sw && (sw.strengths.length > 0 || sw.weaknesses.length > 0) && (
                  <div className="sw">
                    {sw.strengths.length > 0 && <p><span className="sw-label">Strengths</span>{sw.strengths.map(k => <span key={k} className="chip good">{FACTOR_LABELS[k]}</span>)}</p>}
                    {sw.weaknesses.length > 0 && <p><span className="sw-label">Weak points</span>{sw.weaknesses.map(k => <span key={k} className="chip bad">{FACTOR_LABELS[k]}</span>)}</p>}
                  </div>
                )}
                {polar && (
                  <>
                    <h3>South-pole light here</h3>
                    <LightCalendar lat={site.lat} maxDeg={lunarMaxSun(target.lat)} targetName={target.name.split(' (')[0]} />
                  </>
                )}
                <details>
                  <summary>Data sources</summary>
                  <ul className="sources">
                    {result.factors.map(f => {
                      const fv = site.factors[f.key]
                      const src = sourceById(fv.sourceId)
                      return (
                        <li key={f.key}>
                          <strong>{FACTOR_LABELS[f.key]}</strong>: {fv.raw}{fv.estimate ? ' (estimate)' : ''}. {src ? <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a> : 'unknown source'}
                        </li>
                      )
                    })}
                  </ul>
                </details>
                <button className="btn primary cut wide" data-sfx="none" data-tut="certify" onClick={doCertify}><Icon name="check" size={18} />Certify this site</button>
              </div>
            )}

            {site.status !== 'discovery' && (
              <div className="live-check">
                {!check || check.siteId !== site.id ? (
                  <button className="btn ghost cut small" onClick={startCheck}><Icon name="signal" size={16} />Check against live data</button>
                ) : !check.factors ? (
                  <><p className="meta">Measuring this site live…</p><ProbeSteps steps={check.steps} skip={['place']} /></>
                ) : (
                  <details open>
                    <summary>Live data check</summary>
                    {liveRows.length === 0 ? <p className="meta">No service answered. Try again when online.</p> : (
                      <table className="live-table">
                        <thead><tr><th>Factor</th><th>Listed</th><th>Live</th></tr></thead>
                        <tbody>
                          {liveRows.map(k => {
                            const a = site.factors[k], b = check.factors![k]
                            return (
                              <tr key={k}>
                                <th scope="row">{FACTOR_LABELS[k]}</th>
                                <td>{a.value == null ? '–' : a.value.toFixed(2)}{a.estimate ? '*' : ''}</td>
                                <td title={b.raw}>{b.value!.toFixed(2)} <small>{b.raw}</small></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    <p className="meta">* team estimate. Live values cover the exact point and the nearest data grid cell, so a site that spans many kilometres can differ.</p>
                  </details>
                )}
              </div>
            )}

            <div className="report-row">
              <button className="btn ghost cut small" onClick={() => download(`analog-passport-${slug(site.name)}.md`, passportMarkdown(site, APP_NAME))}><Icon name="download" size={16} />Analog Passport</button>
              <button className="btn ghost cut small" onClick={() => download(`analog-passport-${slug(site.name)}.json`, JSON.stringify(passportJson(site, APP_NAME), null, 2), 'application/json')}>JSON</button>
              {site.status === 'discovery' && <button className="btn ghost cut small danger" onClick={() => g.removeDiscovery(site.id)}><Icon name="remove" size={16} />Remove probe</button>}
            </div>
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
