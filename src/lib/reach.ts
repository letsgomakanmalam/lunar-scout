/**
 * Analog within reach: the best analogs on Earth are in Antarctica and the high Arctic, where most
 * teams can never go. This asks the practical question instead: starting from YOUR city, what is the
 * best place you can get to, and how much similarity does each extra kilometre of travel buy?
 *
 * It uses the same global screening scores as the Global search (lib/earthGrid), so no new data.
 * The answer is a frontier: the list of places where going further finally gets you something better.
 * Distances are straight lines over the globe, not travel time or cost.
 */
import { cellCenter, type EarthGrid } from './earthGrid'
import { distanceKm, type LatLon } from './geo'

export interface Home extends LatLon { name: string }

/** Starting points: where many student and hackathon teams are. Coordinates are city centres. */
export const HOMES: Home[] = [
  { name: 'Kuala Lumpur', lat: 3.139, lon: 101.687 },
  { name: 'Singapore', lat: 1.352, lon: 103.82 },
  { name: 'Jakarta', lat: -6.2, lon: 106.85 },
  { name: 'Bangkok', lat: 13.756, lon: 100.502 },
  { name: 'Manila', lat: 14.6, lon: 120.98 },
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
]

export interface Step { cell: number; km: number; score: number }

/** Straight-line distance from home to the centre of every land cell, km. */
export function distancesFrom(g: EarthGrid, home: LatLon): Float32Array {
  const out = new Float32Array(g.meta.land)
  for (let c = 0; c < g.meta.land; c++) out[c] = distanceKm(home, cellCenter(g, c))
  return out
}

/**
 * The reach frontier: walking outwards from home, every place that beats everything closer.
 * A new step must beat the last by `minGain` points, so the list stays short and meaningful.
 * The last step is the best place on Earth, to within half a point.
 */
export function reachFrontier(scores: Float32Array, km: Float32Array, minGain = 1): Step[] {
  const order = Array.from({ length: scores.length }, (_, i) => i).sort((a, b) => km[a] - km[b])
  const steps: Step[] = []
  let best = -1, top: Step | null = null
  for (const cell of order) {
    const score = scores[cell]
    if (!top || score > top.score) top = { cell, km: km[cell], score }
    if (score >= best + minGain) { steps.push({ cell, km: km[cell], score }); best = score }
  }
  if (top && steps.length && top.score - steps[steps.length - 1].score >= 0.5) steps.push(top)
  return steps
}

/** The best place no further than `maxKm` from home, or null if no land is that close. */
export function bestWithin(scores: Float32Array, km: Float32Array, maxKm: number): Step | null {
  let cell = -1
  for (let c = 0; c < scores.length; c++) if (km[c] <= maxKm && (cell < 0 || scores[c] > scores[cell])) cell = c
  return cell < 0 ? null : { cell, km: km[cell], score: scores[cell] }
}

/** The slider runs from 100 km to halfway round the world, with even steps in the ratio of distances. */
export const MIN_KM = 100
export const MAX_KM = 20000
export const kmOfSlider = (x: number) => Math.round(MIN_KM * Math.pow(MAX_KM / MIN_KM, Math.min(100, Math.max(0, x)) / 100) / 50) * 50
export const sliderOfKm = (km: number) => (100 * Math.log(Math.min(MAX_KM, Math.max(MIN_KM, km)) / MIN_KM)) / Math.log(MAX_KM / MIN_KM)
