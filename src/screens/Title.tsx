import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { totalStars, useGame } from '../store'
import { rankFor } from '../lib/base'
import MoonGlobe from '../components/MoonGlobe'
import EarthGlobe from '../components/EarthGlobe'
import Starfield from '../components/Starfield'
import Icon from '../components/Icon'
import type { Vec3 } from '../lib/globe'
import { prefersReducedMotion } from '../lib/motion'

// One sun for the whole scene, so Earth and Moon are lit from the same side.
const SUN: Vec3 = [-0.86, 0.26, 0.44]

export default function Title() {
  const { go, tutorialDone, completed, researchPoints, muted, toggleMuted, music, toggleMusic, startTutorial } = useGame()
  const returning = Object.keys(completed).length > 0
  const stars = totalStars(completed)
  const root = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const earth = useRef<HTMLDivElement>(null)
  const moon = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const [sizes, setSizes] = useState({ moon: 760, earth: 92 })
  const [route, setRoute] = useState<{ d: string; tx: number; ty: number } | null>(null)
  const [moonOn, setMoonOn] = useState(false)

  // Size the scene from the viewport (portrait phones get a bigger Moon low on screen).
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight
      const portrait = h > w * 1.05
      setSizes({
        moon: Math.round(portrait ? Math.min(w * 1.3, h * 0.72) : Math.min(h * 0.98, w * 0.66)),
        earth: Math.round(Math.max(46, Math.min(112, (portrait ? w : h) * 0.105))),
      })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Gold trajectory from Earth to a landing point on the Moon's lit face.
  useEffect(() => {
    const calc = () => {
      const e = earth.current?.getBoundingClientRect()
      const m = moon.current?.getBoundingClientRect()
      const r = scene.current?.getBoundingClientRect()
      if (!e || !m || !r) return
      const ex = e.left - r.left + e.width / 2, ey = e.top - r.top + e.height / 2
      const mx = m.left - r.left + m.width / 2, my = m.top - r.top + m.height / 2
      const a = Math.atan2(my - ey, mx - ex)
      const sx = ex + Math.cos(a) * e.width * 0.62, sy = ey + Math.sin(a) * e.width * 0.62
      const tx = mx - m.width * 0.2, ty = my - m.height * 0.12
      const dist = Math.hypot(tx - sx, ty - sy)
      const cx = (sx + tx) / 2 + dist * 0.06, cy = Math.min(sy, ty) - dist * 0.28
      setRoute({ d: `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`, tx, ty })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [sizes])

  // Gentle parallax that follows the mouse.
  useEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const onMove = (ev: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', ((ev.clientX / window.innerWidth) * 2 - 1).toFixed(3))
        el.style.setProperty('--my', ((ev.clientY / window.innerHeight) * 2 - 1).toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf) }
  }, [])

  // Highlight the first menu item once the intro settles, so Enter starts the game.
  useEffect(() => {
    const t = setTimeout(() => {
      if (document.activeElement === document.body) primary.current?.focus({ preventScroll: true })
    }, prefersReducedMotion() ? 0 : 1500)
    return () => clearTimeout(t)
  }, [])

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div className="title-screen" ref={root}>
      <div className="title-layer sky"><Starfield /></div>
      <div className="title-layer scene" ref={scene}>
        <div className="title-earth" ref={earth}><EarthGlobe size={sizes.earth} light={SUN} /></div>
        <div className={`title-moon ${moonOn ? 'on' : ''}`} ref={moon}>
          <MoonGlobe size={sizes.moon} spin={2.2} tilt={6} lon={-8} light={SUN} maxRes={700} label="The Moon, slowly turning" onReady={() => setMoonOn(true)} />
        </div>
        {route && (
          <svg className="trajectory" aria-hidden="true">
            <path id="route" className="route-glow" d={route.d} />
            <path className="route" d={route.d} />
            <circle className="route-craft" r="3">
              <animateMotion dur="5.5s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .4 1">
                <mpath href="#route" />
              </animateMotion>
            </circle>
            <g className="route-target" transform={`translate(${route.tx.toFixed(1)} ${route.ty.toFixed(1)})`}>
              <circle r="9" /><circle r="16" className="ping" />
            </g>
          </svg>
        )}
      </div>
      <div className="title-scrim" aria-hidden="true" />
      <div className="title-reseau" aria-hidden="true" />

      <div className="title-ui">
        <header className="title-brand">
          <h1 className="logo" aria-label="Lunar Scout">
            <span aria-hidden="true">Lunar</span>
            <span aria-hidden="true">Scout</span>
          </h1>
          <p className="logo-sub">Earth Analog Hunt</p>
          <p className="title-lede">
            Find the Moon on Earth. Before anyone builds a base on the Moon, crews test their gear in places on Earth
            that behave like it. Scout those places with real NASA data, pick your landing site, and build your base.
          </p>
        </header>

        <nav className="title-menu" aria-label="Main menu" ref={menu} onKeyDown={onMenuKey}>
          <button ref={primary} className="menu-item primary" onClick={() => go(tutorialDone ? 'missions' : 'explore')}>
            <span className="mi-label">{returning ? 'Continue scouting' : 'Start scouting'}</span>
            <span className="mi-sub">
              {returning ? `${rankFor(stars)}, ${stars} ${stars === 1 ? 'star' : 'stars'}, ${researchPoints} research points` : 'Begins with a short guided mission'}
            </span>
            <kbd className="mi-key" aria-hidden="true">Enter</kbd>
          </button>
          <button className="menu-item" onClick={() => go('missions')}><span className="mi-label">Missions</span></button>
          <button className="menu-item" onClick={startTutorial}><span className="mi-label">Tutorial</span></button>
          <button className="menu-item" onClick={() => go('about')}><span className="mi-label">How it works</span></button>
        </nav>
        <div className="title-toggles">
          <button className="toggle-chip" aria-pressed={music} onClick={toggleMusic}>
            <Icon name={music ? 'music' : 'musicOff'} size={17} />Music {music ? 'on' : 'off'}
          </button>
          <button className="toggle-chip" aria-pressed={!muted} onClick={toggleMuted}>
            <Icon name={muted ? 'soundOff' : 'soundOn'} size={17} />Sound effects {muted ? 'off' : 'on'}
          </button>
        </div>
      </div>

      <footer className="title-foot">
        <span>NASA Space Apps Challenge 2026, Kuala Lumpur</span>
        <span className="title-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> choose <kbd>Enter</kbd> select <kbd>N</kbd> music <kbd>M</kbd> sound</span>
        <span>v0.1.0</span>
      </footer>
    </div>
  )
}
