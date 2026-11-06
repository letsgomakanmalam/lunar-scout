import { useEffect, useState } from 'react'
import { useGame } from '../store'
import { TARGETS } from '../data/targets'
import type { PlanetTarget, World } from '../data/types'
import MoonGlobe from '../components/MoonGlobe'
import Icon from '../components/Icon'
import Counter from '../components/Counter'
import { ConfirmDialog } from '../components/Modal'
import { fmtCoords } from '../lib/format'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion } from '../lib/motion'

const PIPS = { Easy: 1, Medium: 2, Hard: 3 } as const
const GROUPS: { world: World; title: string; note: string }[] = [
  { world: 'moon', title: 'Moon: south-pole base sites and a lava tube', note: 'Easiest first. The ridge by Shackleton is where NASA plans its Moon Base.' },
  { world: 'mars', title: 'Mars: first base sites', note: 'Harder: everything costs more and sunlight is weaker, but ice and air help.' },
]
const byDifficulty = (a: PlanetTarget, b: PlanetTarget) => PIPS[a.landing!.difficulty] - PIPS[b.landing!.difficulty]
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : 'None')

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
  const descending = TARGETS.find(t => t.id === descent)

  return (
    <div className="page">
      <header className="screen-head">
        <h1 className="screen-title">Landing site</h1>
        <p className="lede">Where you land changes what your base costs and what it does well. Use what you learned on Earth, and in the Twin finder, to decide.</p>
      </header>
      {!ready && (
        <div className="notice cut">
          <Icon name="info" size={20} />
          <span>Complete one mission first, so you have research points to build with.</span>
          <button className="btn primary cut small" onClick={() => go('missions')}>Go to missions</button>
        </div>
      )}
      {GROUPS.map(gr => (
      <section key={gr.world} className="land-group" aria-labelledby={`land-${gr.world}`}>
      <h2 id={`land-${gr.world}`} className="track-head"><Icon name={gr.world === 'mars' ? 'mars' : 'globe'} size={22} />{gr.title}</h2>
      <p className="meta track-lede">{gr.note}</p>
      <div className="landing-grid" data-tut={gr.world === 'moon' ? 'landing' : undefined}>
        {TARGETS.filter(t => t.landable && t.world === gr.world).sort(byDifficulty).map(t => {
          const l = t.landing!
          const chosen = landingId === t.id
          return (
            <article key={t.id} className={`landing-card cut ${chosen ? 'chosen' : ''}`}>
              <div className="lc-globe"><MoonGlobe size={176} maxRes={280} target={t} world={t.world} label={`${t.world === 'mars' ? 'Mars' : 'The Moon'}, turned to ${t.name}`} /></div>
              <h2>{t.name}</h2>
              <p className="coords">{t.approx ? '≈ ' : ''}{fmtCoords(t.lat, t.lon)}{t.program ? ` · ${t.program}` : ''}</p>
              <p className={`difficulty d-${l.difficulty.toLowerCase()}`}>
                <span className="dpips" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= PIPS[l.difficulty] ? 'on' : ''} />)}</span>
                {l.difficulty}
              </p>
              <p>{t.description}</p>
              <dl className="lc-stats">
                <div><dt>Build cost</dt><dd>×{l.costMultiplier.toFixed(2)}</dd></div>
                <div><dt>Solar bonus</dt><dd>{signed(l.powerBonus)}</dd></div>
              </dl>
              <ul className="perks">{l.perks.map(p => <li key={p}>{p}</li>)}</ul>
              <button className="btn primary cut" disabled={!ready || !!descent} data-sfx={chosen ? 'click' : 'none'} onClick={() => choose(t.id)}>
                {chosen ? 'Go to your base' : 'Land here'}
              </button>
            </article>
          )
        })}
      </div>
      </section>
      ))}

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
            <p className="descent-phase">{descending.world === 'mars' ? 'Entry, descent and landing' : 'Powered descent'}</p>
            <p className="descent-alt"><Counter from={descending.world === 'mars' ? 10000 : 2000} value={0} duration={1900} /><span> m</span></p>
            <div className="descent-bar"><span /></div>
            <p className="descent-site">Touchdown at {descending.name}</p>
          </div>
        </div>
      )}
    </div>
  )
}
