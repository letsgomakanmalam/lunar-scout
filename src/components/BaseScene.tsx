import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GRID_SIZE, type BaseGrid } from '../lib/base'
import type { LiveFrame } from '../lib/baseLive'
import { LOOP_LENGTH, loopPoint } from '../lib/baseLife'
import { createBaseLife } from './baseLife3d'
import { buildModel, palette, type Apply, type Env } from './base3d/models'
import type { ModuleId } from '../data/types'
import { makeNoise, mulberry32 } from '../lib/moonTexture'
import { loadEarth } from '../lib/textureCache'
import { isLowPower, prefersReducedMotion } from '../lib/motion'

export interface SceneProps {
  theme: BaseTheme
  grid: BaseGrid
  /** Building to place; null to just look and pick */
  selected: ModuleId | null
  focus: number | null
  /** Predicted score change for the selected building on a plot, or null if it can't go there */
  preview: (cell: number) => number | null
  onCell: (cell: number) => void
  onFail: () => void
  /** The base at this mission hour: Sun, crew, crops, power. null for a plain daylight view */
  live?: LiveFrame | null
  /** Where the base is, to put Earth in the right part of the sky */
  site?: { lat: number; lon: number } | null
}

/**
 * Looks for the base: the Moon (default), a cosy teal "sea" (the Moon's plains are called maria, seas),
 * or Mars. The Moon and Mars looks follow what the place is really like: a black sky and hard shadows
 * on the airless Moon; a dusty butterscotch sky on Mars that turns blue around the setting Sun.
 */
const THEMES = {
  moon: {
    skyTop: '#000002', skyHorizon: '#000003', nightTop: '#000002', nightHorizon: '#000003', glow: '#ffffff', haze: false, fogFar: 0,
    near: '#8b8882', far: '#74716c', top: '#96928a', rim: '#aaa69e', rock: '#7f7c76', sea: null as string | null, craters: 1, hills: 1,
    stars: true, earth: true, sun: '#fffaf0', sunI: 4.2, hemiSky: '#93a7d8', hemiGround: '#5a5650', hemiI: 0.34, nightHemi: 0.4, amb: 0.04, nightAmb: 0.1, exposure: 1.12,
    pad: '#6a6865', berm: '#8a867f', accent: '#d9531e',
  },
  cosy: {
    skyTop: '#4fb0c6', skyHorizon: '#c5efe6', nightTop: '#0c2030', nightHorizon: '#27505c', glow: '#fff4d0', haze: true, fogFar: 300,
    near: '#e9c78f', far: '#d1a868', top: '#ecc993', rim: '#f2d9a9', rock: '#8a8f93', sea: '#3fb3bd' as string | null, craters: 0, hills: 0.25,
    stars: false, earth: true, sun: '#fff4dc', sunI: 2.5, hemiSky: '#e3fbfa', hemiGround: '#d9a86f', hemiI: 0.95, nightHemi: 0.3, amb: 0.22, nightAmb: 0.12, exposure: 1.05,
    pad: '#c9a070', berm: '#dcb37a', accent: '#f2557f',
  },
  mars: {
    skyTop: '#9a6c48', skyHorizon: '#d6ab82', nightTop: '#04050a', nightHorizon: '#15100d', glow: '#9cc4ff', haze: true, fogFar: 620,
    near: '#a55d39', far: '#8e4f31', top: '#ad6740', rim: '#bd7a52', rock: '#5f392b', sea: null as string | null, craters: 0.45, hills: 0.8,
    stars: true, earth: false, sun: '#fff0dc', sunI: 2.6, hemiSky: '#e3b48a', hemiGround: '#8a4a2e', hemiI: 0.7, nightHemi: 0.1, amb: 0.12, nightAmb: 0.07, exposure: 1.0,
    pad: '#76594b', berm: '#9a5b3c', accent: '#d9531e',
  },
}
export type BaseTheme = keyof typeof THEMES
type Theme = (typeof THEMES)[BaseTheme]

const TILE = 2
const HALF = (GRID_SIZE * TILE) / 2
/** The levelled ground the base stands on: a rounded square this far out from the centre */
const YARD = 9
const DEFAULT_SUN = new THREE.Vector3(-30, 15, 18).normalize()
const RAD = Math.PI / 180
const MARS_FULL = 715 / 1361
const centre = (i: number) => new THREE.Vector3((i % GRID_SIZE) * TILE - HALF + TILE / 2, 0, Math.floor(i / GRID_SIZE) * TILE - HALF + TILE / 2)
const cellAt = (x: number, z: number) => {
  const c = Math.floor((x + HALF) / TILE), r = Math.floor((z + HALF) / TILE)
  return c >= 0 && c < GRID_SIZE && r >= 0 && r < GRID_SIZE ? r * GRID_SIZE + c : -1
}
const bounce = (k: number) => {
  const n = 7.5625, d = 2.75
  if (k < 1 / d) return n * k * k
  if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75
  if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375
  return n * (k -= 2.625 / d) * k + 0.984375
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** The lie of the land: a levelled yard, rolling regolith, craters with raised rims, hills on the horizon. */
function makeLand(T: Theme, low: boolean) {
  const rnd = mulberry32(17), { fbm } = makeNoise(41)
  const craters: { x: number; z: number; r: number; d: number }[] = []
  for (let k = 0; k < (low ? 70 : 160) * T.craters; k++) {
    const ang = rnd() * Math.PI * 2, dist = 12 + Math.pow(rnd(), 1.4) * 240, r = 0.5 + Math.pow(rnd(), 3) * 15
    if (dist - r * 1.5 < 11.5) continue
    craters.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, r, d: r * (0.16 + rnd() * 0.08) })
  }
  const height = (x: number, z: number) => {
    const d = Math.hypot(x, z)
    const sq = Math.pow(Math.pow(Math.abs(x) / YARD, 4) + Math.pow(Math.abs(z) / YARD, 4), 0.25)
    const k = smooth(1, 2.2, sq)
    if (k === 0) return 0
    if (T.sea) return k * (-2.7 + (fbm(x * 0.05, 2, z * 0.05, 3) - 0.5) * 0.8)
    let h = (fbm(x * 0.011, 0, z * 0.011, 4) - 0.5) * 11 * (0.2 + 0.8 * smooth(10, 80, d)) + (fbm(x * 0.09, 3, z * 0.09, 3) - 0.5) * 0.7
    for (const c of craters) {
      const q = Math.hypot(x - c.x, z - c.z) / c.r
      if (q > 1.7) continue
      h += (q < 1 ? -c.d * (1 - q * q) : 0) + c.d * 0.32 * Math.exp(-(((q - 1) / 0.24) ** 2))
    }
    const far = smooth(95, 280, d) * Math.pow(fbm(x * 0.0055 + 9, 1, z * 0.0055, 4), 1.6) * 95 * T.hills
    return k * (h - 0.5) + far
  }
  return { height, craters, rnd, fbm }
}

/** Fine grain for the ground: speckles and tiny pits, used for colour and for relief. */
function grainTexture(rnd: () => number) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')!
  const img = x.createImageData(512, 512)
  for (let i = 0; i < 512 * 512; i++) { const v = 196 + (rnd() - 0.5) * 70; img.data.set([v, v, v, 255], i * 4) }
  x.putImageData(img, 0, 0)
  for (let k = 0; k < 900; k++) {
    const px = rnd() * 512, py = rnd() * 512, r = 1.5 + rnd() * rnd() * 14
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, 'rgba(70,70,70,.5)'); g.addColorStop(0.75, 'rgba(120,120,120,.15)'); g.addColorStop(0.9, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

const SKY_VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 glow; uniform float glowK; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.5));
  float s = max(dot(d, sunDir), 0.0); c += glow * glowK * (pow(s, 90.0) * 0.9 + pow(s, 9.0) * 0.22);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

function glowSprite(inner: string, size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, inner); g.addColorStop(size, inner); g.addColorStop(size + 0.03, 'rgba(255,250,235,.38)'); g.addColorStop(0.45, 'rgba(255,245,225,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function BaseScene(props: SceneProps) {
  const box = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLDivElement>(null)
  const live = useRef(props)
  live.current = props
  const api = useRef<{ sync: (grid: BaseGrid) => void; ghost: (id: ModuleId | null) => void; focus: (i: number | null) => void } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const low = isLowPower()
    const still = prefersReducedMotion()
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' })
    } catch {
      live.current.onFail()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    const T = THEMES[live.current.theme] ?? THEMES.moon
    const mars = live.current.theme === 'mars'
    renderer.toneMappingExposure = T.exposure
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const dayTop = new THREE.Color(T.skyTop), dayHor = new THREE.Color(T.skyHorizon), nightTop = new THREE.Color(T.nightTop), nightHor = new THREE.Color(T.nightHorizon)
    scene.background = new THREE.Color(T.skyHorizon)
    const fog = T.haze ? new THREE.Fog(T.skyHorizon, 40, T.fogFar) : null
    scene.fog = fog
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2400)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 5
    controls.maxDistance = 70
    controls.minPolarAngle = 0.3
    controls.maxPolarAngle = 1.46
    controls.panSpeed = 0.6
    controls.screenSpacePanning = false
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    controls.addEventListener('change', () => {
      controls.target.x = Math.max(-8, Math.min(8, controls.target.x))
      controls.target.z = Math.max(-8, Math.min(8, controls.target.z))
      controls.target.y = 0.4
    })

    // Light: the Sun, a little light bounced from the ground and sky, and work lights for the dark
    const sun = new THREE.DirectionalLight(T.sun, T.sunI)
    sun.position.copy(DEFAULT_SUN).multiplyScalar(60)
    sun.castShadow = true
    sun.shadow.mapSize.set(low ? 1024 : 4096, low ? 1024 : 4096)
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 140 })
    sun.shadow.bias = -0.0003
    sun.shadow.normalBias = 0.025
    const hemi = new THREE.HemisphereLight(T.hemiSky, T.hemiGround, T.hemiI), amb = new THREE.AmbientLight('#ffffff', T.amb)
    const work = new THREE.PointLight('#ffe2b0', 0, 34, 1.1)
    work.position.set(0, 7, 0)
    scene.add(sun, hemi, amb, work)

    // The ground: one mesh, finest near the base
    const land = makeLand(T, low)
    const { rnd, height } = land
    const N = low ? 150 : 260, R = 620
    const pos = new Float32Array((N + 1) * (N + 1) * 3), col = new Float32Array((N + 1) * (N + 1) * 3), uv = new Float32Array((N + 1) * (N + 1) * 2)
    const cNear = new THREE.Color(T.near), cFar = new THREE.Color(T.far), cTop = new THREE.Color(T.top), cRim = new THREE.Color(T.rim), mix = new THREE.Color()
    const warp = (u: number) => Math.sign(u) * Math.pow(Math.abs(u), 2.6) * R
    for (let j = 0, v = 0; j <= N; j++) for (let i = 0; i <= N; i++, v++) {
      const x = warp((i / N) * 2 - 1), z = warp((j / N) * 2 - 1), y = height(x, z), d = Math.hypot(x, z)
      pos.set([x, y, z], v * 3)
      uv.set([x / 7, z / 7], v * 2)
      const sq = Math.pow(Math.pow(Math.abs(x) / YARD, 4) + Math.pow(Math.abs(z) / YARD, 4), 0.25)
      mix.copy(cNear).lerp(cFar, Math.min(1, d / 220))
      if (sq < 1.25) mix.lerp(cTop, 1 - smooth(1, 1.25, sq))
      let rim = 0
      for (const c of land.craters) { const q = Math.hypot(x - c.x, z - c.z) / c.r; if (q < 1.6) rim = Math.max(rim, Math.exp(-(((q - 1.05) / 0.2) ** 2)) - (q < 0.8 ? 0.35 : 0)) }
      if (rim > 0) mix.lerp(cRim, Math.min(1, rim) * 0.7); else if (rim < 0) mix.multiplyScalar(1 + rim * 0.45)
      mix.multiplyScalar(0.9 + land.fbm(x * 0.04, 5, z * 0.04, 3) * 0.22)
      col.set([mix.r, mix.g, mix.b], v * 3)
    }
    const idx: number[] = []
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
    const landGeo = new THREE.BufferGeometry()
    landGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    landGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    landGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    landGeo.setIndex(idx)
    landGeo.computeVertexNormals()
    const grain = grainTexture(rnd)
    const ground = new THREE.Mesh(landGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, bumpMap: grain, bumpScale: 1.4, roughness: 1, metalness: 0 }))
    ground.receiveShadow = true
    scene.add(ground)
    if (T.sea) {
      const sea = new THREE.Mesh(new THREE.CircleGeometry(R * 1.4, 48), new THREE.MeshStandardMaterial({ color: T.sea, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.86 }))
      sea.rotation.x = -Math.PI / 2
      sea.position.y = -1.5
      scene.add(sea)
    }

    // Rocks and boulders, scattered everywhere except on the yard
    const rockGeo = new THREE.IcosahedronGeometry(1, 1)
    const rp = rockGeo.attributes.position
    for (let i = 0; i < rp.count; i++) { const k = 0.78 + land.fbm(rp.getX(i) * 1.7, rp.getY(i) * 1.7, rp.getZ(i) * 1.7, 2) * 0.5; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k * 0.7, rp.getZ(i) * k) }
    rockGeo.computeVertexNormals()
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: T.rock, roughness: 0.95, flatShading: true }), low ? 260 : 620)
    const dummy = new THREE.Object3D()
    for (let k = 0; k < rocks.count; k++) {
      const ang = rnd() * Math.PI * 2, d = 9.6 + Math.pow(rnd(), 1.8) * 150, x = Math.cos(ang) * d, z = Math.sin(ang) * d
      const sz = (0.05 + Math.pow(rnd(), 4) * 1.1) * (mars ? 1.3 : 1) * (d > 40 ? 1.6 : 1)
      const inYard = Math.pow(Math.pow(Math.abs(x) / YARD, 4) + Math.pow(Math.abs(z) / YARD, 4), 0.25) < 1.04
      dummy.position.set(x, inYard ? -50 : height(x, z) + sz * 0.2, z)
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
      dummy.scale.setScalar(sz)
      dummy.updateMatrix()
      rocks.setMatrixAt(k, dummy.matrix)
    }
    rocks.castShadow = rocks.receiveShadow = true
    scene.add(rocks)

    // Wheel tracks along the rover's daily loop, and boot-worn paths between the plots
    const marks = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: T.sea ? 0.1 : 0.2, depthWrite: false })
    for (const off of [-0.3, 0.3]) {
      const tv: number[] = [], ti: number[] = [], S = 260
      for (let k = 0; k <= S; k++) {
        const p = loopPoint((k / S) * LOOP_LENGTH), nx = -Math.sin(p.heading), nz = Math.cos(p.heading)
        for (const w of [-0.055, 0.055]) tv.push(p.x + nx * (off + w), 0.006, p.z + nz * (off + w))
        if (k < S) ti.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2)
      }
      const tg = new THREE.BufferGeometry()
      tg.setAttribute('position', new THREE.Float32BufferAttribute(tv, 3))
      tg.setIndex(ti)
      const tm = new THREE.Mesh(tg, marks)
      tm.material.side = THREE.DoubleSide
      scene.add(tm)
    }
    const pathMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.07, depthWrite: false })
    for (let k = 0; k <= GRID_SIZE; k++) for (const turn of [0, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE * TILE, 0.16), pathMat)
      m.rotation.set(-Math.PI / 2, 0, turn * Math.PI / 2)
      m.position.set(turn ? k * TILE - HALF : 0, 0.004, turn ? 0 : k * TILE - HALF)
      scene.add(m)
    }

    // Sky: stars, the Sun's disc, Earth where it really sits in this site's sky, and Mars' dusty air
    const skyU = { top: { value: dayTop.clone() }, horizon: { value: dayHor.clone() }, sunDir: { value: DEFAULT_SUN.clone() }, glow: { value: new THREE.Color(T.glow) }, glowK: { value: 0.3 } }
    if (T.haze) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false }))
      dome.renderOrder = -2
      scene.add(dome)
    }
    let stars: THREE.PointsMaterial | null = null
    if (T.stars) {
      const sp: number[] = [], sc: number[] = []
      for (let k = 0; k < (low ? 1400 : 3200); k++) {
        const y = rnd() * 0.99 + 0.01, t = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y), b = 0.35 + Math.pow(rnd(), 3) * 0.65, warm = rnd()
        sp.push(Math.cos(t) * rr * 1700, y * 1700, Math.sin(t) * rr * 1700)
        sc.push(b * (0.85 + warm * 0.15), b * 0.92, b * (1 - warm * 0.15))
      }
      const sg = new THREE.BufferGeometry()
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3))
      sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3))
      stars = new THREE.PointsMaterial({ vertexColors: true, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false })
      const pts = new THREE.Points(sg, stars)
      pts.renderOrder = -1
      scene.add(pts)
    }
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('rgba(255,253,245,1)', 0.05), depthWrite: false, fog: false, transparent: true, blending: THREE.AdditiveBlending }))
    disc.scale.setScalar(mars ? 190 : 260)
    scene.add(disc)
    const site = live.current.site
    let earthDir: THREE.Vector3 | null = null
    if (T.earth) {
      // Earth hangs where the site sees it: overhead near the middle of the near side, on the horizon at the poles
      const elev = site ? Math.asin(Math.cos(site.lat * RAD) * Math.cos(site.lon * RAD)) / RAD : 20
      const e = Math.max(4.5, elev) * RAD, a = -2.2
      earthDir = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e))
      const earthMat = new THREE.MeshStandardMaterial({ color: '#5b8fd6', roughness: 0.75, fog: false })
      const earth = new THREE.Mesh(new THREE.SphereGeometry(T.sea ? 42 : 30, 48, 32), earthMat)
      earth.position.copy(earthDir).multiplyScalar(1500)
      earth.rotation.set(0.4, 2.2, 0.2)
      earth.userData.earth = true
      scene.add(earth)
      let gone = false
      earth.userData.cancel = () => { gone = true }
      loadEarth().then(tex => {
        if (gone) return
        const c = document.createElement('canvas')
        c.width = tex.w; c.height = tex.h
        const x = c.getContext('2d')!, img = x.createImageData(tex.w, tex.h)
        for (let i = 0; i < tex.w * tex.h; i++) {
          const cl = tex.cloud[i] / 255
          img.data.set([tex.rgb[i * 3] * (1 - cl) + 245 * cl, tex.rgb[i * 3 + 1] * (1 - cl) + 247 * cl, tex.rgb[i * 3 + 2] * (1 - cl) + 250 * cl, 255], i * 4)
        }
        x.putImageData(img, 0, 0)
        const map = new THREE.CanvasTexture(c)
        map.colorSpace = THREE.SRGBColorSpace
        earthMat.map = map
        earthMat.color.set('#ffffff')
        earthMat.needsUpdate = true
      }).catch(() => {})
    }

    // Plots: faint grid, hover marker, focus ring, ghost of the building to place
    const lines: number[] = []
    for (let k = 0; k <= GRID_SIZE; k++) {
      const v = k * TILE - HALF
      lines.push(-HALF, 0.02, v, HALF, 0.02, v, v, 0.02, -HALF, v, 0.02, HALF)
    }
    const gridGeo = new THREE.BufferGeometry()
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
    const gridMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.1 })
    scene.add(new THREE.LineSegments(gridGeo, gridMat))
    const pick = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE * TILE, GRID_SIZE * TILE), new THREE.MeshBasicMaterial({ visible: false }))
    pick.rotation.x = -Math.PI / 2
    scene.add(pick)
    const hoverMat = new THREE.MeshBasicMaterial({ color: '#e9b24c', transparent: true, opacity: 0.28, depthWrite: false })
    const hover = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94), hoverMat)
    hover.rotation.x = -Math.PI / 2
    hover.position.y = 0.045
    const edgeMat = new THREE.LineBasicMaterial({ color: '#ffd98c', transparent: true, opacity: 0.95 })
    hover.add(new THREE.LineSegments(new THREE.EdgesGeometry(hover.geometry), edgeMat))
    hover.visible = false
    scene.add(hover)
    const ringMat = new THREE.MeshBasicMaterial({ color: '#e9b24c', transparent: true, opacity: 0.9, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.04, 6, 48), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.06
    ring.visible = false
    scene.add(ring)
    const ghostMat = new THREE.MeshStandardMaterial({ color: '#fff1cf', transparent: true, opacity: 0.5, depthWrite: false, emissive: '#5a4310', emissiveIntensity: 0.5 })
    let ghost: THREE.Group | null = null

    // Buildings
    const p = palette(T)
    const models = new Map<number, { obj: THREE.Group; key: string }>()
    // Astronauts walking between modules and a rover driving its loop (lib/baseLife)
    const life = createBaseLife(scene, { mars })
    const anims: { obj: THREE.Object3D; t0: number; kind: 'drop' | 'pop' | 'out' }[] = []
    const dust: { mesh: THREE.Mesh; v: THREE.Vector3; t0: number }[] = []
    const dustGeo = new THREE.SphereGeometry(0.09, 6, 4)
    const dustMat = new THREE.MeshBasicMaterial({ color: T.top, transparent: true, opacity: 0.7, depthWrite: false })
    const puff = (at: THREE.Vector3, n = 14, reach = 0.6) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + Math.random() * 0.3
        const mesh = new THREE.Mesh(dustGeo, dustMat.clone())
        mesh.position.set(at.x + Math.cos(a) * reach, 0.1, at.z + Math.sin(a) * reach)
        scene.add(mesh)
        dust.push({ mesh, v: new THREE.Vector3(Math.cos(a) * 1.6, 0.5 + Math.random() * 0.5, Math.sin(a) * 1.6), t0: performance.now() })
      }
    }
    const disposeTree = (o: THREE.Object3D) => o.traverse(n => {
      const mesh = n as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | undefined
      if (mat && !Array.isArray(mat) && mat.userData.own) mat.dispose()
    })
    let first = true
    const sync = (grid: BaseGrid) => {
      const now = performance.now()
      grid.forEach((m, i) => {
        const key = m ? `${m.id}:${m.level}` : ''
        const had = models.get(i)
        if (had?.key === key) return
        if (had) { anims.push({ obj: had.obj, t0: now, kind: 'out' }); models.delete(i) }
        if (!m) return
        const obj = buildModel(p, m, low)
        obj.position.copy(centre(i))
        obj.userData.cell = i
        scene.add(obj)
        models.set(i, { obj, key })
        if (!first && !still) {
          const levelUp = had && had.key.split(':')[0] === m.id
          anims.push({ obj, t0: now, kind: levelUp ? 'pop' : 'drop' })
          if (!levelUp) obj.position.y = 3
        }
      })
      first = false
      life.sync(grid)
    }
    const setGhost = (id: ModuleId | null) => {
      if (ghost) { scene.remove(ghost); disposeTree(ghost); ghost = null }
      if (!id) return
      ghost = buildModel(p, { id, level: 1 }, true)
      ghost.traverse(n => { const mesh = n as THREE.Mesh; if (mesh.isMesh) { mesh.material = ghostMat; mesh.castShadow = false } })
      ghost.visible = false
      scene.add(ghost)
    }
    let focusCell: number | null = null
    const setFocus = (i: number | null) => { focusCell = i; ring.visible = i != null; if (i != null) ring.position.set(centre(i).x, 0.06, centre(i).z) }
    api.current = { sync, ghost: setGhost, focus: setFocus }
    sync(live.current.grid)
    setGhost(live.current.selected)
    setFocus(live.current.focus)

    // Pointer: hover preview, tap to place or pick
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let hovered = -1
    const cellFromEvent = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const objs = [...models.values()].map(v => v.obj)
      const hit = ray.intersectObjects(objs, true)[0]
      if (hit) {
        let o: THREE.Object3D | null = hit.object
        while (o && o.userData.cell === undefined) o = o.parent
        if (o) return o.userData.cell as number
      }
      const flat = ray.intersectObject(pick)[0]
      return flat ? cellAt(flat.point.x, flat.point.z) : -1
    }
    const showHover = (cell: number) => {
      hovered = cell
      const L = live.current
      if (cell < 0) { hover.visible = false; if (ghost) ghost.visible = false; if (label.current) label.current.style.opacity = '0'; return }
      const c = centre(cell)
      hover.position.set(c.x, 0.045, c.z)
      hover.visible = true
      const filled = !!L.grid[cell]
      const gain = !filled && L.selected ? L.preview(cell) : null
      const tone = filled ? '#9fb7d9' : gain == null ? '#9aa0aa' : gain < 0 ? '#ff6f5e' : '#e9b24c'
      hoverMat.color.set(tone)
      edgeMat.color.set(tone)
      if (ghost) { ghost.visible = !filled && !!L.selected; ghost.position.set(c.x, 0, c.z) }
      if (label.current) {
        label.current.textContent = filled || gain == null ? '' : `${gain >= 0 ? '+' : ''}${gain}`
        label.current.className = `bs-preview ${gain != null && gain < 0 ? 'bad' : ''}`
        label.current.style.opacity = label.current.textContent ? '1' : '0'
      }
    }
    let down: { x: number; y: number; t: number } | null = null
    const onMove = (e: PointerEvent) => { if (e.pointerType === 'mouse') showHover(cellFromEvent(e)) }
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() } }
    const onUp = (e: PointerEvent) => {
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 500
      down = null
      if (moved > 6 || !quick || e.button > 0) return
      const cell = cellFromEvent(e)
      if (cell < 0) return
      live.current.onCell(cell)
      if (e.pointerType !== 'mouse') showHover(cell)
    }
    const onLeave = () => showHover(-1)
    const cv = renderer.domElement
    cv.addEventListener('pointermove', onMove)
    cv.addEventListener('pointerdown', onDown)
    cv.addEventListener('pointerup', onUp)
    cv.addEventListener('pointerleave', onLeave)
    cv.addEventListener('contextmenu', e => e.preventDefault())

    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()

    // Starts low across the plain, then swoops up to the overview and hands over to the player.
    // Tall phone screens need the camera further back to fit the whole yard
    const aspect = el.clientWidth / Math.max(1, el.clientHeight)
    const endPos = new THREE.Vector3(15, 13, 17).multiplyScalar(aspect < 1.2 ? Math.min(1.9, (1.2 / aspect) ** 0.75) : 1)
    const startPos = new THREE.Vector3(36, 4.5, 44)
    const startLook = new THREE.Vector3(0, 2.5, 0), look = new THREE.Vector3()
    camera.position.copy(still ? endPos : startPos)
    camera.lookAt(still ? new THREE.Vector3(0, 0.4, 0) : startLook)
    controls.target.set(0, 0.4, 0)
    controls.enabled = still
    let t0 = 0 // set once the first frame is on screen, so slow devices still see the whole swoop
    let raf = 0
    let tick = 0
    let last = performance.now()
    const tmp = new THREE.Vector3(), sunDir = DEFAULT_SUN.clone(), env: Env = { sun: sunDir, earth: earthDir, t: 0, dt: 0, dark: false }
    const skyTop = new THREE.Color(), skyHor = new THREE.Color()
    let dayK = 1, landerWas = ''
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      if (low && tick++ % 2) return // 30 frames a second on phones and low-power devices
      const now = performance.now(), t = now / 1000, dt = Math.min(0.25, (now - last) / 1000)
      last = now
      if (!controls.enabled) {
        const k = t0 ? Math.min(1, Math.max(0, (now - t0 - 400) / 2600)) : 0, e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
        camera.position.lerpVectors(startPos, endPos, e)
        camera.lookAt(look.copy(startLook).lerp(controls.target, e))
        if (k >= 1) controls.enabled = true
      } else controls.update()
      // keep the camera above the ground
      const floor = height(camera.position.x, camera.position.z) + 0.6
      if (camera.position.y < floor) camera.position.y = floor
      for (let a = anims.length - 1; a >= 0; a--) {
        const an = anims[a], k = Math.min(1, (now - an.t0) / (an.kind === 'out' ? 250 : 520))
        if (an.kind === 'drop') {
          an.obj.position.y = 3 * (1 - bounce(k))
          if (k > 0.36 && !an.obj.userData.puffed) { an.obj.userData.puffed = true; puff(an.obj.position) }
        } else if (an.kind === 'pop') an.obj.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * k))
        else an.obj.scale.setScalar(1 - k)
        if (k >= 1) {
          if (an.kind === 'out') { scene.remove(an.obj); disposeTree(an.obj) }
          anims.splice(a, 1)
        }
      }
      // Dust falls back without air to hold it up (on the Moon it flies in clean arcs)
      for (let d = dust.length - 1; d >= 0; d--) {
        const pd = dust[d], k = (now - pd.t0) / 800
        pd.mesh.position.addScaledVector(pd.v, dt)
        pd.v.y -= (mars ? 3.7 : 1.6) * dt
        ;(pd.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)
        pd.mesh.scale.setScalar(1 + k * 1.5)
        if (k >= 1 || pd.mesh.position.y < 0) { scene.remove(pd.mesh); (pd.mesh.material as THREE.Material).dispose(); dust.splice(d, 1) }
      }
      scene.traverse(n => { if (n.userData.blink !== undefined) n.visible = (t * 0.9 + n.userData.blink) % 1 < 0.55; else if (n.userData.earth) n.rotation.y += dt * 0.004 })
      ringMat.opacity = 0.55 + 0.35 * Math.sin(t * 4)
      gridMat.opacity = live.current.selected ? 0.3 : 0.08
      if (focusCell != null) ring.position.y = 0.06
      if (hovered >= 0 && label.current) {
        tmp.copy(centre(hovered)).setY(2.1).project(camera)
        label.current.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * el.clientWidth}px, ${(-tmp.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%, -100%)`
      }

      // The moment: where the Sun is, how bright the sky, what every building and crew member is doing
      const F = live.current.live ?? null
      let light = 1, dayTarget = 1, stormK = 0
      if (F) {
        const elev = F.sun.elev * RAD, az = F.sun.az * RAD
        light = F.mars ? Math.min(1, F.sun.light / MARS_FULL) : F.sun.light
        tmp.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev))
        sunDir.lerp(tmp, Math.min(1, dt * 4)).normalize()
        dayTarget = F.mars ? smooth(-7, 9, F.sun.elev) : light
        stormK = F.mars ? Math.min(1, Math.max(0, ((F.sun.tau ?? 0.5) - 0.7) / 3)) : 0
      } else sunDir.copy(DEFAULT_SUN)
      dayK += (dayTarget - dayK) * Math.min(1, dt * 3)
      env.t = t; env.dt = dt; env.dark = dayK < 0.4
      // Shadows stay long when the Sun skims the horizon, as it does at the Moon's poles. The light is kept a
      // little above the true Sun: lunar dust throws light back strongly, so real ground looks brighter than a flat matte surface would
      sun.position.set(sunDir.x, Math.max(0.17, sunDir.y), sunDir.z).normalize().multiplyScalar(60)
      sun.intensity += (T.sunI * light * (1 - 0.35 * stormK) - sun.intensity) * Math.min(1, dt * 4)
      hemi.intensity = T.hemiI * (T.nightHemi + (1 - T.nightHemi) * dayK) * (1 + stormK * 0.3)
      amb.intensity = T.nightAmb + (T.amb - T.nightAmb) * dayK
      work.intensity += ((dayK < 0.4 && models.size ? 26 : 0) - work.intensity) * Math.min(1, dt * 2)
      skyTop.copy(nightTop).lerp(dayTop, dayK).multiplyScalar(1 - 0.45 * stormK)
      skyHor.copy(nightHor).lerp(dayHor, dayK).multiplyScalar(1 - 0.3 * stormK)
      ;(scene.background as THREE.Color).copy(skyHor)
      if (fog) { fog.color.copy(skyHor); fog.far = T.fogFar * (1 - 0.72 * stormK) }
      skyU.top.value.copy(skyTop); skyU.horizon.value.copy(skyHor); skyU.sunDir.value.copy(sunDir)
      skyU.glowK.value = (mars ? 0.25 + 0.75 * (1 - smooth(0, 25, F?.sun.elev ?? 30)) : 0.3) * (sunDir.y > -0.1 ? 1 : 0) * (1 - stormK * 0.7)
      if (stars) stars.opacity = mars ? 1 - dayK : 0.4 + 0.6 * (1 - dayK)
      disc.position.copy(sunDir).multiplyScalar(1600)
      disc.material.opacity = Math.min(1, light * 1.4) * (1 - stormK * 0.8)
      disc.visible = light > 0.01 && sunDir.y > -0.02

      const outside = F ? F.duties.filter(d => d === 'eva').length : undefined
      life.update(now, F ? { hour: F.hod, dark: env.dark, failed: F.failed, outside } : null)
      for (const [i, m] of models) {
        const cell = F?.cells[i]
        if (!cell) continue
        ;(m.obj.userData.apply as Apply | undefined)?.(cell, env)
        // The lander's engine blows dust off the pad as it comes down
        if (cell.lander && cell.lander.phase !== landerWas) {
          if (landerWas && cell.lander.phase === 'landed') puff(m.obj.position, 26, 0.9)
          landerWas = cell.lander.phase
        }
      }
      renderer.render(scene, camera)
      if (!t0) t0 = performance.now()
    }
    frame()

    return () => {
      life.dispose()
      cancelAnimationFrame(raf)
      ro.disconnect()
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointerleave', onLeave)
      controls.dispose()
      scene.traverse(n => {
        n.userData.cancel?.()
        const mesh = n as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material
        for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose() }
      })
      for (const m of Object.values(p)) { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose() }
      renderer.dispose()
      cv.remove()
      api.current = null
    }
  }, [])

  useEffect(() => { api.current?.sync(props.grid) }, [props.grid])
  useEffect(() => { api.current?.ghost(props.selected) }, [props.selected])
  useEffect(() => { api.current?.focus(props.focus) }, [props.focus])

  return (
    <div className="base-scene" ref={box}>
      <div className="bs-preview" ref={label} aria-hidden="true" />
    </div>
  )
}
