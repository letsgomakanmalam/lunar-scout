/**
 * Astronauts and a rover for the 3D base. Where they go comes from lib/baseLife (plain, tested
 * functions); this file builds the low-poly figures and animates them each frame.
 */
import * as THREE from 'three'
import { GRID_SIZE, type BaseGrid } from '../lib/base'
import { HALF, LOOP_LENGTH, TILE, cellCorners, cornerXZ, crewCount, homeCells, loopPoint, nearestOnLoop, roverPlan, route, workCells, type Corner } from '../lib/baseLife'

/** From the mission simulation: the hour, and whether it is dark or life support has failed. */
export interface LifeInfo { hour?: number; dark: boolean; failed?: boolean; /** How many of the crew are outside right now (from the crew schedule) */ outside?: number }
/** Height of the ground the crew walk on */
const GROUND = 0.02

/** Astronauts are drawn 35% larger than life so they read clearly from the default camera */
const CREW_SCALE = 1.35
const STRIPES = ['#e4572e', '#3a86ff', '#ffbe0b', '#2ec4b6', '#9b5de5', '#f15bb5', '#00bbf9', '#8ac926']
const cellCentre = (i: number) => ({ x: (i % GRID_SIZE) * TILE - HALF + TILE / 2, z: Math.floor(i / GRID_SIZE) * TILE - HALF + TILE / 2 })

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  parent.add(m)
  return m
}

interface Mats { suit: THREE.Material; pack: THREE.Material; boot: THREE.Material; visor: THREE.Material; metal: THREE.Material; cabin: THREE.Material; glass: THREE.Material; panel: THREE.Material; tire: THREE.Material; headlight: THREE.MeshStandardMaterial }

/** A suited astronaut, about 1.8 m tall at the scene's scale, facing +z. */
function astronaut(m: Mats, stripe: THREE.Material, lamp: THREE.MeshStandardMaterial) {
  const g = new THREE.Group()
  const limb = (x: number, y: number, w: number, h: number, d: number, extra?: (p: THREE.Group) => void) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, y, 0)
    mesh(new THREE.BoxGeometry(w, h, d), m.suit, pivot, 0, -h / 2, 0)
    extra?.(pivot)
    g.add(pivot)
    return pivot
  }
  const legL = limb(-0.05, 0.2, 0.075, 0.2, 0.085, p => mesh(new THREE.BoxGeometry(0.085, 0.045, 0.11), m.boot, p, 0, -0.19, 0.012))
  const legR = limb(0.05, 0.2, 0.075, 0.2, 0.085, p => mesh(new THREE.BoxGeometry(0.085, 0.045, 0.11), m.boot, p, 0, -0.19, 0.012))
  mesh(new THREE.BoxGeometry(0.2, 0.19, 0.13), m.suit, g, 0, 0.29, 0)
  mesh(new THREE.BoxGeometry(0.17, 0.21, 0.09), m.pack, g, 0, 0.3, -0.105) // life-support backpack
  mesh(new THREE.BoxGeometry(0.205, 0.03, 0.135), stripe, g, 0, 0.33, 0) // crew stripe, one colour each
  const armL = limb(-0.13, 0.37, 0.06, 0.17, 0.07, p => mesh(new THREE.BoxGeometry(0.064, 0.03, 0.074), stripe, p, 0, -0.03, 0))
  const armR = limb(0.13, 0.37, 0.06, 0.17, 0.07, p => mesh(new THREE.BoxGeometry(0.064, 0.03, 0.074), stripe, p, 0, -0.03, 0))
  mesh(new THREE.SphereGeometry(0.085, 14, 10), m.suit, g, 0, 0.47, 0)
  mesh(new THREE.SphereGeometry(0.072, 14, 10), m.visor, g, 0, 0.465, 0.03).scale.set(1, 0.82, 0.62) // gold sun visor
  mesh(new THREE.BoxGeometry(0.03, 0.022, 0.03), lamp, g, 0.065, 0.535, 0.045) // helmet lamp
  return { g, legL, legR, armL, armR }
}

/** A pressurized rover, about 1.3 units long, facing +x. */
function roverModel(m: Mats) {
  const g = new THREE.Group()
  mesh(new THREE.BoxGeometry(1.25, 0.1, 0.62), m.metal, g, 0, 0.21, 0)
  mesh(new THREE.BoxGeometry(0.88, 0.36, 0.56), m.cabin, g, -0.08, 0.43, 0)
  mesh(new THREE.BoxGeometry(0.3, 0.24, 0.5), m.cabin, g, 0.44, 0.37, 0)
  mesh(new THREE.BoxGeometry(0.02, 0.13, 0.42), m.glass, g, 0.37, 0.53, 0) // windscreen
  for (const z of [-0.281, 0.281]) mesh(new THREE.BoxGeometry(0.5, 0.11, 0.01), m.glass, g, -0.05, 0.5, z) // side windows
  mesh(new THREE.BoxGeometry(0.66, 0.02, 0.5), m.panel, g, -0.12, 0.62, 0) // solar panel on the roof
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), m.metal, g, -0.42, 0.74, 0.18) // antenna
  mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.metal, g, -0.42, 0.86, 0.18)
  for (const z of [-0.15, 0.15]) mesh(new THREE.BoxGeometry(0.03, 0.05, 0.08), m.headlight, g, 0.6, 0.33, z)
  const wheels: THREE.Mesh[] = []
  const wheelGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.11, 14).rotateX(Math.PI / 2) // axle along z
  for (const x of [-0.42, 0, 0.42]) for (const z of [-0.36, 0.36]) wheels.push(mesh(wheelGeo, m.tire, g, x, 0.14, z))
  return { g, wheels }
}

interface Walker {
  obj: THREE.Group
  parts: ReturnType<typeof astronaut>
  lamp: THREE.MeshStandardMaterial
  at: Corner
  pos: { x: number; z: number }
  path: Corner[]
  mode: 'walk' | 'work' | 'home' | 'inside'
  until: number
  target: number
  phase: number
  shown: number
}

export function createBaseLife(scene: THREE.Scene, opts: { mars: boolean }) {
  const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra })
  const dust = opts.mars ? '#c9a58c' : '#e9e7e1' // suits pick up the local dust
  const m: Mats = {
    suit: std(dust), pack: std('#d8d5cb'), boot: std('#585c63'), visor: std('#d4a12a', { metalness: 0.85, roughness: 0.25, emissive: '#3a2800', emissiveIntensity: 0.3 }),
    metal: std('#8d939c', { metalness: 0.6, roughness: 0.4 }), cabin: std('#eceae4'), glass: std('#1f2a3a', { metalness: 0.3, roughness: 0.15 }),
    panel: std('#1d3b6e', { metalness: 0.4, roughness: 0.3 }), tire: std('#3a3d42', { roughness: 0.9 }),
    headlight: std('#fff7d6', { emissive: '#fff2c0', emissiveIntensity: 0 }),
  }
  const stripeMats = STRIPES.map(c => std(c))
  const speed = opts.mars ? 0.65 : 0.5 // the Moon's low gravity: slower, bouncing steps
  const crew: Walker[] = []
  let grid: BaseGrid = []
  let rover: { obj: THREE.Group; wheels: THREE.Mesh[]; s: number; home: number } | null = null
  let last = performance.now()

  const pickCorner = (cells: number[]) => {
    const cs = cellCorners(cells[Math.floor(Math.random() * cells.length)])
    return cs[Math.floor(Math.random() * cs.length)]
  }
  const nearestHome = (w: Walker): Corner | null => {
    let best: Corner | null = null, bestD = Infinity
    for (const i of homeCells(grid)) for (const c of cellCorners(i)) {
      const d = Math.abs(c[0] - w.at[0]) + Math.abs(c[1] - w.at[1])
      if (d < bestD) { bestD = d; best = c }
    }
    return best
  }
  /** Keep walking to the next corner already under way, then follow the new route. */
  const goTo = (w: Walker, goal: Corner) => {
    const from = w.path.length ? w.path[0] : w.at
    w.path = w.path.length ? [w.path[0], ...route(from, goal)] : route(from, goal)
  }
  const plan = (w: Walker, now: number) => {
    const cells = workCells(grid).filter(i => i !== w.target)
    if (!cells.length) { w.mode = 'work'; w.until = now + 3000; return }
    const target = cells[Math.floor(Math.random() * cells.length)]
    const cs = cellCorners(target)
    w.target = target
    goTo(w, cs[Math.floor(Math.random() * cs.length)])
    w.mode = 'walk'
  }

  function sync(g: BaseGrid) {
    grid = g
    const n = crewCount(g), homes = homeCells(g)
    while (crew.length > n) { const w = crew.pop()!; scene.remove(w.obj); w.obj.traverse(o => (o as THREE.Mesh).geometry?.dispose()); w.lamp.dispose() }
    while (crew.length < n && homes.length) {
      const lamp = std('#fff7d6', { emissive: '#fff2c0', emissiveIntensity: 0 })
      const parts = astronaut(m, stripeMats[crew.length % stripeMats.length], lamp)
      const at = pickCorner(homes)
      const p = cornerXZ(at)
      parts.g.position.set(p.x, GROUND, p.z)
      parts.g.scale.setScalar(0.001)
      scene.add(parts.g)
      crew.push({ obj: parts.g, parts, lamp, at, pos: { ...p }, path: [], mode: 'work', until: performance.now() + Math.random() * 2500, target: -1, phase: Math.random() * 6, shown: 0 })
    }
    const garage = g.findIndex(c => c?.id === 'rover')
    if (garage < 0 && rover) { scene.remove(rover.obj); rover.obj.traverse(o => (o as THREE.Mesh).geometry?.dispose()); rover = null }
    if (garage >= 0) {
      const c = cellCentre(garage)
      const home = nearestOnLoop(c.x, c.z)
      if (!rover) {
        const r = roverModel(m)
        scene.add(r.g)
        rover = { obj: r.g, wheels: r.wheels, s: home, home }
      } else rover.home = home
    }
  }

  function step(w: Walker, dt: number, now: number, t: number, stayIn: boolean, night: boolean) {
    if (stayIn && w.mode !== 'inside' && w.mode !== 'home') {
      const h = nearestHome(w)
      if (h) { goTo(w, h); w.mode = 'home' }
    }
    if (!stayIn && w.mode === 'inside') { w.mode = 'work'; w.until = now + 300 + Math.random() * 1500 }
    if (w.mode === 'work' && now > w.until && !stayIn) plan(w, now)

    let moving = false
    if ((w.mode === 'walk' || w.mode === 'home') && w.path.length) {
      const next = cornerXZ(w.path[0])
      const dx = next.x - w.pos.x, dz = next.z - w.pos.z, d = Math.hypot(dx, dz), stepLen = speed * dt
      if (d <= stepLen) { w.pos = next; w.at = w.path.shift()! } else { w.pos.x += (dx / d) * stepLen; w.pos.z += (dz / d) * stepLen }
      if (d > 1e-4) w.obj.rotation.y = Math.atan2(dx, dz)
      moving = true
    } else if (w.mode === 'walk') { w.mode = 'work'; w.until = now + 2000 + Math.random() * 4000 }
    else if (w.mode === 'home') w.mode = 'inside'

    // Face the module being worked on
    if (w.mode === 'work' && w.target >= 0) {
      const c = cellCentre(w.target)
      w.obj.rotation.y = Math.atan2(c.x - w.pos.x, c.z - w.pos.z)
    }
    w.shown += ((w.mode === 'inside' ? 0 : 1) - w.shown) * Math.min(1, dt * 5)
    w.obj.visible = w.shown > 0.02
    w.obj.scale.setScalar(Math.max(0.001, w.shown * CREW_SCALE))

    const P = w.parts
    if (moving) {
      w.phase += dt * (opts.mars ? 6.5 : 4.6)
      const s = Math.sin(w.phase)
      if (opts.mars) {
        w.obj.position.y = GROUND + Math.abs(s) * 0.012
        P.legL.rotation.x = s * 0.55; P.legR.rotation.x = -s * 0.55
        P.armL.rotation.x = -s * 0.45; P.armR.rotation.x = s * 0.45
      } else {
        // the lunar "bunny hop": both legs together, a slow float between steps
        w.obj.position.y = GROUND + Math.abs(Math.sin(w.phase * 0.5)) * 0.075
        P.legL.rotation.x = P.legR.rotation.x = Math.sin(w.phase) * 0.28
        P.armL.rotation.x = P.armR.rotation.x = -0.25 + Math.sin(w.phase) * 0.12
      }
    } else {
      w.obj.position.y = GROUND
      P.legL.rotation.x = P.legR.rotation.x = 0
      const work = w.mode === 'work'
      P.armL.rotation.x = 0
      P.armR.rotation.x = work ? -1.05 + Math.sin(t * 3 + w.phase) * 0.18 : 0 // reaching into the module
    }
    w.obj.position.x = w.pos.x
    w.obj.position.z = w.pos.z
    w.lamp.emissiveIntensity = night ? 2 : 0
  }

  function update(now: number, info: LifeInfo | null) {
    // Real time even at a few frames a second; the cap only stops a jump after the tab was hidden
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000))
    last = now
    const t = now / 1000
    const stayIn = !!info && info.outside === undefined && (info.dark || !!info.failed)
    crew.forEach((w, i) => step(w, dt, now, t, info?.outside !== undefined ? i >= info.outside : stayIn, !!info?.dark))
    if (!rover) return
    const planNow = roverPlan({ hour: info?.hour, seconds: t, dark: info?.dark, failed: info?.failed, home: rover.home })
    // Always forward along the loop; in the simulation it can hurry to catch up when the timeline jumps
    const ahead = (((planNow.s - rover.s) % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH
    const moved = info?.hour === undefined ? (ahead < LOOP_LENGTH / 2 ? ahead : 0) : Math.min(ahead, 18 * dt)
    if (info?.hour === undefined && ahead >= LOOP_LENGTH / 2) rover.s = planNow.s
    else rover.s += moved
    const p = loopPoint(rover.s)
    rover.obj.position.set(p.x, 0, p.z)
    rover.obj.rotation.y = -p.heading
    for (const wh of rover.wheels) wh.rotation.z -= moved / 0.14
    m.headlight.emissiveIntensity = info?.dark && (planNow.driving || moved > 0.001) ? 2.2 : info?.dark ? 0.6 : 0
  }

  const freeGeometry = (o: THREE.Object3D) => o.traverse(n => (n as THREE.Mesh).geometry?.dispose())
  function dispose() {
    for (const w of crew) { scene.remove(w.obj); freeGeometry(w.obj); w.lamp.dispose() }
    crew.length = 0
    if (rover) { scene.remove(rover.obj); freeGeometry(rover.obj) }
    rover = null
    for (const mat of [...Object.values(m), ...stripeMats]) (mat as THREE.Material).dispose()
  }

  return { sync, update, dispose }
}
