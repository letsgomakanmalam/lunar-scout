import { buildEarthTexture, moonTextureSteps, type EarthTexture, type MoonTexture } from './moonTexture'

/**
 * Textures are built once per page load and shared by every globe on screen.
 * Moon generation is spread over animation frames (about 12 ms of work per frame)
 * so the title intro keeps running smoothly while the surface is being made.
 */
let moon: MoonTexture | null = null
let moonJob: Promise<MoonTexture> | null = null
let earth: EarthTexture | null = null
let earthJob: Promise<EarthTexture> | null = null

const nextFrame = () =>
  new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })

export const peekMoon = () => moon

export function loadMoon(): Promise<MoonTexture> {
  if (moon) return Promise.resolve(moon)
  if (!moonJob) {
    moonJob = (async () => {
      const steps = moonTextureSteps(1024)
      let start = performance.now()
      for (;;) {
        const s = steps.next()
        if (s.done) return (moon = s.value)
        if (performance.now() - start > 12) {
          await nextFrame()
          start = performance.now()
        }
      }
    })()
  }
  return moonJob
}

export const peekEarth = () => earth

export function loadEarth(): Promise<EarthTexture> {
  if (earth) return Promise.resolve(earth)
  if (!earthJob) earthJob = nextFrame().then(() => (earth = buildEarthTexture(256)))
  return earthJob
}
