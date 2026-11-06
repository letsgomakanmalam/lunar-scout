import { earthTextureSteps, moonTextureSteps, type EarthTexture, type MoonTexture } from './moonTexture'
import { marsTextureSteps, type MarsTexture } from './marsTexture'
import { runStepsAsync } from './globe'

/**
 * Textures are built once per page load and shared by every globe on screen.
 * Moon generation is spread over animation frames (about 12 ms of work per frame)
 * so the title intro keeps running smoothly while the surface is being made.
 */
let moon: MoonTexture | null = null
let moonDone = 0
let moonJob: Promise<MoonTexture> | null = null
let earth: EarthTexture | null = null
let earthJob: Promise<EarthTexture> | null = null

const nextFrame = () =>
  new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })

export const peekMoon = () => moon
/** How far the Moon's surface is through being generated, 0 to 1. */
export const moonProgress = () => (moon ? 1 : moonDone)

export function loadMoon(): Promise<MoonTexture> {
  if (moon) return Promise.resolve(moon)
  if (!moonJob) {
    moonJob = (async () => {
      const steps = moonTextureSteps(1024)
      let start = performance.now()
      for (;;) {
        const s = steps.next()
        if (s.done) return (moon = s.value)
        moonDone = s.value
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
  if (!earthJob) earthJob = runStepsAsync(earthTextureSteps(512), () => false, 8).then(t => (earth = t!))
  return earthJob
}

let mars: MarsTexture | null = null
let marsJob: Promise<MarsTexture> | null = null

export const peekMars = () => mars

/** Mars is only built when a Mars view first appears, in small slices so the page stays smooth. */
export function loadMars(): Promise<MarsTexture> {
  if (mars) return Promise.resolve(mars)
  if (!marsJob) marsJob = runStepsAsync(marsTextureSteps(768), () => false, 10).then(t => (mars = t!))
  return marsJob
}
