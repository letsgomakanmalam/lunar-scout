import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ModuleId } from './data/types'
import { MODULES, moduleById } from './data/modules'
import { MISSIONS, missionById, targetById } from './data/moon'
import { EARTH_SITES } from './data/earthSites'
import { computeASI, starsFor } from './lib/scoring'
import { baseScore, emptyGrid, ENERGY_BASE_CAP, energyCap, energyCost, energyRegenMs, GOAL_REWARD, goalsReached, moduleCost, settleEnergy, type BaseGrid } from './lib/base'
import { QUESTS, questById, questDone, techFor, type QuestCtx } from './data/quests'
import { TUTORIAL, type TutEvent } from './data/tutorial'
import type { LatLon, Units } from './lib/geo'

export type MapBase = 'live' | 'satellite' | 'map' | 'blue'
export interface MapPrefs { base: MapBase; labels: boolean; dayNight: boolean; sky: boolean; units: Units }
const DEFAULT_MAP: MapPrefs = { base: 'live', labels: true, dayNight: true, sky: true, units: 'km' }

export type Screen = 'title' | 'explore' | 'land' | 'build' | 'missions' | 'journal' | 'dashboard' | 'about'

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

  go: (s: Screen) => void
  toggleMuted: () => void
  toggleMusic: () => void
  setMapPrefs: (p: Partial<MapPrefs>) => void
  setBaseTheme: (t: 'moon' | 'cosy') => void
  setMyLocation: (p: LatLon | null) => void
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
}

const now = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 10)

export const totalStars = (completed: Record<string, MissionRecord>) =>
  Object.values(completed).reduce((n, r) => n + r.stars, 0)

/** What the quests look at, from the saved game. */
export const questContext = (s: Pick<GameState, 'landingId' | 'grid' | 'scanned' | 'completed'>): QuestCtx => ({
  landingId: s.landingId,
  landing: s.landingId ? targetById(s.landingId) : undefined,
  grid: s.grid,
  scannedCount: new Set(Object.values(s.scanned).flat()).size,
  missionsDone: Object.keys(s.completed),
  stars: totalStars(s.completed),
})

/** Energy right now, including what has refilled since it was saved. */
export const energyNow = (s: Pick<GameState, 'energy' | 'energyAt' | 'grid'>, now = Date.now()) =>
  settleEnergy(s.energy, s.energyAt, now, energyCap(s.grid), energyRegenMs(s.grid))

/** Quests finished but not yet claimed. */
export const claimableQuests = (s: Pick<GameState, 'landingId' | 'grid' | 'scanned' | 'completed' | 'claimed'>) => {
  const ctx = questContext(s)
  return QUESTS.filter(q => !s.claimed.includes(q.id) && questDone(q, ctx))
}

export const missionUnlocked = (id: string, completed: Record<string, MissionRecord>) => {
  const idx = MISSIONS.findIndex(m => m.id === id)
  if (idx <= 1) return true // tutorial and first real mission are always open
  return Object.keys(completed).length >= idx - 1 // one more mission opens per completed mission
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
        const site = EARTH_SITES.find(x => x.id === siteId)!
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

      resetAll: () => set({ ...initial, grid: emptyGrid(), leaderboard: get().leaderboard, tutorialDone: get().tutorialDone, muted: get().muted, music: get().music, mapPrefs: get().mapPrefs, baseTheme: get().baseTheme, myLocation: get().myLocation }),
    }),
    {
      name: 'lunar-scout-v1',
      partialize: s => {
        const { screen: _screen, selectedSiteId: _sel, myLocation: _me, ...rest } = s
        return rest
      },
    },
  ),
)

export { PROBES_PER_MISSION }
