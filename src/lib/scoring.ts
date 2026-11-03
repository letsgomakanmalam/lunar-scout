import type { EarthSite, FactorKey, LunarTarget, Mission } from '../data/types'

export interface FactorResult {
  key: FactorKey
  weight: number
  siteValue: number
  targetValue: number
  similarity: number
}

export interface ScanResult {
  siteId: string
  missionId: string
  asi: number | null
  confidence: number
  factors: FactorResult[]
  missing: FactorKey[]
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** 1 when values match, 0 when they are opposite ends of the 0..1 scale. */
export function factorSimilarity(siteValue: number, targetValue: number): number {
  return 1 - Math.abs(clamp01(siteValue) - clamp01(targetValue))
}

/**
 * Analog Similarity Index (0..100) for a site against a mission's lunar target.
 * Factors with no data are skipped and the remaining weights are re-normalized.
 * confidence = share of mission weight that had data.
 */
export function computeASI(site: EarthSite, target: LunarTarget, mission: Mission): ScanResult {
  const entries = Object.entries(mission.weights) as [FactorKey, number][]
  const totalWeight = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0)
  const factors: FactorResult[] = []
  const missing: FactorKey[] = []
  let usedWeight = 0
  let weighted = 0

  for (const [key, rawWeight] of entries) {
    const weight = Math.max(0, rawWeight)
    const siteValue = site.factors[key]?.value
    const targetValue = target.factors[key]
    if (siteValue == null || targetValue == null || weight === 0) {
      if (weight > 0) missing.push(key)
      continue
    }
    const similarity = factorSimilarity(siteValue, targetValue)
    factors.push({ key, weight, siteValue: clamp01(siteValue), targetValue: clamp01(targetValue), similarity })
    usedWeight += weight
    weighted += weight * similarity
  }

  const asi = usedWeight > 0 ? Math.round(Number(((100 * weighted) / usedWeight).toFixed(6))) : null
  const confidence = totalWeight > 0 ? usedWeight / totalWeight : 0
  return { siteId: site.id, missionId: mission.id, asi, confidence, factors, missing }
}

/** Stars for a certification: 0 = failed, 1–3 = passed. */
export function starsFor(asi: number, passAsi: number, probesUsed: number): number {
  if (asi < passAsi) return 0
  if (asi >= passAsi + 20 && probesUsed <= 4) return 3
  if (asi >= passAsi + 10) return 2
  return 1
}

export function strengthsAndWeaknesses(result: ScanResult) {
  const sorted = [...result.factors].sort((a, b) => b.similarity - a.similarity)
  return {
    strengths: sorted.filter(f => f.similarity >= 0.7).map(f => f.key),
    weaknesses: sorted.filter(f => f.similarity < 0.5).map(f => f.key).reverse(),
  }
}
