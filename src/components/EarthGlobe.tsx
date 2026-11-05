import { useEffect, useRef, useState } from 'react'
import type { EarthTexture } from '../lib/moonTexture'
import { loadEarth, peekEarth } from '../lib/textureCache'
import { prepareGlobe, renderEarth, type Vec3 } from '../lib/globe'
import { pixelRatio, prefersReducedMotion } from '../lib/motion'

/** Small spinning Earth with drifting clouds, lit from the same sun as the Moon. */
export default function EarthGlobe({ size, light, className }: { size: number; light: Vec3; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tex, setTex] = useState<EarthTexture | null>(() => peekEarth())
  const [lx, ly, lz] = light

  useEffect(() => {
    if (tex) return
    let alive = true
    loadEarth().then(t => alive && setTex(t))
    return () => { alive = false }
  }, [tex])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !tex) return
    const res = Math.max(32, Math.min(260, Math.round(size * pixelRatio())))
    el.width = res
    el.height = res
    const prep = prepareGlobe(res, 18, [lx, ly, lz], tex.w, tex.h)
    const img = ctx.createImageData(res, res)
    const draw = (sec: number) => {
      // Starts over the Indian Ocean with Malaysia near the morning terminator.
      renderEarth(prep, tex, 70 + sec * 3.5, 70 + sec * 4.2, img.data)
      ctx.putImageData(img, 0, 0)
    }
    if (prefersReducedMotion()) { draw(0); return }
    let raf = 0
    let last = -1e9
    const t0 = performance.now()
    const tick = (now: number) => {
      if (now - last > 50) { draw((now - t0) / 1000); last = now }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tex, size, lx, ly, lz])

  return (
    <div className={`earth ${className ?? ''} ${tex ? 'is-ready' : 'is-loading'}`} style={{ width: size, height: size }} role="img" aria-label="Earth">
      <canvas ref={canvas} width={2} height={2} />
    </div>
  )
}
