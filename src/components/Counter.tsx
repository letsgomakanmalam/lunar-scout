import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

/** A number that rolls to its new value. Server rendering and reduced motion show the value directly. */
export default function Counter({ value, from, duration = 700, delay = 0, className }: { value: number; from?: number; duration?: number; delay?: number; className?: string }) {
  const [shown, setShown] = useState(from ?? value)
  const current = useRef(from ?? value)

  useEffect(() => {
    const start = current.current
    if (start === value) return
    if (prefersReducedMotion()) { current.current = value; setShown(value); return }
    let raf = 0
    let t0 = 0
    const step = (now: number) => {
      if (!t0) t0 = now + delay
      const k = Math.max(0, Math.min(1, (now - t0) / duration))
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)))
      current.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, delay])

  return <span className={`counter ${className ?? ''}`}>{shown}</span>
}
