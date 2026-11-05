import { useEffect, useRef, useState } from 'react'
import { mulberry32 } from '../lib/moonTexture'
import { STAGES, ZOOM_END, ZOOM_KEYS, fovLabel, makeCurve, stageAt } from '../lib/cosmos'
import { isLowPower, pixelRatio } from '../lib/motion'

interface Props {
  /** Where the title's Earth and Moon are, so the zoom lands exactly on them */
  targets: () => { earth: DOMRect | null; moon: DOMRect | null }
  /** True once the title's 3D Moon is drawn */
  ready: () => boolean
  progress: () => number
  onDone: () => void
}

type Ctx = CanvasRenderingContext2D
interface Pt { x: number; y: number }

const AU = 1.496e11
const EARTH_MOON = 3.844e8
const ORBITS = [0.387, 0.723, 1, 1.524, 5.203, 9.537, 19.19, 30.07]
const ANGLES = [2.4, 4.1, 0, 5.3, 1.1, 3.4, 0.5, 2.8] // Earth at angle 0, so the Sun sits to its left, as on the title
const UNIVERSE_AT = [27.2, 26.0, 24.8, 23.6] // log10 metres each copy of the galaxy field spans
const STARS_AT = [20.2, 19.0, 17.8, 16.6, 15.4]
const GALAXY_AT = 21.2
const MATCH_S = 0.9
const HOLD_MAX_S = 6
const fovAt = makeCurve(ZOOM_KEYS)

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const inOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
/** Fades in over a..b and out over c..d (all in decades of zoom relative to a layer). */
const band = (rel: number, a: number, b: number, c: number, d: number) => smooth(a, b, rel) * (1 - smooth(c, d, rel))
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())

function canvas(size: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

/** Soft round edge so overlapping copies blend while zooming. */
function roundEdge(g: Ctx, size: number, inner = 0.22) {
  g.globalCompositeOperation = 'destination-in'
  const m = g.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size * 0.5)
  m.addColorStop(0, 'rgba(0,0,0,1)')
  m.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = m
  g.fillRect(0, 0, size, size)
  g.globalCompositeOperation = 'source-over'
}

/** The cosmic web: galaxies strung along faint filaments between clusters. */
function universe(size: number, count: number, seed: number) {
  const [c, g] = canvas(size)
  const r = mulberry32(seed)
  const knots: Pt[] = Array.from({ length: 34 }, () => ({ x: r() * size, y: r() * size }))
  const links: [Pt, Pt][] = []
  for (const k of knots) {
    const near = knots.filter(o => o !== k).sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y))
    for (const n of near.slice(0, 2 + Math.floor(r() * 2))) links.push([k, n])
  }
  g.globalCompositeOperation = 'lighter'
  g.lineCap = 'round'
  for (const [a, b] of links) {
    g.strokeStyle = 'rgba(110,130,255,0.03)'; g.lineWidth = size * 0.016
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
    g.strokeStyle = 'rgba(150,140,255,0.025)'; g.lineWidth = size * 0.007
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
  }
  const unit = size / 1600
  for (let i = 0; i < count; i++) {
    let x: number, y: number
    const pick = r()
    if (pick < 0.62) {
      const [a, b] = links[Math.floor(r() * links.length)]
      const t = r()
      x = a.x + (b.x - a.x) * t + gauss(r) * size * 0.008
      y = a.y + (b.y - a.y) * t + gauss(r) * size * 0.008
    } else if (pick < 0.9) {
      const k = knots[Math.floor(r() * knots.length)]
      x = k.x + gauss(r) * size * 0.013
      y = k.y + gauss(r) * size * 0.013
    } else { x = r() * size; y = r() * size }
    const bigOne = r() < 0.04
    const rad = (bigOne ? 3 + r() * 4 : 0.6 + r() * 1.8) * unit
    const tone = r()
    const col = tone < 0.45 ? '255,236,210' : tone < 0.8 ? '220,230,255' : '255,210,170'
    g.save()
    g.translate(x, y); g.rotate(r() * Math.PI); g.scale(1, 0.35 + r() * 0.65)
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, rad * 2.2)
    grd.addColorStop(0, `rgba(${col},${bigOne ? 0.95 : 0.85})`)
    grd.addColorStop(0.35, `rgba(${col},0.35)`)
    grd.addColorStop(1, `rgba(${col},0)`)
    g.fillStyle = grd
    g.beginPath(); g.arc(0, 0, rad * 2.2, 0, Math.PI * 2); g.fill()
    g.restore()
  }
  roundEdge(g, size)
  return c
}

/** Stars of the solar neighbourhood, used for the dive through the galaxy. */
function stars(size: number, count: number, seed: number) {
  const [c, g] = canvas(size)
  const r = mulberry32(seed)
  const unit = size / 1600
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, m = r() ** 3
    const rad = (0.4 + m * 1.6) * unit
    const tone = r()
    const col = tone < 0.2 ? '255,210,170' : tone < 0.6 ? '240,244,255' : '190,210,255'
    g.fillStyle = `rgba(${col},${(0.35 + m * 0.65).toFixed(2)})`
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
    if (m > 0.5) {
      const grd = g.createRadialGradient(x, y, 0, x, y, rad * 6)
      grd.addColorStop(0, `rgba(${col},0.25)`)
      grd.addColorStop(1, `rgba(${col},0)`)
      g.fillStyle = grd
      g.fillRect(x - rad * 6, y - rad * 6, rad * 12, rad * 12)
    }
  }
  roundEdge(g, size, 0.25)
  return c
}

/** A face-on barred spiral, with the Sun's spot 26,000 light-years out. */
function milkyWay(size: number, seed: number) {
  const [c, g] = canvas(size)
  const r = mulberry32(seed)
  const cx = size / 2, cy = size / 2, R = size * 0.42
  g.globalCompositeOperation = 'lighter'
  const disc = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.05)
  disc.addColorStop(0, 'rgba(255,224,180,0.55)')
  disc.addColorStop(0.18, 'rgba(255,210,170,0.22)')
  disc.addColorStop(0.55, 'rgba(150,170,255,0.08)')
  disc.addColorStop(1, 'rgba(120,140,255,0)')
  g.fillStyle = disc
  g.fillRect(0, 0, size, size)
  const pitch = Math.tan((13 * Math.PI) / 180)
  const unit = size / 1400
  const dust: Pt[] = []
  for (let a = 0; a < 4; a++) {
    const major = a < 2
    const base = (a * Math.PI) / 2 + (major ? 0 : 0.35)
    for (let i = 0; i < (major ? 3200 : 1800); i++) {
      const th = r() * 3.3 * Math.PI
      const rr = R * 0.13 * Math.exp(pitch * th)
      if (rr > R) continue
      const ang = th + base
      const off = gauss(r) * (0.03 + 0.05 * (rr / R)) * R
      const x = cx + Math.cos(ang) * rr - Math.sin(ang) * off
      const y = cy + Math.sin(ang) * rr + Math.cos(ang) * off
      const hii = r() < 0.018
      const b = r()
      g.fillStyle = hii ? 'rgba(255,130,175,0.6)' : b < 0.6 ? `rgba(200,215,255,${(0.25 + b * 0.6).toFixed(2)})` : `rgba(255,245,230,${(0.3 + b * 0.5).toFixed(2)})`
      g.beginPath(); g.arc(x, y, (hii ? 1.4 + r() * 1.6 : 0.5 + r() * 0.9) * unit, 0, Math.PI * 2); g.fill()
      if (major && r() < 0.35) dust.push({ x: cx + Math.cos(ang - 0.08) * rr * 0.97, y: cy + Math.sin(ang - 0.08) * rr * 0.97 })
    }
  }
  for (let i = 0; i < 3500; i++) {
    const rr = R * Math.min(1, -Math.log(1 - r() * 0.98) * 0.28), ang = r() * Math.PI * 2
    g.fillStyle = `rgba(235,235,255,${(0.15 + r() * 0.4).toFixed(2)})`
    g.fillRect(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, unit, unit)
  }
  g.save()
  g.translate(cx, cy); g.rotate(0.5); g.scale(1, 0.42)
  const bar = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.2)
  bar.addColorStop(0, 'rgba(255,244,220,0.95)')
  bar.addColorStop(0.5, 'rgba(255,214,160,0.4)')
  bar.addColorStop(1, 'rgba(255,200,140,0)')
  g.fillStyle = bar
  g.beginPath(); g.arc(0, 0, R * 0.2, 0, Math.PI * 2); g.fill()
  g.restore()
  g.globalCompositeOperation = 'source-over'
  for (const p of dust) {
    g.fillStyle = 'rgba(14,8,6,0.22)'
    g.beginPath(); g.arc(p.x, p.y, (1.5 + r() * 2.5) * unit, 0, Math.PI * 2); g.fill()
  }
  roundEdge(g, size, 0.32)
  const sunAng = 2.35
  return { img: c, sun: { x: cx + Math.cos(sunAng) * R * 0.52, y: cy + Math.sin(sunAng) * R * 0.52 } }
}

function disc(g: Ctx, x: number, y: number, rad: number, stops: [number, string][], alpha: number) {
  if (rad <= 0 || alpha <= 0) return
  const grd = g.createRadialGradient(x - rad * 0.45, y - rad * 0.25, rad * 0.05, x, y, rad)
  for (const [o, col] of stops) grd.addColorStop(o, col)
  g.globalAlpha = alpha
  g.fillStyle = grd
  g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
  g.globalAlpha = 1
}
const EARTH: [number, string][] = [[0, '#bfe3ff'], [0.3, '#3d85d6'], [0.72, '#0f2f5e'], [1, '#040a16']]
const MOON: [number, string][] = [[0, '#f4f0e7'], [0.45, '#b9b4aa'], [0.8, '#4a4a4c'], [1, '#121316']]

/**
 * The opening "Powers of Ten" zoom: from the edge of the observable universe, through the Milky Way
 * and the Solar System, to Earth and the Moon, landing exactly where the title shows them.
 * It doubles as the loading screen while the Moon's surface is generated. Any key, click or tap skips it.
 * Add ?intro-at=2.3 to the address to freeze it on one moment (handy for screenshots and slides).
 */
export default function CosmicIntro({ targets, ready, progress, onDone }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const fovText = useRef<HTMLElement>(null)
  const loadBar = useRef<HTMLElement>(null)
  const loadText = useRef<HTMLSpanElement>(null)
  const [stage, setStage] = useState(0)
  const [ending, setEnding] = useState(false)
  const [out, setOut] = useState(false)
  const [showLoad] = useState(() => progress() < 1)
  const cb = useRef({ targets, ready, progress })
  cb.current = { targets, ready, progress }

  useEffect(() => {
    const el = cv.current
    const g = el?.getContext('2d')
    if (!el || !g) return
    const low = isLowPower()
    let W = 0, H = 0
    const fit = () => {
      const dpr = pixelRatio(low ? 1.25 : 2)
      W = el.clientWidth; H = el.clientHeight
      el.width = Math.round(W * dpr); el.height = Math.round(H * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)
    const U = universe(low ? 1300 : 2048, low ? 1900 : 3400, 3)
    const S = stars(low ? 1300 : 2048, low ? 2400 : 4200, 8)
    const MW = milkyWay(low ? 1100 : 1500, 5)
    const rnd = mulberry32(42)
    const maxR = () => Math.hypot(W, H) / 2
    const streaks = Array.from({ length: low ? 150 : 260 }, () => ({ a: rnd() * Math.PI * 2, d: rnd() * maxR(), b: 0.4 + rnd() * 0.6 }))

    const layer = (img: HTMLCanvasElement, at: number, focus: Pt | null, F: number, alpha: number, rot = 0) => {
      if (alpha <= 0.003) return
      const k = 10 ** (at - F) * (W / img.width)
      if (k * img.width < 2) return
      g.save()
      g.globalAlpha = alpha
      g.translate(W / 2, H / 2); g.rotate(rot); g.scale(k, k)
      g.drawImage(img, -(focus ? focus.x : img.width / 2), -(focus ? focus.y : img.height / 2))
      g.restore()
    }

    const frozen = Number(new URLSearchParams(location.search).get('intro-at'))
    const freezeAt = Number.isFinite(frozen) && frozen > 0 ? Math.min(frozen, ZOOM_END - 0.01) : null
    let start = 0, prevT = 0, raf = 0
    let phase: 'zoom' | 'hold' | 'match' | 'done' = 'zoom'
    let holdAt = 0, matchAt = 0, lastLabel = '', lastStage = -1
    let land: { e: Pt & { r: number }; m: Pt & { r: number } } | null = null

    const frame = (now: number) => {
      if (!start) { start = now; prevT = 0 }
      const real = (now - start) / 1000
      const dt = Math.min(0.05, Math.max(0.001, real - prevT))
      prevT = real
      const t = freezeAt ?? real
      if (phase === 'zoom' && t >= ZOOM_END) { phase = 'hold'; holdAt = t }
      if (phase === 'hold' && (cb.current.ready() || t - holdAt > HOLD_MAX_S)) {
        const { earth, moon } = cb.current.targets()
        const b = box.current?.getBoundingClientRect()
        land = earth && moon && b ? {
          e: { x: earth.left - b.left + earth.width / 2, y: earth.top - b.top + earth.height / 2, r: earth.width / 2 },
          m: { x: moon.left - b.left + moon.width / 2, y: moon.top - b.top + moon.height / 2, r: moon.width / 2 },
        } : null
        phase = 'match'; matchAt = t
        setEnding(true)
      }
      const F = phase === 'zoom' ? fovAt(t) : fovAt(ZOOM_END) - 0.04 * Math.min(1, (t - ZOOM_END) / 2)
      const speed = phase === 'zoom' ? Math.max(0, (fovAt(t - 0.02) - fovAt(t)) / 0.02) : 0 // decades per second
      const mt = phase === 'match' ? inOut(clamp((t - matchAt) / MATCH_S)) : 0
      const fade = 1 - mt

      g.globalCompositeOperation = 'source-over'
      g.fillStyle = '#02030a'
      g.fillRect(0, 0, W, H)
      g.globalCompositeOperation = 'lighter'
      UNIVERSE_AT.forEach((at, i) => layer(U, at, null, F, band(at - F, -1.0, -0.55, 0.55, 0.95), i * 1.3))
      // The whole galaxy first, then the camera drifts to the Sun's spot as it dives in
      const drift = smooth(-0.1, 0.8, GALAXY_AT - F)
      const gc = MW.img.width / 2
      layer(MW.img, GALAXY_AT, { x: gc + (MW.sun.x - gc) * drift, y: gc + (MW.sun.y - gc) * drift }, F, band(GALAXY_AT - F, -1.5, -1.0, 0.5, 0.9))
      STARS_AT.forEach((at, i) => layer(S, at, null, F, band(at - F, -0.9, -0.45, 0.45, 0.8) * fade, i * 2.1))

      // Stars streaking past while the zoom is fast
      const sa = clamp((speed - 0.8) / 4) * fade
      const grow = 10 ** (speed * dt * 0.45)
      g.lineCap = 'round'
      for (const s of streaks) {
        const d0 = s.d
        s.d = s.d * grow + dt * 8
        if (s.d > maxR()) { s.a = rnd() * Math.PI * 2; s.d = 4 + rnd() * 30; continue }
        if (sa <= 0.01) continue
        const ca = Math.cos(s.a), sn = Math.sin(s.a)
        g.strokeStyle = `rgba(200,220,255,${(sa * s.b).toFixed(3)})`
        g.lineWidth = 1.1
        g.beginPath(); g.moveTo(W / 2 + ca * d0, H / 2 + sn * d0); g.lineTo(W / 2 + ca * s.d, H / 2 + sn * s.d); g.stroke()
      }
      g.globalCompositeOperation = 'source-over'

      // Solar System, drawn as lines so it stays sharp at any zoom
      const ppm = W / 10 ** F
      const solar = smooth(0.03, 0.15, (60.14 * AU * ppm) / W) * fade
      if (solar > 0) {
        const sx = W / 2 - AU * ppm, sy = H / 2
        const glowR = clamp(6.96e8 * ppm * 8, 10, 240)
        if (sx > -glowR) {
          const grd = g.createRadialGradient(sx, sy, 0, sx, sy, glowR)
          grd.addColorStop(0, `rgba(255,246,220,${solar})`)
          grd.addColorStop(0.2, `rgba(255,200,90,${0.55 * solar})`)
          grd.addColorStop(1, 'rgba(255,170,60,0)')
          g.fillStyle = grd
          g.beginPath(); g.arc(sx, sy, glowR, 0, Math.PI * 2); g.fill()
        }
        ORBITS.forEach((o, i) => {
          const rad = o * AU * ppm
          if (rad < 1.5 || rad > 60000) return
          g.strokeStyle = i === 2 ? `rgba(233,178,76,${0.7 * solar})` : `rgba(235,230,218,${0.3 * solar})`
          g.lineWidth = 1
          g.beginPath(); g.arc(sx, sy, rad, 0, Math.PI * 2); g.stroke()
          if (i !== 2) {
            g.fillStyle = `rgba(235,230,218,${0.8 * solar})`
            g.beginPath(); g.arc(sx + Math.cos(ANGLES[i]) * rad, sy + Math.sin(ANGLES[i]) * rad, 1.8, 0, Math.PI * 2); g.fill()
          }
        })
      }

      // Earth and Moon (sizes boosted so they read at this scale), gliding onto the title's own
      const show = solar > 0 || phase !== 'zoom' ? 1 : 0
      if (show) {
        const near = smooth(12.5, 9.4, F)
        const er0 = Math.max(6.371e6 * ppm, 1.6 + near * 13)
        const mr0 = Math.max(1.737e6 * ppm, 0.9 + near * 7)
        const dist = EARTH_MOON * ppm
        let ex = W / 2, ey = H / 2, er = er0
        let mx = W / 2 + Math.cos(0.32) * dist, my = H / 2 + Math.sin(0.32) * dist, mr = mr0
        if (land) {
          ex += (land.e.x - ex) * mt; ey += (land.e.y - ey) * mt; er += (land.e.r - er) * mt
          mx += (land.m.x - mx) * mt; my += (land.m.y - my) * mt; mr += (land.m.r - mr) * mt
        }
        const halo = g.createRadialGradient(ex, ey, 0, ex, ey, er * 3)
        halo.addColorStop(0, 'rgba(114,182,255,0.35)')
        halo.addColorStop(1, 'rgba(114,182,255,0)')
        g.fillStyle = halo
        g.beginPath(); g.arc(ex, ey, er * 3, 0, Math.PI * 2); g.fill()
        disc(g, ex, ey, er, EARTH, 1)
        if (dist > er + mr + 3 || land) disc(g, mx, my, mr, MOON, smooth(4, 14, dist))
      }

      const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, `rgba(0,0,0,${0.55 * fade})`)
      g.fillStyle = vig
      g.fillRect(0, 0, W, H)

      const label = fovLabel(F)
      if (label !== lastLabel && fovText.current) { fovText.current.textContent = label; lastLabel = label }
      const st = stageAt(F)
      if (st !== lastStage) { lastStage = st; setStage(st) }
      const p = cb.current.progress()
      if (loadBar.current) loadBar.current.style.width = `${Math.round(p * 100)}%`
      if (loadText.current) loadText.current.textContent = p >= 1 ? 'Moon surface ready' : `Generating the Moon's surface ${Math.round(p * 100)}%`

      if (phase === 'match' && mt >= 1) { phase = 'done'; setOut(true); return }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const skip = () => { phase = 'done'; cancelAnimationFrame(raf); setOut(true) }
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); skip() }
    window.addEventListener('keydown', onKey, true)
    box.current?.addEventListener('pointerdown', skip)
    const node = box.current
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
      window.removeEventListener('keydown', onKey, true)
      node?.removeEventListener('pointerdown', skip)
    }
  }, [])

  return (
    <div ref={box} className={`cosmic ${out ? 'is-out' : ''}`} onTransitionEnd={e => { if (out && e.target === e.currentTarget) onDone() }} aria-label="Opening animation: zooming from the universe to Earth and the Moon">
      <canvas ref={cv} />
      {!ending && (
        <div className="cosmic-caption" key={stage}>
          <p className="cc-name">{STAGES[stage].name}</p>
          <p className="cc-sub">{STAGES[stage].sub}</p>
        </div>
      )}
      <p className="cosmic-fov"><span>Field of view</span><strong ref={fovText}>{fovLabel(ZOOM_KEYS[0][1])}</strong></p>
      {showLoad && <p className="cosmic-load"><span ref={loadText}>Generating the Moon's surface</span><i><b ref={loadBar} /></i></p>}
      <button className="cosmic-skip" data-sfx="none">Skip intro <kbd>any key</kbd></button>
    </div>
  )
}
