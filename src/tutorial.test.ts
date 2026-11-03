import { beforeEach, describe, expect, it } from 'vitest'
import { useGame } from './store'
import { TUTORIAL } from './data/tutorial'

const stepId = () => TUTORIAL[useGame.getState().tutorialStep].id
const goTo = (id: string) => useGame.setState({ tutorialStep: TUTORIAL.findIndex(s => s.id === id) })

describe('guided tutorial', () => {
  beforeEach(() => {
    useGame.setState({ landingId: null })
    useGame.getState().startTutorial()
  })

  it('starts on Explore with the tutorial mission', () => {
    const s = useGame.getState()
    expect(s.tutorialDone).toBe(false)
    expect(stepId()).toBe('brief')
    expect(s.screen).toBe('explore')
    expect(s.activeMissionId).toBe('tutorial')
  })

  it('waits for the right action, then moves on', () => {
    goTo('certify')
    useGame.getState().tutorialEvent('placed')
    expect(stepId()).toBe('certify')
    useGame.getState().tutorialEvent('certified')
    expect(stepId()).toBe('land')
  })

  it('skips steps the player already did', () => {
    useGame.getState().tutorialEvent('site')
    useGame.getState().tutorialEvent('scanned')
    useGame.getState().nextTutorialStep() // brief -> weights
    useGame.getState().nextTutorialStep() // map and scan are done, so -> score
    expect(stepId()).toBe('score')
  })

  it('never asks a returning player to move an existing base', () => {
    useGame.setState({ landingId: 'taurus-littrow' })
    useGame.getState().startTutorial()
    expect(useGame.getState().tutorialFlags).toContain('landed')
  })

  it('finishes after the last step', () => {
    goTo('next')
    useGame.getState().nextTutorialStep()
    expect(useGame.getState().tutorialDone).toBe(true)
  })
})
