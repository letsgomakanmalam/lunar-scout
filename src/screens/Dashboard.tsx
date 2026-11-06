import { useState } from 'react'
import { allSites, totalStars, useGame } from '../store'
import { MISSIONS } from '../data/missions'
import { targetById } from '../data/targets'
import { isOperational, rankFor } from '../lib/base'
import Icon from '../components/Icon'
import { ConfirmDialog } from '../components/Modal'

// Star thresholds, matching rankFor in lib/base.ts
const RANK_AT = [0, 3, 8, 14, 24]

function Insignia({ tier }: { tier: number }) {
  return (
    <svg viewBox="0 0 64 72" className="insignia" aria-hidden="true">
      <path className="ins-shield" d="M32 3l26 9v22c0 17-11 28-26 35C17 62 6 51 6 34V12z" />
      {Array.from({ length: tier + 1 }, (_, i) => <path key={i} className="ins-chev" d={`M18 ${54 - i * 8}l14-8 14 8`} />)}
      {tier === RANK_AT.length - 1 && <path className="ins-star" d="M32 6l2 4.3 4.7.5-3.5 3.2 1 4.6L32 16.3l-4.2 2.3 1-4.6-3.5-3.2 4.7-.5z" />}
    </svg>
  )
}

export default function Dashboard() {
  const g = useGame()
  const [name, setName] = useState('')
  const [askReset, setAskReset] = useState(false)
  const stars = totalStars(g.completed)
  const scannedSites = new Set(Object.values(g.scanned).flat())
  const landing = g.landingId ? targetById(g.landingId) : undefined
  const sites = allSites(g)
  const done = Object.keys(g.completed).length
  const tier = RANK_AT.reduce((t, at, i) => (stars >= at ? i : t), 0)
  const next = RANK_AT[tier + 1]
  const nextName = next != null ? rankFor(next) : null
  const from = RANK_AT[tier]

  return (
    <div className="page">
      <header className="screen-head">
        <h1 className="screen-title">Progress</h1>
      </header>

      <section className="rank-card cut" aria-label="Rank">
        <Insignia tier={tier} />
        <div className="rank-body">
          <h2 className="rank-name">{rankFor(stars)}</h2>
          {next != null ? (
            <>
              <div className="bar"><span style={{ width: `${((stars - from) / (next - from)) * 100}%` }} /></div>
              <p className="meta">{next - stars} more {next - stars === 1 ? 'star' : 'stars'} to {nextName}</p>
            </>
          ) : <p className="meta">Highest rank reached</p>}
        </div>
      </section>

      <dl className="dash">
        <div className="tile cut"><dt><Icon name="rocket" size={16} />Missions passed</dt><dd>{done} <small>of {MISSIONS.length}</small></dd></div>
        <div className="tile cut"><dt><Icon name="star" size={16} />Stars</dt><dd>{stars} <small>of {MISSIONS.length * 3}</small></dd></div>
        <div className="tile cut"><dt><Icon name="globe" size={16} />Sites scanned</dt><dd>{scannedSites.size} <small>of {sites.length}</small></dd></div>
        <div className="tile cut"><dt><Icon name="probe" size={16} />Live discoveries</dt><dd>{g.discoveries.length}</dd></div>
        <div className="tile cut"><dt><Icon name="rp" size={16} />Research points</dt><dd>{g.researchPoints}</dd></div>
        <div className="tile cut"><dt><Icon name="flag" size={16} />Landing site</dt><dd className="small">{landing?.name ?? 'Not chosen'}</dd></div>
        <div className="tile cut"><dt><Icon name="grid" size={16} />Base</dt><dd className="small">{g.grid.filter(Boolean).length} modules, {isOperational(g.grid, landing) ? 'operational' : 'not operational'}</dd></div>
      </dl>

      <h2>Mission log</h2>
      <table className="log">
        <thead><tr><th>Mission</th><th>Best site</th><th>ASI</th><th>Stars</th></tr></thead>
        <tbody>
          {MISSIONS.map(m => {
            const r = g.completed[m.id]
            return (
              <tr key={m.id}>
                <td>{m.title}</td>
                <td>{r ? sites.find(s => s.id === r.siteId)?.name ?? 'Removed probe' : '–'}</td>
                <td>{r?.asi ?? '–'}</td>
                <td className="log-stars">{r ? '★'.repeat(r.stars) : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Leaderboard (this device)</h2>
      <div className="row">
        <input aria-label="Your name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
        <button className="btn primary cut" disabled={!name.trim()} onClick={() => { g.saveScore(name.trim()); setName('') }}>Save my score</button>
      </div>
      {g.leaderboard.length === 0 ? <p className="empty">No scores yet.</p> : (
        <ol className="leaders">{g.leaderboard.map((l, i) => <li key={i}><span>{l.name}</span><strong>{l.score}</strong></li>)}</ol>
      )}

      <button className="btn ghost cut small danger" onClick={() => setAskReset(true)}>Reset progress</button>
      <ConfirmDialog
        open={askReset}
        title="Reset all progress?"
        body="Missions, research points, your landing site, base and journal are cleared. The leaderboard is kept."
        confirmLabel="Reset progress"
        danger
        onConfirm={() => { setAskReset(false); g.resetAll() }}
        onCancel={() => setAskReset(false)}
      />
    </div>
  )
}
