import { create } from 'zustand'
import { DEFAULT_COLORS, SKIN_BY_ID, isHexColor, type Look, type SkinId } from './game/appearance'
import { BASE } from './game/constants'
import {
  PERKS,
  UNLOCK_BY_ID,
  emptyProgress,
  isUnlockId,
  loadoutOf,
  sanitizeLooks,
  sanitizePerks,
  sanitizeSkins,
  type PerkId,
  type SavedProgress,
  type UnlockId
} from './game/progress'
import type { ChoiceRequest, HudState, RunResult } from './game/types'
import { session } from './net'

export type Screen = 'menu' | 'lobby' | 'playing' | 'paused' | 'gameover' | 'skills' | 'shop'
/** local : une machine · host : héberge la partie en ligne · client : a rejoint la partie d'un hôte */
export type Mode = 'local' | 'host' | 'client'

export interface EndResult extends RunResult {
  newRecord: boolean
}

const BEST_KEY = 'last-bastion:best-wave'
const ADDRESS_KEY = 'last-bastion:last-address'
const PROGRESS_KEY = 'last-bastion:progress'

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

function saveBest(wave: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(wave))
  } catch {
    /* stockage indisponible : on ignore */
  }
}

function loadProgress(): SavedProgress {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as { points?: unknown; unlocked?: unknown; perks?: unknown; skins?: unknown; looks?: unknown } | null
    if (!raw) return emptyProgress()
    const points = typeof raw.points === 'number' && Number.isFinite(raw.points) ? Math.max(0, Math.floor(raw.points)) : 0
    const unlocked = Array.isArray(raw.unlocked) ? [...new Set(raw.unlocked.filter(isUnlockId))] : []
    return { points, unlocked, perks: sanitizePerks(raw.perks), skins: sanitizeSkins(raw.skins), looks: sanitizeLooks(raw.looks) }
  } catch {
    return emptyProgress()
  }
}

function saveProgress(progress: SavedProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export function loadAddress(): string {
  try {
    return localStorage.getItem(ADDRESS_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveAddress(address: string): void {
  try {
    localStorage.setItem(ADDRESS_KEY, address)
  } catch {
    /* ignore */
  }
}

const initialHud: HudState = {
  gold: 0,
  wave: 0,
  phase: 'prep',
  countdown: 0,
  baseHp: BASE.maxHp,
  baseMax: BASE.maxHp,
  enemies: 0,
  kills: 0,
  selected: [0, 0],
  ping: 0,
  colors: [DEFAULT_COLORS[0], DEFAULT_COLORS[1]]
}

interface Store {
  screen: Screen
  mode: Mode
  playerCount: 1 | 2
  /** Change à chaque nouvelle partie : force le remontage du canvas. */
  runId: number
  hud: HudState
  result: EndResult | null
  /** Pop-up de choix de branche d'une tourelle de niveau 2 (null = fermé). */
  choice: ChoiceRequest | null
  bestWave: number
  /** Points de compétence et compétences débloquées (sauvegardés en local). */
  progress: SavedProgress
  /** Salle d'attente de l'hôte : adresses à donner au joueur 2. */
  lobby: { ips: string[]; port: number } | null
  /** Hôte : le joueur 2 est connecté. */
  peerOnline: boolean
  netError: string | null
  /** Partie sur cette machine (solo ou 2 joueurs au clavier). */
  start: (playerCount: 1 | 2) => void
  hostLobby: () => Promise<void>
  joinLobby: (address: string) => Promise<void>
  startHosted: () => void
  startClient: () => void
  restart: () => void
  pause: () => void
  resume: () => void
  toMenu: () => void
  setHud: (hud: HudState) => void
  openSkills: () => void
  closeSkills: () => void
  /** Dépense des points pour débloquer une compétence (vérifie le prix et le prérequis). */
  buyUnlock: (id: UnlockId) => boolean
  /** Achète le rang suivant d'une amélioration du joueur. */
  buyPerk: (id: PerkId) => boolean
  openShop: () => void
  closeShop: () => void
  /** Achète un skin avec des points de compétence. */
  buySkin: (id: SkinId) => boolean
  /** Change la couleur et/ou le skin d'un emplacement de joueur (0 = joueur 1, 1 = joueur 2 au même clavier). */
  setLook: (slot: 0 | 1, change: Partial<Look>) => void
  /** Développement uniquement : ajoute des points pour tester. */
  devAddPoints: (n: number) => void
  openChoice: (request: ChoiceRequest) => void
  closeChoice: () => void
  endGame: (result: RunResult) => void
}

export const useStore = create<Store>()((set, get) => ({
  screen: 'menu',
  mode: 'local',
  playerCount: 1,
  runId: 0,
  hud: initialHud,
  result: null,
  choice: null,
  bestWave: loadBest(),
  progress: loadProgress(),
  lobby: null,
  peerOnline: false,
  netError: null,

  start: (playerCount) =>
    set((s) => ({
      screen: 'playing',
      mode: 'local',
      playerCount,
      runId: s.runId + 1,
      hud: initialHud,
      choice: null,
      result: null,
      netError: null
    })),

  hostLobby: async () => {
    set({ netError: null })
    const result = await session.host()
    if (!result.ok) {
      set({ netError: result.error })
      return
    }
    set({ screen: 'lobby', mode: 'host', lobby: { ips: result.ips, port: result.port }, peerOnline: false })
  },

  joinLobby: async (address) => {
    // Mémorisée tout de suite : si la connexion échoue, le champ du menu reste rempli.
    saveAddress(address.trim())
    set({ netError: null, screen: 'lobby', mode: 'client', lobby: null, peerOnline: false })
    const result = await session.join(address.trim(), loadoutOf(get().progress))
    if (get().screen !== 'lobby' || get().mode !== 'client') {
      // Annulé pendant la connexion
      if (result.ok) session.close()
      return
    }
    if (!result.ok) {
      set({ screen: 'menu', mode: 'local', netError: result.error })
      return
    }
    // L'hôte nous enverra 'start' dès que la poignée de main est validée.
  },

  startHosted: () =>
    set((s) => ({
      screen: 'playing',
      mode: 'host',
      playerCount: 2,
      runId: s.runId + 1,
      hud: initialHud,
      choice: null,
      result: null,
      lobby: null
    })),

  startClient: () =>
    set((s) => ({
      screen: 'playing',
      mode: 'client',
      playerCount: 2,
      runId: s.runId + 1,
      hud: initialHud,
      choice: null,
      result: null,
      lobby: null,
      netError: null
    })),

  restart: () => {
    const { mode, playerCount } = get()
    if (mode === 'host') get().startHosted()
    else if (mode === 'local') get().start(playerCount)
    // client : c'est l'hôte qui relance
  },

  pause: () => {
    if (get().screen === 'playing') set({ screen: 'paused' })
  },
  resume: () => {
    if (get().screen === 'paused') set({ screen: 'playing' })
  },

  toMenu: () => {
    session.close()
    set({ screen: 'menu', mode: 'local', lobby: null, peerOnline: false, choice: null })
  },

  setHud: (hud) => set({ hud }),

  openSkills: () => {
    if (get().screen === 'menu') set({ screen: 'skills' })
  },
  closeSkills: () => {
    if (get().screen === 'skills') set({ screen: 'menu' })
  },
  buyUnlock: (id) => {
    const { progress } = get()
    const def = UNLOCK_BY_ID[id]
    if (progress.unlocked.includes(id) || progress.points < def.cost) return false
    if (def.requires && !progress.unlocked.includes(def.requires)) return false
    const next = { ...progress, points: progress.points - def.cost, unlocked: [...progress.unlocked, id] }
    saveProgress(next)
    set({ progress: next })
    return true
  },
  buyPerk: (id) => {
    const { progress } = get()
    const i = PERKS.findIndex((p) => p.id === id)
    const def = PERKS[i]
    const rank = progress.perks[i] ?? 0
    if (!def || rank >= def.costs.length || progress.points < def.costs[rank]) return false
    const perks = progress.perks.slice()
    perks[i] = rank + 1
    const next = { ...progress, points: progress.points - def.costs[rank], perks }
    saveProgress(next)
    set({ progress: next })
    return true
  },
  openShop: () => {
    if (get().screen === 'menu') set({ screen: 'shop' })
  },
  closeShop: () => {
    if (get().screen === 'shop') set({ screen: 'menu' })
  },
  buySkin: (id) => {
    const { progress } = get()
    const def = SKIN_BY_ID[id]
    if (!def || progress.skins.includes(id) || progress.points < def.price) return false
    const next = { ...progress, points: progress.points - def.price, skins: [...progress.skins, id] }
    saveProgress(next)
    set({ progress: next })
    return true
  },
  setLook: (slot, change) => {
    const { progress } = get()
    const current = progress.looks[slot]
    const color = change.color !== undefined && isHexColor(change.color) ? change.color.toLowerCase() : current.color
    // Un skin ne s'équipe que s'il a été acheté.
    const skin = change.skin !== undefined && progress.skins.includes(change.skin) ? change.skin : current.skin
    const looks: [Look, Look] = [progress.looks[0], progress.looks[1]]
    looks[slot] = { color, skin }
    const next = { ...progress, looks }
    saveProgress(next)
    set({ progress: next })
  },
  devAddPoints: (n) => {
    const next = { ...get().progress, points: get().progress.points + n }
    saveProgress(next)
    set({ progress: next })
  },

  openChoice: (request) => {
    if (get().screen === 'playing') set({ choice: request })
  },
  closeChoice: () => set({ choice: null }),

  endGame: (result) => {
    const newRecord = result.wave > get().bestWave
    if (newRecord) saveBest(result.wave)
    const progress = { ...get().progress, points: get().progress.points + result.points }
    saveProgress(progress)
    set({
      screen: 'gameover',
      choice: null,
      result: { ...result, newRecord },
      bestWave: Math.max(get().bestWave, result.wave),
      progress
    })
  }
}))

// Évènements du jeu en ligne -> navigation entre écrans
session.subscribe((event) => {
  const s = useStore.getState()
  switch (event.type) {
    case 'ready':
      // Hôte : le joueur 2 est là. En salle d'attente, la partie démarre ; en pleine partie, il reprend sa place.
      useStore.setState({ peerOnline: true })
      if (s.screen === 'lobby' && s.mode === 'host') s.startHosted()
      break
    case 'left':
      if (s.mode === 'host') {
        useStore.setState({ peerOnline: false })
      } else if (s.mode === 'client') {
        session.close()
        useStore.setState({
          screen: 'menu',
          mode: 'local',
          lobby: null,
          peerOnline: false,
          netError: s.netError ?? "Connexion perdue avec l'hôte."
        })
      }
      break
    case 'start':
      if (s.mode === 'client') s.startClient()
      break
    case 'rejected':
      useStore.setState({ netError: event.reason })
      break
  }
})
