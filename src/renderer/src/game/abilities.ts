import { ABILITY_CONFIG } from './config/config'
import { abilityRank, type AbilityId } from './config/progress'
import { addText, burst, ring, sparks } from './fx'
import type { AbilityHud, GameState, Player } from './types'

/** Valeurs d'une capacité active pour un rang donné (rang 0 traité comme 1 : la capacité doit être débloquée avant). */
export interface AbilityStats {
  /** Secondes d'effet. */
  duration: number
  /** Recharge, comptée depuis l'activation (s). */
  cooldown: number
  /** Dégâts de brûlure par seconde. */
  burnDps: number
  /** Secondes de brûlure après une balle. */
  burnSeconds: number
}

export function abilityStats(id: AbilityId, perks: readonly number[]): AbilityStats {
  const cfg = ABILITY_CONFIG[id]
  const rank = Math.min(cfg.ranks.length, Math.max(1, abilityRank(perks, id)))
  return { ...cfg.ranks[rank - 1], burnSeconds: cfg.burnSeconds }
}

/** Dégâts de brûlure par seconde des balles du joueur à cet instant (0 = pas de capacité enflammée active). */
export function activeBurn(p: Player): number {
  for (let i = 0; i < p.abilities.length; i++) {
    if (p.abilities[i] === 'fireBullets' && p.abilityOn[i] > 0) return abilityStats('fireBullets', p.perks).burnDps
  }
  return 0
}

/** Écoule les durées et recharges d'un joueur. */
export function tickAbilities(p: Player, dt: number): void {
  for (let i = 0; i < p.abilityOn.length; i++) {
    p.abilityOn[i] = Math.max(0, p.abilityOn[i] - dt)
    p.abilityCd[i] = Math.max(0, p.abilityCd[i] - dt)
  }
}

/** Déclenche la capacité de l'emplacement `slot` si elle est équipée et rechargée. */
export function activateAbility(state: GameState, p: Player, slot: number): boolean {
  const id = p.abilities[slot]
  if (!id || p.abilityCd[slot] > 0 || p.abilityOn[slot] > 0) return false
  const s = abilityStats(id, p.perks)
  p.abilityOn[slot] = s.duration
  p.abilityCd[slot] = s.cooldown
  ring(state, p.x, p.y, '#ff7043', 60)
  sparks(state, p.x, p.y, '#ffab40', 14, 220)
  burst(state, p.x, p.y, '#ff5722', 8, 120)
  addText(state, p.x, p.y - 28, 'Balles enflammées !', '#ffab40')
  return true
}

/** Barre de capacités d'un joueur pour l'interface. */
export function abilityHud(p: Player): AbilityHud[] {
  return p.abilities.map((id, i) => {
    const s = abilityStats(id, p.perks)
    return { id, on: p.abilityOn[i] ?? 0, onMax: s.duration, cd: p.abilityCd[i] ?? 0, cdMax: s.cooldown }
  })
}
