import { useEffect, useState } from 'react'
import { useGame } from '../store'
import { LUNAR_TARGETS } from '../data/moon'
import MoonGlobe from '../components/MoonGlobe'
import Icon from '../components/Icon'
import Counter from '../components/Counter'
import { ConfirmDialog } from '../components/Modal'
import { fmtCoords } from '../lib/format'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion } from '../lib/motion'

const PIPS = { Easy: 1, Medium: 2, Hard: 3 } as const

export default function Land() {
  const { completed, landingId, chooseLanding, go, tutorialEvent } = useGame()
  const ready = Object.keys(completed).length > 0
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [descent, setDescent] = useState<string | null>(null)

  // Touchdown sequence, then on to the base builder.
  useEffect(() => {
    if (!descent) return
    sfx('land')
    const t = setTimeout(() => { chooseLanding(descent); tutorialEvent('landed') }, prefersReducedMotion() ? 0 : 2300)
    return () => clearTimeout(t)
  }, [descent, chooseLanding, tutorialEvent])

  const choose = (id: string) => {
    if (landingId === id) return go('build')
    if (landingId) return setConfirmId(id)
    setDescent(id)
  }
  const descending = LUNAR_TARGETS.find(t => t.id === descent)

  return (
    <div className="page">
      <header className="screen-head">
        <h1 className="screen-title">Landing site</h1>
        <p className="lede">Where you land changes what your base costs and what it does well. Use what you learned on Earth to decide.</p>
      </header>
      {!ready && (
        <div className="notice cut">
          <Icon name="info" size={20} />
          <span>Complete one mission first, so you have research points to build with.</span>
          <button className="btn primary cut small" onClick={() => go('missions')}>Go to missions</button>
        </div>
      )}
      <div className="landing-grid" data-tut="landing">
        {LUNAR_TARGETS.filter(t => t.landable).map(t => {
          const l = t.landing!
          const chosen = landingId === t.id
          return (
            <article key={t.id} className={`landing-card cut ${chosen ? 'chosen' : ''}`}>
              <div className="lc-globe"><MoonGlobe size={176} maxRes={280} target={t} label={`The Moon, turned to ${t.name}`} /></div>
              <h2>{t.name}</h2>
              <p className="coords">{fmtCoords(t.lat, t.lon)}</p>
              <p className={`difficulty d-${l.difficulty.toLowerCase()}`}>
                <span className="dpips" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= PIPS[l.difficulty] ? 'on' : ''} />)}</span>
                {l.difficulty}
              </p>
              <p>{t.description}</p>
              <dl className="lc-stats">
                <div><dt>Build cost</dt><dd>×{l.costMultiplier.toFixed(2)}</dd></div>
                <div><dt>Solar bonus</dt><dd>{l.powerBonus ? `+${l.powerBonus}` : 'None'}</dd></div>
              </dl>
              <ul className="perks">{l.perks.map(p => <li key={p}>{p}</li>)}</ul>
              <button className="btn primary cut" disabled={!ready || !!descent} data-sfx={chosen ? 'click' : 'none'} onClick={() => choose(t.id)}>
                {chosen ? 'Go to your base' : 'Land here'}
              </button>
            </article>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirmId != null}
        title="Move your base?"
        body="Changing your landing site clears your base, and the modules you built are not refunded."
        confirmLabel="Land at the new site"
        danger
        onConfirm={() => { const id = confirmId; setConfirmId(null); if (id) setDescent(id) }}
        onCancel={() => setConfirmId(null)}
      />

      {descending && (
        <div className="descent" role="status" aria-live="assertive">
          <div className="descent-box">
            <p className="descent-phase">Powered descent</p>
            <p className="descent-alt"><Counter from={2000} value={0} duration={1900} /><span> m</span></p>
            <div className="descent-bar"><span /></div>
            <p className="descent-site">Touchdown at {descending.name}</p>
          </div>
        </div>
      )}
    </div>
  )
}
