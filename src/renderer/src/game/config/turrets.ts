/**
 * Types et fonctions des tourelles. Les chiffres (stats, prix) sont dans config.ts, section « Tourelles ».
 *
 *   niveaux 1 → 3   communs à toutes les tourelles (TURRET_PLAIN)
 *   niveau 4        on choisit une branche : double canons ou canon lourd
 *   niveaux 5 → 7   la branche choisie continue d'évoluer, avec ses propres statistiques
 *   niveaux 8 → 10  évolution (compétence à débloquer) : double canons → Minigun, canon lourd → Canon explosif
 *
 * Chaque niveau a ses statistiques complètes et son prix (pour y arriver depuis le niveau précédent).
 * Le niveau 1 se paie à la pose : son prix est TURRET_PLACE_COST.
 */
import { TURRET_BRANCH_CONFIG, TURRET_COSTS, TURRET_EVOLVE_AT, TURRET_LEVELS_PLAIN } from './config'

/** Spécialisation d'une tourelle (à partir du niveau 4) : 0 = aucune, 1 = double canons, 2 = canon lourd. */
export type Branch = 0 | 1 | 2

export interface TurretStats {
  /** Dégâts par tir. */
  damage: number
  /** Tirs par seconde. */
  fireRate: number
  /** Portée en pixels. */
  range: number
  /** Points de vie. */
  hp: number
  /** Vitesse du projectile (px/s). */
  bulletSpeed: number
  /** Rayon de l'explosion à l'impact (px) ; absent = tir sans zone. */
  splash?: number
}

export interface TurretLevel {
  /** Prix en or pour atteindre ce niveau depuis le précédent (niveau 1 : prix de pose). */
  cost: number
  stats: TurretStats
}

export const TURRET_PLACE_COST = TURRET_COSTS.place
/** Coût de franchissement pour les ennemis (ils cassent ce qui bloque). */
export const TURRET_BREAK_COST = TURRET_COSTS.breakCost

/** Niveaux 1 à 3, communs à toutes les tourelles. */
export const TURRET_PLAIN: readonly TurretLevel[] = TURRET_LEVELS_PLAIN

/** Dernier niveau « simple » : à ce niveau l'amélioration suivante est le choix de la branche. */
export const TURRET_PLAIN_MAX = TURRET_PLAIN.length
/** Niveau auquel on choisit la branche (premier niveau d'une branche). */
export const TURRET_SPEC_LEVEL = TURRET_PLAIN_MAX + 1

export interface TurretBranchDef {
  /** Clés de traduction (i18n) : nom, et phrase affichée sur la carte de choix. */
  nameKey: string
  blurbKey: string
  /** Couleur d'accent du canon (rendu). */
  accent: string
  /** Niveaux de la branche : le premier est le niveau 4 (le choix), puis 5 à 7, puis 8 à 10 (évolution). */
  levels: readonly TurretLevel[]
}

export const TURRET_BRANCHES: Record<1 | 2, TurretBranchDef> = TURRET_BRANCH_CONFIG

/** Niveau maximum d'une tourelle (niveaux simples + niveaux de branche). */
export const TURRET_MAX_LEVEL = TURRET_PLAIN_MAX + TURRET_BRANCHES[1].levels.length
/** Premier niveau d'évolution (Minigun / Canon explosif) : il demande une compétence de plus. */
export const TURRET_EVOLVE_LEVEL = TURRET_EVOLVE_AT
/** Dernier niveau avant l'évolution. */
export const TURRET_BASE_MAX_LEVEL = TURRET_EVOLVE_LEVEL - 1

/** Forme de la tourelle : sert au tir et au dessin. */
export type TurretForm = 'basic' | 'double' | 'minigun' | 'heavy' | 'explosive'

export function turretForm(level: number, branch: Branch): TurretForm {
  if (branch === 0 || level <= TURRET_PLAIN_MAX) return 'basic'
  const evolved = level >= TURRET_EVOLVE_LEVEL
  return branch === 1 ? (evolved ? 'minigun' : 'double') : evolved ? 'explosive' : 'heavy'
}

/** Statistiques et prix d'un niveau. `branch` ne compte qu'à partir du niveau 4. */
export function turretLevel(level: number, branch: Branch): TurretLevel {
  if (level > TURRET_PLAIN_MAX && branch !== 0) {
    const levels = TURRET_BRANCHES[branch].levels
    return levels[Math.min(levels.length, level - TURRET_PLAIN_MAX) - 1]
  }
  return TURRET_PLAIN[Math.min(TURRET_PLAIN_MAX, Math.max(1, level)) - 1]
}

/** Prix pour passer au niveau suivant, ou null au niveau maximum. Pour le choix de la branche : le moins cher des deux. */
export function turretNextCost(level: number, branch: Branch): number | null {
  if (level >= TURRET_MAX_LEVEL) return null
  if (level < TURRET_PLAIN_MAX) return TURRET_PLAIN[level].cost
  if (level === TURRET_PLAIN_MAX) return Math.min(TURRET_BRANCHES[1].levels[0].cost, TURRET_BRANCHES[2].levels[0].cost)
  return branch !== 0 ? turretLevel(level + 1, branch).cost : null
}

/** Or total dépensé pour obtenir une tourelle de ce niveau (pose + améliorations). */
export function turretInvested(level: number, branch: Branch): number {
  let total = 0
  for (let l = 1; l <= level; l++) total += turretLevel(l, branch).cost
  return total
}
