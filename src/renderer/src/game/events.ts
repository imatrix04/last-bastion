import { EVENTS, type EventKind } from './config/config'
import { BASE, TILE } from './config/constants'
import type { Enemy, GameState } from './types'

/** Ordre des événements (partagé avec le réseau : 0 = aucun, sinon 1 + index). */
export const EVENT_KINDS = Object.keys(EVENTS.list) as EventKind[]

/** Tire au sort l'événement d'une vague (null = vague normale). */
export function rollEvent(wave: number): EventKind | null {
  if (wave < EVENTS.from || Math.random() >= EVENTS.chance) return null
  return EVENT_KINDS[Math.floor(Math.random() * EVENT_KINDS.length)]
}

/** Fait avancer le temps de l'événement et le fondu de ses effets visuels (hôte et invité). */
export function advanceEvent(state: GameState, dt: number): void {
  state.eventAge = state.event ? state.eventAge + dt : 0
  if (state.event) state.eventShown = state.event
  const target = state.event ? 1 : 0
  const step = dt / EVENTS.fadeSeconds
  state.eventLevel += Math.max(-step, Math.min(step, target - state.eventLevel))
  if (state.eventLevel <= 0 && !state.event) state.eventShown = null
}

/** Bonus de l'événement en cours (×1 sans événement). */
export function eventMods(state: GameState): { mobSpeed: number; turretDamage: number } {
  if (!state.event) return { mobSpeed: 1, turretDamage: 1 }
  const def = EVENTS.list[state.event]
  return { mobSpeed: def.mobSpeed, turretDamage: def.turretDamage }
}

const sight = (state: GameState): { player: number; turret: number; base: number } | null =>
  state.event === 'fog' ? EVENTS.list.fog.sight : null

/** Rayon dans lequel un joueur voit les monstres (illimité sans brouillard). */
export function playerSight(state: GameState): number {
  return sight(state)?.player ?? Infinity
}

/**
 * Une tourelle (centre cx, cy) a-t-elle un visuel sur ce monstre ? Sans brouillard : toujours.
 * Avec : il doit être dans son propre rayon de visibilité, ou visible par l'un des joueurs.
 */
export function turretSees(state: GameState, cx: number, cy: number, e: Enemy): boolean {
  const s = sight(state)
  if (!s) return true
  if (Math.hypot(e.x - cx, e.y - cy) <= s.turret + e.radius) return true
  return state.players.some((p) => Math.hypot(e.x - p.x, e.y - p.y) <= s.player + e.radius)
}

export interface Light {
  x: number
  y: number
  r: number
}

/** Sources de lumière qui percent le brouillard : joueurs, tourelles, forteresse. */
export function lightSources(state: GameState): Light[] {
  const s = sight(state) ?? EVENTS.list.fog.sight
  const out: Light[] = [{ x: (BASE.col + BASE.cols / 2) * TILE, y: (BASE.row + BASE.rows / 2) * TILE, r: s.base }]
  for (const p of state.players) out.push({ x: p.x, y: p.y, r: s.player })
  for (const b of state.grid) if (b && b.kind === 'turret') out.push({ x: (b.col + 0.5) * TILE, y: (b.row + 0.5) * TILE, r: s.turret })
  return out
}

/** Monstre caché par le brouillard à l'affichage : hors de toute zone éclairée. */
export function enemyHidden(state: GameState, e: Enemy): boolean {
  // Le brouillard doit être bien installé : pas de monstres qui disparaissent d'un coup au début du fondu.
  if (state.event !== 'fog' || state.eventLevel < 0.5) return false
  for (const l of lightSources(state)) {
    if (Math.hypot(e.x - l.x, e.y - l.y) <= l.r * 0.85 + e.radius) return false
  }
  return true
}
