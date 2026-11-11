import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GRID_SIZE, type BaseGrid, type PlacedModule } from '../lib/base'
import type { ModuleId } from '../data/types'
import { mulberry32 } from '../lib/moonTexture'
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
  /** Sun from the mission simulation (elevation and direction in degrees, light 0..1); null for the default view */
  sun?: { elev: number; az: number; light: number; dark: boolean } | null
}

/**
 * Looks for the base: on the Moon (default), a cosy teal "sea" (the Moon's plains are called maria,
 * seas), or on Mars, with rust-red ground under a butterscotch sky and no Earth overhead.
 */
const THEMES = {
  moon: {
    bg: '#060913', fog: '#0a0f1c', fogNear: 60, fogFar: 200, near: '#bec1c8', far: '#6c717b', shoal: null as string | null, waves: false, craters: true,
    top: '#ddd7cb', cliffs: ['#8d93a0', '#7a808d', '#686e7b'], isleTop: '#cfc9bd', spires: ['#a3a9b5', '#858c99'], ice: true, rock: '#8f939c',
    stars: true, earth: true, sun: '#ffffff', sunI: 2.7, sky: '#bcd0ff', ground: '#6b6864', hemiI: 0.7, amb: 0.14, exposure: 1.0, deck: '#c7b394', plank: '#a38f72',
  },
  cosy: {
    bg: '#86cfcf', fog: '#7ccbcb', fogNear: 55, fogFar: 175, near: '#62c6c6', far: '#2b8a95', shoal: '#9be6dc' as string | null, waves: true, craters: false,
    top: '#ecc993', cliffs: ['#557487', '#486678', '#3d5869'], isleTop: '#dc9a5e', spires: ['#e27d3e', '#c9652f'], ice: false, rock: '#5f7a8b',
    stars: false, earth: true, sun: '#fff4dc', sunI: 2.3, sky: '#e3fbfa', ground: '#d9a86f', hemiI: 1.0, amb: 0.25, exposure: 1.1, deck: '#c48d57', plank: '#9b6838',
  },
  mars: {
    bg: '#c99470', fog: '#c08a66', fogNear: 50, fogFar: 175, near: '#b5683f', far: '#86492d', shoal: null as string | null, waves: false, craters: true,
    top: '#c98a5f', cliffs: ['#9a5638', '#894c31', '#77422b'], isleTop: '#b9774f', spires: ['#a65d3c', '#8d4e32'], ice: true, rock: '#7c4530',
    stars: false, earth: false, sun: '#fff0dc', sunI: 2.2, sky: '#f2caa6', ground: '#8a4a2e', hemiI: 0.85, amb: 0.2, exposure: 1.0, deck: '#c7b394', plank: '#a38f72',
  },
}
export type BaseTheme = keyof typeof THEMES
type Theme = (typeof THEMES)[BaseTheme]

const TILE = 2
const HALF = (GRID_SIZE * TILE) / 2
const SUN = new THREE.Vector3(-30, 22, 18).normalize()
const RAD3 = Math.PI / 180
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

function palette(T: Theme) {
  const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...o })
  return {
    hull: std('#f7f2e8', { roughness: 0.6 }),
    hull2: std('#d4d1ca'),
    foil: std('#e9b24c', { metalness: 0.55, roughness: 0.35 }),
    pink: std('#f2557f'),
    solar: std('#1d3566', { metalness: 0.35, roughness: 0.35, emissive: '#0b1838', emissiveIntensity: 0.6 }),
    metal: std('#5a606a', { metalness: 0.4, roughness: 0.5 }),
    dark: std('#2a2d34'),
    dish: std('#f1efe9', { side: THREE.DoubleSide, roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.1, depthWrite: false }),
    plant: std('#5fe0a2', { emissive: '#1f7a50', emissiveIntensity: 0.55 }),
    soil: std('#3b6b4a', { emissive: '#12301f', emissiveIntensity: 0.4 }),
    ice: std('#9fdcff', { emissive: '#2a6c98', emissiveIntensity: 0.35 }),
    blue: std('#4f8fe0'),
    regolith: std('#dcbd8e'),
    wood: std(T.deck),
    plank: std(T.plank),
    yellow: std('#f2c14e'),
    light: new THREE.MeshBasicMaterial({ color: '#ff5d5d' }),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffe7a8' }),
    green: new THREE.MeshBasicMaterial({ color: '#5fe0a2' }),
  }
}
type Pal = ReturnType<typeof palette>

function part(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  m.castShadow = true
  m.receiveShadow = true
  g.add(m)
  return m
}
const blink = (m: THREE.Mesh) => { m.userData.blink = Math.random(); m.castShadow = false; return m }
const cap = (r: number) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)

/** Low-poly models for every building, two levels each. Everything fits inside one 2 x 2 plot. */
const MODELS: Record<ModuleId, (p: Pal, lv: 1 | 2) => THREE.Group> = {
  habitat: (p, lv) => {
    const g = new THREE.Group()
    const pod = (x: number, z: number, s: number) => {
      part(g, new THREE.CylinderGeometry(0.62 * s, 0.68 * s, 0.8 * s, 12), p.hull, x, 0.4 * s, z)
      part(g, cap(0.62 * s), p.pink, x, 0.8 * s, z)
      part(g, new THREE.CylinderGeometry(0.7 * s, 0.7 * s, 0.12 * s, 12), p.foil, x, 0.3 * s, z)
      part(g, new THREE.BoxGeometry(0.24 * s, 0.16 * s, 0.06), p.dark, x, 0.6 * s, z + 0.64 * s)
    }
    if (lv === 1) pod(0, 0, 1)
    else { pod(-0.3, -0.25, 1); pod(0.5, 0.45, 0.72); part(g, new THREE.CylinderGeometry(0.13, 0.13, 0.7, 6), p.hull2, 0.12, 0.3, 0.12, 0, -0.8, Math.PI / 2) }
    blink(part(g, new THREE.SphereGeometry(0.06, 6, 4), p.light, lv === 1 ? 0 : -0.3, lv === 1 ? 1.46 : 1.46, lv === 1 ? 0 : -0.25))
    return g
  },
  power: (p, lv) => {
    const g = new THREE.Group()
    const up = new THREE.Vector3(0, 1, 0)
    const array = (x: number, z: number) => {
      part(g, new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), p.metal, x, 0.55, z)
      const panel = new THREE.Group()
      panel.position.set(x, 1.12, z)
      panel.quaternion.setFromUnitVectors(up, SUN) // facing the low Sun
      part(panel, new THREE.BoxGeometry(1.5, 0.05, 0.78), p.solar)
      part(panel, new THREE.BoxGeometry(1.56, 0.04, 0.06), p.foil, 0, 0.02, 0)
      part(panel, new THREE.BoxGeometry(0.06, 0.04, 0.82), p.foil, 0, 0.02, 0)
      g.add(panel)
    }
    if (lv === 1) array(0, 0)
    else { array(-0.42, -0.4); array(0.42, 0.42) }
    part(g, new THREE.BoxGeometry(0.42, 0.24, 0.3), p.hull2, 0.55, 0.12, -0.6)
    return g
  },
  comms: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.36, 0.42, 0.2, 8), p.hull2, 0, 0.1, 0)
    part(g, new THREE.CylinderGeometry(0.07, 0.2, 2.3, 5), p.hull, 0, 1.25, 0)
    part(g, new THREE.CylinderGeometry(0.12, 0.14, 0.28, 5), p.pink, 0, 2.05, 0)
    part(g, new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), p.dish, 0.1, 1.7, 0.25, -2.1, 0.4, 0)
    if (lv === 2) part(g, new THREE.SphereGeometry(0.36, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.3), p.dish, -0.3, 1.05, -0.2, -1.9, 2.6, 0)
    blink(part(g, new THREE.SphereGeometry(0.07, 6, 4), p.light, 0, 2.45, 0))
    return g
  },
  farm: (p, lv) => {
    const g = new THREE.Group()
    const dome = (x: number, z: number, s: number) => {
      part(g, new THREE.CylinderGeometry(0.86 * s, 0.9 * s, 0.18 * s, 16), p.hull, x, 0.09 * s, z)
      part(g, new THREE.CylinderGeometry(0.78 * s, 0.78 * s, 0.05, 16), p.soil, x, 0.2 * s, z)
      for (let k = 0; k < 8; k++) {
        const a = (k / 7) * Math.PI * 2, r = k === 7 ? 0 : 0.46 * s
        part(g, new THREE.ConeGeometry(0.13 * s, (0.36 + (k % 3) * 0.08) * s, 5), p.plant, x + Math.cos(a) * r, 0.4 * s, z + Math.sin(a) * r)
      }
      const glass = part(g, cap(0.82 * s), p.glass, x, 0.18 * s, z)
      glass.castShadow = false
      part(g, new THREE.TorusGeometry(0.82 * s, 0.025, 4, 18, Math.PI), p.foil, x, 0.18 * s, z)
      part(g, new THREE.TorusGeometry(0.82 * s, 0.025, 4, 18, Math.PI), p.foil, x, 0.18 * s, z, 0, Math.PI / 2, 0)
    }
    if (lv === 1) dome(0, 0, 1)
    else { dome(-0.28, -0.25, 0.86); dome(0.55, 0.55, 0.52) }
    return g
  },
  battery: (p, lv) => {
    const g = new THREE.Group()
    const n = lv === 1 ? 4 : 6
    for (let k = 0; k < n; k++) {
      const x = (k % 2) * 0.62 - 0.31, z = Math.floor(k / 2) * 0.55 - (n === 4 ? 0.28 : 0.55)
      part(g, new THREE.BoxGeometry(0.5, 0.55, 0.42), p.hull2, x, 0.28, z)
      part(g, new THREE.BoxGeometry(0.52, 0.06, 0.44), p.green, x, 0.42, z)
    }
    return g
  },
  pad: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.94, 0.99, 0.12, 8), p.dark, 0, 0.06, 0, 0, Math.PI / 8, 0)
    part(g, new THREE.TorusGeometry(0.66, 0.035, 4, 28), p.yellow, 0, 0.13, 0, Math.PI / 2)
    for (let k = 0; k < 4; k++) blink(part(g, new THREE.SphereGeometry(0.05, 6, 4), p.lamp, Math.cos(k * Math.PI / 2 + 0.78) * 0.84, 0.16, Math.sin(k * Math.PI / 2 + 0.78) * 0.84))
    if (lv === 2) {
      part(g, new THREE.ConeGeometry(0.32, 0.7, 6), p.hull, 0, 0.62, 0)
      part(g, new THREE.CylinderGeometry(0.34, 0.34, 0.22, 6), p.foil, 0, 0.3, 0)
      for (let k = 0; k < 4; k++) part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), p.metal, Math.cos(k * Math.PI / 2) * 0.36, 0.2, Math.sin(k * Math.PI / 2) * 0.36, Math.sin(k * Math.PI / 2) * 0.5, 0, -Math.cos(k * Math.PI / 2) * 0.5)
    }
    return g
  },
  lab: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.BoxGeometry(1.3, 0.7, 0.92), p.hull, 0, 0.35, 0)
    const tri = new THREE.Shape()
    tri.moveTo(-0.72, 0); tri.lineTo(0.72, 0); tri.lineTo(0, 0.45); tri.closePath()
    const roof = new THREE.ExtrudeGeometry(tri, { depth: 1.0, bevelEnabled: false })
    roof.translate(0, 0, -0.5)
    part(g, roof, p.pink, 0, 0.7, 0)
    part(g, cap(0.26), p.glass, 0.42, 0.7, 0.62).castShadow = false
    part(g, new THREE.BoxGeometry(0.3, 0.2, 0.05), p.dark, -0.3, 0.42, 0.47)
    if (lv === 2) { part(g, new THREE.BoxGeometry(0.62, 0.5, 0.6), p.hull2, -0.55, 0.25, 0.62); part(g, new THREE.BoxGeometry(0.66, 0.08, 0.64), p.pink, -0.55, 0.53, 0.62) }
    return g
  },
  ice: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.BoxGeometry(0.08, 1.7, 0.08), p.metal, -0.24, 0.8, -0.3, 0, 0, -0.28)
    part(g, new THREE.BoxGeometry(0.08, 1.7, 0.08), p.metal, 0.24, 0.8, -0.3, 0, 0, 0.28)
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), p.foil, 0, 0.75, -0.3)
    part(g, new THREE.BoxGeometry(0.5, 0.26, 0.32), p.hull2, 0, 1.55, -0.3)
    const tank = (x: number, z: number) => {
      part(g, new THREE.CylinderGeometry(0.32, 0.32, 0.85, 10), p.ice, x, 0.43, z)
      part(g, cap(0.32), p.ice, x, 0.85, z)
    }
    tank(0.42, 0.4)
    if (lv === 2) tank(-0.4, 0.45)
    return g
  },
  rover: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12, 1, false, 0, Math.PI), p.hull, 0, 0, -0.35, 0, 0, Math.PI / 2)
    part(g, new THREE.BoxGeometry(0.06, 0.62, 0.7), p.dark, 0.71, 0.3, -0.35)
    const rover = (x: number, z: number, ry: number) => {
      const r = new THREE.Group()
      r.position.set(x, 0, z); r.rotation.y = ry
      part(r, new THREE.BoxGeometry(0.62, 0.22, 0.4), p.foil, 0, 0.25, 0)
      part(r, new THREE.BoxGeometry(0.3, 0.16, 0.34), p.hull, -0.08, 0.43, 0)
      for (const [wx, wz] of [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]]) part(r, new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8), p.dark, wx, 0.11, wz, Math.PI / 2)
      part(r, new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), p.metal, 0.2, 0.55, 0.1)
      g.add(r)
    }
    rover(0.15, 0.55, 0.3)
    if (lv === 2) rover(-0.55, 0.45, -0.4)
    return g
  },
  oxygen: (p, lv) => {
    const g = new THREE.Group()
    const n = lv === 1 ? 3 : 4
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.45, z = Math.sin(a) * 0.45
      part(g, new THREE.CylinderGeometry(0.22, 0.22, 0.95, 10), p.hull, x, 0.48, z)
      part(g, cap(0.22), p.hull, x, 0.95, z)
      part(g, new THREE.CylinderGeometry(0.23, 0.23, 0.1, 10), p.blue, x, 0.62, z)
    }
    part(g, new THREE.TorusGeometry(0.45, 0.04, 4, 18), p.foil, 0, 0.22, 0, Math.PI / 2)
    return g
  },
  printer: (p, lv) => {
    const g = new THREE.Group()
    const s = lv === 1 ? 1 : 1.15
    const dome = part(g, cap(0.6 * s), p.regolith, 0, 0, 0)
    dome.scale.y = 0.85
    for (const [x, z] of [[0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8]]) part(g, new THREE.BoxGeometry(0.07, 1.5, 0.07), p.foil, x, 0.75, z)
    part(g, new THREE.BoxGeometry(1.67, 0.07, 0.07), p.foil, 0, 1.5, 0.8)
    part(g, new THREE.BoxGeometry(1.67, 0.07, 0.07), p.foil, 0, 1.5, -0.8)
    part(g, new THREE.BoxGeometry(0.07, 0.07, 1.67), p.metal, 0.2, 1.5, 0)
    part(g, new THREE.BoxGeometry(0.2, 0.25, 0.2), p.dark, 0.2, 1.3, 0)
    blink(part(g, new THREE.SphereGeometry(0.04, 6, 4), p.lamp, 0.2, 1.15, 0))
    return g
  },
  reactor: (p, lv) => {
    // NASA Fission Surface Power concept: a shielded core with radiator fins that shed its waste heat
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.34, 0.42, 0.46, 18), p.hull2, 0, 0.23, 0)
    part(g, new THREE.CylinderGeometry(0.22, 0.34, 0.3, 18), p.hull, 0, 0.61, 0)
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), p.metal, 0, 0.98, 0)
    const fins = lv === 1 ? 4 : 6
    for (let k = 0; k < fins; k++) {
      const a = (k / fins) * Math.PI * 2 + Math.PI / 4
      part(g, new THREE.BoxGeometry(0.035, 0.66, 0.46), p.foil, Math.cos(a) * 0.6, 0.4, Math.sin(a) * 0.6, 0, -a, 0)
    }
    return g
  },
  telescope: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.CylinderGeometry(0.25, 0.36, 0.45, 8), p.hull2, 0, 0.22, 0)
    part(g, new THREE.BoxGeometry(0.16, 0.62, 0.16), p.metal, 0, 0.72, 0)
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) { const r = (i / 8) * 0.95; pts.push(new THREE.Vector2(r, r * r * 0.4)) }
    part(g, new THREE.LatheGeometry(pts, 18), p.dish, 0, 1.05, 0, -0.75, 0.7, 0)
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.75, 4), p.metal, 0.12, 1.4, 0.16, -0.75, 0.7, 0)
    if (lv === 2) part(g, new THREE.LatheGeometry(pts.map(v => v.clone().multiplyScalar(0.5)), 14), p.dish, -0.6, 0.55, -0.55, -0.6, 2.2, 0)
    return g
  },
}

function buildModel(p: Pal, m: PlacedModule) {
  const root = new THREE.Group()
  part(root, new THREE.BoxGeometry(1.88, 0.14, 1.88), p.wood, 0, 0.07, 0)
  for (let k = -1; k <= 1; k++) part(root, new THREE.BoxGeometry(1.9, 0.02, 0.05), p.plank, 0, 0.145, k * 0.47).castShadow = false
  const g = MODELS[m.id](p, m.level)
  g.position.y = 0.14
  root.add(g)
  if (m.level === 2) part(root, new THREE.TorusGeometry(0.95, 0.03, 4, 28), p.foil, 0, 0.17, 0, Math.PI / 2).castShadow = false
  return root
}

/** A layered mesa: the base plateau and the smaller ones out on the plain. */
function mesa(rnd: () => number, radius: number, layers: number, height: number, mats: THREE.Material[][], squircle: boolean) {
  const g = new THREE.Group()
  let top = 0
  for (let l = 0; l < layers; l++) {
    const r = radius * (1 + l * 0.09)
    const shape = new THREE.Shape()
    const n = 30
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const sq = squircle ? 1 / Math.pow(Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4, 0.25) : 1
      const rr = r * sq * (1 + (rnd() - 0.5) * 0.06)
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr
      if (k) shape.lineTo(x, z); else shape.moveTo(x, z)
    }
    shape.closePath()
    const depth = height / layers + (l === layers - 1 ? 1 : 0)
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.16, bevelSegments: 1, curveSegments: 1 })
    const mesh = new THREE.Mesh(geo, mats[Math.min(l, mats.length - 1)])
    mesh.rotation.x = Math.PI / 2
    mesh.position.y = top - 0.16
    mesh.castShadow = l === 0
    mesh.receiveShadow = true
    g.add(mesh)
    top -= height / layers
  }
  return g
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
    renderer.toneMappingExposure = T.exposure
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(T.bg)
    scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 12
    controls.maxDistance = 64
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = 1.22
    controls.panSpeed = 0.6
    controls.screenSpacePanning = false
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    controls.addEventListener('change', () => {
      controls.target.x = Math.max(-8, Math.min(8, controls.target.x))
      controls.target.z = Math.max(-8, Math.min(8, controls.target.z))
      controls.target.y = 0
    })

    // Light: a low Sun for long shadows, blue earthshine from above
    const sun = new THREE.DirectionalLight(T.sun, T.sunI)
    sun.position.copy(SUN).multiplyScalar(45)
    sun.castShadow = true
    sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 110 })
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.03
    const hemi = new THREE.HemisphereLight(T.sky, T.ground, T.hemiI), amb = new THREE.AmbientLight('#ffffff', T.amb)
    scene.add(sun, hemi, amb)

    const p = palette(T)
    const rnd = mulberry32(17)
    const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o })
    const sand = std(T.top), cliff1 = std(T.cliffs[0]), cliff2 = std(T.cliffs[1]), cliff3 = std(T.cliffs[2])
    const isleTop = std(T.isleTop), spireA = std(T.spires[0]), spireB = std(T.spires[1]), rockMat = std(T.rock)
    const iceMat = std('#c9ecff', { emissive: '#3f9fe0', emissiveIntensity: 0.65, roughness: 0.3 })

    // The plain around the base: grey moon dust, or the cosy teal "sea"
    const plainGeo = new THREE.PlaneGeometry(460, 460, 80, 80)
    const pp = plainGeo.attributes.position
    const cols: number[] = []
    const cNear = new THREE.Color(T.near), cFar = new THREE.Color(T.far), mix = new THREE.Color()
    for (let i = 0; i < pp.count; i++) {
      pp.setZ(i, (rnd() - 0.5) * (T.craters ? 0.45 : 0.22))
      mix.copy(cNear).lerp(cFar, Math.min(1, Math.hypot(pp.getX(i), pp.getY(i)) / 120))
      cols.push(mix.r, mix.g, mix.b)
    }
    plainGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    plainGeo.computeVertexNormals()
    const plain = new THREE.Mesh(plainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: T.craters ? 0.95 : 0.55, metalness: 0.03, flatShading: T.craters }))
    plain.rotation.x = -Math.PI / 2
    plain.position.y = -3.4
    plain.receiveShadow = true
    scene.add(plain)
    if (T.shoal) {
      const shoal = new THREE.Mesh(new THREE.CircleGeometry(14.5, 40), new THREE.MeshBasicMaterial({ color: T.shoal, transparent: true, opacity: 0.35, depthWrite: false }))
      shoal.rotation.x = -Math.PI / 2
      shoal.position.y = -3.3
      scene.add(shoal)
    }
    if (T.craters) {
      const rimMat = std('#d0d3d9'), floorMat = std('#9da1a9')
      for (let k = 0; k < (low ? 30 : 55); k++) {
        const ang = rnd() * Math.PI * 2, d = 13 + rnd() * 85, r = 0.7 + rnd() * rnd() * 7
        const rim = part(scene, new THREE.TorusGeometry(r, r * 0.17, 4, 20), rimMat, Math.cos(ang) * d, -3.32, Math.sin(ang) * d, Math.PI / 2)
        rim.scale.z = 0.45
        part(scene, new THREE.CircleGeometry(r * 0.9, 18), floorMat, Math.cos(ang) * d, -3.3, Math.sin(ang) * d, -Math.PI / 2).castShadow = false
      }
    }

    // Little white wave marks that come and go (cosy look only)
    const waveGeo = new THREE.BoxGeometry(0.9, 0.02, 0.07)
    const waves: { m: THREE.Mesh; ph: number }[] = []
    for (let k = 0; T.waves && k < (low ? 30 : 60); k++) {
      const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }))
      const ang = rnd() * Math.PI * 2, d = 12 + rnd() * 55
      m.position.set(Math.cos(ang) * d, -3.27, Math.sin(ang) * d)
      m.rotation.y = rnd() * Math.PI
      scene.add(m)
      waves.push({ m, ph: rnd() * Math.PI * 2 })
    }

    const rock = new THREE.IcosahedronGeometry(1, 0)
    for (let k = 0; k < (low ? 30 : 60); k++) {
      const ang = rnd() * Math.PI * 2, d = 12 + rnd() * 70, sz = 0.2 + rnd() * rnd() * 1.4
      const m = part(scene, rock, rockMat, Math.cos(ang) * d, -3.3 + sz * 0.25, Math.sin(ang) * d, rnd() * 3, rnd() * 3, rnd() * 3)
      m.scale.set(sz, sz * (0.5 + rnd() * 0.5), sz)
    }

    // The base plateau (flat top at y = 0) and smaller plateaus with rock spires, and ice on the Moon
    scene.add(mesa(rnd, 7.9, 3, 3.6, [[sand, cliff1], [sand, cliff2], [sand, cliff3]], true))
    const spireGeo = new THREE.ConeGeometry(1, 1, 5)
    const spire = (o: THREE.Object3D, x: number, z: number, h: number, w: number, mat: THREE.Material) => {
      const m = part(o, spireGeo, mat, x, h / 2, z)
      m.scale.set(w, h, w)
    }
    for (let k = 0; k < (low ? 6 : 10); k++) {
      const ang = (k / 10) * Math.PI * 2 + rnd() * 0.5, d = (k % 3 === 0 ? 15 : 24) + rnd() * (k % 3 === 0 ? 6 : 36), h = 1.2 + rnd() * 2.6, r = (k % 3 === 0 ? 1.6 : 2) + rnd() * (k % 3 === 0 ? 2.2 : 4.5)
      const isle = mesa(rnd, r, 2, h, [[isleTop, cliff1], [isleTop, cliff2]], false)
      isle.position.set(Math.cos(ang) * d, -3.4 + h, Math.sin(ang) * d)
      const iceHere = T.ice && k % 2 === 0
      for (let j = 0, n = Math.floor(rnd() * 7); j < n; j++) {
        const sa = rnd() * Math.PI * 2, sd = rnd() * r * 0.55
        if (iceHere && j < 4) spire(isle, Math.cos(sa) * sd, Math.sin(sa) * sd, 0.6 + rnd() * 1.1, 0.12 + rnd() * 0.12, iceMat)
        else spire(isle, Math.cos(sa) * sd, Math.sin(sa) * sd, 0.9 + rnd() * 1.9, 0.25 + rnd() * 0.25, j % 2 ? spireA : spireB)
      }
      scene.add(isle)
    }
    for (let k = 0; k < 8; k++) { // spires on the edges of the base plateau, clear of the plots
      const ang = Math.floor(k / 2) * (Math.PI / 2) + (k % 2 ? 0.38 : -0.32) + rnd() * 0.1, d = 7.1 + rnd() * 0.4
      if (T.ice && k % 3 === 0) spire(scene, Math.cos(ang) * d, Math.sin(ang) * d, 0.6 + rnd() * 0.6, 0.12, iceMat)
      else spire(scene, Math.cos(ang) * d, Math.sin(ang) * d, 0.8 + rnd() * 1.2, 0.22 + rnd() * 0.12, k % 2 ? spireA : spireB)
    }
    for (let k = 0; k < 22; k++) {
      const ang = rnd() * Math.PI * 2, d = 6.7 + rnd() * 0.9, sz = 0.1 + rnd() * 0.2
      const m = part(scene, rock, rockMat, Math.cos(ang) * d, sz * 0.4, Math.sin(ang) * d, rnd() * 3, rnd() * 3, 0)
      m.scale.setScalar(sz)
    }

    // Sky: on the Moon, stars and a big bright Earth; in the cosy look, a pale daytime Earth
    if (T.stars) {
      const starPos: number[] = []
      for (let k = 0; k < (low ? 900 : 1800); k++) {
        const u = rnd(), t = rnd() * Math.PI * 2, y = u * 0.98 + 0.02, rr = Math.sqrt(1 - y * y)
        starPos.push(Math.cos(t) * rr * 600, y * 600 - 20, Math.sin(t) * rr * 600)
      }
      const starGeo = new THREE.BufferGeometry()
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#e3e9ff', size: 1.6, sizeAttenuation: false, fog: false })))
    }
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(T.stars ? 12 : 9, 32, 20),
      T.stars
        ? new THREE.MeshStandardMaterial({ color: '#3d7fd0', roughness: 0.6, emissive: '#0a2a55', emissiveIntensity: 0.55, fog: false })
        : new THREE.MeshStandardMaterial({ color: '#7fb0ee', roughness: 0.7, emissive: '#3a6fb8', emissiveIntensity: 0.3, transparent: true, opacity: 0.85, fog: false }),
    )
    earth.position.set(-125, 48, -175)
    if (T.earth) scene.add(earth)
    if (T.stars && T.earth) {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const x = c.getContext('2d')!
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64)
      gr.addColorStop(0, 'rgba(114,182,255,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
      halo.scale.setScalar(42)
      halo.position.copy(earth.position)
      scene.add(halo)
    }

    // Plots: faint grid, hover marker, focus ring, ghost of the building to place
    const lines: number[] = []
    for (let k = 0; k <= GRID_SIZE; k++) {
      const v = k * TILE - HALF
      lines.push(-HALF, 0.015, v, HALF, 0.015, v, v, 0.015, -HALF, v, 0.015, HALF)
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
    hover.position.y = 0.03
    const edgeMat = new THREE.LineBasicMaterial({ color: '#ffd98c', transparent: true, opacity: 0.95 })
    hover.add(new THREE.LineSegments(new THREE.EdgesGeometry(hover.geometry), edgeMat))
    hover.visible = false
    scene.add(hover)
    const ringMat = new THREE.MeshBasicMaterial({ color: '#e9b24c', transparent: true, opacity: 0.9, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 6, 40), ringMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.05
    ring.visible = false
    scene.add(ring)
    const ghostMat = new THREE.MeshStandardMaterial({ color: '#fff1cf', transparent: true, opacity: 0.5, depthWrite: false, emissive: '#5a4310', emissiveIntensity: 0.5 })
    let ghost: THREE.Group | null = null

    // Buildings
    const models = new Map<number, { obj: THREE.Group; key: string }>()
    const anims: { obj: THREE.Object3D; t0: number; kind: 'drop' | 'pop' | 'out' }[] = []
    const dust: { mesh: THREE.Mesh; v: THREE.Vector3; t0: number }[] = []
    const dustGeo = new THREE.SphereGeometry(0.09, 5, 3)
    const dustMat = new THREE.MeshBasicMaterial({ color: '#f6e2bf', transparent: true, opacity: 0.85, depthWrite: false })
    const puff = (at: THREE.Vector3) => {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + Math.random() * 0.3
        const mesh = new THREE.Mesh(dustGeo, dustMat.clone())
        mesh.position.set(at.x + Math.cos(a) * 0.6, 0.12, at.z + Math.sin(a) * 0.6)
        scene.add(mesh)
        dust.push({ mesh, v: new THREE.Vector3(Math.cos(a) * 1.6, 0.6 + Math.random() * 0.5, Math.sin(a) * 1.6), t0: performance.now() })
      }
    }
    const disposeTree = (o: THREE.Object3D) => o.traverse(n => { if ((n as THREE.Mesh).geometry) (n as THREE.Mesh).geometry.dispose() })
    let first = true
    const sync = (grid: BaseGrid) => {
      const now = performance.now()
      grid.forEach((m, i) => {
        const key = m ? `${m.id}:${m.level}` : ''
        const had = models.get(i)
        if (had?.key === key) return
        if (had) { anims.push({ obj: had.obj, t0: now, kind: 'out' }); models.delete(i) }
        if (!m) return
        const obj = buildModel(p, m)
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
    }
    const setGhost = (id: ModuleId | null) => {
      if (ghost) { scene.remove(ghost); disposeTree(ghost); ghost = null }
      if (!id) return
      ghost = buildModel(p, { id, level: 1 })
      ghost.traverse(n => { const mesh = n as THREE.Mesh; if (mesh.isMesh) { mesh.material = ghostMat; mesh.castShadow = false } })
      ghost.visible = false
      scene.add(ghost)
    }
    let focusCell: number | null = null
    const setFocus = (i: number | null) => { focusCell = i; ring.visible = i != null; if (i != null) ring.position.set(centre(i).x, 0.05, centre(i).z) }
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
      const ground = ray.intersectObject(pick)[0]
      return ground ? cellAt(ground.point.x, ground.point.z) : -1
    }
    const showHover = (cell: number) => {
      hovered = cell
      const L = live.current
      if (cell < 0) { hover.visible = false; if (ghost) ghost.visible = false; if (label.current) label.current.style.opacity = '0'; return }
      const c = centre(cell)
      hover.position.set(c.x, 0.03, c.z)
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

    // Fly in from high above, then hand over to the player
    // Starts low across the plain with Earth rising behind the base, then swoops up to the overview
    // Tall phone screens need the camera further back to fit the whole plateau
    const aspect = el.clientWidth / Math.max(1, el.clientHeight)
    const endPos = new THREE.Vector3(15, 15.5, 17).multiplyScalar(aspect < 1.2 ? Math.min(1.9, (1.2 / aspect) ** 0.75) : 1)
    const startPos = new THREE.Vector3(36, 5.5, 44)
    const startLook = new THREE.Vector3(0, 2.5, 0), look = new THREE.Vector3()
    camera.position.copy(still ? endPos : startPos)
    camera.lookAt(still ? new THREE.Vector3() : startLook)
    controls.enabled = still
    let t0 = 0 // set once the first frame is on screen, so slow devices still see the whole swoop
    let raf = 0
    let tick = 0
    const tmp = new THREE.Vector3()
    const frame = () => {
      raf = requestAnimationFrame(frame)
      if (document.hidden) return
      if (low && tick++ % 2) return // 30 frames a second on phones and low-power devices
      const now = performance.now(), t = now / 1000
      if (!controls.enabled) {
        const k = t0 ? Math.min(1, Math.max(0, (now - t0 - 400) / 2600)) : 0, e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
        camera.position.lerpVectors(startPos, endPos, e)
        camera.lookAt(look.copy(startLook).multiplyScalar(1 - e))
        if (k >= 1) controls.enabled = true
      } else controls.update()
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
      for (let d = dust.length - 1; d >= 0; d--) {
        const pd = dust[d], k = (now - pd.t0) / 700
        pd.mesh.position.addScaledVector(pd.v, 1 / 60)
        pd.v.y -= 0.05
        ;(pd.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k)
        pd.mesh.scale.setScalar(1 + k * 1.5)
        if (k >= 1) { scene.remove(pd.mesh); (pd.mesh.material as THREE.Material).dispose(); dust.splice(d, 1) }
      }
      scene.traverse(n => { if (n.userData.blink !== undefined) n.visible = (t * 0.9 + n.userData.blink) % 1 < 0.55 })
      p.plant.emissiveIntensity = 0.45 + 0.15 * Math.sin(t * 2)
      for (const w of waves) {
        const o = Math.max(0, Math.sin(t * 0.8 + w.ph))
        ;(w.m.material as THREE.MeshBasicMaterial).opacity = o * 0.7
        w.m.scale.x = 0.6 + o * 0.6
      }
      ringMat.opacity = 0.55 + 0.35 * Math.sin(t * 4)
      gridMat.opacity = live.current.selected ? 0.3 : 0.12
      earth.rotation.y = t * 0.02
      if (focusCell != null) ring.position.y = 0.05
      if (hovered >= 0 && label.current) {
        tmp.copy(centre(hovered)).setY(2.1).project(camera)
        label.current.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * el.clientWidth}px, ${(-tmp.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%, -100%)`
      }
      // Mission simulation: the real Sun for this hour (at the Moon's pole it skims the horizon)
      const ss = live.current.sun
      if (ss) {
        const el = Math.max(3, ss.elev) * RAD3, az = ss.az * RAD3
        sun.position.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(45)
        sun.intensity = T.sunI * ss.light
        hemi.intensity = T.hemiI * (ss.dark ? 0.3 : 0.55 + 0.45 * ss.light)
        amb.intensity = T.amb * (ss.dark ? 0.7 : 1)
      } else {
        sun.position.copy(SUN).multiplyScalar(45)
        sun.intensity = T.sunI; hemi.intensity = T.hemiI; amb.intensity = T.amb
      }
      renderer.render(scene, camera)
      if (!t0) t0 = performance.now()
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      cv.removeEventListener('pointermove', onMove)
      cv.removeEventListener('pointerdown', onDown)
      cv.removeEventListener('pointerup', onUp)
      cv.removeEventListener('pointerleave', onLeave)
      controls.dispose()
      scene.traverse(n => {
        const mesh = n as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material
        for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) { (m as THREE.SpriteMaterial).map?.dispose(); m.dispose() }
      })
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
