/** True when the player asked their system for less motion. Safe to call during server rendering. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Device pixel ratio, capped so big screens don't cost too much canvas work. */
export const pixelRatio = (cap = 2) => (typeof window === 'undefined' ? 1 : Math.min(cap, window.devicePixelRatio || 1))
