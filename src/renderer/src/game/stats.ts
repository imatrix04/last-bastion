import {
  BARRICADE_REINFORCED,
  BARRICADE_STONE,
  BUILDS,
  OVERCLOCK,
  PLAYER,
  TURRET_BRANCHES,
  TURRET_L2_COST,
  TURRET_L3_COST,
  TURRET_LEVELS,
  TURRET_PLAIN_MAX,
  WEB,
  type Branch,
  type BuildKind,
  type TurretStats
} from './constants'
import { hasUnlock, perkMult } from './progress'
import type { Building } from './types'

/** Ce qui définit le niveau d'un bâtiment (partagé entre la simulation, l'invité et l'interface). */
export type Leveled = Pick<Building, 'kind' | 'level' | 'branch'>

/** Niveau d'une tourelle spécialisée (double canons / canon lourd). */
export const TURRET_SPEC_LEVEL = TURRET_PLAIN_MAX + 1

export function turretStats(level: number, branch: Branch): TurretStats {
  if (level > TURRET_PLAIN_MAX && branch !== 0) return TURRET_BRANCHES[branch].stats
  return TURRET_LEVELS[Math.min(TURRET_PLAIN_MAX, Math.max(1, level)) - 1]
}

/** Armes de défense : ce que l'Overclocking accélère et que les araignées prennent pour cible. */
export const isWeapon = (kind: BuildKind): boolean => kind === 'turret'

/** Multiplicateur de cadence de tir d'une arme : Overclocking du joueur qui l'a construite, toile d'araignée. */
export function fireRateMult(b: Pick<Building, 'boost' | 'web'>): number {
  return (b.boost ? OVERCLOCK.fireRate : 1) * (b.web > 0 ? WEB.slow : 1)
}

export function maxHpOf(kind: BuildKind, level: number, branch: Branch): number {
  if (kind === 'barricade') return level >= 3 ? BARRICADE_REINFORCED.hp : level === 2 ? BARRICADE_STONE.hp : BUILDS.barricade.hp
  if (kind === 'turret') return turretStats(level, branch).hp
  return BUILDS[kind].hp
}

export function breakCostOf(b: Pick<Building, 'kind' | 'level'>): number {
  if (b.kind === 'barricade' && b.level >= 3) return BARRICADE_REINFORCED.breakCost
  if (b.kind === 'barricade' && b.level === 2) return BARRICADE_STONE.breakCost
  return BUILDS[b.kind].breakCost
}

/** Or dépensé pour obtenir ce bâtiment (pose + améliorations) : sert au remboursement et au prix des réparations. */
export function investedCost(b: Leveled): number {
  let total = BUILDS[b.kind].cost
  if (b.kind === 'barricade' && b.level >= 2) total += BARRICADE_STONE.cost
  if (b.kind === 'barricade' && b.level >= 3) total += BARRICADE_REINFORCED.cost
  if (b.kind === 'turret') {
    if (b.level >= 2) total += TURRET_L2_COST
    if (b.level >= 3) total += TURRET_L3_COST
    if (b.level > TURRET_PLAIN_MAX && b.branch !== 0) total += TURRET_BRANCHES[b.branch].cost
  }
  return total
}

export interface UpgradeStep {
  /** `direct` : amélioration immédiate · `choice` : l'interface propose le choix de branche. */
  mode: 'direct' | 'choice'
  /** Prix (pour un choix : le moins cher des deux). */
  cost: number
  label: string
  /** Compétence manquante : l'amélioration existe mais n'est pas débloquée. */
  locked: boolean
}

/** Prochaine amélioration, ou null au niveau maximum. `unlocks` : compétences du joueur qui améliore. */
export function nextUpgrade(b: Leveled, unlocks: number): UpgradeStep | null {
  if (b.kind === 'barricade' && b.level === 1) {
    return { mode: 'direct', cost: BARRICADE_STONE.cost, label: BARRICADE_STONE.name, locked: !hasUnlock(unlocks, 'stone') }
  }
  if (b.kind === 'barricade' && b.level === 2) {
    return { mode: 'direct', cost: BARRICADE_REINFORCED.cost, label: BARRICADE_REINFORCED.name, locked: !hasUnlock(unlocks, 'reinforced') }
  }
  if (b.kind === 'turret' && b.level < TURRET_PLAIN_MAX) {
    return {
      mode: 'direct',
      cost: b.level === 1 ? TURRET_L2_COST : TURRET_L3_COST,
      label: `Niveau ${b.level + 1}`,
      locked: false
    }
  }
  if (b.kind === 'turret' && b.level === TURRET_PLAIN_MAX) {
    const open = (['double', 'heavy'] as const).filter((id) => hasUnlock(unlocks, id))
    const costs = open.map((id) => TURRET_BRANCHES[id === 'double' ? 1 : 2].cost)
    const cost = costs.length > 0 ? Math.min(...costs) : Math.min(TURRET_BRANCHES[1].cost, TURRET_BRANCHES[2].cost)
    return { mode: 'choice', cost, label: `Niveau ${TURRET_SPEC_LEVEL} : choisir`, locked: open.length === 0 }
  }
  return null
}

/** Compétence qui débloque une branche de tourelle (1 = double canon, 2 = canon lourd). */
export const branchUnlocked = (unlocks: number, branch: 1 | 2): boolean => hasUnlock(unlocks, branch === 1 ? 'double' : 'heavy')

export const levelName = (b: Leveled): string => {
  if (b.kind === 'barricade') {
    return b.level >= 3 ? BARRICADE_REINFORCED.name : b.level === 2 ? BARRICADE_STONE.name : BUILDS.barricade.name
  }
  if (b.kind === 'turret') return b.branch !== 0 ? TURRET_BRANCHES[b.branch].name : `Tourelle niv. ${b.level}`
  return BUILDS[b.kind].name
}

export interface PlayerStats {
  speed: number
  fireRate: number
  damage: number
  range: number
  bulletSpeed: number
}

/** Statistiques du joueur : valeurs de base (PLAYER) × bonus de ses améliorations. */
export function playerStats(perks: readonly number[]): PlayerStats {
  return {
    speed: PLAYER.speed * perkMult(perks, 'speed'),
    fireRate: PLAYER.fireRate * perkMult(perks, 'fireRate'),
    damage: PLAYER.damage * perkMult(perks, 'damage'),
    range: PLAYER.range * perkMult(perks, 'range'),
    bulletSpeed: PLAYER.bulletSpeed * perkMult(perks, 'bulletSpeed')
  }
}
