import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EarthSite, ModuleId } from './data/types'
import { MODULES, moduleById } from './data/modules'
import { MISSIONS, missionById, worldOfMission } from './data/missions'
import { TARGETS, targetById } from './data/targets'
import { EARTH_SITES } from './data/earthSites'
import { computeASI, starsFor } from './lib/scoring'
import { baseScore, emptyGrid, ENERGY_BASE_CAP, energyCap, energyCost, energyRegenMs, GOAL_REWARD, goalsReached, moduleCost, settleEnergy, type BaseGrid } from './lib/base'
import { QUESTS, questById, questDone, techFor, type QuestCtx } from './data/quests'
import { TUTORIAL, type TutEvent } from './data/tutorial'
import type { LatLon, Units } from './lib/geo'

export type MapBase = 'live' | 'satellite' | 'map' | 'blue' | 'daily'
export interface MapPrefs { base: MapBase; labels: boolean; dayNight: boolean; sky: boolean; units: Units }
const DEFAULT_MAP: MapPrefs = { base: 'live', labels: true, dayNight: true, sky: true, units: 'km' }

export type Screen = 'title' | 'explore' | 'twins' | 'land' | 'build' | 'missions' | 'journal' | 'dashboard' | 'about'

export interface JournalEntry { id: string; date: string; title: string; text: string; auto: boolean }
export interface MissionRecord { stars: number; siteId: string; asi: number }
export interface LeaderEntry { name: string; score: number; date: string }

const PROBES_PER_MISSION = 8

export interface BuildResult { ok: boolean; points?: number; goal?: number; reason?: 'no-landing' | 'taken' | 'locked' | 'energy' | 'rp'; need?: number }

interface GameState {
  screen: Screen
  tutorialDone: boolean
  tutorialStep: number
  activeMissionId: string
  probesUsed: Record<string, number>
  scanned: Record<string, string[]> // missionId -> siteIds
  selectedSiteId: string | null
  completed: Record<string, MissionRecord>
  researchPoints: number
  unlocked: ModuleId[]
  landingId: string | null
  grid: BaseGrid
  /** Energy to build with, as of energyAt (see settleEnergy) */
  energy: number
  energyAt: number
  /** Quests whose reward has been claimed */
  claimed: string[]
  /** Base score targets reached so far */
  goals: number
  journal: JournalEntry[]
  leaderboard: LeaderEntry[]
  muted: boolean
  music: boolean
  tutorialFlags: TutEvent[]
  mapPrefs: MapPrefs
  /** How the 3D base looks: on the Moon, or a cosy teal sea */
  baseTheme: 'moon' | 'cosy'
  /** From the browser's location service. Never saved. */
  myLocation: LatLon | null
  /** Places the player characterized with a live field probe */
  discoveries: EarthSite[]
  /** Judge and teacher mode: every mission open */
  allOpen: boolean
  /** Twin finder: the Moon or Mars site being looked at */
  twinTargetId: string
  /** A spot the Global search asked Explore to probe live. Never saved. */
  pendingProbe: { lat: number; lon: number; note?: string } | null

  go: (s: Screen) => void
  toggleMuted: () => void
  toggleMusic: () => void
  setMapPrefs: (p: Partial<MapPrefs>) => void
  setBaseTheme: (t: 'moon' | 'cosy') => void
  setMyLocation: (p: LatLon | null) => void
  addDiscovery: (site: EarthSite) => void
  removeDiscovery: (id: string) => void
  setAllOpen: (v: boolean) => void
  setTwinTarget: (id: string) => void
  setPendingProbe: (p: { lat: number; lon: number; note?: string } | null) => void
  newGame: () => void
  startTutorial: () => void
  nextTutorialStep: () => void
  tutorialEvent: (e: TutEvent) => void
  setTutorialStep: (n: number) => void
  finishTutorial: () => void
  setMission: (id: string) => void
  selectSite: (id: string | null) => void
  scan: (siteId: string) => 'ok' | 'no-probes' | 'already'
  certify: (siteId: string) => { stars: number; asi: number; reward: number; unlocked?: ModuleId }
  chooseLanding: (id: string) => void
  place: (cell: number, id: ModuleId) => BuildResult
  upgrade: (cell: number) => BuildResult
  remove: (cell: number) => void
  /** Adds the energy that has refilled since it was last saved */
  settle: () => void
  claimQuest: (id: string) => boolean
  research: (id: ModuleId) => boolean
  addNote: (title: string, text: string) => void
  deleteNote: (id: string) => void
  saveScore: (name: string) => void
  resetAll: () => void
}

const initial = {
  screen: 'title' as Screen,
  tutorialDone: false,
  tutorialStep: 0,
  activeMissionId: 'tutorial',
  probesUsed: {},
  scanned: {},
  selectedSiteId: null,
  completed: {},
  researchPoints: 0,
  unlocked: MODULES.filter(m => m.startsUnlocked).map(m => m.id),
  landingId: null,
  grid: emptyGrid(),
  energy: ENERGY_BASE_CAP,
  energyAt: 0,
  claimed: [] as string[],
  goals: 0,
  journal: [] as JournalEntry[],
  leaderboard: [] as LeaderEntry[],
  muted: false,
  music: true,
  tutorialFlags: [] as TutEvent[],
  mapPrefs: DEFAULT_MAP,
  baseTheme: 'moon' as 'moon' | 'cosy',
  myLocation: null as LatLon | null,
  discoveries: [] as EarthSite[],
  allOpen: false,
  twinTargetId: 'shackleton',
  pendingProbe: null as { lat: number; lon: number; note?: string } | null,
}

const now = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 10)

export const totalStars = (completed: Record<string, MissionRecord>) =>
  Object.values(completed).reduce((n, r) => n + r.stars, 0)

/** Every site the player can scan: the curated list plus their own live discoveries. */
export const allSites = (s: Pick<GameState, 'discoveries'>): EarthSite[] => [...EARTH_SITES, ...s.discoveries]
export const siteById = (s: Pick<GameState, 'discoveries'>, id: string | null) => (id ? allSites(s).find(x => x.id === id) ?? null : null)

/** What the quests look at, from the saved game. */
export const questContext = (s: Pick<GameState, 'landingId' | 'grid' | 'scanned' | 'completed'> & Partial<Pick<GameState, 'discoveries'>>): QuestCtx => {
  const done = Object.keys(s.completed).filter(id => MISSIONS.some(m => m.id === id))
  return {
    landingId: s.landingId,
    landing: s.landingId ? TARGETS.find(t => t.id === s.landingId) : undefined,
    grid: s.grid,
    scannedCount: new Set(Object.values(s.scanned).flat()).size,
    missionsDone: done,
    stars: totalStars(s.completed),
    discoveries: s.discoveries?.length ?? 0,
    worldsDone: new Set(done.map(id => worldOfMission(missionById(id)))).size,
  }
}

/** Energy right now, including what has refilled since it was saved. */
export const energyNow = (s: Pick<GameState, 'energy' | 'energyAt' | 'grid'>, now = Date.now()) =>
  settleEnergy(s.energy, s.energyAt, now, energyCap(s.grid), energyRegenMs(s.grid))

/** Quests finished but not yet claimed. */
export const claimableQuests = (s: Pick<GameState, 'landingId' | 'grid' | 'scanned' | 'completed' | 'claimed'> & Partial<Pick<GameState, 'discoveries'>>) => {
  const ctx = questContext(s)
  return QUESTS.filter(q => !s.claimed.includes(q.id) && questDone(q, ctx))
}

/**
 * Two campaigns. Moon: the tutorial and first mission are open, then one more per Moon mission passed.
 * Mars: opens after any mission is passed, then one more per Mars mission passed. Judge mode opens all.
 */
export const missionUnlocked = (id: string, completed: Record<string, MissionRecord>, allOpen = false) => {
  if (allOpen) return true
  const m = MISSIONS.find(x => x.id === id)
  if (!m) return false
  const world = worldOfMission(m)
  const track = MISSIONS.filter(x => worldOfMission(x) === world)
  const idx = track.findIndex(x => x.id === id)
  const done = track.filter(x => completed[x.id]).length
  if (world === 'moon') return idx <= 1 || done >= idx - 1
  return idx === 0 ? Object.keys(completed).length > 0 : done >= idx
}

/** Missions still to pass before this one opens (for the lock note). */
export const missionsToOpen = (id: string, completed: Record<string, MissionRecord>) => {
  const m = MISSIONS.find(x => x.id === id)
  if (!m) return 0
  const world = worldOfMission(m)
  const track = MISSIONS.filter(x => worldOfMission(x) === world)
  const idx = track.findIndex(x => x.id === id)
  const done = track.filter(x => completed[x.id]).length
  if (world === 'moon') return Math.max(0, idx - 1 - done)
  return idx === 0 ? (Object.keys(completed).length ? 0 : 1) : Math.max(0, idx - done)
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,

      go: screen => set({ screen }),
      toggleMuted: () => set({ muted: !get().muted }),
      toggleMusic: () => set({ music: !get().music }),
      setBaseTheme: baseTheme => set({ baseTheme }),
      setMapPrefs: p => set({ mapPrefs: { ...DEFAULT_MAP, ...get().mapPrefs, ...p } }),
      setMyLocation: myLocation => set({ myLocation }),
      addDiscovery: site => {
        const s = get()
        set({
          discoveries: [...s.discoveries.filter(d => d.id !== site.id), site],
          journal: [{ id: uid(), date: now(), auto: true, title: `Field probe: ${site.name.replace(/^Field probe:\s*/, '')}`, text: site.description }, ...s.journal],
        })
      },
      removeDiscovery: id => {
        const s = get()
        set({ discoveries: s.discoveries.filter(d => d.id !== id), selectedSiteId: s.selectedSiteId === id ? null : s.selectedSiteId })
      },
      setAllOpen: allOpen => set({ allOpen }),
      setTwinTarget: twinTargetId => set({ twinTargetId }),
      setPendingProbe: pendingProbe => set({ pendingProbe }),
      // Start over: progress is cleared, settings and the leaderboard stay, and the guided tutorial begins.
      newGame: () => { get().resetAll(); get().startTutorial() },

      // Guided tutorial. Flags remember what the player has already done, so steps they
      // finished early are skipped; a returning player is never asked to move their base.
      startTutorial: () => set({
        tutorialDone: false, tutorialStep: 0, tutorialFlags: get().landingId ? ['landed'] : [],
        activeMissionId: 'tutorial', selectedSiteId: null, screen: 'explore',
      }),
      nextTutorialStep: () => {
        const { tutorialStep, tutorialFlags } = get()
        let i = tutorialStep + 1
        while (i < TUTORIAL.length && TUTORIAL[i].waitFor && tutorialFlags.includes(TUTORIAL[i].waitFor!)) i++
        if (i >= TUTORIAL.length) set({ tutorialDone: true, tutorialStep: 0 })
        else set({ tutorialStep: i })
      },
      tutorialEvent: e => {
        const s = get()
        if (s.tutorialDone) return
        if (!s.tutorialFlags.includes(e)) set({ tutorialFlags: [...s.tutorialFlags, e] })
        if (TUTORIAL[s.tutorialStep]?.waitFor === e) get().nextTutorialStep()
      },
      setTutorialStep: tutorialStep => set({ tutorialStep }),
      finishTutorial: () => set({ tutorialDone: true, tutorialStep: 0 }),
      setMission: activeMissionId => set({ activeMissionId, selectedSiteId: null, screen: 'explore' }),
      selectSite: selectedSiteId => set({ selectedSiteId }),

      scan: siteId => {
        const { activeMissionId, probesUsed, scanned } = get()
        const list = scanned[activeMissionId] ?? []
        if (list.includes(siteId)) return 'already'
        const used = probesUsed[activeMissionId] ?? 0
        if (used >= PROBES_PER_MISSION) return 'no-probes'
        set({
          probesUsed: { ...probesUsed, [activeMissionId]: used + 1 },
          scanned: { ...scanned, [activeMissionId]: [...list, siteId] },
        })
        return 'ok'
      },

      certify: siteId => {
        const s = get()
        const mission = missionById(s.activeMissionId)
        const site = siteById(s, siteId)!
        const result = computeASI(site, targetById(mission.targetId), mission)
        const asi = result.asi ?? 0
        const stars = starsFor(asi, mission.passAsi, s.probesUsed[mission.id] ?? 0)
        const prev = s.completed[mission.id]
        const firstPass = stars > 0 && !prev
        const improved = stars > (prev?.stars ?? 0)
        const reward = stars > 0 ? (firstPass ? mission.reward * stars : improved ? 30 * (stars - (prev?.stars ?? 0)) : 0) : 0
        const unlocked = firstPass && mission.unlocks && !s.unlocked.includes(mission.unlocks) ? mission.unlocks : undefined
        const entry: JournalEntry = {
          id: uid(), date: now(), auto: true,
          title: `${stars > 0 ? 'Certified' : 'Provisional'}: ${site.name}`,
          text: `Mission "${mission.title}". ASI ${asi} (pass ${mission.passAsi}), ${stars} star${stars === 1 ? '' : 's'}. Data confidence ${Math.round(result.confidence * 100)}%.`,
        }
        set({
          completed: improved ? { ...s.completed, [mission.id]: { stars, siteId, asi } } : s.completed,
          researchPoints: s.researchPoints + reward,
          unlocked: unlocked ? [...s.unlocked, unlocked] : s.unlocked,
          journal: [entry, ...s.journal],
        })
        return { stars, asi, reward, unlocked }
      },

      chooseLanding: id => set({ landingId: id, grid: emptyGrid(), screen: 'build',
        journal: [{ id: uid(), date: now(), auto: true, title: `Landing site chosen: ${targetById(id).name}`, text: targetById(id).landing?.perks.join(' ') ?? '' }, ...get().journal] }),

      place: (cell, id) => {
        const s = get()
        if (!s.landingId) return { ok: false, reason: 'no-landing' }
        if (s.grid[cell]) return { ok: false, reason: 'taken' }
        if (!s.unlocked.includes(id)) return { ok: false, reason: 'locked' }
        const cost = energyCost(id, targetById(s.landingId))
        const e = energyNow(s)
        if (e.energy < cost) return { ok: false, reason: 'energy', need: cost }
        const grid = [...s.grid]
        grid[cell] = { id, level: 1 }
        const before = baseScore(s.grid), after = baseScore(grid)
        const reached = goalsReached(after), fresh = Math.max(0, reached - s.goals)
        set({
          grid,
          energy: e.energy - cost + fresh * GOAL_REWARD.energy,
          energyAt: e.next === null ? Date.now() : e.at, // a full battery starts refilling from now
          goals: Math.max(s.goals, reached),
          researchPoints: s.researchPoints + fresh * GOAL_REWARD.rp,
        })
        return { ok: true, points: after - before, goal: fresh ? reached : undefined }
      },

      upgrade: cell => {
        const s = get()
        const m = s.grid[cell]
        if (!m || m.level === 2 || !s.landingId) return { ok: false }
        const cost = moduleCost(m.id, targetById(s.landingId), true)
        if (s.researchPoints < cost) return { ok: false, reason: 'rp', need: cost }
        const grid = [...s.grid]
        grid[cell] = { ...m, level: 2 }
        const before = baseScore(s.grid), after = baseScore(grid)
        const reached = goalsReached(after), fresh = Math.max(0, reached - s.goals)
        const e = energyNow(s)
        set({
          grid,
          researchPoints: s.researchPoints - cost + fresh * GOAL_REWARD.rp,
          goals: Math.max(s.goals, reached),
          energy: e.energy + fresh * GOAL_REWARD.energy,
          energyAt: e.at,
        })
        return { ok: true, points: after - before, goal: fresh ? reached : undefined }
      },

      remove: cell => {
        const s = get()
        const m = s.grid[cell]
        if (!m || !s.landingId) return
        const e = energyNow(s)
        const grid = [...s.grid]
        grid[cell] = null
        set({ grid, energy: e.energy + Math.floor(energyCost(m.id, targetById(s.landingId)) / 2), energyAt: e.at })
      },

      settle: () => {
        const s = get()
        const e = energyNow(s)
        if (e.energy !== s.energy) set({ energy: e.energy, energyAt: e.at })
      },

      claimQuest: id => {
        const s = get()
        const q = questById(id)
        if (!q || s.claimed.includes(id) || !questDone(q, questContext(s))) return false
        const e = energyNow(s)
        set({ claimed: [...s.claimed, id], researchPoints: s.researchPoints + (q.reward.rp ?? 0), energy: e.energy + (q.reward.energy ?? 0), energyAt: e.at })
        return true
      },

      research: id => {
        const s = get()
        const t = techFor(id)
        if (!t || s.unlocked.includes(id) || !t.requires.every(q => s.claimed.includes(q)) || s.researchPoints < t.rp) return false
        const m = moduleById(id)
        set({
          unlocked: [...s.unlocked, id],
          researchPoints: s.researchPoints - t.rp,
          journal: [{ id: uid(), date: now(), auto: true, title: `Technology unlocked: ${m.name}`, text: m.description }, ...s.journal],
        })
        return true
      },

      addNote: (title, text) => set({ journal: [{ id: uid(), date: now(), title, text, auto: false }, ...get().journal] }),
      deleteNote: id => set({ journal: get().journal.filter(j => j.id !== id) }),

      saveScore: name => {
        const s = get()
        const score = totalStars(s.completed) * 100 + s.grid.filter(Boolean).length * 25 + s.researchPoints
        const leaderboard = [...s.leaderboard, { name: name.slice(0, 24), score, date: now() }]
          .sort((a, b) => b.score - a.score).slice(0, 10)
        set({ leaderboard })
      },

      // Discoveries are real data the player gathered, so a new game keeps them (like the leaderboard).
      resetAll: () => set({ ...initial, grid: emptyGrid(), leaderboard: get().leaderboard, tutorialDone: get().tutorialDone, muted: get().muted, music: get().music, mapPrefs: get().mapPrefs, baseTheme: get().baseTheme, myLocation: get().myLocation, discoveries: get().discoveries, allOpen: get().allOpen }),
    }),
    {
      name: 'lunar-scout-v1',
      version: 2,
      // Saves from before Mars: the Apollo 17 valley was the easy landing site, now the flat Mons Mouton plateau.
      migrate: (persisted, version) => migrateSave(persisted as Record<string, unknown>, version) as unknown as GameState,
      partialize: s => {
        const { screen: _screen, selectedSiteId: _sel, myLocation: _me, pendingProbe: _pp, ...rest } = s
        return rest
      },
    },
  ),
)

/** Brings an older save up to date. Unknown missions and targets are dropped instead of crashing the game. */
export function migrateSave(p: Record<string, unknown>, version: number): Record<string, unknown> {
  const out = { ...p }
  if (version < 2) {
    if (out.landingId === 'taurus-littrow') out.landingId = 'mons-mouton'
    if (typeof out.landingId === 'string' && !TARGETS.some(t => t.id === out.landingId && t.landable)) out.landingId = null
    if (typeof out.activeMissionId === 'string' && !MISSIONS.some(m => m.id === out.activeMissionId)) out.activeMissionId = 'tutorial'
    const completed = (out.completed ?? {}) as Record<string, MissionRecord>
    out.completed = Object.fromEntries(Object.entries(completed).filter(([id]) => MISSIONS.some(m => m.id === id)))
    if (!Array.isArray(out.discoveries)) out.discoveries = []
  }
  return out
}

export { PROBES_PER_MISSION }
