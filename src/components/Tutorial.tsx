import { useEffect, useRef, useState } from 'react'
import { useGame, type Screen } from '../store'
import { TUTORIAL } from '../data/tutorial'
import Icon from './Icon'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion } from '../lib/motion'

const LABELS: Record<Screen, string> = {
  title: 'Main menu', missions: 'Missions', explore: 'Explore Earth', land: 'Landing site',
  build: 'Base', journal: 'Journal', dashboard: 'Progress', about: 'About',
}

interface Box { x: number; y: number; w: number; h: number }
interface Frame { target: Box | null; vw: number; vh: number; top: number; bubbleH: number; hidden: boolean }

const near = (a: number, b: number) => Math.abs(a - b) < 0.5
const sameBox = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h))
const sameFrame = (a: Frame, b: Frame) => sameBox(a.target, b.target) && a.vw === b.vw && a.vh === b.vh && near(a.top, b.top) && near(a.bubbleH, b.bubbleH) && a.hidden === b.hidden

/**
 * Guided tutorial. Mission Control spotlights the real control for each step and the
 * step moves on when the player actually does the thing (see data/tutorial.ts).
 * It never blocks the game: the dimmed area stays clickable and every step can be skipped.
 */
export default function Tutorial() {
  const { screen, tutorialStep, nextTutorialStep, finishTutorial, go } = useGame()
  const index = Math.min(tutorialStep, TUTORIAL.length - 1)
  const step = TUTORIAL[index]
  const here = step.screen === screen
  const targetName = here ? step.target : `tab-${step.screen}`
  const title = here ? step.title : `Head to ${LABELS[step.screen]}`
  const text = here ? step.text : step.navText
  const waiting = here && !!step.waitFor
  const last = index === TUTORIAL.length - 1
  const bubble = useRef<HTMLElement>(null)
  const [frame, setFrame] = useState<Frame>({ target: null, vw: 1280, vh: 800, top: 64, bubbleH: 220, hidden: false })
  const [typed, setTyped] = useState(text.length)

  // Follow the target every frame: it moves with scrolling, resizing and animations.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const el = document.querySelector<HTMLElement>(`[data-tut="${targetName}"]`)
      const r = el?.getBoundingClientRect()
      const next: Frame = {
        target: r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
        vw: window.innerWidth,
        vh: window.innerHeight,
        top: document.querySelector('.hud')?.getBoundingClientRect().bottom ?? 64,
        bubbleH: bubble.current?.offsetHeight ?? 220,
        hidden: !!document.querySelector('[aria-modal="true"], .descent'),
      }
      setFrame(prev => (sameFrame(prev, next) ? prev : next))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [targetName])

  // Bring the target into view when the step changes.
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-tut="${targetName}"]`)
      if (!el) return
      const r = el.getBoundingClientRect()
      const visible = r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth
      if (!visible) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: r.height > window.innerHeight * 0.55 ? 'start' : 'center', inline: 'center' })
    }, 380)
    return () => clearTimeout(t)
  }, [targetName, index])

  // Typed-out message
  useEffect(() => {
    if (prefersReducedMotion()) { setTyped(text.length); return }
    setTyped(0)
    let n = 0
    const id = setInterval(() => {
      n += 2
      setTyped(n)
      if (n % 8 === 0) sfx('type')
      if (n >= text.length) clearInterval(id)
    }, 22)
    return () => clearInterval(id)
  }, [text])

  if (frame.hidden) return null
  const { target, vw, vh, top, bubbleH } = frame
  const narrow = vw < 700
  const m = narrow ? 10 : 16
  const w = narrow ? vw - m * 2 : Math.min(370, vw - m * 2)
  const safeTop = top + m
  const spots = narrow
    ? [{ x: m, y: vh - bubbleH - m }, { x: m, y: safeTop }]
    : [{ x: vw - w - m, y: vh - bubbleH - m }, { x: m, y: vh - bubbleH - m }, { x: vw - w - m, y: safeTop }, { x: m, y: safeTop }]
  const hits = (p: { x: number; y: number }) =>
    !!target && !(p.x + w < target.x - 10 || p.x > target.x + target.w + 10 || p.y + bubbleH < target.y - 10 || p.y > target.y + target.h + 10)
  const pos = spots.find(p => !hits(p)) ?? spots[0]

  return (
    <>
      {target && <div className="coach-spot" aria-hidden="true" style={{ left: target.x - 6, top: target.y - 6, width: target.w + 12, height: target.h + 12 }} />}
      <aside ref={bubble} className="coach cut" style={{ left: pos.x, top: Math.max(safeTop, pos.y), width: w }} role="dialog" aria-labelledby="tut-title" aria-describedby="tut-text">
        <header className="tx-head">
          <Icon name="signal" size={16} className="tx-signal" />
          <span>Mission Control</span>
          <span className="tx-step">Step {index + 1} of {TUTORIAL.length}</span>
        </header>
        <h2 id="tut-title" className="tx-title">{title}</h2>
        <p id="tut-text" className="tx-text">
          <span className="sr-only">{text}</span>
          <span aria-hidden="true">{text.slice(0, typed)}{typed < text.length && <span className="caret" />}</span>
        </p>
        {waiting && <p className="tx-wait"><span className="tx-dot" />{step.waitText}</p>}
        <div className="tx-bar" aria-hidden="true"><span style={{ width: `${((index + 1) / TUTORIAL.length) * 100}%` }} /></div>
        <div className="dialog-actions">
          <button className="btn ghost cut small" data-sfx="back" onClick={finishTutorial}>Skip tutorial</button>
          {!here ? (
            <button className="btn primary cut small" data-sfx="tab" onClick={() => go(step.screen)}>Take me there</button>
          ) : (
            <button className={`btn cut small ${waiting ? 'ghost' : 'primary'}`} onClick={nextTutorialStep}>
              {last ? 'Finish' : waiting ? 'Skip step' : 'Next'}
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
