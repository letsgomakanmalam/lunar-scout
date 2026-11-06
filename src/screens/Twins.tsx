import { useMemo } from 'react'
import { allSites, useGame } from '../store'
import { TARGETS, targetById, targetsOf } from '../data/targets'
import { FACTOR_HINTS, FACTOR_LABELS, WORLD_LABEL, type FactorKey, type World } from '../data/types'
import { sourceById } from '../data/sources'
import { GAPS } from '../data/gaps'
import { planCampaign, rankTwins } from '../lib/twins'
import { download, slug, twinReportMarkdown } from '../lib/passport'
import { lunarMaxSun } from '../lib/sun'
import { distanceKm, formatDistance } from '../lib/geo'
import { fmtCoords } from '../lib/format'
import MoonGlobe from '../components/MoonGlobe'
import LightCalendar from '../components/LightCalendar'
import Icon from '../components/Icon'
import { useMedia } from '../lib/motion'
import { APP_NAME } from '../brand'

const KIND = { base: 'Base site', landing: 'Landing site', science: 'Science target' } as const
const STATUS = { known: 'Known analog', candidate: 'New candidate', local: 'Malaysia', discovery: 'Your discovery' } as const

/**
 * Twin finder: the mission planner's view of the challenge. Pick a base or landing site on the
 * Moon or Mars; see which Earth places rehearse it best, the best combination of sites for a
 * field campaign, when the Sun behaves like the lunar south pole, and what Earth cannot copy.
 */
export default function Twins() {
  const g = useGame()
  const compact = useMedia('(max-width: 899px)')
  const t = TARGETS.find(x => x.id === g.twinTargetId) ?? targetById('shackleton')
  const sites = allSites(g)
  const twins = useMemo(() => rankTwins(t, sites), [t, sites])
  const plan = useMemo(() => planCampaign(t, sites, 3), [t, sites])
  const polar = t.world === 'moon' && (t.factors.lowsun ?? 0) >= 0.5
  const lightSites = polar ? twins.filter(r => (r.site.factors.lowsun.value ?? 0) > 0).slice(0, 2).map(r => r.site) : []
  const profile = (Object.entries(t.profile) as [FactorKey, number][]).sort((a, b) => b[1] - a[1])
  const nameOf = (id: string | null) => sites.find(s => s.id === id)?.name ?? 'none'

  const pickWorld = (w: World) => { if (w !== t.world) g.setTwinTarget(targetsOf(w)[0].id) }
  const openSite = (id: string) => { g.selectSite(id); g.go('explore') }

  return (
    <div className="page twins">
      <header className="screen-head">
        <h1 className="screen-title">Twin finder</h1>
        <p className="lede">Pick a base or landing site on the Moon or Mars. See which places on Earth rehearse it best, the best set of sites for a field campaign, and what no place on Earth can copy.</p>
      </header>

      <div className="world-tabs" role="tablist" aria-label="World">
        {(['moon', 'mars'] as World[]).map(w => (
          <button key={w} role="tab" aria-selected={t.world === w} className={`world-tab cut ${t.world === w ? 'on' : ''}`} onClick={() => pickWorld(w)}>
            <Icon name={w === 'mars' ? 'mars' : 'globe'} size={18} />{WORLD_LABEL[w]}
          </button>
        ))}
      </div>

      <div className="target-strip" role="list">
        {targetsOf(t.world).map(x => (
          <button key={x.id} role="listitem" className={`target-pill cut ${x.id === t.id ? 'on' : ''}`} aria-pressed={x.id === t.id} onClick={() => g.setTwinTarget(x.id)}>
            <strong>{x.name}</strong>
            <small>{KIND[x.kind]}{x.program ? ` · ${x.program}` : ''}</small>
          </button>
        ))}
      </div>

      <div className="twin-grid">
        <article className="panel twin-target cut">
          <div className="tt-globe"><MoonGlobe size={compact ? 150 : 200} maxRes={360} target={t} world={t.world} markers={targetsOf(t.world).map(x => ({ id: x.id, lat: x.lat, lon: x.lon, label: x.name }))} label={`${WORLD_LABEL[t.world]}, turned to ${t.name}`} /></div>
          <span className={`chip world-${t.world}`}>{WORLD_LABEL[t.world]} · {KIND[t.kind]}</span>
          <h2>{t.name}</h2>
          <p className="coords">{t.approx ? '≈ ' : ''}{fmtCoords(t.lat, t.lon)}{t.program ? ` · ${t.program}` : ''}</p>
          <p>{t.description}</p>
          <ul className="facts">{t.facts.map(f => <li key={f}>{f}</li>)}</ul>
          <h3>What matters for a crew here</h3>
          <ul className="weights">
            {profile.map(([k, w]) => (
              <li key={k} title={FACTOR_HINTS[k]}>
                <span>{FACTOR_LABELS[k]}</span>
                <span className="bar seg"><span style={{ width: `${w * 100 * 3}%` }} /></span>
              </li>
            ))}
          </ul>
          <p className="src-chips">
            {t.sourceIds.map(id => { const s = sourceById(id); return s ? <a key={id} className="chip" href={s.url} target="_blank" rel="noreferrer">{s.agency}: {s.name.split(' (')[0]}</a> : null })}
          </p>
        </article>

        <section className="panel twin-list" aria-labelledby="twins-h">
          <h2 id="twins-h">Best Earth twins</h2>
          <p className="meta">Ranked with the same Analog Similarity Index as the missions, using this site's crew profile. Includes your live discoveries.</p>
          <ol className="twin-rows">
            {twins.slice(0, 8).map((r, i) => (
              <li key={r.site.id} className="twin-row">
                <span className="tr-rank">{i + 1}</span>
                <span className="tr-name">
                  <button className="pc-link" onClick={() => openSite(r.site.id)}>{r.site.name}</button>
                  <small>{r.site.country} · <span className={`st-text st-${r.site.status}`}>{STATUS[r.site.status]}</span>{g.myLocation ? ` · ${formatDistance(distanceKm(g.myLocation, r.site), g.mapPrefs.units)} away` : ''}</small>
                </span>
                <span className="tr-score">
                  <span className="bar"><span style={{ width: `${r.result.asi}%` }} /></span>
                  <strong>{r.result.asi}</strong>
                  <small title="Share of the profile with data">{Math.round(r.result.confidence * 100)}% data</small>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="panel campaign-plan cut" aria-labelledby="plan-h">
        <h2 id="plan-h">Best three-site field campaign</h2>
        <p>
          No place on Earth is the {WORLD_LABEL[t.world]}. {plan.single && <>The best single site, <strong>{plan.single.site.name}</strong>, covers <strong>{Math.round(plan.single.coverage * 100)}%</strong> of what this site needs. </>}
          These {plan.sites.length} together cover <strong>{Math.round(plan.coverage * 100)}%</strong>:
        </p>
        <ol className="plan-sites">
          {plan.sites.map(s => {
            const roles = plan.factors.filter(f => f.siteId === s.id).map(f => FACTOR_LABELS[f.key])
            return (
              <li key={s.id} className="cut">
                <button className="pc-link" onClick={() => openSite(s.id)}>{s.name}</button>
                <small>{s.country}</small>
                <span>Best for: {roles.length ? roles.join(', ') : 'backup coverage'}</span>
              </li>
            )
          })}
        </ol>
        <ul className="weights cover">
          {plan.factors.map(f => (
            <li key={f.key}>
              <span>{FACTOR_LABELS[f.key]} <small>({nameOf(f.siteId)})</small></span>
              <span className="bar"><span style={{ width: `${f.best * 100}%` }} /></span>
            </li>
          ))}
        </ul>
        <p className="meta">Greedy maximum-coverage selection: each step adds the site that fills the biggest remaining gap.</p>
      </section>

      {polar && lightSites.length > 0 && (
        <section className="panel cut" aria-labelledby="light-h">
          <h2 id="light-h">When Earth's Sun copies the south pole</h2>
          <p>At {t.name.split(' (')[0]} the Sun never climbs above about {lunarMaxSun(t.lat).toFixed(1)}°. NASA rehearses this with spotlights at night. These twins get the real thing on these dates (computed from solar geometry):</p>
          {lightSites.map(s => (
            <div key={s.id} className="light-block">
              <h3>{s.name}</h3>
              <LightCalendar lat={s.lat} maxDeg={lunarMaxSun(t.lat)} targetName={t.name.split(' (')[0]} />
            </div>
          ))}
        </section>
      )}

      <section className="panel cut" aria-labelledby="gap-h">
        <h2 id="gap-h">What no place on Earth can copy</h2>
        <div className="table-scroll">
          <table className="gap-table">
            <thead><tr><th scope="col">Condition</th><th scope="col">Earth</th><th scope="col">{WORLD_LABEL[t.world]}</th><th scope="col">How teams test it instead</th></tr></thead>
            <tbody>
              {GAPS.map(gp => (
                <tr key={gp.id}><th scope="row">{gp.label}</th><td>{gp.earth}</td><td>{t.world === 'moon' ? gp.moon : gp.mars}</td><td>{gp.instead}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="report-row">
        <button className="btn primary cut" onClick={() => download(`earth-twins-${slug(t.name)}.md`, twinReportMarkdown(t, sites, APP_NAME))}><Icon name="download" size={18} />Download twin report</button>
        <button className="btn ghost cut" onClick={() => g.go('missions')}>Play the missions</button>
      </div>
    </div>
  )
}
