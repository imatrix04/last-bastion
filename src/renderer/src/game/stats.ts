import {
  BARRICADE_STONE,
  BUILDS,
  TURRET_BRANCHES,
  TURRET_L2_COST,
  TURRET_LEVELS,
  type Branch,
  type BuildKind,
  type TurretStats
} from './constants'
import type { Building } from './types'

/** Ce qui définit le niveau d'un bâtiment (partagé entre la simulation, l'invité et l'interface). */
export type Leveled = Pick<Building, 'kind' | 'level' | 'branch'>

export function turretStats(level: number, branch: Branch): TurretStats {
  if (level >= 3 && branch !== 0) return TURRET_BRANCHES[branch].stats
  return TURRET_LEVELS[Math.min(2, Math.max(1, level)) - 1]
}

export function maxHpOf(kind: BuildKind, level: number, branch: Branch): number {
  if (kind === 'barricade') return level >= 2 ? BARRICADE_STONE.hp : BUILDS.barricade.hp
  if (kind === 'turret') return turretStats(level, branch).hp
  return BUILDS[kind].hp
}

export function breakCostOf(b: Pick<Building, 'kind' | 'level'>): number {
  if (b.kind === 'barricade' && b.level >= 2) return BARRICADE_STONE.breakCost
  return BUILDS[b.kind].breakCost
}

/** Or dépensé pour obtenir ce bâtiment (pose + améliorations) : sert au remboursement et au prix des réparations. */
export function investedCost(b: Leveled): number {
  let total = BUILDS[b.kind].cost
  if (b.kind === 'barricade' && b.level >= 2) total += BARRICADE_STONE.cost
  if (b.kind === 'turret') {
    if (b.level >= 2) total += TURRET_L2_COST
    if (b.level >= 3 && b.branch !== 0) total += TURRET_BRANCHES[b.branch].cost
  }
  return total
}

export interface UpgradeStep {
  /** `direct` : amélioration immédiate · `choice` : l'interface propose le choix de branche. */
  mode: 'direct' | 'choice'
  /** Prix (pour un choix : le moins cher des deux). */
  cost: number
  label: string
}

/** Prochaine amélioration possible, ou null au niveau maximum. */
export function nextUpgrade(b: Leveled): UpgradeStep | null {
  if (b.kind === 'barricade' && b.level < 2) return { mode: 'direct', cost: BARRICADE_STONE.cost, label: BARRICADE_STONE.name }
  if (b.kind === 'turret' && b.level < 2) return { mode: 'direct', cost: TURRET_L2_COST, label: 'Niveau 2' }
  if (b.kind === 'turret' && b.level === 2) {
    const cost = Math.min(TURRET_BRANCHES[1].cost, TURRET_BRANCHES[2].cost)
    return { mode: 'choice', cost, label: 'Niveau 3 : choisir' }
  }
  return null
}

export const levelName = (b: Leveled): string => {
  if (b.kind === 'barricade') return b.level >= 2 ? BARRICADE_STONE.name : BUILDS.barricade.name
  if (b.kind === 'turret') return b.level >= 3 && b.branch !== 0 ? TURRET_BRANCHES[b.branch].name : `Tourelle niv. ${b.level}`
  return BUILDS[b.kind].name
}
