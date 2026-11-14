import { useEffect, useMemo, useState } from 'react'
import type { EarthSite, FactorKey, PlanetTarget } from '../data/types'
import { FACTOR_LABELS } from '../data/types'
import { TEST_LABEL, compareTwins, explainTwin, testsFor, whereToTest, type Point } from '../lib/explain'
import Icon from './Icon'

interface Props {
  target: PlanetTarget
  /** Earth sites, best twin first */
  sites: EarthSite[]
  /** The site being asked about (set by the "Why?" buttons in the list above) */
  siteId: string | null
  onSite: (id: string) => void
  onOpen: (id: string) => void
}

const Points = ({ items }: { items: Point[] }) => (
  <ul className="why-points">
    {items.map(p => <li key={p.title} className={p.tone}><strong>{p.title}</strong><span>{p.text}</span></li>)}
  </ul>
)

/**
 * Ask why: the app explains its own answers in plain words (lib/explain). Three questions:
 * why is this place a match, why this one rather than that one, and where should I test something.
 */
export default function AskWhy({ target, sites, siteId, onSite, onOpen }: Props) {
  const [otherId, setOtherId] = useState('')
  const [test, setTest] = useState<FactorKey | null>(null)
  const site = sites.find(s => s.id === siteId) ?? sites[0]
  const other = sites.find(s => s.id === otherId && s.id !== site?.id) ?? null
  const tests = useMemo(() => testsFor(target), [target])
  useEffect(() => { setTest(null); setOtherId('') }, [target.id])

  const why = useMemo(() => (site ? explainTwin(site, target) : null), [site, target])
  const versus = useMemo(() => (site && other ? compareTwins(site, other, target) : null), [site, other, target])
  const where = useMemo(() => (test ? whereToTest(target, sites, test) : null), [test, target, sites])
  if (!site || !why) return <p className="meta">No sites to explain yet.</p>
  const short = target.name.split(' (')[0]

  return (
    <div className="ask-why">
      <p className="meta">
        The app explains its own answers. These explanations are written from the numbers on this page by fixed rules, not by a
        chatbot: every figure can be traced to a factor, the same question always gets the same answer, and it works offline.
      </p>

      <div className="why-q">
        <label>
          <span>Why is this place like {short}?</span>
          <select value={site.id} onChange={e => onSite(e.target.value)}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span>Why this one and not…</span>
          <select value={other?.id ?? ''} onChange={e => setOtherId(e.target.value)}>
            <option value="">Choose a second place to compare</option>
            {sites.filter(s => s.id !== site.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div className="why-answer cut" aria-live="polite">
        <p className="why-verdict"><Icon name="info" size={18} /><span>{why.verdict}</span></p>
        {why.why.length > 0 && <><h3>Why it matches</h3><Points items={why.why} /></>}
        {why.whyNot.length > 0 && <><h3>Where the likeness breaks down</h3><Points items={why.whyNot} /></>}
        {why.notes.length > 0 && <><h3>Worth knowing</h3><Points items={why.notes} /></>}
        <button className="btn ghost cut" onClick={() => onOpen(site.id)}><Icon name="globe" size={16} />Open {site.name} on the map</button>
      </div>

      {versus && other && (
        <div className="why-answer versus cut" aria-live="polite">
          <p className="why-verdict"><Icon name="twins" size={18} /><span>{versus.verdict}</span></p>
          <div className="why-cols">
            <div>
              <h3>{site.name} is ahead on</h3>
              {versus.aLeads.length ? <ul className="why-leads">{versus.aLeads.map(l => <li key={l.key}><span>{FACTOR_LABELS[l.key]}</span><strong>+{Math.round(l.points)}</strong></li>)}</ul> : <p className="meta">Nothing that matters here.</p>}
            </div>
            <div>
              <h3>{other.name} is ahead on</h3>
              {versus.bLeads.length ? <ul className="why-leads">{versus.bLeads.map(l => <li key={l.key}><span>{FACTOR_LABELS[l.key]}</span><strong>+{Math.round(l.points)}</strong></li>)}</ul> : <p className="meta">Nothing that matters here.</p>}
            </div>
          </div>
          <p className="why-advice">{versus.advice}</p>
        </div>
      )}

      <h3 className="sub-h">Where should I test…</h3>
      <div className="why-tests" role="group" aria-label={`Tests to rehearse for ${short}`}>
        {tests.map(k => <button key={k} className="chip-btn" aria-pressed={test === k} onClick={() => setTest(test === k ? null : k)}>{TEST_LABEL[k]}</button>)}
      </div>
      {where && (
        <div className="why-answer cut" aria-live="polite">
          <p className="why-verdict"><Icon name="pin" size={18} /><span>{where.text}</span></p>
          {where.picks.length > 0 && (
            <div className="report-row">
              {where.picks.map(p => <button key={p.site.id} className="btn ghost cut" onClick={() => onSite(p.site.id)}>Why {p.site.name}?</button>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
