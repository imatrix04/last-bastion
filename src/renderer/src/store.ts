import { create } from 'zustand'
import { BASE } from './game/constants'
import type { HudState, RunResult } from './game/types'
import { session } from './net'

export type Screen = 'menu' | 'lobby' | 'playing' | 'paused' | 'gameover'
/** local : une machine · host : héberge la partie en ligne · client : a rejoint la partie d'un hôte */
export type Mode = 'local' | 'host' | 'client'

export interface EndResult extends RunResult {
  newRecord: boolean
}

const BEST_KEY = 'last-bastion:best-wave'
const ADDRESS_KEY = 'last-bastion:last-address'

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
  selected: [0, 0]
}

interface Store {
  screen: Screen
  mode: Mode
  playerCount: 1 | 2
  /** Change à chaque nouvelle partie : force le remontage du canvas. */
  runId: number
  hud: HudState
  result: EndResult | null
  bestWave: number
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
  endGame: (result: RunResult) => void
}

export const useStore = create<Store>()((set, get) => ({
  screen: 'menu',
  mode: 'local',
  playerCount: 1,
  runId: 0,
  hud: initialHud,
  result: null,
  bestWave: loadBest(),
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
    const result = await session.join(address.trim())
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
    set({ screen: 'menu', mode: 'local', lobby: null, peerOnline: false })
  },

  setHud: (hud) => set({ hud }),

  endGame: (result) => {
    const newRecord = result.wave > get().bestWave
    if (newRecord) saveBest(result.wave)
    set({
      screen: 'gameover',
      result: { ...result, newRecord },
      bestWave: Math.max(get().bestWave, result.wave)
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
