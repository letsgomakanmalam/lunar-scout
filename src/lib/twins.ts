/**
 * Twin finder: which places on Earth best rehearse a base or landing site on the Moon or Mars.
 *
 * No single place on Earth is the Moon. A real field campaign uses several sites, each good at
 * different things (an anorthosite crater for geology, a polar desert for cold and ice...).
 * planCampaign picks the set of k sites that together cover the most of what the target needs,
 * using the greedy maximum-coverage method (provably within 63% of the best possible set, and in
 * practice usually optimal for small k).
 */
import type { EarthSite, FactorKey, Mission, PlanetTarget, ProcessKey } from '../data/types'
import { computeASI, factorSimilarity, type ScanResult } from './scoring'

/** The target's crew profile as a scoring mission, so Twin finder scores use the same ASI formula. */
export function profileMission(t: PlanetTarget): Mission {
  return { id: `profile-${t.id}`, title: t.name, brief: '', targetId: t.id, weights: t.profile, passAsi: 0, reward: 0, equipmentTip: '' }
}

/** Processes at work at both the Earth site and the Moon or Mars site: where the analogy goes deeper than looks. */
export function sharedProcesses(site: Pick<EarthSite, 'processes'>, t: Pick<PlanetTarget, 'processes'>): ProcessKey[] {
  return (t.processes ?? []).filter(p => site.processes?.includes(p))
}

export interface TwinRow { site: EarthSite; result: ScanResult }

/** Earth sites ranked by ASI against the target's profile. Ties go to the site with more data. */
export function rankTwins(t: PlanetTarget, sites: EarthSite[]): TwinRow[] {
  const m = profileMission(t)
  return sites
    .map(site => ({ site, result: computeASI(site, t, m) }))
    .filter(r => r.result.asi != null)
    .sort((a, b) => (b.result.asi! - a.result.asi!) || (b.result.confidence - a.result.confidence))
}

export interface FactorCover { key: FactorKey; weight: number; best: number; siteId: string | null }
export interface Campaign { sites: EarthSite[]; coverage: number; factors: FactorCover[]; single: { site: EarthSite; coverage: number } | null }

/** Similarity of one site on one factor; missing data counts as no help. */
function sim(site: EarthSite, t: PlanetTarget, k: FactorKey) {
  const v = site.factors[k]?.value
  const tv = t.factors[k]
  return v == null || tv == null ? 0 : factorSimilarity(v, tv)
}

/** Share (0..1) of the profile's weight covered by the best site in the set for each factor. */
export function coverage(t: PlanetTarget, set: EarthSite[]): { value: number; factors: FactorCover[] } {
  const entries = (Object.entries(t.profile) as [FactorKey, number][]).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let got = 0
  const factors = entries.map(([key, weight]) => {
    let best = 0, siteId: string | null = null
    for (const s of set) { const v = sim(s, t, key); if (v > best) { best = v; siteId = s.id } }
    got += weight * best
    return { key, weight, best, siteId }
  })
  return { value: total ? got / total : 0, factors }
}

export function planCampaign(t: PlanetTarget, sites: EarthSite[], k = 3): Campaign {
  const chosen: EarthSite[] = []
  let cov = 0
  for (let step = 0; step < k; step++) {
    let pick: EarthSite | null = null, pickCov = cov
    for (const s of sites) {
      if (chosen.includes(s)) continue
      const c = coverage(t, [...chosen, s]).value
      if (c > pickCov + 1e-9) { pick = s; pickCov = c }
    }
    if (!pick) break
    chosen.push(pick)
    cov = pickCov
  }
  const best = rankTwins(t, sites)[0]
  return {
    sites: chosen,
    coverage: cov,
    factors: coverage(t, chosen).factors,
    single: best ? { site: best.site, coverage: coverage(t, [best.site]).value } : null,
  }
}
