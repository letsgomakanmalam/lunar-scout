import { useEffect, useState } from 'react'
import { useGame } from '../store'
import Icon from './Icon'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion } from '../lib/motion'

const STEPS = [
  { title: 'Your mission', text: 'Each mission names a place on the Moon and what matters there. Read the mission brief first.' },
  { title: 'Scan Earth', text: 'Tap a dot on the map, then press Scan. Each scan uses one of your 8 probes, so choose with care.' },
  { title: 'Certify the best match', text: 'The score shows how Moon-like the site is for this mission. Certify a site that passes to earn research points for your base.' },
]

/** First-run guide, styled as a transmission from Mission Control with typed-out text. */
export default function Tutorial() {
  const { tutorialStep, setTutorialStep, finishTutorial } = useGame()
  const step = STEPS[tutorialStep]
  const last = tutorialStep === STEPS.length - 1
  const [typed, setTyped] = useState(step.text.length)

  useEffect(() => {
    if (prefersReducedMotion()) { setTyped(step.text.length); return }
    setTyped(0)
    let n = 0
    const id = setInterval(() => {
      n += 2
      setTyped(n)
      if (n % 6 === 0) sfx('type')
      if (n >= step.text.length) clearInterval(id)
    }, 24)
    return () => clearInterval(id)
  }, [step.text])

  return (
    <aside className="transmission cut" role="dialog" aria-labelledby="tut-title" aria-describedby="tut-text">
      <header className="tx-head">
        <Icon name="signal" size={16} className="tx-signal" />
        <span>Mission Control</span>
        <span className="tx-step">Step {tutorialStep + 1} of {STEPS.length}</span>
      </header>
      <h2 id="tut-title" className="tx-title">{step.title}</h2>
      <p id="tut-text" className="tx-text">
        <span className="sr-only">{step.text}</span>
        <span aria-hidden="true">{step.text.slice(0, typed)}{typed < step.text.length && <span className="caret" />}</span>
      </p>
      <div className="dialog-actions">
        <button className="btn ghost cut small" data-sfx="back" onClick={finishTutorial}>Skip tutorial</button>
        <button className="btn primary cut small" onClick={() => (last ? finishTutorial() : setTutorialStep(tutorialStep + 1))}>
          {last ? 'Start' : 'Next'}
        </button>
      </div>
    </aside>
  )
}
