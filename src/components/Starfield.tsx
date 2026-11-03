import { useEffect, useRef } from 'react'
import { mulberry32 } from '../lib/moonTexture'
import { pixelRatio } from '../lib/motion'

/**
 * Seeded star field with a faint Milky Way band. Drawn once per resize; a handful of
 * brighter stars twinkle as four-point glints with CSS so no animation loop runs.
 */
export default function Starfield({ className, density = 1, band = true }: { className?: string; density?: number; band?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const draw = () => {
      const dpr = pixelRatio(1.5)
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const rnd = mulberry32(2026)
      // Milky Way: a soft diagonal glow with extra faint stars packed along it
      const angle = -0.42
      const ca = Math.cos(angle), sa = Math.sin(angle)
      const cx = w * 0.55, cy = h * 0.45
      if (band) {
        for (let i = 0; i < 70; i++) {
          const t = (rnd() - 0.5) * Math.hypot(w, h) * 1.1
          const off = (rnd() - 0.5) * h * 0.16
          const x = cx + t * ca - off * sa, y = cy + t * sa + off * ca
          const r = 40 + rnd() * 120
          const g = ctx.createRadialGradient(x, y, 0, x, y, r)
          const warm = rnd() < 0.3
          g.addColorStop(0, warm ? 'rgba(190,170,150,0.035)' : 'rgba(150,170,210,0.035)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.fillRect(x - r, y - r, r * 2, r * 2)
        }
      }
      const count = Math.round(((w * h) / 1500) * density)
      for (let i = 0; i < count; i++) {
        let x = rnd() * w, y = rnd() * h
        if (band && rnd() < 0.45) {
          const t = (rnd() - 0.5) * Math.hypot(w, h)
          const off = (rnd() + rnd() + rnd() - 1.5) * h * 0.09
          x = cx + t * ca - off * sa
          y = cy + t * sa + off * ca
        }
        const m = Math.pow(rnd(), 3.2)
        const r = 0.35 + m * 1.25
        const a = 0.25 + m * 0.75
        const temp = rnd()
        const col = temp < 0.18 ? '255,214,170' : temp < 0.55 ? '235,238,255' : '200,215,255'
        ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        if (m > 0.55) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5)
          g.addColorStop(0, `rgba(${col},${(a * 0.22).toFixed(3)})`)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = g
          ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10)
        }
      }
    }
    draw()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [density, band])

  // Deterministic twinkles so server and browser render the same markup.
  const rnd = mulberry32(77)
  const twinkles = Array.from({ length: 26 }, (_, i) => ({
    i, x: rnd() * 100, y: rnd() * 100, d: (rnd() * 6).toFixed(2), s: (2.5 + rnd() * 4).toFixed(2), z: Math.round(8 + Math.pow(rnd(), 2) * 13),
  }))

  return (
    <div className={`starfield ${className ?? ''}`} aria-hidden="true">
      <canvas ref={canvas} />
      {twinkles.map(t => (
        <i key={t.i} style={{ left: `${t.x}%`, top: `${t.y}%`, width: t.z, height: t.z, animationDelay: `${t.d}s`, animationDuration: `${t.s}s` }} />
      ))}
    </div>
  )
}
