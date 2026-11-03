import { useEffect, useState } from 'react'

/** True when the player asked their system for less motion. Safe to call during server rendering. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Device pixel ratio, capped so big screens don't cost too much canvas work. */
export const pixelRatio = (cap = 2) => (typeof window === 'undefined' ? 1 : Math.min(cap, window.devicePixelRatio || 1))

/** Phones and small laptops with few cores or little memory get lighter rendering. */
export const isLowPower = () => {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Navigator & { deviceMemory?: number }
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4
}

/** Live result of a CSS media query (false during server rendering). */
export function useMedia(query: string) {
  const [match, setMatch] = useState(false)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}
