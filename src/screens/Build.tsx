import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { claimableQuests, energyNow, questContext, useGame, type BuildResult } from '../store'
import { MODULES, moduleById } from '../data/modules'
import { MISSIONS, targetById } from '../data/moon'
import { QUESTS, TECH, questById, questDone } from '../data/quests'
import {
  baseScore, cellScore, crewCapacity, emptyGrid, energyCap, energyCost, energyRegenMs, goalRange, GOAL_REWARD, GRID_SIZE,
  isOperational, moduleCost, modulePower, placementGain, powerBalance, SCORE_RULES,
} from '../lib/base'
import type { ModuleId } from '../data/types'
import Icon, { MODULE_ICON } from '../components/Icon'
import { sfx } from '../lib/sfx'

const BaseScene = lazy(() => import('../components/BaseScene'))
const EMPTY = emptyGrid()

/** If the 3D code can't load (for example three.js was never installed), fall back instead of breaking the page. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`

function ScoreRing({ score, from, to, done }: { score: number; from: number; to: number; done: boolean }) {
  const k = done ? 1 : Math.max(0, Math.min(1, (score - from) / Math.max(1, to - from)))
  const C = 2 * Math.PI * 34
  return (
    <div className="score-ring" role="img" aria-label={done ? `Base score ${score}, every target reached` : `Base score ${score} of ${to} for the next target`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="34" className="sr-track" />
        <circle cx="40" cy="40" r="34" className="sr-fill" strokeDasharray={`${C * k} ${C}`} transform="rotate(-90 40 40)" />
      </svg>
      <span className="sr-text"><small>score</small><strong>{score}</strong>{!done && <em>/{to}</em>}</span>
    </div>
  )
}

export default function Build() {
  const g = useGame()
  const [selected, setSelected] = useState<ModuleId | null>('habitat')
  const [focus, setFocus] = useState<number | null>(null)
  const [view, setView] = useState<'3d' | 'plan'>('3d')
  const [drawer, setDrawer] = useState<null | 'quests' | 'tech' | 'site'>(null)
  const [toast, setToast] = useState<{ id: number; text: string; kind: 'good' | 'bad' | 'goal' } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => { g.settle() }, [now]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.kind === 'goal' ? 4200 : 2400)
    return () => clearTimeout(id)
  }, [toast])

  // Number keys pick a building, like a hotbar. 0 puts the tool down, Esc closes panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return
      if ((e.target as Element).closest?.('input, textarea, select')) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'Escape' && (drawer || focus != null)) { e.preventDefault(); setDrawer(null); setFocus(null); return }
      if (e.key === '0') { setSelected(null); return }
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > Math.min(9, MODULES.length)) return
      const m = MODULES[n - 1]
      if (g.unlocked.includes(m.id)) { setSelected(m.id); sfx('click') } else sfx('error')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [g.unlocked, drawer, focus])

  if (!g.landingId) {
    return (
      <div className={`base-screen theme-${g.baseTheme}`}>
        <div className="base-view" aria-hidden="true">
          <SceneBoundary onError={() => {}}>
            <Suspense fallback={null}>
              <BaseScene key={g.baseTheme} theme={g.baseTheme} grid={EMPTY} selected={null} focus={null} preview={() => null} onCell={() => {}} onFail={() => {}} />
            </Suspense>
          </SceneBoundary>
        </div>
        <div className="base-empty cut">
          <Icon name="flag" size={24} />
          <h1>Your base site is waiting</h1>
          <p>Pick a landing site on the Moon, then build your base here: habitats, solar arrays, greenhouse farms and more.</p>
          <button className="btn primary cut" onClick={() => g.go('land')}>Choose landing site</button>
        </div>
      </div>
    )
  }

  const landing = targetById(g.landingId)
  const e = energyNow(g, now)
  const cap = energyCap(g.grid)
  const period = energyRegenMs(g.grid)
  const score = baseScore(g.grid)
  const ring = goalRange(score, g.goals)
  const power = powerBalance(g.grid, landing)
  const operational = isOperational(g.grid, landing)
  const claimable = claimableQuests(g)
  const ctx = questContext(g)
  const has = (id: ModuleId) => g.grid.some(c => c?.id === id)
  const missing = [!has('habitat') && 'a habitat', !has('comms') && 'a comms tower', power.net < 0 && 'more power'].filter(Boolean) as string[]
  const focused = focus != null ? g.grid[focus] : null
  const say = (text: string, kind: 'good' | 'bad' | 'goal') => setToast({ id: Date.now() + Math.random(), text, kind })
  const preview = (i: number) => (selected && g.unlocked.includes(selected) && !g.grid[i] ? placementGain(g.grid, i, selected) : null)

  const why = (r: BuildResult) =>
    r.reason === 'energy' ? `Not enough energy: this needs ${r.need}. ${e.next ? `+1 in ${mmss(e.next - now)}.` : ''}`
    : r.reason === 'locked' ? 'That building is locked. Unlock it under Technology.'
    : r.reason === 'rp' ? `Not enough research points: this needs ${r.need}.`
    : 'You can’t build there.'

  const celebrate = (r: BuildResult) => {
    if (r.goal) { sfx('unlock'); say(`Target reached! +${GOAL_REWARD.energy} energy and +${GOAL_REWARD.rp} research points`, 'goal') }
    else if (r.points != null) say(`${signed(r.points)} points`, r.points >= 0 ? 'good' : 'bad')
  }

  const onCell = (i: number) => {
    if (g.grid[i]) { setFocus(i); sfx('click'); return }
    setFocus(null)
    if (!selected) return
    const r = g.place(i, selected)
    if (r.ok) { sfx('place'); g.tutorialEvent('placed'); celebrate(r) }
    else { sfx('error'); say(why(r), 'bad') }
  }

  const pickTool = (id: ModuleId) => {
    if (!g.unlocked.includes(id)) { sfx('error'); setDrawer('tech'); say(`${moduleById(id).name} is locked. Finish its quests to research it.`, 'bad'); return }
    setSelected(s => (s === id ? null : id))
  }

  const rule = selected ? SCORE_RULES[selected] : null
  const likes = rule ? Object.entries(rule.near ?? {}).filter(([, v]) => v! > 0) as [ModuleId, number][] : []
  const avoids = rule ? Object.entries(rule.near ?? {}).filter(([, v]) => v! < 0) as [ModuleId, number][] : []

  return (
    <div className={`base-screen theme-${g.baseTheme}`}>
      <div className="base-view" data-tut="grid">
        {view === '3d' ? (
          <SceneBoundary onError={() => { setView('plan'); say('The 3D view could not load. Double-click start-dev.bat (or run npm install), then reload.', 'bad') }}>
            <Suspense fallback={<div className="base-loading">Preparing the base site…</div>}>
              <BaseScene key={g.baseTheme} theme={g.baseTheme} grid={g.grid} selected={selected} focus={focus} preview={preview} onCell={onCell}
                onFail={() => { setView('plan'); say('3D is not available on this device, so here is the plan view.', 'bad') }} />
            </Suspense>
          </SceneBoundary>
        ) : (
          <div className="flat-plan">
            <div className="lunar-grid" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }} role="group" aria-label="Base plots">
              {g.grid.map((cell, i) => {
                const gain = preview(i)
                return (
                  <button key={i} data-sfx="none" onClick={() => onCell(i)}
                    className={`cell ${cell ? `filled m-${cell.id}` : ''} ${focus === i ? 'focused' : ''} ${cell?.level === 2 ? 'lvl2' : ''}`}
                    aria-label={cell ? `${moduleById(cell.id).name}, level ${cell.level}` : `Empty plot ${i + 1}${selected && gain != null ? `, ${moduleById(selected).name} scores ${signed(gain)}` : ''}`}>
                    {cell ? <><Icon name={MODULE_ICON[cell.id]} size={28} /><span className="lvl" aria-hidden="true">{cell.level === 2 ? 'II' : 'I'}</span></>
                      : gain != null ? <span className={`gain ${gain < 0 ? 'neg' : ''}`} aria-hidden="true">{signed(gain)}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="base-top">
        <section className={`energy cut ${e.energy < (selected ? energyCost(selected, landing) : 1) ? 'low' : ''}`} aria-label={`Energy ${e.energy} of ${cap}`}>
          <p className="en-row"><Icon name="bolt" size={18} /><strong key={e.energy}>{e.energy}</strong><span>/ {cap} energy</span></p>
          <div className="en-bar"><i style={{ width: `${Math.min(100, (e.energy / cap) * 100)}%` }} /></div>
          <p className="en-next">{e.next ? <>+1 in {mmss(e.next - now)}</> : 'Full'}<span>, 1 per {Math.round(period / 1000)} s</span></p>
        </section>
        <section className="base-status" data-tut="status" aria-label="Base status">
          <span className={`chip ${operational ? 'ok' : 'warn'}`}><Icon name={operational ? 'check' : 'info'} size={14} />{operational ? 'Operational' : `Needs ${missing.join(', ')}`}</span>
          <span className={`chip ${power.net < 0 ? 'warn' : ''}`}><Icon name="bolt" size={14} />Power {signed(power.net)}</span>
          <span className="chip"><Icon name="crew" size={14} />Crew {crewCapacity(g.grid)}</span>
          <span className="chip"><Icon name="grid" size={14} />{g.grid.filter(Boolean).length}/{GRID_SIZE * GRID_SIZE}</span>
          <button className="chip chip-btn" onClick={() => setView(v => (v === '3d' ? 'plan' : '3d'))}>{view === '3d' ? '2D plan' : '3D view'}</button>
          {view === '3d' && <button className="chip chip-btn" onClick={() => g.setBaseTheme(g.baseTheme === 'moon' ? 'cosy' : 'moon')} title="Switch how the base looks">Style: {g.baseTheme === 'moon' ? 'Moon' : 'cosy sea'}</button>}
        </section>
      </div>

      {focused && focus != null && (
        <section className="focus-card cut" aria-label={`${moduleById(focused.id).name} details`}>
          <button className="pc-close" aria-label="Close" data-sfx="back" onClick={() => setFocus(null)}><Icon name="cross" size={16} /></button>
          <h3><Icon name={MODULE_ICON[focused.id]} size={22} />{moduleById(focused.id).name}<small>level {focused.level}</small></h3>
          <p className="meta">Scores {Math.round(cellScore(g.grid, focus))} here. Power {signed(modulePower(focused, landing))}.</p>
          <div className="fc-actions">
            {focused.level === 1 && (
              <button className="btn primary cut small" data-sfx="none" onClick={() => { const r = g.upgrade(focus); if (r.ok) { sfx('star'); celebrate(r) } else { sfx('error'); say(why(r), 'bad') } }}>
                <Icon name="upgrade" size={16} />Upgrade ({moduleCost(focused.id, landing, true)} pts)
              </button>
            )}
            <button className="btn ghost cut small" data-sfx="remove" onClick={() => { g.remove(focus); setFocus(null) }}>
              <Icon name="remove" size={16} />Remove (+{Math.floor(energyCost(focused.id, landing) / 2)} energy back)
            </button>
          </div>
        </section>
      )}

      <div className="base-bottom">
        <ScoreRing score={score} from={ring.from} to={ring.to} done={ring.done} />
        <div className="bb-col">
          {selected && rule && (
            <p className="bb-hint">
              <strong>{moduleById(selected).name}</strong>
              <span><Icon name="bolt" size={12} />{energyCost(selected, landing)} energy, power {signed(moduleById(selected).power[0])}</span>
              {likes.length > 0 && <span className="pos">Good next to {likes.map(([id, v]) => `${moduleById(id).name} ${signed(v)}`).join(', ')}</span>}
              {avoids.length > 0 && <span className="neg">Avoid {avoids.map(([id, v]) => `${moduleById(id).name} ${signed(v)}`).join(', ')}{rule.other ? `, anything else ${signed(rule.other)}` : ''}</span>}
            </p>
          )}
          <nav className="build-bar cut" data-tut="palette" aria-label="Buildings">
            <button className={`bb-plus ${drawer ? 'on' : ''}`} onClick={() => setDrawer(d => (d ? null : claimable.length ? 'quests' : 'quests'))}
              aria-label={`Quests and technology${claimable.length ? `, ${claimable.length} ready to claim` : ''}`} aria-expanded={!!drawer}>
              <Icon name="plus" size={26} />
              {claimable.length > 0 && <span className="bb-alert" aria-hidden="true">{claimable.length}</span>}
            </button>
            <div className="bb-items">
              {MODULES.map((m, idx) => {
                const locked = !g.unlocked.includes(m.id)
                const cost = energyCost(m.id, landing)
                return (
                  <button key={m.id} data-sfx="none" onClick={() => pickTool(m.id)} aria-pressed={selected === m.id}
                    className={`bb-item ${selected === m.id ? 'on' : ''} ${locked ? 'locked' : ''} ${!locked && e.energy < cost ? 'short' : ''}`}
                    title={locked ? `${m.name}: locked` : `${m.name}: ${cost} energy`}>
                    <Icon name={locked ? 'lock' : MODULE_ICON[m.id]} size={26} />
                    {!locked && <span className="bb-badge" aria-hidden="true">{cost}</span>}
                    {idx < 9 && <kbd aria-hidden="true">{idx + 1}</kbd>}
                    <span className="sr-only">{m.name}{locked ? ', locked' : `, ${cost} energy`}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        </div>
      </div>

      {drawer && (
        <aside className="base-drawer cut" aria-label="Quests and technology">
          <div className="bd-tabs" role="tablist">
            {(['quests', 'tech', 'site'] as const).map(t => (
              <button key={t} role="tab" aria-selected={drawer === t} className={drawer === t ? 'on' : ''} onClick={() => setDrawer(t)}>
                {t === 'quests' ? <>Quests{claimable.length > 0 && <span className="bd-count">{claimable.length}</span>}</> : t === 'tech' ? 'Technology' : 'Site'}
              </button>
            ))}
            <button className="pc-close" aria-label="Close" data-sfx="back" onClick={() => setDrawer(null)}><Icon name="cross" size={16} /></button>
          </div>

          {drawer === 'quests' && (
            <ul className="quest-list">
              {[...QUESTS].sort((a, b) => {
                const rank = (q: typeof a) => (g.claimed.includes(q.id) ? 2 : questDone(q, ctx) ? 0 : 1)
                return rank(a) - rank(b)
              }).map(q => {
                const [have, need] = q.progress(ctx)
                const claimed = g.claimed.includes(q.id)
                const done = have >= need
                return (
                  <li key={q.id} className={`quest ${claimed ? 'claimed' : done ? 'ready' : ''}`}>
                    <div className="q-head"><Icon name={claimed ? 'check' : 'quest'} size={18} /><strong>{q.title}</strong></div>
                    <p>{q.text}</p>
                    {!claimed && <div className="q-bar"><i style={{ width: `${Math.min(100, (have / need) * 100)}%` }} /><span>{Math.min(have, need)}/{need}</span></div>}
                    <div className="q-foot">
                      <span className="q-reward">{q.reward.rp ? <><Icon name="rp" size={12} />+{q.reward.rp}</> : null}{q.reward.energy ? <><Icon name="bolt" size={12} />+{q.reward.energy}</> : null}</span>
                      {claimed ? <span className="q-done">Claimed</span>
                        : done ? <button className="btn primary cut small" data-sfx="none" onClick={() => { if (g.claimQuest(q.id)) { sfx('success'); say(`Quest complete: ${q.title}`, 'goal') } }}>Claim</button>
                        : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {drawer === 'tech' && (
            <div className="tech-list">
              {([1, 2, 3] as const).map(tier => (
                <section key={tier}>
                  <h3 className="lp-title">Tier {tier}</h3>
                  {TECH.filter(t => t.tier === tier).map(t => {
                    const m = moduleById(t.id)
                    const unlocked = g.unlocked.includes(t.id)
                    const ready = t.requires.every(r => g.claimed.includes(r))
                    const mission = MISSIONS.find(x => x.unlocks === t.id)
                    return (
                      <article key={t.id} className={`tech ${unlocked ? 'done' : ready ? 'ready' : ''}`}>
                        <span className="tech-icon"><Icon name={unlocked ? MODULE_ICON[t.id] : 'lock'} size={24} /></span>
                        <div>
                          <strong>{m.name}</strong>
                          <p>{m.description}</p>
                          {!unlocked && (
                            <ul className="tech-req">
                              {t.requires.map(r => <li key={r} className={g.claimed.includes(r) ? 'ok' : ''}><Icon name={g.claimed.includes(r) ? 'check' : 'quest'} size={12} />Quest: {questById(r)?.title}</li>)}
                              {mission && <li className="note">Or pass the {mission.title} mission</li>}
                            </ul>
                          )}
                        </div>
                        {unlocked ? <span className="q-done">Unlocked</span> : (
                          <button className="btn primary cut small" data-sfx="none" disabled={!ready || g.researchPoints < t.rp}
                            onClick={() => { if (g.research(t.id)) { sfx('unlock'); say(`${m.name} unlocked! It is now in your build bar.`, 'goal'); setSelected(t.id) } }}>
                            {t.rp ? `Research, ${t.rp} pts` : 'Unlock'}
                          </button>
                        )}
                      </article>
                    )
                  })}
                </section>
              ))}
            </div>
          )}

          {drawer === 'site' && (
            <div className="site-info">
              <h3>{landing.name}</h3>
              <ul className="perks">{landing.landing?.perks.map(p => <li key={p}>{p}</li>)}</ul>
              <p className="meta">Energy refills 1 point every {Math.round(period / 1000)} seconds, even while the game is closed. Solar arrays and landing pads make it faster; battery banks store more. Each score target you reach adds {GOAL_REWARD.energy} energy and {GOAL_REWARD.rp} research points.</p>
            </div>
          )}
        </aside>
      )}

      {toast && <p key={toast.id} className={`base-toast ${toast.kind}`} role="status">{toast.text}</p>}
    </div>
  )
}
