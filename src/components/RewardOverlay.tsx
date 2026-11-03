import { useEffect } from 'react'
import Modal from './Modal'
import Icon, { MODULE_ICON } from './Icon'
import Counter from './Counter'
import { sfx } from '../lib/sfx'
import { prefersReducedMotion } from '../lib/motion'
import { moduleById } from '../data/modules'
import type { ModuleId } from '../data/types'

export interface CertifyResult { stars: number; asi: number; reward: number; unlocked?: ModuleId }

interface Props {
  result: CertifyResult | null
  missionNumber: number
  missionTitle: string
  passAsi: number
  siteName: string
  weakPoints: string[]
  hasLanding: boolean
  onClose: () => void
  onMissions: () => void
  onBase: () => void
}

/** The certification moment: verdict, stars one by one, similarity and points rolling up, unlocks. */
export default function RewardOverlay({ result, missionNumber, missionTitle, passAsi, siteName, weakPoints, hasLanding, onClose, onMissions, onBase }: Props) {
  const pass = !!result && result.stars > 0

  useEffect(() => {
    if (!result) return
    sfx(pass ? 'success' : 'fail')
    if (!pass || prefersReducedMotion()) return
    const timers = [
      ...Array.from({ length: result.stars }, (_, i) => setTimeout(() => sfx('star'), 520 + i * 300)),
      ...(result.unlocked ? [setTimeout(() => sfx('unlock'), 620 + result.stars * 300)] : []),
    ]
    return () => timers.forEach(clearTimeout)
  }, [result, pass])

  if (!result) return null
  const repeat = pass && result.reward === 0
  return (
    <Modal open onClose={onClose} labelledBy="reward-title" className={`reward cut ${pass ? 'is-pass' : 'is-fail'}`}>
      <p className="reward-mission">Mission {missionNumber}: {missionTitle}</p>
      <h2 id="reward-title" className="reward-title">{pass ? 'Site certified' : 'Provisional log'}</h2>
      <p className="reward-site"><Icon name="target" size={16} /> {siteName}</p>

      <div className="reward-stars" role="img" aria-label={`${result.stars} of 3 stars`}>
        {[0, 1, 2].map(i => (
          <span key={i} className={`rstar ${i < result.stars ? 'on' : 'off'}`} style={{ animationDelay: `${520 + i * 300}ms` }}>
            <Icon name={i < result.stars ? 'star' : 'starOutline'} size={46} />
          </span>
        ))}
      </div>

      <dl className="reward-stats">
        <div>
          <dt>Analog similarity</dt>
          <dd><Counter from={0} value={result.asi} duration={900} delay={150} className="big" /><small>pass mark {passAsi}</small></dd>
        </div>
        <div>
          <dt>Research points</dt>
          <dd><span className="big">+<Counter from={0} value={result.reward} duration={800} delay={pass ? 450 + result.stars * 300 : 0} /></span><small>{repeat ? 'no change to your best' : pass ? 'added to your base budget' : 'nothing yet'}</small></dd>
        </div>
      </dl>

      {result.unlocked && (
        <div className="reward-unlock cut" style={{ animationDelay: `${620 + result.stars * 300}ms` }}>
          <Icon name={MODULE_ICON[result.unlocked]} size={34} />
          <div><strong>New module unlocked</strong><span>{moduleById(result.unlocked).name}</span></div>
        </div>
      )}

      {repeat && <p className="reward-note">You already hold this many stars here. Beat your best to earn more points.</p>}
      {!pass && (
        <p className="reward-note">
          This site needs {passAsi} to pass. {weakPoints.length > 0 ? `Weak points: ${weakPoints.join(', ')}. ` : ''}It is saved in your journal; try a site that is stronger on what this mission weighs most.
        </p>
      )}

      <div className="dialog-actions">
        <button className="btn ghost cut" onClick={onMissions}>All missions</button>
        {pass ? (
          <>
            <button className="btn ghost cut" data-sfx="back" onClick={onClose}>Keep scanning</button>
            <button className="btn primary cut" data-autofocus onClick={onBase}>{hasLanding ? 'Build your base' : 'Choose landing site'}</button>
          </>
        ) : (
          <button className="btn primary cut" data-autofocus onClick={onClose}>Scan another site</button>
        )}
      </div>
    </Modal>
  )
}
