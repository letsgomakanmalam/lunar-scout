import { useEffect, useRef, useState } from 'react'
import type { MoonTexture } from '../lib/moonTexture'
import { loadMoon, peekMoon } from '../lib/textureCache'
import { prepareGlobeSteps, projectToView, renderMoon, runSteps, runStepsAsync, type Vec3 } from '../lib/globe'
import { isLowPower, pixelRatio, prefersReducedMotion } from '../lib/motion'

export interface GlobeMarker {
  id: string
  lat: number
  lon: number
  label: string
}

interface Props {
  /** Size on screen in CSS pixels */
  size: number
  label: string
  className?: string
  /** Degrees per second of slow rotation. 0 keeps the globe still. */
  spin?: number
  /** View latitude in degrees */
  tilt?: number
  /** Starting view longitude in degrees */
  lon?: number
  light?: Vec3
  /** Rotates to this place, then locks a reticle onto it */
  target?: { lat: number; lon: number } | null
  /** Other places drawn as small dots once the view settles */
  markers?: GlobeMarker[]
  /** Cap on canvas pixels across, to bound the work per frame */
  maxRes?: number
  /** Called once the surface is drawn for the first time */
  onReady?: () => void
}

const DEFAULT_LIGHT: Vec3 = [-0.86, 0.24, 0.45]
const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const clampTilt = (lat: number) => Math.max(-55, Math.min(55, lat))

/**
 * A lit, rotating Moon drawn into a canvas. Maria and named craters sit at their real
 * positions (see lib/moonTexture.ts), so target markers land on the right terrain.
 */
export default function MoonGlobe({
  size, label, className, spin = 0, tilt = 0, lon = 0, light = DEFAULT_LIGHT,
  target = null, markers, maxRes = 720, onReady,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tex, setTex] = useState<MoonTexture | null>(() => peekMoon())
  const [lock, setLock] = useState<{ lon: number; tilt: number } | null>(null)
  const lastLon = useRef<number | null>(null)
  const readyRef = useRef(onReady)
  readyRef.current = onReady

  useEffect(() => {
    if (tex) return
    let alive = true
    loadMoon().then(t => alive && setTex(t))
    return () => { alive = false }
  }, [tex])

  const tLat = target?.lat
  const tLon = target?.lon
  const [lx, ly, lz] = light

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx || !tex) return
    const cap = isLowPower() ? Math.min(maxRes, 520) : maxRes
    const res = Math.max(32, Math.min(cap, Math.round(size * pixelRatio())))
    const viewTilt = tLat != null ? clampTilt(tLat) : tilt
    const reduce = prefersReducedMotion()
    let cancelled = false
    let raf = 0
    setLock(null)

    const start = async () => {
      const steps = prepareGlobeSteps(res, viewTilt, [lx, ly, lz], tex.w, tex.h)
      const prep = res <= 360 ? runSteps(steps) : await runStepsAsync(steps, () => cancelled)
      if (!prep || cancelled) return
      if (el.width !== res) { el.width = res; el.height = res }
      const img = ctx.createImageData(res, res)
      let first = true
      const draw = (viewLon: number) => {
        renderMoon(prep, tex, viewLon, img.data)
        ctx.putImageData(img, 0, 0)
        lastLon.current = viewLon
        if (first) { first = false; readyRef.current?.() }
      }

      if (tLat != null && tLon != null) {
        // Target mode: swing round to the site, then lock on.
        const from = lastLon.current ?? tLon + 75
        let delta = ((tLon - from + 540) % 360) - 180
        if (Math.abs(delta) < 50) delta += delta < 0 ? -50 : 50
        const begin = tLon - delta
        if (reduce) { draw(tLon); setLock({ lon: tLon, tilt: viewTilt }); return }
        const t0 = performance.now()
        const dur = 1300
        const tick = (now: number) => {
          if (cancelled) return
          const k = Math.min(1, (now - t0) / dur)
          draw(begin + delta * ease(k))
          if (k < 1) raf = requestAnimationFrame(tick)
          else setLock({ lon: tLon, tilt: viewTilt })
        }
        raf = requestAnimationFrame(tick)
        return
      }

      if (!spin || reduce) { draw(lon); return }
      // Spin mode: steady rotation, frame rate adapts to how long a frame takes to draw.
      const t0 = performance.now()
      let lastDraw = -1e9
      let gap = 33
      const tick = (now: number) => {
        if (cancelled) return
        if (now - lastDraw >= gap) {
          const a = performance.now()
          draw(lon + ((now - t0) / 1000) * spin)
          gap = Math.min(100, Math.max(33, (performance.now() - a) * 2.5))
          lastDraw = now
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    start()
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [tex, size, maxRes, spin, tilt, lon, tLat, tLon, lx, ly, lz])

  const targetPos = lock && tLat != null && tLon != null ? projectToView(tLat, tLon, lock.lon, lock.tilt) : null

  return (
    <div className={`globe ${className ?? ''} ${tex ? 'is-ready' : 'is-loading'}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <canvas ref={canvas} className="globe-canvas" width={2} height={2} />
      {lock && markers?.map(m => {
        if (m.lat === tLat && m.lon === tLon) return null
        const p = projectToView(m.lat, m.lon, lock.lon, lock.tilt)
        return p && <span key={m.id} className="globe-dot" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} title={m.label} />
      })}
      {targetPos && (
        <span className="globe-lock" style={{ left: `${targetPos.x * 100}%`, top: `${targetPos.y * 100}%` }} aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="11" />
            <path d="M20 2v8M20 30v8M2 20h8M30 20h8" />
            <circle cx="20" cy="20" r="2.2" className="core" />
          </svg>
        </span>
      )}
    </div>
  )
}
