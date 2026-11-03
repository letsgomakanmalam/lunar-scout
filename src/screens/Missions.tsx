import { missionUnlocked, useGame } from '../store'
import { MISSIONS, targetById } from '../data/moon'
import { moduleById } from '../data/modules'
import Icon, { MODULE_ICON } from '../components/Icon'

export default function Missions() {
  const { completed, setMission, activeMissionId } = useGame()
  const done = Object.keys(completed).length
  return (
    <div className="page">
      <header className="screen-head">
        <h1 className="screen-title">Missions</h1>
        <p className="lede">Each mission tests gear for a real place on the Moon. Finish one to open the next.</p>
      </header>
      <ol className="campaign">
        {MISSIONS.map((m, i) => {
          const open = missionUnlocked(m.id, completed)
          const rec = completed[m.id]
          const current = m.id === activeMissionId
          const need = Math.max(1, i - 1 - done)
          return (
            <li key={m.id} className={`mission-card cut ${open ? '' : 'locked'} ${current ? 'current' : ''} ${rec ? 'done' : ''}`}>
              <div className="mc-node" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
              <div className="mc-body">
                <h2>{m.title}{current && <span className="chip gold">Active</span>}</h2>
                <p className="mc-meta">
                  <span><Icon name="target" size={15} />{targetById(m.targetId).name}</span>
                  <span><Icon name="rp" size={15} />{m.reward} research points per star</span>
                  {m.unlocks && <span><Icon name={MODULE_ICON[m.unlocks]} size={15} />Unlocks {moduleById(m.unlocks).name}</span>}
                </p>
                <p>{m.brief}</p>
              </div>
              <div className="mc-side">
                <div className="mc-pass"><span>Pass mark</span><strong>{m.passAsi}</strong></div>
                <span className="stars3" role="img" aria-label={rec ? `${rec.stars} of 3 stars` : 'Not passed yet'}>
                  {[0, 1, 2].map(s => {
                    const on = !!rec && s < rec.stars
                    return <Icon key={s} name={on ? 'star' : 'starOutline'} size={18} className={on ? 'on' : ''} />
                  })}
                </span>
                <button className="btn primary cut" disabled={!open} onClick={() => setMission(m.id)}>
                  {!open ? <><Icon name="lock" size={16} />Locked</> : rec ? 'Replay' : 'Start mission'}
                </button>
                {!open && <span className="mc-lock-note">Pass {need} more {need === 1 ? 'mission' : 'missions'} to open</span>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
