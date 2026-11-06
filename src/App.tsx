import { useEffect } from 'react'
import { useGame, type Screen } from './store'
import Title from './screens/Title'
import Explore from './screens/Explore'
import Twins from './screens/Twins'
import Land from './screens/Land'
import Build from './screens/Build'
import Missions from './screens/Missions'
import Journal from './screens/Journal'
import Dashboard from './screens/Dashboard'
import About from './screens/About'
import Tutorial from './components/Tutorial'
import Hud, { type NavItem } from './components/Hud'
import Starfield from './components/Starfield'
import { sfx, type Sfx } from './lib/sfx'
import { music } from './lib/music'
import { canPlayAudio } from './lib/audio'

const NAV: NavItem[] = [
  { id: 'missions', label: 'Missions', icon: 'rocket' },
  { id: 'explore', label: 'Explore Earth', icon: 'globe' },
  { id: 'twins', label: 'Twin finder', icon: 'twins' },
  { id: 'land', label: 'Landing site', icon: 'flag' },
  { id: 'build', label: 'Base', icon: 'grid' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'dashboard', label: 'Progress', icon: 'chart' },
  { id: 'about', label: 'About', icon: 'info' },
]

const SCREENS: Screen[] = ['title', ...NAV.map(n => n.id)]
const HOVERABLE = '.btn, .tab, .menu-item, .cell, .module-btn, .hud-icon, .hud-brand'

/** Hover and click sounds for every button, set once at the document level. */
function useInterfaceSounds() {
  useEffect(() => {
    let last: Element | null = null
    let keyboard = false
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = (e.target as Element).closest?.(HOVERABLE) ?? null
      if (el === last) return
      last = el
      if (el && !(el as HTMLButtonElement).disabled) sfx('hover')
    }
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.('button, a[href]')
      if (!el || (el as HTMLButtonElement).disabled) return
      const kind = el.getAttribute('data-sfx')
      if (kind !== 'none') sfx((kind as Sfx | null) ?? 'click')
    }
    const onKey = () => { keyboard = true }
    const onPointer = () => { keyboard = false }
    const onFocus = (e: FocusEvent) => {
      if (keyboard && (e.target as Element).matches?.('.menu-item, .tab, .module-btn')) sfx('hover')
    }
    document.addEventListener('pointerover', onOver)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('focusin', onFocus)
    }
  }, [])
}

export default function App() {
  const { screen, go, tutorialDone, toggleMuted, toggleMusic, music: musicOn } = useGame()

  // Simple #hash routing so a screen can be bookmarked or shared.
  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.slice(1) as Screen
      if (SCREENS.includes(h)) go(h)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [go])

  useEffect(() => {
    const target = screen === 'title' ? '' : `#${screen}`
    if (location.hash !== target) history.replaceState(null, '', target || location.pathname + location.search)
  }, [screen])

  useInterfaceSounds()

  // Music: browsers need a first tap or key press, then it follows the Music setting.
  useEffect(() => {
    const start = () => { if (useGame.getState().music) music.play() }
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
    return () => { window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', start) }
  }, [])
  useEffect(() => {
    if (!musicOn) music.pause()
    else if (canPlayAudio()) music.play()
  }, [musicOn])
  useEffect(() => music.setMood(screen === 'title' ? 'title' : 'game'), [screen])

  // Game-style keys: Q / E switch tabs, M mutes, Esc returns to the main menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if ((e.target as Element).closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[aria-modal="true"]')) return
      const k = e.key.toLowerCase()
      if (k === 'm') { toggleMuted(); sfx('click'); return }
      if (k === 'n') { toggleMusic(); sfx('click'); return }
      if (screen === 'title') return
      if (k === 'q' || k === 'e') {
        const i = NAV.findIndex(n => n.id === screen)
        const next = NAV[(i + (k === 'e' ? 1 : -1) + NAV.length) % NAV.length]
        sfx('tab')
        go(next.id)
      } else if (k === 'escape') {
        sfx('back')
        go('title')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, go, toggleMuted, toggleMusic])

  if (screen === 'title') return <Title />

  return (
    <div className="shell">
      <Starfield className="shell-sky" density={0.55} band={false} />
      <Hud nav={NAV} />
      <main className="main">
        <div className="screen" key={screen}>
          {screen === 'explore' && <Explore />}
          {screen === 'twins' && <Twins />}
          {screen === 'land' && <Land />}
          {screen === 'build' && <Build />}
          {screen === 'missions' && <Missions />}
          {screen === 'journal' && <Journal />}
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'about' && <About />}
        </div>
      </main>
      {!tutorialDone && <Tutorial />}
    </div>
  )
}
