/**
 * Ask why: plain-language explanations of a match, written from the numbers.
 *
 * This is a rule-based explainer, not a chatbot. Every sentence is built from a factor value, a
 * weight or a process label that is already on screen, so nothing can be made up, it gives the same
 * answer every time, and it works offline. Points are the factor's share of the 100-point Analog
 * Similarity Index: a factor "carries" weight / total weight x 100 points and "earns" that times
 * its similarity.
 */
import type { EarthSite, FactorKey, PlanetTarget } from '../data/types'
import { FACTOR_HINTS, FACTOR_LABELS, PROCESS_LABELS, WORLD_LABEL } from '../data/types'
import { computeASI, factorSimilarity } from './scoring'
import { coverage, profileMission, sharedProcesses } from './twins'

export type Tone = 'good' | 'bad' | 'info'
export interface Point { tone: Tone; title: string; text: string }
export interface Explanation {
  asi: number | null
  /** One sentence: the answer */
  verdict: string
  /** Why it matches: the factors that earn the most points */
  why: Point[]
  /** Where the analogy breaks down: the factors that lose the most points */
  whyNot: Point[]
  /** Processes, what to rehearse there, and how far to trust the data */
  notes: Point[]
}

/** What a strong factor lets a team rehearse there */
export const REHEARSE: Record<FactorKey, string> = {
  thermal: 'heaters, batteries and seals through big swings between day and night',
  aridity: 'drills and soil handling in ground with almost no water',
  roughness: 'rover driving, landing-site surveys and walking on slopes',
  basalt: 'sampling and building with volcanic rock',
  anorthosite: 'reading the pale highland rock crews will find at the lunar south pole',
  crater: 'geology traverses across crater rims, walls and ejecta',
  caves: 'cave robots and shelters under rock',
  cold: 'cold starts for machines, suits and batteries',
  isolation: 'living and working far from help',
  ice: 'ice drilling and making water from frozen ground',
  sediment: 'choosing samples in rock laid down by water',
  lowsun: 'moving and navigating in long shadows and glare',
  barren: 'navigation on bare ground with no plants to hide the rock',
  wind: 'keeping dust out of seals and off solar panels',
  life: 'life-detection instruments and keeping samples clean',
}

/** Short names for the same tests, for buttons */
export const TEST_LABEL: Record<FactorKey, string> = {
  thermal: 'Heaters and batteries', aridity: 'Dry-soil drills', roughness: 'Rover driving', basalt: 'Volcanic rock work',
  anorthosite: 'Highland geology', crater: 'Crater traverses', caves: 'Cave robots', cold: 'Cold starts', isolation: 'Crew isolation',
  ice: 'Ice drilling', sediment: 'Sample hunting', lowsun: 'Low-Sun navigation', barren: 'Bare-ground navigation', wind: 'Dust protection', life: 'Life detection',
}

const level = (v: number) => (v >= 0.85 ? 'very high' : v >= 0.6 ? 'high' : v >= 0.4 ? 'medium' : v >= 0.15 ? 'low' : 'very low')
const pts = (n: number) => { const r = Math.round(n); return `${r} point${r === 1 ? '' : 's'}` }
const list = (a: string[]) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)
const shortName = (t: PlanetTarget) => t.name.split(' (')[0]
const grade = (asi: number) => (asi >= 85 ? 'an excellent' : asi >= 70 ? 'a strong' : asi >= 55 ? 'a fair' : asi >= 40 ? 'a weak' : 'a poor')

interface Row { key: FactorKey; carries: number; earned: number; lost: number; site: number; target: number; sim: number }

/** Each profile factor's share of the 100 points, for one site. */
export function pointRows(site: EarthSite, t: PlanetTarget): { rows: Row[]; asi: number | null; missing: FactorKey[] } {
  const r = computeASI(site, t, profileMission(t))
  const used = r.factors.reduce((s, f) => s + f.weight, 0)
  const rows = r.factors.map(f => {
    const carries = used ? (100 * f.weight) / used : 0
    return { key: f.key, carries, earned: carries * f.similarity, lost: carries * (1 - f.similarity), site: f.siteValue, target: f.targetValue, sim: f.similarity }
  })
  return { rows, asi: r.asi, missing: r.missing }
}

const measurement = (site: EarthSite, k: FactorKey) => {
  const raw = site.factors[k].raw
  return raw && !/^Team estimate/.test(raw) ? ` [${raw.replace(/\.$/, '')}]` : ''
}

/** Why this Earth site is, and is not, like this Moon or Mars site. */
export function explainTwin(site: EarthSite, t: PlanetTarget): Explanation {
  const { rows, asi, missing } = pointRows(site, t)
  const name = shortName(t)
  if (asi == null || !rows.length) {
    return { asi: null, verdict: `${site.name} has no data yet for what matters at ${name}, so it cannot be compared.`, why: [], whyNot: [], notes: [] }
  }
  const strong = rows.filter(r => r.sim >= 0.7).sort((a, b) => b.earned - a.earned)
  const weak = rows.filter(r => r.sim < 0.7 && r.lost >= 1).sort((a, b) => b.lost - a.lost)

  const why = strong.slice(0, 4).map((r): Point => ({
    tone: 'good',
    title: `${FACTOR_LABELS[r.key]}: earns ${pts(r.earned)} of ${Math.round(r.carries)}`,
    text: `${site.name} rates ${level(r.site)} on this${measurement(site, r.key)}, and ${name} rates ${level(r.target)}. ${FACTOR_HINTS[r.key]}`,
  }))
  const whyNot = weak.slice(0, 3).map((r): Point => ({
    tone: 'bad',
    title: `${FACTOR_LABELS[r.key]}: loses ${pts(r.lost)}`,
    text: `${site.name} rates ${level(r.site)} on this${measurement(site, r.key)}, but ${name} rates ${level(r.target)}. ${r.site < r.target ? 'There is not enough of it here' : 'There is more of it here than there'}, so this part of the mission cannot be rehearsed well at this site.`,
  }))

  const notes: Point[] = []
  if (site.processes && t.processes) {
    const same = sharedProcesses(site, t)
    notes.push(same.length
      ? { tone: 'good', title: 'Same processes at work', text: `${list(same.map(p => PROCESS_LABELS[p].toLowerCase()))} shape both places, so the likeness goes deeper than conditions.` }
      : { tone: 'info', title: 'Alike in conditions only', text: `None of the processes that shape ${name} (${list(t.processes.map(p => PROCESS_LABELS[p].toLowerCase()))}) is at work here. The ground behaves alike, but it was made differently.` })
  }
  if (strong.length) notes.push({ tone: 'info', title: 'What to rehearse here', text: `Best used for ${list(strong.slice(0, 3).map(r => REHEARSE[r.key]))}.` })
  const estimates = rows.filter(r => site.factors[r.key].estimate).length
  const trust = [
    estimates ? `${estimates} of the ${rows.length} values used are team estimates, not measurements` : `all ${rows.length} values used are measured or computed`,
    ...(missing.length ? [`${list(missing.map(k => FACTOR_LABELS[k].toLowerCase()))} had no data and ${missing.length === 1 ? 'was' : 'were'} left out`] : []),
  ]
  notes.push({ tone: 'info', title: 'How far to trust this', text: `${trust.join('; ')}. No place on Earth copies the ${WORLD_LABEL[t.world]}'s gravity, air or radiation.`.replace(/^./, c => c.toUpperCase()) })

  const lead = strong[0], drag = weak[0]
  const verdict = `${site.name} is ${grade(asi)} match for ${name} (${asi} of 100)`
    + (lead ? `, mostly because of ${FACTOR_LABELS[lead.key].toLowerCase()}` : '')
    + (drag ? `; its biggest gap is ${FACTOR_LABELS[drag.key].toLowerCase()}.` : '; it has no serious gap in what matters here.')
  return { asi, verdict, why, whyNot, notes }
}

export interface Comparison {
  verdict: string
  /** Factors where the first site is ahead, then where the second is ahead: points of difference */
  aLeads: { key: FactorKey; points: number }[]
  bLeads: { key: FactorKey; points: number }[]
  /** Share of the target's needs covered by each alone and by both together (0..1) */
  alone: [number, number]
  together: number
  advice: string
}

/** Why one Earth site beats another for this Moon or Mars site, and whether to use both. */
export function compareTwins(a: EarthSite, b: EarthSite, t: PlanetTarget): Comparison {
  const A = pointRows(a, t), B = pointRows(b, t)
  const name = shortName(t)
  const diffs = A.rows.flatMap(ra => {
    const rb = B.rows.find(x => x.key === ra.key)
    return rb ? [{ key: ra.key, points: ra.earned - rb.earned }] : []
  })
  const aLeads = diffs.filter(d => d.points >= 1).sort((x, y) => y.points - x.points)
  const bLeads = diffs.filter(d => d.points <= -1).map(d => ({ key: d.key, points: -d.points })).sort((x, y) => y.points - x.points)
  const ca = coverage(t, [a]).value, cb = coverage(t, [b]).value, both = coverage(t, [a, b]).value
  const sa = A.asi ?? 0, sb = B.asi ?? 0
  const [win, lose, leads] = sa >= sb ? [a, b, aLeads] : [b, a, bLeads]
  const gap = Math.abs(sa - sb)
  const verdict = gap < 1
    ? `${a.name} and ${b.name} score the same for ${name} (${sa}), for different reasons.`
    : `${win.name} beats ${lose.name} for ${name} by ${pts(gap)} (${Math.max(sa, sb)} against ${Math.min(sa, sb)})${leads.length ? `, mainly on ${list(leads.slice(0, 2).map(l => FACTOR_LABELS[l.key].toLowerCase()))}` : ''}.`
  const gain = Math.round((both - Math.max(ca, cb)) * 100)
  const loserLeads = sa >= sb ? bLeads : aLeads
  const advice = gain >= 3
    ? `Use both: together they cover ${Math.round(both * 100)}% of what ${name} needs, ${gain} points more than the better one alone${loserLeads.length ? `, because ${lose.name} is stronger on ${list(loserLeads.slice(0, 2).map(l => FACTOR_LABELS[l.key].toLowerCase()))}` : ''}.`
    : `A second trip adds little: together they cover ${Math.round(both * 100)}%, about the same as ${win.name} alone. Pick ${win.name}.`
  return { verdict, aLeads, bLeads, alone: [ca, cb], together: both, advice }
}

/** The tests that make sense for a Moon or Mars site: conditions it really has, most important first. */
export function testsFor(t: PlanetTarget): FactorKey[] {
  return (Object.keys(t.factors) as FactorKey[])
    .filter(k => (t.factors[k] ?? 0) >= 0.5)
    .sort((a, b) => (t.profile[b] ?? 0) - (t.profile[a] ?? 0) || (t.factors[b] ?? 0) - (t.factors[a] ?? 0))
}

export interface TestAnswer { key: FactorKey; picks: { site: EarthSite; sim: number; asi: number }[]; text: string }

/** Where on Earth to rehearse one kind of test for this site: closest on that factor, then best overall. */
export function whereToTest(t: PlanetTarget, sites: EarthSite[], key: FactorKey, n = 3): TestAnswer {
  const tv = t.factors[key]
  const name = shortName(t)
  if (tv == null) return { key, picks: [], text: `${FACTOR_LABELS[key]} is not part of what ${name} is like, so there is nothing to rehearse for it.` }
  const m = profileMission(t)
  const picks = sites
    .filter(s => s.factors[key]?.value != null)
    .map(s => ({ site: s, sim: factorSimilarity(s.factors[key].value!, tv), asi: computeASI(s, t, m).asi ?? 0 }))
    .sort((a, b) => b.sim - a.sim || b.asi - a.asi)
    .slice(0, n)
  if (!picks.length) return { key, picks, text: `No site has data on ${FACTOR_LABELS[key].toLowerCase()} yet.` }
  const [first, ...rest] = picks
  const v = first.site.factors[key].value!
  const text = `To rehearse ${REHEARSE[key]} for ${name}, go to ${first.site.name}, ${first.site.country}. It rates ${level(v)} on ${FACTOR_LABELS[key].toLowerCase()}${measurement(first.site, key)}, where ${name} rates ${level(tv)}: a ${Math.round(first.sim * 100)}% match on this one thing${first.site.factors[key].estimate && !/estimate/i.test(first.site.factors[key].raw) ? ' (team estimate)' : ''}. As a whole twin it scores ${first.asi}.`
    + (rest.length ? ` Next best: ${list(rest.map(p => `${p.site.name} (${Math.round(p.sim * 100)}%)`))}.` : '')
  return { key, picks, text }
}
