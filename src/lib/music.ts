import { audioContext } from './audio'
import { mulberry32 } from './moonTexture'

/**
 * Original soundtrack, composed in code and synthesized live with Web Audio:
 * slow pads over an A minor progression (Am9, Fmaj7, Cmaj7, Em7), a sub bass, a bell
 * melody that wanders over the chord tones, starlight pings and a faint solar-wind hiss.
 * No audio files: nothing to download and no licences to clear.
 *
 * To play your own track instead, put the file in public/music/ and set CUSTOM_TRACK,
 * for example './music/theme.mp3'. Only use music you have the rights to.
 */
export const CUSTOM_TRACK: string | null = null

export type Mood = 'title' | 'game'

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const BEAT = 0.8
const BEATS_PER_CHORD = 10

interface Chord { root: number; pad: number[]; tones: number[] }
const CHORDS: Chord[] = [
  { root: 45, pad: [57, 60, 64, 71], tones: [69, 71, 72, 76, 79, 81, 83, 84] }, // Am9
  { root: 41, pad: [53, 57, 60, 64], tones: [69, 72, 74, 76, 77, 79, 81, 84] }, // Fmaj7
  { root: 48, pad: [55, 60, 64, 71], tones: [67, 69, 71, 72, 74, 76, 79, 83] }, // Cmaj7
  { root: 40, pad: [55, 59, 62, 67], tones: [67, 69, 71, 74, 76, 79, 81, 83] }, // Em7
]

interface Graph { pad: GainNode; lead: GainNode; air: GainNode }

function impulse(c: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  const rnd = mulberry32(9)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

/** Reverb and echo shared by every instrument. */
function buildGraph(c: BaseAudioContext, out: AudioNode): Graph {
  const reverb = c.createConvolver()
  reverb.buffer = impulse(c, 3.2, 2.4)
  const wet = c.createGain(); wet.gain.value = 0.6
  reverb.connect(wet).connect(out)
  const dry = c.createGain(); dry.gain.value = 0.75
  dry.connect(out)
  const delay = c.createDelay(2); delay.delayTime.value = BEAT * 0.75
  const feedback = c.createGain(); feedback.gain.value = 0.36
  const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200
  delay.connect(tone); tone.connect(feedback).connect(delay)
  const echo = c.createGain(); echo.gain.value = 0.5
  tone.connect(echo); echo.connect(dry); echo.connect(reverb)
  const pad = c.createGain(); pad.connect(dry); pad.connect(reverb)
  const lead = c.createGain(); lead.connect(dry); lead.connect(reverb); lead.connect(delay)
  const air = c.createGain(); air.connect(reverb); air.connect(dry)
  return { pad, lead, air }
}

/** Filtered noise drifting slowly in pitch, like wind that isn't there. Returns a stop function. */
function startWind(c: BaseAudioContext, g: Graph, at: number) {
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  const rnd = mulberry32(5)
  for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.8
  const lfo = c.createOscillator(); lfo.frequency.value = 0.045
  const depth = c.createGain(); depth.gain.value = 380
  lfo.connect(depth).connect(bp.frequency)
  const level = c.createGain(); level.gain.value = 0.018
  src.connect(bp).connect(level).connect(g.air)
  src.start(at); lfo.start(at)
  return () => { try { src.stop(); lfo.stop() } catch { /* already stopped */ } }
}

/** Schedules the score one beat at a time, slightly ahead of the audio clock. */
class Composer {
  t = 0
  beat = 0
  private step = 3
  private rnd: () => number
  constructor(private c: BaseAudioContext, private g: Graph, seed: number, private mood: () => Mood) {
    this.rnd = mulberry32(seed)
  }

  until(end: number) {
    while (this.t < end) { this.play(this.t, this.beat); this.beat++; this.t += BEAT }
  }

  skipTo(time: number) {
    while (this.t < time) { this.beat++; this.t += BEAT }
  }

  private play(t: number, n: number) {
    const chord = CHORDS[Math.floor(n / BEATS_PER_CHORD) % CHORDS.length]
    const local = n % BEATS_PER_CHORD
    if (local === 0) this.chord(t, chord)
    const title = this.mood() === 'title'
    const p = title ? (local % 2 === 0 ? 0.6 : 0.28) : (local % 2 === 0 ? 0.24 : 0.07)
    if (this.rnd() < p) this.bell(t, chord, title ? 0.06 : 0.04)
    if (this.rnd() < (title ? 0.1 : 0.06)) this.ping(t + BEAT / 2, chord)
  }

  private chord(t: number, ch: Chord) {
    const len = BEAT * BEATS_PER_CHORD + 2.6
    for (const m of ch.pad) for (const det of [-8, 8]) this.voice(this.g.pad, hz(m), t, len, 'sawtooth', 0.016, 2.6, 3, det, 950)
    this.voice(this.g.pad, hz(ch.root), t, len, 'sine', 0.12, 1.8, 2.6, 0, 0)
    this.voice(this.g.pad, hz(ch.root + 12), t, len, 'triangle', 0.03, 2.2, 2.6, 0, 600)
  }

  private voice(bus: AudioNode, f: number, t: number, len: number, type: OscillatorType, gain: number, attack: number, release: number, detune: number, lp: number) {
    const c = this.c
    const o = c.createOscillator()
    o.type = type; o.frequency.value = f; o.detune.value = detune
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.setValueAtTime(gain, t + len - release)
    g.gain.linearRampToValueAtTime(0, t + len)
    if (lp) {
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = 0.3
      o.connect(fl).connect(g)
    } else o.connect(g)
    g.connect(bus)
    o.start(t); o.stop(t + len + 0.05)
  }

  private bell(t: number, ch: Chord, gain: number) {
    const moves = [-2, -1, -1, 0, 1, 1, 2]
    this.step = Math.max(0, Math.min(ch.tones.length - 1, this.step + moves[Math.floor(this.rnd() * moves.length)]))
    const f = hz(ch.tones[this.step])
    for (const [mul, k, dec] of [[1, 1, 2.2], [2, 0.28, 1.1], [3.01, 0.08, 0.6]] as const) {
      const o = this.c.createOscillator()
      o.type = mul === 1 ? 'triangle' : 'sine'; o.frequency.value = f * mul
      const g = this.c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(gain * k, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec)
      o.connect(g).connect(this.g.lead)
      o.start(t); o.stop(t + dec + 0.05)
    }
  }

  private ping(t: number, ch: Chord) {
    const o = this.c.createOscillator()
    o.type = 'sine'; o.frequency.value = hz(ch.tones[Math.floor(this.rnd() * ch.tones.length)] + 12)
    const g = this.c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
    o.connect(g).connect(this.g.air)
    o.start(t); o.stop(t + 1.3)
  }
}

class Music {
  readonly volume = 0.6
  private c: AudioContext | null = null
  private out: GainNode | null = null
  private graph: Graph | null = null
  private comp: Composer | null = null
  private stopWind: (() => void) | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private file: HTMLAudioElement | null = null
  private mood: Mood = 'title'
  private wanted = false
  private hooked = false

  setMood(m: Mood) { this.mood = m }

  /** Starts the music (fading in). Must first be called from a tap or key press. */
  play() {
    this.wanted = true
    this.hookVisibility()
    if (CUSTOM_TRACK) { this.playFile(); return }
    const c = audioContext()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})
    if (this.timer) return
    if (!this.out) {
      this.out = c.createGain()
      this.out.gain.value = 0
      this.out.connect(c.destination)
      this.graph = buildGraph(c, this.out)
    }
    this.c = c
    const now = c.currentTime
    const g = this.out.gain
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(this.volume, now + 3)
    if (!this.comp) this.comp = new Composer(c, this.graph!, Date.now() % 100000, () => this.mood)
    this.comp.skipTo(now + 0.2)
    this.stopWind?.()
    this.stopWind = startWind(c, this.graph!, now)
    this.timer = setInterval(() => this.tick(), 150)
    this.tick()
  }

  /** Fades out and stops. */
  pause() {
    this.wanted = false
    this.halt()
  }

  /** Dips the music under a fanfare, then brings it back. */
  duck(seconds: number) {
    if (this.file) {
      const f = this.file
      f.volume = 0.15
      setTimeout(() => { f.volume = 0.5 }, seconds * 1000)
      return
    }
    if (!this.c || !this.out || !this.timer) return
    const now = this.c.currentTime
    const g = this.out.gain
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(this.volume * 0.3, now + 0.12)
    g.setValueAtTime(this.volume * 0.3, now + seconds * 0.6)
    g.linearRampToValueAtTime(this.volume, now + seconds)
  }

  private halt() {
    this.file?.pause()
    if (!this.c || !this.out || !this.timer) return
    clearInterval(this.timer)
    this.timer = null
    const now = this.c.currentTime
    const g = this.out.gain
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + 1.2)
    const stop = this.stopWind
    this.stopWind = null
    setTimeout(() => stop?.(), 1400)
  }

  private tick() {
    const c = this.c, comp = this.comp
    if (!c || !comp || c.state !== 'running') return
    if (comp.t < c.currentTime) comp.skipTo(c.currentTime + 0.05) // after the tab was busy: skip, don't burst
    comp.until(c.currentTime + 0.8)
  }

  private playFile() {
    if (!this.file) { this.file = new Audio(CUSTOM_TRACK!); this.file.loop = true; this.file.volume = 0.5 }
    this.file.play().catch(() => {})
  }

  private hookVisibility() {
    if (this.hooked || typeof document === 'undefined') return
    this.hooked = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.halt()
      else if (this.wanted) this.play()
    })
  }
}

export const music = new Music()

/** Renders the score offline and reports its level; used to check the mix in tests and tools. */
export async function renderScore(seconds: number, mood: Mood = 'title', seed = 1234) {
  const sr = 22050
  const c = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr)
  const out = c.createGain()
  out.gain.value = music.volume
  out.connect(c.destination)
  const g = buildGraph(c, out)
  startWind(c, g, 0)
  const comp = new Composer(c, g, seed, () => mood)
  comp.t = 0.05
  comp.until(seconds)
  const buf = await c.startRendering()
  let peak = 0, sum = 0, n = 0, bad = 0
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) {
      const v = d[i]
      if (!Number.isFinite(v)) { bad++; continue }
      peak = Math.max(peak, Math.abs(v)); sum += v * v; n++
    }
  }
  return { peak, rms: Math.sqrt(sum / Math.max(1, n)), bad }
}
