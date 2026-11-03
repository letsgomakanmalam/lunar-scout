import { useEffect, useState } from 'react'
import { useGame } from '../store'
import { MODULES, moduleById } from '../data/modules'
import { MISSIONS, targetById } from '../data/moon'
import { crewCapacity, GRID_SIZE, isOperational, moduleCost, modulePower, powerBalance } from '../lib/base'
import type { ModuleId } from '../data/types'
import Icon, { MODULE_ICON } from '../components/Icon'
import { sfx } from '../lib/sfx'

export default function Build() {
  const g = useGame()
  const [selected, setSelected] = useState<ModuleId>('habitat')
  const [focus, setFocus] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // Number keys pick a module, like a hotbar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      if ((e.target as Element).closest?.('input, textarea, select')) return
      if (document.querySelector('[aria-modal="true"]')) return
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > MODULES.length) return
      const m = MODULES[n - 1]
      if (g.unlocked.includes(m.id)) { setSelected(m.id); sfx('click') } else sfx('error')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [g.unlocked])

  if (!g.landingId) {
    return (
      <div className="page">
        <header className="screen-head"><h1 className="screen-title">Your base</h1></header>
        <div className="notice cut">
          <Icon name="flag" size={20} />
          <span>Pick a landing site before you build.</span>
          <button className="btn primary cut small" onClick={() => g.go('land')}>Choose landing site</button>
        </div>
      </div>
    )
  }

  const landing = targetById(g.landingId)
  const power = powerBalance(g.grid, landing)
  const operational = isOperational(g.grid, landing)
  const focused = focus != null ? g.grid[focus] : null
  const has = (id: ModuleId) => g.grid.some(c => c?.id === id)
  const peak = Math.max(1, power.produced, power.used)
  const needs: [boolean, string][] = [[has('habitat'), 'Habitat'], [has('comms'), 'Comms tower'], [power.net >= 0, 'Power balance of zero or more']]

  const clickCell = (i: number) => {
    setNote(null)
    if (g.grid[i]) { setFocus(i); sfx('click'); return }
    setFocus(null)
    if (!g.unlocked.includes(selected)) { sfx('error'); return setNote('That module is still locked. Finish its mission first.') }
    const cost = moduleCost(selected, landing)
    if (g.place(i, selected)) sfx('place')
    else { sfx('error'); setNote(`Not enough research points. ${moduleById(selected).name} costs ${cost}.`) }
  }

  return (
    <div className="build">
      <aside className="panel">
        <h2>Modules</h2>
        <p className="meta">Landed at {landing.name}</p>
        <ul className="palette">
          {MODULES.map((m, i) => {
            const locked = !g.unlocked.includes(m.id)
            const p = m.power[0]
            const by = MISSIONS.find(x => x.unlocks === m.id)
            return (
              <li key={m.id}>
                <button className={`module-btn cut ${selected === m.id ? 'active' : ''}`} disabled={locked} onClick={() => setSelected(m.id)} aria-pressed={selected === m.id}>
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  <span className="mod-icon"><Icon name={locked ? 'lock' : MODULE_ICON[m.id]} size={24} /></span>
                  <span className="module-text">
                    <strong>{m.name}</strong>
                    {locked ? (
                      <small>Locked{by ? `: pass ${by.title}` : ''}</small>
                    ) : (
                      <small>
                        <span><Icon name="rp" size={12} />{moduleCost(m.id, landing)} pts</span>
                        <span className={p > 0 ? 'pos' : 'neg'}><Icon name="bolt" size={12} />power {p > 0 ? '+' : ''}{p}</span>
                      </small>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="meta">{moduleById(selected).description}</p>
      </aside>

      <section className="grid-col">
        <div className="lunar-grid" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }} role="group" aria-label="Base layout">
          {g.grid.map((cell, i) => (
            <button
              key={i}
              data-sfx="none"
              className={`cell ${cell ? `filled m-${cell.id}` : ''} ${focus === i ? 'focused' : ''} ${cell?.level === 2 ? 'lvl2' : ''}`}
              onClick={() => clickCell(i)}
              aria-label={cell ? `${moduleById(cell.id).name} level ${cell.level}` : `Empty plot ${i + 1}, place ${moduleById(selected).name}`}
            >
              {cell ? (
                <><Icon name={MODULE_ICON[cell.id]} size={30} /><span className="lvl" aria-hidden="true">{cell.level === 2 ? 'II' : 'I'}</span></>
              ) : (
                <Icon name={MODULE_ICON[selected]} size={26} className="ghost" />
              )}
            </button>
          ))}
        </div>
        {note && <p className="message" role="status">{note}</p>}
      </section>

      <aside className="panel">
        <h2>Base status</h2>
        <p className={`status ${operational ? 'ok' : 'warn'}`}><Icon name={operational ? 'check' : 'info'} size={22} />{operational ? 'Operational' : 'Not operational yet'}</p>
        <ul className="checklist">
          {needs.map(([ok, label]) => <li key={label} className={ok ? 'ok' : ''}><Icon name={ok ? 'check' : 'cross'} size={14} />{label}</li>)}
        </ul>
        <div className="power-meter">
          <div className="pm-row"><span><Icon name="bolt" size={14} />Power</span><strong className={power.net < 0 ? 'bad' : ''}>{power.net >= 0 ? '+' : ''}{power.net}</strong></div>
          <div className="pm-bar"><span className="made" style={{ width: `${(power.produced / peak) * 100}%` }} /></div>
          <div className="pm-bar"><span className="used" style={{ width: `${(power.used / peak) * 100}%` }} /></div>
          <p className="meta">{power.produced} made, {power.used} used</p>
        </div>
        <dl className="stats">
          <dt><Icon name="crew" size={14} />Crew space</dt><dd>{crewCapacity(g.grid)}</dd>
          <dt><Icon name="grid" size={14} />Modules</dt><dd>{g.grid.filter(Boolean).length} of {GRID_SIZE * GRID_SIZE}</dd>
        </dl>

        {focused && focus != null && (
          <div className="focus cut">
            <h3><Icon name={MODULE_ICON[focused.id]} size={22} />{moduleById(focused.id).name}, level {focused.level}</h3>
            <p className="meta">Power {modulePower(focused, landing)}</p>
            {focused.level === 1 && (
              <button className="btn primary cut small" data-sfx="none" onClick={() => { if (g.upgrade(focus)) sfx('star'); else { sfx('error'); setNote('Not enough research points to upgrade.') } }}>
                <Icon name="upgrade" size={16} />Upgrade ({moduleCost(focused.id, landing, true)} pts)
              </button>
            )}
            <button className="btn ghost cut small" data-sfx="remove" onClick={() => { g.remove(focus); setFocus(null) }}>
              <Icon name="remove" size={16} />Remove (50% refund)
            </button>
          </div>
        )}
        <h3>Landing perks</h3>
        <ul className="perks">{landing.landing?.perks.map(p => <li key={p}>{p}</li>)}</ul>
      </aside>
    </div>
  )
}
