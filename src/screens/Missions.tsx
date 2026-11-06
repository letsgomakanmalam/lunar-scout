import { missionUnlocked, missionsToOpen, useGame } from '../store'
import { missionsOf } from '../data/missions'
import { targetById } from '../data/targets'
import { moduleById } from '../data/modules'
import type { World } from '../data/types'
import Icon, { MODULE_ICON } from '../components/Icon'

const TRACKS: { world: World; title: string; lede: string }[] = [
  { world: 'moon', title: 'Moon: the south-pole base', lede: "NASA's Moon Base sits on the Shackleton Connecting Ridge. Rehearse its ice drills, polar light, highland geology and long nights." },
  { world: 'mars', title: 'Mars: the first bases', lede: 'Buried ice for fuel, ancient lakes, caves and clay plains, at sites chosen by NASA, ESA and CNSA. Opens after your first passed mission.' },
]

export default function Missions() {
  const { completed, setMission, activeMissionId, allOpen, setAllOpen } = useGame()
  return (
    <div className="page">
      <header className="screen-head">
        <h1 className="screen-title">Missions</h1>
        <p className="lede">Each mission tests gear or skills for a real base or landing site. Find the Earth site that rehearses it best, then certify it.</p>
      </header>
      <label className="judge-toggle">
        <input type="checkbox" checked={allOpen} onChange={e => setAllOpen(e.target.checked)} />
        <span><strong>Open all missions</strong> for judges and teachers (skips the unlock order)</span>
      </label>
      {TRACKS.map(track => {
        const list = missionsOf(track.world)
        return (
          <section key={track.world} className={`track track-${track.world}`} aria-labelledby={`track-${track.world}`}>
            <h2 id={`track-${track.world}`} className="track-head"><Icon name={track.world === 'mars' ? 'mars' : 'globe'} size={22} />{track.title}</h2>
            <p className="meta track-lede">{track.lede}</p>
            <ol className="campaign" data-tut={track.world === 'moon' ? 'campaign' : undefined}>
              {list.map((m, i) => {
                const open = missionUnlocked(m.id, completed, allOpen)
                const rec = completed[m.id]
                const current = m.id === activeMissionId
                const need = missionsToOpen(m.id, completed)
                const t = targetById(m.targetId)
                return (
                  <li key={m.id} className={`mission-card cut ${open ? '' : 'locked'} ${current ? 'current' : ''} ${rec ? 'done' : ''}`}>
                    <div className="mc-node" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
                    <div className="mc-body">
                      <h2>{m.title}{current && <span className="chip gold">Active</span>}</h2>
                      <p className="mc-meta">
                        <span><Icon name="target" size={15} />{t.name}</span>
                        {t.program && <span><Icon name="flag" size={15} />{t.program}</span>}
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
                      {!open && (
                        <span className="mc-lock-note">
                          {track.world === 'mars' && i === 0 ? 'Pass any mission to open Mars' : `Pass ${need} more ${track.world === 'mars' ? 'Mars' : 'Moon'} ${need === 1 ? 'mission' : 'missions'} to open`}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
