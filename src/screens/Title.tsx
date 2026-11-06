import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { totalStars, useGame } from '../store'
import { rankFor } from '../lib/base'
import MoonGlobe from '../components/MoonGlobe'
import EarthGlobe from '../components/EarthGlobe'
import { APP_NAME } from '../brand'
import Starfield from '../components/Starfield'
import Icon from '../components/Icon'
import type { Vec3 } from '../lib/globe'
import { prefersReducedMotion } from '../lib/motion'
import { ConfirmDialog } from '../components/Modal'
import CosmicIntro from '../components/CosmicIntro'
import { moonProgress } from '../lib/textureCache'

// The opening zoom plays once per visit, not every time you come back to the menu.
let introPlayed = false

// One sun for the whole scene, so Earth and Moon are lit from the same side.
const SUN: Vec3 = [-0.86, 0.26, 0.44]

// Earth-to-Moon transfer: one loop is launch, cruise (first 75%), then landing.
const LOOP = '6.5s'
const CRUISE = { keyTimes: '0;0.75;1', calcMode: 'spline', keySplines: '0.45 0 0.35 1;0 0 1 1', dur: LOOP, repeatCount: 'indefinite' } as const
// Comet tail behind the craft: [length as a share of the route, width, opacity, colour]
const TAIL: [number, number, number, string][] = [[0.035, 3, 0.95, '#fff6dd'], [0.09, 2, 0.5, '#ffd98c'], [0.2, 1.4, 0.22, '#e9b24c']]

interface Route { d: string; sx: number; sy: number; tx: number; ty: number; ax: number; ay: number }

// Shooting stars: start position, how often each one repeats, and when it first appears.
const METEORS = [
  { '--x': '58%', '--y': '9%', '--t': '13s', '--d': '3s' },
  { '--x': '42%', '--y': '4%', '--t': '19s', '--d': '9s' },
  { '--x': '78%', '--y': '17%', '--t': '27s', '--d': '16s' },
] as unknown as CSSProperties[]

export default function Title() {
  const { go, tutorialDone, completed, researchPoints, muted, toggleMuted, music, toggleMusic, startTutorial, newGame } = useGame()
  const [askNew, setAskNew] = useState(false)
  const returning = Object.keys(completed).length > 0
  const stars = totalStars(completed)
  const root = useRef<HTMLDivElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const earth = useRef<HTMLDivElement>(null)
  const moon = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLElement>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const [sizes, setSizes] = useState({ moon: 760, earth: 92 })
  const [route, setRoute] = useState<Route | null>(null)
  const [moonOn, setMoonOn] = useState(false)
  const moonOnRef = useRef(false)
  moonOnRef.current = moonOn
  const [intro, setIntro] = useState(() => !introPlayed && !prefersReducedMotion())
  const [still, setStill] = useState(false)
  useEffect(() => setStill(prefersReducedMotion()), [])

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
      const sx = ex + Math.cos(a) * e.width * 0.74, sy = ey + Math.sin(a) * e.width * 0.74
      const tx = mx - m.width * 0.2, ty = my - m.height * 0.12
      const dist = Math.hypot(tx - sx, ty - sy)
      const cx = (sx + tx) / 2 + dist * 0.06, cy = Math.min(sy, ty) - dist * 0.28
      // Highest point of the arc, so the distance label sits clear above the line
      const den = sy - 2 * cy + ty
      const tt = Math.min(1, Math.max(0, den ? (sy - cy) / den : 0.5))
      const ax = (1 - tt) ** 2 * sx + 2 * (1 - tt) * tt * cx + tt ** 2 * tx
      const ay = (1 - tt) ** 2 * sy + 2 * (1 - tt) * tt * cy + tt ** 2 * ty
      setRoute({ d: `M${sx.toFixed(1)},${sy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`, sx, sy, tx, ty, ax, ay })
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
    if (intro) return
    const t = setTimeout(() => {
      if (document.activeElement === document.body) primary.current?.focus({ preventScroll: true })
    }, prefersReducedMotion() ? 0 : 1300)
    return () => clearTimeout(t)
  }, [intro])

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div className={`title-screen ${intro ? 'is-waiting' : ''}`} ref={root}>
      <div className="title-layer sky">
        <Starfield />
        <div className="shooting-stars" aria-hidden="true">{METEORS.map((m, i) => <span key={i} style={m} />)}</div>
      </div>
      <div className="title-layer scene" ref={scene}>
        <div className="title-earth" ref={earth}><EarthGlobe size={sizes.earth} light={SUN} /></div>
        <div className="title-mars"><MoonGlobe world="mars" size={Math.max(24, Math.round(sizes.earth * 0.45))} spin={4} tilt={25} light={SUN} maxRes={140} label="Mars, far in the distance" /></div>
        <div className={`title-moon ${moonOn ? 'on' : ''}`} ref={moon}>
          <MoonGlobe size={sizes.moon} spin={2.2} tilt={6} lon={-8} light={SUN} maxRes={700} label="The Moon, slowly turning" onReady={() => setMoonOn(true)} />
        </div>
        {route && (
          <svg className="trajectory" aria-hidden="true">
            <defs>
              <linearGradient id="ls-course" gradientUnits="userSpaceOnUse" x1={route.sx} y1={route.sy} x2={route.tx} y2={route.ty}>
                <stop offset="0" stopColor="#72b6ff" />
                <stop offset="0.5" stopColor="#e9b24c" />
                <stop offset="1" stopColor="#ffd98c" />
              </linearGradient>
              <radialGradient id="ls-flash">
                <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="0.35" stopColor="#cfe6ff" stopOpacity="0.7" />
                <stop offset="1" stopColor="#72b6ff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="ls-craft-glow">
                <stop offset="0" stopColor="#fff6dd" stopOpacity="1" />
                <stop offset="0.35" stopColor="#ffd98c" stopOpacity="0.55" />
                <stop offset="1" stopColor="#e9b24c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path id="ls-route" className="course-glow" d={route.d} />
            <path className="course" d={route.d} />
            <text className="route-label" x={route.ax} y={route.ay - 12} textAnchor="middle">384,400 km</text>

            {!still && TAIL.map(([len, w, o, c]) => (
              <path key={len} className="tail" d={route.d} pathLength={1} stroke={c} strokeWidth={w} strokeOpacity={o} strokeDasharray={`${len} 2`}>
                <animate attributeName="stroke-dashoffset" values={`${len};${len - 1};${len - 1}`} {...CRUISE} />
                <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.04;0.7;0.78;1" dur={LOOP} repeatCount="indefinite" />
              </path>
            ))}
            {!still && (
              <g>
                <circle r="11" fill="url(#ls-craft-glow)" />
                <path className="craft" d="M7 0L-5-4-2.6 0-5 4Z" />
                <animateMotion rotate="auto" keyPoints="0;1;1" {...CRUISE}><mpath href="#ls-route" /></animateMotion>
                <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.03;0.72;0.77;1" dur={LOOP} repeatCount="indefinite" />
              </g>
            )}
            {!still && (
              <circle className="launch-flash" cx={route.sx} cy={route.sy} r="2">
                <animate attributeName="r" values="2;15;15" keyTimes="0;0.1;1" dur={LOOP} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0;0" keyTimes="0;0.1;1" dur={LOOP} repeatCount="indefinite" />
              </circle>
            )}

            <g className="route-target" transform={`translate(${route.tx.toFixed(1)} ${route.ty.toFixed(1)})`}>
              <circle r="9" />
              <circle r="16" className="ping" />
              <path className="target-star" d="M0-6.5 1.2-1.2 6.5 0 1.2 1.2 0 6.5-1.2 1.2-6.5 0-1.2-1.2Z">
                {!still && <animateTransform attributeName="transform" type="scale" values="1;1;2;1;1" keyTimes="0;0.74;0.8;0.9;1" dur={LOOP} repeatCount="indefinite" />}
              </path>
              {!still && (
                <circle className="arrival" r="8">
                  <animate attributeName="r" values="8;8;38;38" keyTimes="0;0.75;0.95;1" dur={LOOP} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;0;0.95;0;0" keyTimes="0;0.749;0.76;0.95;1" dur={LOOP} repeatCount="indefinite" />
                </circle>
              )}
            </g>
          </svg>
        )}
      </div>
      <div className="title-scrim" aria-hidden="true" />

      <div className="title-ui">
        <header className="title-brand">
          <h1 className="logo" aria-label={APP_NAME}>
            <span aria-hidden="true">{APP_NAME.split(' ')[0]}</span>
            <span aria-hidden="true">{APP_NAME.split(' ').slice(1).join(' ')}</span>
          </h1>
          <p className="logo-sub">Moon Base · Mars · Earth twins</p>
          <p className="title-lede">
            Find the Moon and Mars on Earth. Before crews build NASA's Moon Base at the lunar south pole, or the first
            bases on Mars, they rehearse in places on Earth that behave like them. Scout those places, discover new ones
            with live NASA and ESA data, then pick a landing site and build your base.
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
          {returning && <button className="menu-item" onClick={() => setAskNew(true)}><span className="mi-label">New game</span></button>}
          <button className="menu-item" onClick={() => go('missions')}><span className="mi-label">Missions</span></button>
          <button className="menu-item" onClick={() => go('twins')}><span className="mi-label">Twin finder</span></button>
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

      {intro && (
        <CosmicIntro
          targets={() => ({ earth: earth.current?.getBoundingClientRect() ?? null, moon: moon.current?.querySelector('.globe')?.getBoundingClientRect() ?? null })}
          ready={() => moonOnRef.current}
          progress={moonProgress}
          onDone={() => { introPlayed = true; setIntro(false) }}
        />
      )}

      <ConfirmDialog
        open={askNew}
        title="Start a new game?"
        body="Your missions, research points, landing site, base and journal are cleared, and the guided tutorial starts again. The leaderboard and your settings stay."
        confirmLabel="Start new game"
        danger
        onConfirm={() => { setAskNew(false); newGame() }}
        onCancel={() => setAskNew(false)}
      />

      <footer className="title-foot">
        <span>NASA Space Apps Challenge 2026, Kuala Lumpur</span>
        <span className="title-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> choose <kbd>Enter</kbd> select <kbd>N</kbd> music <kbd>M</kbd> sound</span>
        <span>v{__APP_VERSION__}</span>
      </footer>
    </div>
  )
}
