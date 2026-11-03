import { useGame } from '../store'

/**
 * Interface sounds synthesized with Web Audio, so there are no audio files to load.
 * Browsers only allow sound after the first tap or key press; before that, calls are ignored.
 * Muting is stored with the rest of the game state.
 */
export type Sfx =
  | 'hover' | 'click' | 'back' | 'tab' | 'scan' | 'success' | 'fail'
  | 'star' | 'unlock' | 'place' | 'remove' | 'error' | 'land' | 'type'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let lastHover = 0

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.2
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(c: AudioContext, freq: number, dur: number, { type = 'sine' as OscillatorType, gain = 0.2, at = 0, to = 0, attack = 0.005 } = {}) {
  const t = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function hiss(c: AudioContext, dur: number, { gain = 0.08, at = 0, from = 600, to = 2400, q = 1.2 } = {}) {
  const t = c.currentTime + at
  const len = Math.ceil(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master!)
  src.start(t)
  src.stop(t + dur + 0.02)
}

export function sfx(name: Sfx) {
  if (useGame.getState().muted) return
  if (name === 'hover') {
    const now = performance.now()
    if (now - lastHover < 70) return
    lastHover = now
  }
  const c = audio()
  if (!c || !master) return
  switch (name) {
    case 'hover': tone(c, 2100, 0.035, { gain: 0.035 }); break
    case 'type': tone(c, 1500 + Math.random() * 300, 0.02, { type: 'square', gain: 0.012 }); break
    case 'click': tone(c, 660, 0.07, { type: 'triangle', gain: 0.16, to: 990 }); tone(c, 1980, 0.04, { gain: 0.05, at: 0.01 }); break
    case 'back': tone(c, 560, 0.09, { type: 'triangle', gain: 0.14, to: 330 }); break
    case 'tab': hiss(c, 0.22, { gain: 0.05, from: 500, to: 3200 }); tone(c, 880, 0.05, { gain: 0.06, at: 0.04 }); break
    case 'scan':
      hiss(c, 1.6, { gain: 0.05, from: 300, to: 2600, q: 3 })
      for (let i = 0; i < 6; i++) tone(c, 1250, 0.09, { gain: 0.07, at: 0.12 + i * 0.26 })
      break
    case 'success':
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, 0.55, { type: 'triangle', gain: 0.13, at: i * 0.09, attack: 0.01 }))
      tone(c, 261.63, 1.2, { gain: 0.08, at: 0.05, attack: 0.08 })
      break
    case 'fail': tone(c, 233, 0.22, { type: 'square', gain: 0.05, to: 196 }); tone(c, 175, 0.35, { type: 'square', gain: 0.05, at: 0.2, to: 147 }); break
    case 'star': tone(c, 1568, 0.25, { type: 'triangle', gain: 0.12 }); tone(c, 2349, 0.18, { gain: 0.05, at: 0.02 }); break
    case 'unlock': tone(c, 392, 0.5, { type: 'sawtooth', gain: 0.04, to: 1568 }); hiss(c, 0.6, { gain: 0.04, from: 1200, to: 6000, at: 0.1 }); tone(c, 1568, 0.6, { type: 'triangle', gain: 0.1, at: 0.45 }); break
    case 'place': tone(c, 170, 0.14, { gain: 0.25, to: 80 }); hiss(c, 0.08, { gain: 0.05, from: 2000, to: 800 }); break
    case 'remove': tone(c, 300, 0.16, { type: 'triangle', gain: 0.12, to: 120 }); break
    case 'error': tone(c, 140, 0.12, { type: 'square', gain: 0.06 }); tone(c, 140, 0.12, { type: 'square', gain: 0.06, at: 0.16 }); break
    case 'land': hiss(c, 1.2, { gain: 0.09, from: 2400, to: 200, q: 0.7 }); tone(c, 90, 0.5, { gain: 0.25, at: 1.0, to: 45 }); break
  }
}
