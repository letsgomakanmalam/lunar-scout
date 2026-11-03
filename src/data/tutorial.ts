import type { Screen } from '../store'

/** Things the player does that move the tutorial on. */
export type TutEvent = 'site' | 'scanned' | 'certified' | 'landed' | 'placed'

export interface TutStep {
  id: string
  screen: Screen
  /** data-tut name of the element to spotlight */
  target: string
  title: string
  text: string
  /** If set, the step moves on by itself when the player does this */
  waitFor?: TutEvent
  waitText?: string
  /** Shown when the player is on a different screen */
  navText: string
}

const BACK = 'Open Explore Earth to carry on with your mission.'

export const TUTORIAL: TutStep[] = [
  { id: 'brief', screen: 'explore', target: 'brief', navText: BACK, title: 'Your mission',
    text: 'Each mission names a place on the Moon and what matters there. This one trains you for Taurus-Littrow, where Apollo 17 landed.' },
  { id: 'weights', screen: 'explore', target: 'weights', navText: BACK, title: 'What counts',
    text: 'These bars show what this mission cares about. The longer the bar, the more it counts toward the score.' },
  { id: 'map', screen: 'explore', target: 'map', navText: BACK, title: 'Pick a place on Earth', waitFor: 'site', waitText: 'Pick any site to continue',
    text: 'Tap a marker on the map, or choose from the list. White markers are known test sites, gold ones are new candidates and pink ones are in Malaysia.' },
  { id: 'scan', screen: 'explore', target: 'scan-button', navText: BACK, title: 'Scan it', waitFor: 'scanned', waitText: 'Scan the site to continue',
    text: 'A scan reads NASA data about this place. You get 8 probes per mission, so choose with care.' },
  { id: 'score', screen: 'explore', target: 'result', navText: BACK, title: 'Read the score',
    text: 'The Analog Similarity Index runs from 0 to 100. Green means this site passes the mission. The radar shows the site in blue against the Moon in white.' },
  { id: 'certify', screen: 'explore', target: 'certify', navText: BACK, title: 'Certify a match', waitFor: 'certified', waitText: 'Certify a passing site to continue',
    text: 'Certify a site that passes to earn research points. If it falls short, go back to the site list and scan another one.' },
  { id: 'land', screen: 'land', target: 'landing', navText: 'You have research points now. Open Landing site to spend them.', title: 'Choose where to land', waitFor: 'landed', waitText: 'Land at a site to continue',
    text: 'Research points pay for your Moon base. Each landing site changes what modules cost and what they do well. Taurus-Littrow is the easy start.' },
  { id: 'palette', screen: 'build', target: 'palette', navText: 'Open Base to start building.', title: 'Pick a module',
    text: 'Each module costs research points. Solar arrays make power; habitats and comms towers use it.' },
  { id: 'grid', screen: 'build', target: 'grid', navText: 'Open Base to start building.', title: 'Build', waitFor: 'placed', waitText: 'Place a module to continue',
    text: 'Tap an empty plot to place the selected module. Tap a placed module to upgrade it or remove it.' },
  { id: 'status', screen: 'build', target: 'status', navText: 'Open Base to check your base.', title: 'Get it running',
    text: 'A working base needs a habitat, a comms tower and enough power. Earn more points from missions to finish it.' },
  { id: 'next', screen: 'missions', target: 'campaign', navText: 'Open Missions to see what comes next.', title: "You're ready, scout",
    text: 'Each mission you pass opens the next one, and some unlock new modules. Your journal logs every discovery, and Progress shows your rank.' },
]
