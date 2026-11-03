import { useEffect, useRef, useState } from 'react'
import { totalStars, useGame, type Screen } from '../store'
import { MISSIONS } from '../data/moon'
import { rankFor } from '../lib/base'
import Icon, { type IconName } from './Icon'
import Counter from './Counter'

export interface NavItem { id: Screen; label: string; icon: IconName }

/** Floating "+120" / "−60" markers whenever a value changes. */
function useDeltas(value: number) {
  const prev = useRef(value)
  const timers = useRef<number[]>([])
  const [items, setItems] = useState<{ id: number; d: number }[]>([])
  useEffect(() => {
    const d = value - prev.current
    prev.current = value
    if (!d) return
    const id = Math.random()
    setItems(list => [...list.slice(-2), { id, d }])
    timers.current.push(window.setTimeout(() => setItems(list => list.filter(x => x.id !== id)), 1500))
  }, [value])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return items
}

export default function Hud({ nav }: { nav: NavItem[] }) {
  const { screen, go, researchPoints, completed, muted, toggleMuted, music, toggleMusic } = useGame()
  const stars = totalStars(completed)
  const deltas = useDeltas(researchPoints)

  // Keep the active tab visible when the tab bar scrolls on small screens.
  useEffect(() => {
    document.querySelector('.hud-tabs .tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [screen])

  return (
    <header className="hud">
      <button className="hud-brand" onClick={() => go('title')} data-sfx="back" aria-label="Lunar Scout: back to main menu">
        <span className="brand-mark" aria-hidden="true"><span className="brand-moon" /></span>
        <span className="brand-word">Lunar Scout</span>
      </button>

      <nav className="hud-tabs" aria-label="Main">
        <kbd className="tab-key" aria-hidden="true" title="Previous tab">Q</kbd>
        {nav.map(n => (
          <button
            key={n.id} className={`tab ${n.id === screen ? 'active' : ''}`} data-sfx="tab" data-tut={`tab-${n.id}`}
            aria-current={n.id === screen ? 'page' : undefined} onClick={() => go(n.id)}
          >
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
          </button>
        ))}
        <kbd className="tab-key" aria-hidden="true" title="Next tab">E</kbd>
      </nav>

      <div className="hud-res">
        <div className="res res-rp" title="Research points: earned from missions, spent on base modules">
          <Icon name="rp" size={18} />
          <Counter value={researchPoints} className="res-num" />
          <span className="res-unit"><span className="long">research points</span><span className="short">pts</span></span>
          <span className="res-deltas" aria-hidden="true">
            {deltas.map(d => <span key={d.id} className={`res-delta ${d.d > 0 ? 'up' : 'down'}`}>{d.d > 0 ? '+' : '−'}{Math.abs(d.d)}</span>)}
          </span>
        </div>
        <div className="res res-stars" title={`Rank: ${rankFor(stars)}`}>
          <Icon name="star" size={16} />
          <span className="res-num">{stars}</span>
          <span className="res-unit">of {MISSIONS.length * 3}</span>
        </div>
        <button className="hud-icon" aria-label="Music" aria-pressed={music} title="Music (N)" onClick={toggleMusic}>
          <Icon name={music ? 'music' : 'musicOff'} size={18} />
        </button>
        <button className="hud-icon" aria-label="Sound effects" aria-pressed={!muted} title="Sound effects (M)" onClick={toggleMuted}>
          <Icon name={muted ? 'soundOff' : 'soundOn'} size={18} />
        </button>
      </div>
    </header>
  )
}
