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
