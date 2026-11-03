let ctx: AudioContext | null = null

/** One shared AudioContext for music and sound effects, created on first use. */
export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try { ctx = new AC() } catch { return null }
  }
  return ctx
}

/** Browsers only allow sound after the player has tapped or pressed a key. */
export const canPlayAudio = () =>
  typeof navigator !== 'undefined' &&
  ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true)
