import { describe, expect, it } from 'vitest'
import { crewCapacity, emptyGrid, isOperational, moduleCost, powerBalance, rankFor } from './base'
import { targetById } from '../data/moon'

describe('base rules', () => {
  const easy = targetById('taurus-littrow')
  const pole = targetById('shackleton')
  const pit = targetById('marius-hills')

  it('applies landing cost multipliers and the polar ice discount', () => {
    expect(moduleCost('habitat', easy)).toBe(60)
    expect(moduleCost('habitat', pole)).toBe(75)
    expect(moduleCost('ice', pole)).toBe(Math.round(90 * 1.25 * 0.7))
  })

  it('computes power, crew and operational status', () => {
    const g = emptyGrid()
    g[0] = { id: 'habitat', level: 1 }
    g[1] = { id: 'comms', level: 1 }
    expect(isOperational(g, easy)).toBe(false) // -3 power
    g[2] = { id: 'power', level: 1 }
    expect(powerBalance(g, easy).net).toBe(1)
    expect(isOperational(g, easy)).toBe(true)
    expect(powerBalance(g, pole).net).toBe(4) // +3 sun bonus
    expect(powerBalance(g, pit).net).toBe(2) // habitat sheltered
    expect(crewCapacity(g)).toBe(2)
  })

  it('ranks by stars', () => {
    expect(rankFor(0)).toBe('Cadet')
    expect(rankFor(14)).toBe('Chief selenologist')
  })
})

import { baseScore, cellScore, energyCap, energyCost, energyRegenMs, goalRange, goalsReached, neighbours, placementGain, settleEnergy, SCORE_GOALS } from './base'
import { MODULES } from '../data/modules'
import { QUESTS, TECH } from '../data/quests'

describe('energy', () => {
  it('refills one point per period, keeps part-way progress and stops when full', () => {
    expect(settleEnergy(5, 0, 25000, 20, 10000)).toEqual({ energy: 7, at: 20000, next: 30000 })
    expect(settleEnergy(19, 0, 99999, 20, 10000)).toMatchObject({ energy: 20, next: null })
    expect(settleEnergy(20, 0, 5, 20, 10000)).toMatchObject({ energy: 20, next: null })
  })
  it('grows with batteries and refills faster with solar arrays and pads', () => {
    const g = emptyGrid()
    expect(energyCap(g)).toBe(20)
    g[0] = { id: 'battery', level: 1 }; g[1] = { id: 'battery', level: 2 }
    expect(energyCap(g)).toBe(36)
    const slow = energyRegenMs(g)
    g[2] = { id: 'power', level: 1 }; g[3] = { id: 'pad', level: 1 }
    expect(energyRegenMs(g)).toBeLessThan(slow)
  })
  it('costs more energy at harder landing sites', () => {
    expect(energyCost('habitat', targetById('taurus-littrow'))).toBe(4)
    expect(energyCost('habitat', targetById('shackleton'))).toBe(5)
  })
})

describe('base score', () => {
  it('counts only real neighbours', () => {
    expect(neighbours(0).sort((a, b) => a - b)).toEqual([1, 6, 7])
    expect(neighbours(7)).toHaveLength(8)
  })
  it('rewards good neighbours and punishes bad ones', () => {
    const g = emptyGrid()
    g[7] = { id: 'habitat', level: 1 }
    expect(placementGain(g, 8, 'farm')).toBe(5 + 3 + 4) // farm base + farm likes habitat + habitat likes farm
    expect(placementGain(g, 8, 'pad')).toBeLessThan(5)  // dust next to a home
    g[8] = { id: 'farm', level: 1 }
    expect(baseScore(g)).toBe(6 + 4 + 5 + 3)
    expect(cellScore(g, 7)).toBe(10)
  })
  it('wants the telescope somewhere quiet', () => {
    const g = emptyGrid()
    const alone = placementGain(g, 14, 'telescope')
    g[15] = { id: 'comms', level: 1 }
    expect(placementGain(g, 14, 'telescope')).toBeLessThan(alone - 6)
  })
  it('moves the ring from one target to the next', () => {
    expect(goalsReached(0)).toBe(0)
    expect(goalsReached(SCORE_GOALS[1])).toBe(2)
    expect(goalRange(50, 1)).toEqual({ from: 40, to: 100, done: false })
  })
})

describe('quests and technology', () => {
  it('needs real quests to unlock each building that is not there from the start', () => {
    const ids = new Set(QUESTS.map(q => q.id))
    expect(ids.size).toBe(QUESTS.length)
    for (const t of TECH) for (const r of t.requires) expect(ids.has(r), `${t.id} needs ${r}`).toBe(true)
    for (const m of MODULES.filter(x => !x.startsUnlocked)) expect(TECH.some(t => t.id === m.id), m.id).toBe(true)
  })
})
