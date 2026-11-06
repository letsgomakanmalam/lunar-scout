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
    text: "Each mission names a real base or landing site on the Moon or Mars, and what matters there. This one trains you for NASA's Moon Base, on a ridge by Shackleton crater at the lunar south pole." },
  { id: 'weights', screen: 'explore', target: 'weights', navText: BACK, title: 'What counts',
    text: 'These bars show what this mission cares about. The longer the bar, the more it counts toward the score.' },
  { id: 'map', screen: 'explore', target: 'map', navText: BACK, title: 'Pick a place on Earth', waitFor: 'site', waitText: 'Pick any site to continue',
    text: 'Tap a marker on the map, or choose from the list. White markers are known test sites, gold ones are new candidates and pink ones are in Malaysia. Later, the crosshair tool lets you probe any point with live data.' },
  { id: 'scan', screen: 'explore', target: 'scan-button', navText: BACK, title: 'Scan it', waitFor: 'scanned', waitText: 'Scan the site to continue',
    text: 'A scan compares this place with the mission target using NASA and partner data. You get 8 probes per mission, so choose with care.' },
  { id: 'score', screen: 'explore', target: 'result', navText: BACK, title: 'Read the score',
    text: 'The Analog Similarity Index runs from 0 to 100. Green means this site passes the mission. The radar shows the site in blue against the target in white.' },
  { id: 'certify', screen: 'explore', target: 'certify', navText: BACK, title: 'Certify a match', waitFor: 'certified', waitText: 'Certify a passing site to continue',
    text: 'Certify a site that passes to earn research points. If it falls short, go back to the site list and scan another one.' },
  { id: 'land', screen: 'land', target: 'landing', navText: 'You have research points now. Open Landing site to spend them.', title: 'Choose where to land', waitFor: 'landed', waitText: 'Land at a site to continue',
    text: 'Research points pay for your base. Each landing site, on the Moon or Mars, changes what modules cost and what they do well. The flat Mons Mouton plateau is the easy start.' },
  { id: 'palette', screen: 'build', target: 'palette', navText: 'Open Base to start building.', title: 'Pick a building',
    text: 'Each building uses the energy on its badge. Energy refills over time, faster with more solar arrays.' },
  { id: 'grid', screen: 'build', target: 'grid', navText: 'Open Base to start building.', title: 'Build', waitFor: 'placed', waitText: 'Place a module to continue',
    text: 'Tap a plot on the plateau to build. The number shows the points you score: buildings score more next to good neighbours.' },
  { id: 'status', screen: 'build', target: 'status', navText: 'Open Base to check your base.', title: 'Get it running',
    text: 'A working base needs a habitat, a comms tower and enough power. Open + for quests: they unlock new technology like the greenhouse farm.' },
  { id: 'next', screen: 'missions', target: 'campaign', navText: 'Open Missions to see what comes next.', title: "You're ready, scout",
    text: 'Each mission you pass opens the next one, and some unlock new modules. Your journal logs every discovery, and Progress shows your rank.' },
]
