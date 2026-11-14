/**
 * The buildings of the 3D base. Each one is modelled on real hardware or a NASA concept, sits on its
 * own 2 x 2 plot, and has an `apply` function that shows what it is doing at this mission hour:
 * solar arrays turn to the Sun, crops grow in their beds, windows light up, the cargo lander comes down.
 */
import * as THREE from 'three'
import type { ModuleId } from '../../data/types'
import type { PlacedModule } from '../../lib/base'
import { BEDS, CROPS, type CellLive } from '../../lib/baseLive'

/** What every building needs to know about the moment */
export interface Env { sun: THREE.Vector3; earth: THREE.Vector3 | null; t: number; dt: number; dark: boolean }
export type Apply = (c: CellLive, e: Env) => void

const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...o })
/** A material that belongs to one building only (so it can change on its own) */
const own = <M extends THREE.Material>(m: M) => { m.userData.own = true; return m }

/** Solar cells: dark blue with fine grid lines */
function cellTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = '#0d1a3a'; x.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const g = x.createLinearGradient(i * 32, j * 32, i * 32 + 32, j * 32 + 32)
    g.addColorStop(0, '#16306b'); g.addColorStop(1, '#0b1a44')
    x.fillStyle = g; x.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29)
  }
  x.strokeStyle = 'rgba(190,205,235,.5)'; x.lineWidth = 0.6
  for (let k = 0; k <= 128; k += 8) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 128); x.stroke() }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function palette(T: { pad: string; berm: string; accent: string }) {
  return {
    hull: std('#e9e7e1', { roughness: 0.55 }), // white thermal paint
    hull2: std('#b9bcc2', { roughness: 0.6, metalness: 0.2 }),
    foil: std('#c9962f', { metalness: 0.75, roughness: 0.38 }), // gold insulation blankets
    silver: std('#cfd3d8', { metalness: 0.85, roughness: 0.3 }),
    solar: std('#ffffff', { map: cellTexture(), metalness: 0.5, roughness: 0.25 }),
    metal: std('#70757d', { metalness: 0.7, roughness: 0.45 }),
    dark: std('#23262b', { roughness: 0.8 }),
    dish: std('#eeeeea', { side: THREE.DoubleSide, roughness: 0.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#dff1ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false }),
    radiator: std('#f4f4f1', { roughness: 0.35, emissive: '#ff5a1e', emissiveIntensity: 0.012 }),
    tank: std('#dfe3e6', { metalness: 0.55, roughness: 0.35 }),
    tray: std('#8e9299', { metalness: 0.5, roughness: 0.5 }),
    soil: std('#5a4332', { roughness: 1 }),
    leaf: std('#4fae45', { roughness: 0.8 }),
    leafDark: std('#2c6b33', { roughness: 0.8 }),
    lettuce: std('#7a2f45', { roughness: 0.8 }),
    radish: std('#d2334d', { roughness: 0.6 }),
    shirt: std('#2b5fa8'), skin: std('#d9a887'), trousers: std('#2f3540'),
    pad: std(T.pad, { roughness: 0.95 }),
    berm: std(T.berm, { roughness: 1 }),
    accent: std(T.accent, { roughness: 0.6 }),
    yellow: std('#e6b422', { roughness: 0.7 }),
    red: new THREE.MeshBasicMaterial({ color: '#ff4a4a' }),
    lamp: new THREE.MeshBasicMaterial({ color: '#ffe7a8' }),
    ledOn: new THREE.MeshBasicMaterial({ color: '#58e08f' }),
    ledOff: std('#22302a'),
    flame: new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }),
  }
}
export type Pal = ReturnType<typeof palette>

export function part(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  m.castShadow = true
  m.receiveShadow = true
  g.add(m)
  return m
}
const blink = (m: THREE.Mesh) => { m.userData.blink = Math.random(); m.castShadow = false; return m }
const cap = (r: number, seg = 20) => new THREE.SphereGeometry(r, seg, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const cyl = (r1: number, r2: number, h: number, seg = 20) => new THREE.CylinderGeometry(r1, r2, h, seg)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const windowMat = () => own(new THREE.MeshStandardMaterial({ color: '#141a24', emissive: '#ffd08a', emissiveIntensity: 0, roughness: 0.25, side: THREE.DoubleSide }))
const ease = (from: number, to: number, dt: number, speed = 3) => from + (to - from) * Math.min(1, dt * speed)
const tmpA = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Vector3()
/** Turns a group so its +z looks along a direction, smoothly. */
function aim(o: THREE.Object3D, dir: THREE.Vector3, dt: number, speed = 2) {
  tmpA.copy(dir)
  if (tmpA.lengthSq() < 1e-6) return
  tmpM.lookAt(tmpA, ZERO, UP) // +z towards dir
  tmpQ.setFromRotationMatrix(tmpM)
  o.quaternion.slerp(tmpQ, Math.min(1, dt * speed))
}

/** A pressurised module lying on its side: hull, end domes, foil bands, windows, saddles. */
function hullModule(g: THREE.Object3D, p: Pal, win: THREE.Material, len: number, r: number) {
  part(g, cyl(r, r, len, 24), p.hull, 0, r + 0.06, 0, 0, 0, Math.PI / 2)
  for (const s of [-1, 1]) {
    part(g, new THREE.SphereGeometry(r, 24, 14), p.hull, (s * len) / 2, r + 0.06, 0).scale.set(0.42, 1, 1)
    part(g, new THREE.TorusGeometry(r + 0.004, 0.018, 6, 28), p.foil, s * len * 0.3, r + 0.06, 0, 0, Math.PI / 2, 0)
    part(g, box(0.1, 0.08, r * 1.7), p.dark, s * len * 0.36, 0.04, 0)
    for (const side of [-1, 1]) {
      const a = 0.42
      part(g, new THREE.CircleGeometry(r * 0.17, 14), win, s * len * 0.16, r + 0.06 + (r + 0.006) * Math.sin(a), side * (r + 0.006) * Math.cos(a), -side * a, side < 0 ? Math.PI : 0, 0).castShadow = false
    }
  }
}

const MODELS: Record<ModuleId, (p: Pal, lv: 1 | 2, low: boolean) => { g: THREE.Group; apply?: Apply }> = {
  // Habitat: a rigid pressurised module with an airlock, as in NASA's surface habitat concepts
  habitat: (p, lv) => {
    const g = new THREE.Group(), win = windowMat()
    const pod = (z: number, s: number, ry: number) => {
      const m = new THREE.Group()
      m.position.z = z; m.rotation.y = ry; m.scale.setScalar(s)
      hullModule(m, p, win, 1.2, 0.42)
      part(m, box(0.38, 0.54, 0.3), p.hull2, 0, 0.27, 0.5) // airlock
      part(m, box(0.22, 0.36, 0.02), p.dark, 0, 0.24, 0.655)
      part(m, box(0.26, 0.02, 0.02), p.yellow, 0, 0.45, 0.66).castShadow = false
      part(m, box(0.7, 0.02, 0.34), p.radiator, 0, 0.97, -0.05, 0.12)
      part(m, cyl(0.012, 0.012, 0.12, 6), p.metal, 0.2, 0.92, -0.05)
      part(m, cyl(0.012, 0.012, 0.12, 6), p.metal, -0.2, 0.92, -0.05)
      g.add(m)
    }
    if (lv === 1) pod(-0.12, 1.12, 0)
    else { pod(-0.5, 1, 0); pod(0.52, 0.86, Math.PI) }
    blink(part(g, new THREE.SphereGeometry(0.035, 8, 6), p.red, 0.62, lv === 1 ? 1.12 : 1.02, lv === 1 ? -0.12 : -0.5))
    return { g, apply: (c, e) => { win.emissiveIntensity = ease(win.emissiveIntensity, (c.lit ?? 0) * 1.8, e.dt) } }
  },
  // Solar array: a tall mast with a panel that turns to follow the Sun (NASA's Vertical Solar Array Technology)
  power: (p, lv) => {
    const g = new THREE.Group()
    part(g, box(0.5, 0.16, 0.5), p.hull2, 0, 0.08, 0)
    part(g, cyl(0.035, 0.05, 1.5, 10), p.metal, 0, 0.9, 0)
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; part(g, cyl(0.012, 0.012, 0.75, 5), p.metal, Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9) }
    const head = new THREE.Group()
    head.position.y = 1.62
    const wings = lv === 1 ? [0] : [-0.62, 0.62]
    for (const x of wings) {
      part(head, box(lv === 1 ? 1.3 : 1.15, 1.15, 0.025), p.solar, x, 0, 0.02)
      part(head, box(lv === 1 ? 1.34 : 1.19, 1.19, 0.015), p.silver, x, 0, 0)
    }
    part(head, cyl(0.03, 0.03, lv === 1 ? 0.3 : 1.3, 8), p.metal, 0, 0, -0.03, 0, 0, Math.PI / 2)
    g.add(head)
    if (lv === 2) { part(g, box(0.5, 0.3, 0.34), p.hull, 0.62, 0.15, -0.6); part(g, box(0.52, 0.03, 0.36), p.foil, 0.62, 0.31, -0.6) }
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.6, 0.2, 0.4).normalize())
    return { g, apply: (c, e) => { if (c.on) aim(head, tmpA.set(e.sun.x, Math.max(0.02, e.sun.y), e.sun.z), e.dt, 1.5) } }
  },
  // Comms: a mast and a dish that points at Earth (on Mars, at the relay orbiter's track)
  comms: (p, lv) => {
    const g = new THREE.Group()
    part(g, cyl(0.34, 0.4, 0.16, 10), p.hull2, 0, 0.08, 0)
    part(g, box(0.34, 0.3, 0.26), p.hull, 0.3, 0.31, 0.2)
    part(g, cyl(0.035, 0.07, 2.2, 8), p.metal, 0, 1.25, 0)
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.5; part(g, cyl(0.008, 0.008, 1.6, 4), p.metal, Math.cos(a) * 0.36, 0.85, Math.sin(a) * 0.36, Math.sin(a) * 0.48, 0, -Math.cos(a) * 0.48).castShadow = false }
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) { const r = (i / 8) * 0.5; pts.push(new THREE.Vector2(r, r * r * 0.55)) }
    const dishGeo = new THREE.LatheGeometry(pts, 24)
    const head = new THREE.Group()
    head.position.set(0, 1.75, 0)
    part(head, dishGeo, p.dish, 0, 0, 0.06, Math.PI / 2)
    part(head, cyl(0.008, 0.008, 0.34, 4), p.metal, 0, 0, 0.24, Math.PI / 2)
    part(head, cyl(0.03, 0.03, 0.04, 8), p.foil, 0, 0, 0.41, Math.PI / 2)
    g.add(head)
    if (lv === 2) { const d2 = part(g, dishGeo, p.dish, -0.34, 1.05, -0.2, -0.5, 2.4, 0); d2.scale.setScalar(0.62) }
    const lampMat = own(new THREE.MeshBasicMaterial({ color: '#58e08f' }))
    part(g, new THREE.SphereGeometry(0.03, 8, 6), lampMat, 0.3, 0.48, 0.2).castShadow = false
    blink(part(g, new THREE.SphereGeometry(0.04, 8, 6), p.red, 0, 2.4, 0))
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.5, 0.4, -0.7).normalize())
    return {
      g, apply: (c, e) => {
        if (e.earth) aim(head, e.earth, e.dt)
        lampMat.color.set(!c.on ? '#3a1d1d' : (c.level ?? 1) > 0 ? '#58e08f' : '#e6b422')
      },
    }
  },
  // Greenhouse: beds under magenta grow lights. Each bed's plants grow day by day; a crew member tends them.
  farm: (p, lv, low) => {
    const g = new THREE.Group()
    const n = BEDS[lv - 1].length, per = n / 2, L = 1.6, R = 0.72, Y = 0.07
    part(g, box(1.72, 0.07, 1.56), p.hull2, 0, 0.035, 0)
    part(g, new THREE.CylinderGeometry(R, R, L, 28, 1, true, 0, Math.PI), p.glass, 0, Y, 0, 0, 0, Math.PI / 2).castShadow = false
    for (const s of [-1, 1]) part(g, new THREE.CircleGeometry(R, 24, 0, Math.PI), p.glass, (s * L) / 2, Y, 0, 0, Math.PI / 2, 0).castShadow = false
    for (const x of [-L / 2, -L / 6, L / 6, L / 2]) part(g, new THREE.TorusGeometry(R, 0.016, 6, 24, Math.PI), p.silver, x, Y, 0, 0, Math.PI / 2, 0).castShadow = false
    part(g, box(0.3, 0.46, 0.04), p.hull, L / 2 + 0.01, 0.3, 0) // door
    const led = own(new THREE.MeshStandardMaterial({ color: '#2a1630', emissive: '#ff4fd8', emissiveIntensity: 0 }))
    for (const z of [-0.3, 0.3]) part(g, box(L - 0.12, 0.015, 0.03), led, 0, Y + 0.62, z).castShadow = false
    const glow = low ? null : new THREE.PointLight('#ff6ae0', 0, 2.6, 1.6)
    if (glow) { glow.position.set(0, 0.55, 0); g.add(glow) }
    const beds: { x: number; z: number; plants: THREE.Group; ripe?: THREE.MeshStandardMaterial; sown: THREE.Mesh }[] = []
    for (let k = 0; k < n; k++) {
      const side = k % 2 ? 1 : -1, col = Math.floor(k / 2)
      const len = 1.44 / per - 0.07, bx = ((col + 0.5) / per) * 1.44 - 0.72, bz = side * 0.42, w = 0.34
      part(g, box(len, 0.14, w), p.tray, bx, Y + 0.07, bz)
      part(g, box(len - 0.03, 0.02, w - 0.03), p.soil, bx, Y + 0.145, bz).castShadow = false
      const sown = part(g, box(len - 0.06, 0.006, 0.02), p.leaf, bx, Y + 0.158, bz)
      sown.castShadow = false
      const plants = new THREE.Group()
      plants.position.set(bx, Y + 0.155, bz)
      const crop = CROPS[BEDS[lv - 1][k]].id
      let ripe: THREE.MeshStandardMaterial | undefined
      const cols = Math.max(2, Math.round(len / (crop === 'wheat' ? 0.07 : 0.15))), rows = crop === 'wheat' ? 4 : 2
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const px = ((i + 0.5) / cols - 0.5) * (len - 0.08), pz = ((j + 0.5) / rows - 0.5) * (w - 0.08)
        const pl = new THREE.Group()
        pl.position.set(px, 0, pz)
        pl.rotation.y = (i * 7 + j * 3) % 6
        if (crop === 'lettuce') { part(pl, new THREE.IcosahedronGeometry(0.075, 1), p.lettuce, 0, 0.045, 0).scale.y = 0.75; part(pl, new THREE.IcosahedronGeometry(0.045, 1), p.leaf, 0, 0.06, 0) }
        else if (crop === 'radish') { part(pl, new THREE.SphereGeometry(0.03, 8, 6), p.radish, 0, 0.012, 0); for (let q = 0; q < 3; q++) part(pl, new THREE.ConeGeometry(0.022, 0.13, 5), p.leaf, Math.cos(q * 2.1) * 0.02, 0.085, Math.sin(q * 2.1) * 0.02, Math.sin(q * 2.1) * 0.35, 0, -Math.cos(q * 2.1) * 0.35) }
        else if (crop === 'wheat') { ripe ??= own(std('#4f9a3c', { roughness: 0.85 })); part(pl, new THREE.ConeGeometry(0.014, 0.3, 4), ripe, 0, 0.15, 0); part(pl, new THREE.CylinderGeometry(0.012, 0.008, 0.07, 5), ripe, 0, 0.3, 0) }
        else { part(pl, new THREE.IcosahedronGeometry(0.085, 1), p.leafDark, 0, 0.07, 0).scale.y = 0.85; part(pl, new THREE.IcosahedronGeometry(0.05, 0), p.leaf, 0.03, 0.12, 0.01) }
        plants.add(pl)
      }
      g.add(plants)
      beds.push({ x: bx, z: bz, plants, ripe, sown })
    }
    // The gardener, in shirtsleeves: the greenhouse is pressurised
    const crew = new THREE.Group()
    part(crew, box(0.09, 0.17, 0.06), p.trousers, 0, 0.085, 0)
    part(crew, box(0.11, 0.16, 0.07), p.shirt, 0, 0.25, 0)
    part(crew, new THREE.SphereGeometry(0.045, 12, 8), p.skin, 0, 0.375, 0)
    const arm = new THREE.Group()
    arm.position.set(0, 0.31, 0.04)
    part(arm, box(0.13, 0.035, 0.035), p.shirt, 0, 0, 0.08, 0, Math.PI / 2, 0)
    crew.add(arm)
    crew.position.y = Y
    crew.visible = false
    g.add(crew)
    const green = new THREE.Color('#4f9a3c'), gold = new THREE.Color('#d9b24a')
    return {
      g, apply: (c, e) => {
        c.beds?.forEach((b, k) => {
          const bed = beds[k]
          if (!bed) return
          const up = b.stage !== 'empty' && b.stage !== 'sown'
          bed.plants.visible = up
          bed.sown.visible = b.stage === 'sown'
          if (up) bed.plants.scale.setScalar(1.35 * (0.14 + 0.86 * Math.pow(b.growth, 0.7)))
          bed.ripe?.color.copy(green).lerp(gold, Math.min(1, Math.max(0, (b.growth - 0.7) / 0.3)))
        })
        const on = c.lit ? 1 : 0
        led.emissiveIntensity = ease(led.emissiveIntensity, on * 2.4, e.dt)
        if (glow) glow.intensity = ease(glow.intensity, on * (e.dark ? 2.2 : 0.5), e.dt)
        crew.visible = !!c.job
        if (c.job && beds[c.job.bed]) {
          const bed = beds[c.job.bed]
          crew.position.x = ease(crew.position.x, bed.x + Math.sin(e.t * 0.5) * 0.12, e.dt, 2)
          crew.position.z = bed.z > 0 ? 0.1 : -0.1
          crew.rotation.y = bed.z > 0 ? 0 : Math.PI
          arm.rotation.x = 0.5 + Math.sin(e.t * (c.job.kind === 'tend' ? 2 : 4)) * 0.35
        }
      },
    }
  },
  // Battery bank: cabinets with a charge meter
  battery: (p, lv) => {
    const g = new THREE.Group()
    const n = lv === 1 ? 2 : 3, leds: THREE.Mesh[] = []
    for (let k = 0; k < n; k++) {
      const z = (k - (n - 1) / 2) * 0.56
      part(g, box(1.3, 0.62, 0.44), p.hull, 0, 0.35, z)
      part(g, box(1.34, 0.04, 0.48), p.hull2, 0, 0.68, z)
      part(g, box(1.2, 0.03, 0.4), p.radiator, 0, 0.76, z, 0, 0, 0.1)
      for (const x of [-0.5, 0.5]) part(g, box(0.1, 0.06, 0.4), p.dark, x, 0.03, z)
    }
    for (let k = 0; k < 5; k++) leds.push(part(g, box(0.035, 0.05, 0.012), p.ledOff, 0.35 + k * 0.055, 0.5, ((n - 1) / 2) * 0.56 + 0.225))
    part(g, cyl(0.02, 0.02, 1.3, 6), p.dark, -0.5, 0.05, 0, Math.PI / 2)
    return { g, apply: c => leds.forEach((m, k) => { m.material = (c.level ?? 0) * 5 > k + 0.02 ? p.ledOn : p.ledOff }) }
  },
  // Landing pad: sintered regolith with edge lights. The cargo lander comes down on schedule.
  pad: (p, lv) => {
    const g = new THREE.Group()
    part(g, cyl(0.95, 0.98, 0.05, 40), p.dark, 0, 0.025, 0).castShadow = false
    part(g, new THREE.RingGeometry(0.6, 0.66, 40), p.yellow, 0, 0.052, 0, -Math.PI / 2).castShadow = false
    part(g, box(0.5, 0.004, 0.07), p.yellow, 0, 0.053, 0).castShadow = false
    part(g, box(0.07, 0.004, 0.5), p.yellow, 0, 0.053, 0).castShadow = false
    for (let k = 0; k < 8; k++) blink(part(g, new THREE.SphereGeometry(0.028, 6, 4), p.lamp, Math.cos((k * Math.PI) / 4) * 0.88, 0.07, Math.sin((k * Math.PI) / 4) * 0.88))
    if (lv === 2) { part(g, cyl(0.014, 0.02, 1.1, 6), p.metal, 0.9, 0.55, 0.9); part(g, box(0.12, 0.05, 0.08), p.lamp, 0.87, 1.1, 0.87).castShadow = false; part(g, box(0.34, 0.22, 0.26), p.hull2, -0.8, 0.11, 0.8) }
    const L = new THREE.Group()
    part(L, cyl(0.3, 0.34, 0.26, 8), p.foil, 0, 0.42, 0)
    for (let k = 0; k < 4; k++) part(L, new THREE.SphereGeometry(0.11, 12, 8), p.silver, Math.cos(k * Math.PI / 2 + 0.78) * 0.3, 0.44, Math.sin(k * Math.PI / 2 + 0.78) * 0.3)
    part(L, cyl(0.21, 0.27, 0.36, 16), p.hull, 0, 0.73, 0)
    part(L, cap(0.21), p.hull, 0, 0.91, 0)
    part(L, new THREE.ConeGeometry(0.12, 0.17, 14, 1, true), p.dark, 0, 0.21, 0)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2
      part(L, cyl(0.014, 0.014, 0.52, 5), p.metal, Math.cos(a) * 0.44, 0.24, Math.sin(a) * 0.44, Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62)
      part(L, cyl(0.06, 0.06, 0.02, 10), p.foil, Math.cos(a) * 0.6, 0.012, Math.sin(a) * 0.6)
    }
    const plume = part(L, new THREE.ConeGeometry(0.2, 1.3, 14, 1, true), p.flame, 0, -0.5, 0)
    plume.castShadow = plume.receiveShadow = false
    L.position.y = 0.05
    L.visible = false
    g.add(L)
    return {
      g, apply: (c, e) => {
        const l = c.lander
        L.visible = !!l && l.phase !== 'away'
        if (!l || l.phase === 'away') return
        const k = l.phase === 'descent' ? 1 - l.k : l.phase === 'ascent' ? l.k : 0
        L.position.y = 0.05 + 30 * k * k
        const burning = l.phase !== 'landed'
        plume.visible = burning
        if (burning) plume.scale.set(1 + Math.sin(e.t * 40) * 0.12, 0.8 + Math.sin(e.t * 31) * 0.2, 1 + Math.sin(e.t * 37) * 0.12)
      },
    }
  },
  // Science lab: a pressurised module with a sample airlock and a glovebox window
  lab: (p, lv) => {
    const g = new THREE.Group(), win = windowMat()
    const m = new THREE.Group()
    hullModule(m, p, win, 1.15, 0.4)
    m.position.z = lv === 1 ? 0 : -0.3
    g.add(m)
    part(g, box(0.3, 0.3, 0.3), p.hull2, 0.2, 0.2, m.position.z + 0.5)
    part(g, box(0.16, 0.16, 0.02), p.dark, 0.2, 0.2, m.position.z + 0.655)
    part(g, cyl(0.01, 0.01, 0.5, 5), p.metal, -0.4, 1.1, m.position.z)
    part(g, box(0.62, 0.02, 0.3), p.radiator, 0.1, 0.93, m.position.z, 0.1)
    if (lv === 2) { part(g, box(0.9, 0.5, 0.56), p.hull, -0.2, 0.3, 0.55); part(g, box(0.94, 0.03, 0.6), p.foil, -0.2, 0.56, 0.55); part(g, box(0.3, 0.16, 0.01), win, -0.2, 0.36, 0.835).castShadow = false }
    return { g, apply: (c, e) => { win.emissiveIntensity = ease(win.emissiveIntensity, (c.lit ?? 0) * 1.8, e.dt) } }
  },
  // Ice extractor: a drill rig over the regolith and insulated water tanks
  ice: (p, lv) => {
    const g = new THREE.Group()
    for (const [x, z] of [[-0.26, -0.56], [0.26, -0.56], [-0.26, -0.04], [0.26, -0.04]]) part(g, box(0.035, 1.7, 0.035), p.metal, x * 0.72, 0.85, -0.3 + (z + 0.3) * 0.72, (z + 0.3) * -0.6, 0, x * 0.55)
    for (const y of [0.5, 1.0, 1.45]) { const s = 1 - y * 0.42; part(g, box(0.56 * s, 0.02, 0.02), p.metal, 0, y, -0.3 - 0.26 * s); part(g, box(0.56 * s, 0.02, 0.02), p.metal, 0, y, -0.3 + 0.26 * s); part(g, box(0.02, 0.02, 0.56 * s), p.metal, -0.26 * s, y, -0.3); part(g, box(0.02, 0.02, 0.56 * s), p.metal, 0.26 * s, y, -0.3) }
    part(g, box(0.3, 0.2, 0.3), p.hull2, 0, 1.75, -0.3)
    const drill = part(g, cyl(0.03, 0.03, 1.6, 8), p.silver, 0, 0.8, -0.3)
    const bit = part(g, new THREE.ConeGeometry(0.07, 0.2, 6), p.dark, 0, 0.1, -0.3, Math.PI)
    part(g, cyl(0.18, 0.2, 0.06, 14), p.dark, 0, 0.03, -0.3)
    const tank = (x: number, z: number) => { part(g, cyl(0.26, 0.26, 0.7, 18), p.tank, x, 0.45, z); part(g, cap(0.26), p.tank, x, 0.8, z); part(g, cyl(0.265, 0.265, 0.08, 18), p.foil, x, 0.3, z); part(g, cyl(0.27, 0.27, 0.1, 18), p.dark, x, 0.05, z) }
    tank(0.5, 0.45)
    if (lv === 2) tank(-0.45, 0.5)
    part(g, cyl(0.02, 0.02, 0.8, 6), p.metal, 0.25, 0.14, 0.08, Math.PI / 2, 0, 0.55)
    return { g, apply: (c, e) => { if (c.on) { bit.rotation.y += e.dt * 9; drill.rotation.y += e.dt * 9; bit.position.y = 0.1 + Math.sin(e.t * 0.7) * 0.04 } } }
  },
  // Rover garage: a shelter with a charging post
  rover: (p, lv) => {
    const g = new THREE.Group()
    const len = lv === 1 ? 1.3 : 1.6
    part(g, new THREE.CylinderGeometry(0.62, 0.62, len, 22, 1, false, 0, Math.PI), p.hull, 0, 0.02, -0.3, 0, 0, Math.PI / 2)
    part(g, box(0.03, 0.66, 0.84), p.dark, len / 2 + 0.005, 0.33, -0.3)
    for (const x of [-len * 0.3, 0, len * 0.3]) part(g, new THREE.TorusGeometry(0.625, 0.014, 5, 22, Math.PI), p.foil, x, 0.02, -0.3, 0, Math.PI / 2, 0).castShadow = false
    part(g, box(0.14, 0.5, 0.14), p.hull2, 0.75, 0.25, 0.6)
    const lampMat = own(new THREE.MeshBasicMaterial({ color: '#58e08f' }))
    part(g, box(0.06, 0.06, 0.02), lampMat, 0.75, 0.42, 0.675).castShadow = false
    part(g, box(0.5, 0.2, 0.36), p.hull2, -0.5, 0.1, 0.6)
    return { g, apply: c => lampMat.color.set(!c.on ? '#3a1d1d' : c.level ? '#e6b422' : '#58e08f') }
  },
  // Oxygen plant: electrolysis (Moon) or CO2 splitting like MOXIE (Mars), with storage tanks
  oxygen: (p, lv) => {
    const g = new THREE.Group()
    part(g, box(0.7, 0.5, 0.5), p.foil, -0.35, 0.29, -0.4)
    part(g, box(0.74, 0.04, 0.54), p.hull2, -0.35, 0.02, -0.4)
    part(g, box(0.6, 0.02, 0.4), p.radiator, -0.35, 0.66, -0.4, 0.15)
    const n = lv === 1 ? 2 : 3
    for (let k = 0; k < n; k++) {
      const x = 0.5 - k * 0.5, z = 0.42
      part(g, cyl(0.2, 0.2, 0.7, 18), p.tank, x, 0.5, z)
      part(g, cap(0.2), p.tank, x, 0.85, z)
      part(g, new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), p.tank, x, 0.15, z)
      part(g, cyl(0.205, 0.205, 0.06, 18), p.accent, x, 0.62, z)
      part(g, cyl(0.02, 0.02, 0.3, 5), p.metal, x, 0.02, z)
    }
    part(g, cyl(0.018, 0.018, 1.2, 6), p.silver, 0, 0.98, 0.42, 0, 0, Math.PI / 2)
    part(g, cyl(0.018, 0.018, 0.9, 6), p.silver, -0.35, 0.72, 0, Math.PI / 2 - 0.3)
    const lampMat = own(new THREE.MeshBasicMaterial({ color: '#58e08f' }))
    part(g, box(0.05, 0.05, 0.02), lampMat, -0.1, 0.42, -0.14).castShadow = false
    return { g, apply: c => lampMat.color.set(c.on ? '#58e08f' : '#3a1d1d') }
  },
  // Regolith printer: a gantry that builds a radiation berm, layer by layer, over weeks
  printer: (p, lv) => {
    const g = new THREE.Group()
    const s = lv === 1 ? 1 : 1.1
    const berm = part(g, new THREE.SphereGeometry(0.62 * s, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), p.berm, 0, 0.02, 0)
    for (const [x, z] of [[0.82, 0.82], [-0.82, 0.82], [0.82, -0.82], [-0.82, -0.82]]) part(g, box(0.05, 1.3, 0.05), p.metal, x, 0.65, z)
    part(g, box(1.69, 0.05, 0.05), p.metal, 0, 1.3, 0.82)
    part(g, box(1.69, 0.05, 0.05), p.metal, 0, 1.3, -0.82)
    const beam = part(g, box(0.06, 0.06, 1.69), p.yellow, 0, 1.3, 0)
    const head = new THREE.Group()
    part(head, box(0.16, 0.2, 0.16), p.dark, 0, -0.12, 0)
    part(head, new THREE.ConeGeometry(0.04, 0.12, 8), p.silver, 0, -0.28, 0, Math.PI)
    const tip = part(head, new THREE.SphereGeometry(0.03, 6, 4), p.lamp, 0, -0.35, 0)
    tip.castShadow = false
    head.position.y = 1.3
    g.add(head)
    part(g, box(0.3, 0.24, 0.3), p.hull2, 0.78, 0.12, 0)
    return {
      g, apply: (c, e) => {
        const k = c.level ?? 0
        berm.scale.y = 0.04 + 0.9 * k
        const busy = c.on && k < 1
        tip.visible = busy
        if (busy) { beam.position.x = head.position.x = Math.cos(e.t * 0.5) * 0.5 * s; head.position.z = Math.sin(e.t * 0.5) * 0.5 * s }
      },
    }
  },
  // Fission reactor: a buried, shielded core with a radiator mast (NASA Fission Surface Power concept)
  reactor: (p, lv) => {
    const g = new THREE.Group()
    part(g, new THREE.SphereGeometry(0.7, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), p.berm, 0, 0, 0).scale.y = 0.42
    part(g, cyl(0.2, 0.26, 0.4, 18), p.hull2, 0, 0.42, 0)
    part(g, cyl(0.05, 0.05, 1.3, 8), p.metal, 0, 1.2, 0)
    const fins = lv === 1 ? 4 : 6
    for (let k = 0; k < fins; k++) {
      const a = (k / fins) * Math.PI * 2 + Math.PI / 4
      part(g, box(0.02, 0.95, 0.5), p.radiator, Math.cos(a) * 0.3, 1.3, Math.sin(a) * 0.3, 0, -a + Math.PI / 2, 0)
    }
    part(g, cyl(0.08, 0.08, 0.06, 10), p.accent, 0, 1.88, 0)
    for (let k = 0; k < 4; k++) part(g, box(0.04, 0.3, 0.04), p.yellow, Math.cos(k * Math.PI / 2) * 0.9, 0.15, Math.sin(k * Math.PI / 2) * 0.9)
    return { g }
  },
  // Radio telescope: a dish that slowly tracks the sky
  telescope: (p, lv) => {
    const g = new THREE.Group()
    part(g, cyl(0.26, 0.36, 0.4, 12), p.hull2, 0, 0.2, 0)
    const turn = new THREE.Group()
    part(turn, box(0.14, 0.6, 0.14), p.metal, 0, 0.7, 0)
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 10; i++) { const r = (i / 10) * 0.92; pts.push(new THREE.Vector2(r, r * r * 0.38)) }
    const tilt = new THREE.Group()
    tilt.position.y = 1.02
    tilt.rotation.x = -0.6
    part(tilt, new THREE.LatheGeometry(pts, 32), p.dish)
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; part(tilt, cyl(0.008, 0.008, 0.85, 4), p.metal, Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3, Math.sin(a) * 0.72, 0, -Math.cos(a) * 0.72).castShadow = false }
    part(tilt, cyl(0.05, 0.05, 0.08, 8), p.foil, 0, 0.84, 0)
    turn.add(tilt)
    g.add(turn)
    if (lv === 2) { const d = part(g, new THREE.LatheGeometry(pts, 20), p.dish, -0.62, 0.5, -0.6, -0.5, 2.2, 0); d.scale.setScalar(0.42); part(g, cyl(0.03, 0.05, 0.5, 6), p.metal, -0.62, 0.25, -0.6) }
    return { g, apply: (c, e) => { if (c.on) turn.rotation.y += e.dt * 0.03 } }
  },
}

/** One building on its foundation of sintered regolith. */
export function buildModel(p: Pal, m: PlacedModule, low: boolean) {
  const root = new THREE.Group()
  const slab = part(root, new THREE.BoxGeometry(1.88, 0.04, 1.88), p.pad, 0, 0.012, 0)
  slab.castShadow = false
  const built = MODELS[m.id](p, m.level, low)
  built.g.position.y = 0.03
  root.add(built.g)
  if (m.level === 2) for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) part(root, new THREE.BoxGeometry(0.16, 0.012, 0.16), p.yellow, x * 0.85, 0.034, z * 0.85).castShadow = false
  root.userData.apply = built.apply
  return root
}
