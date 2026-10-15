/**
 * Configuration complète des tourelles : à modifier ici pour équilibrer.
 *
 *   niveaux 1 → 3   communs à toutes les tourelles (TURRET_PLAIN)
 *   niveau 4        on choisit une branche : double canons ou canon lourd
 *   niveaux 5 → 7   la branche choisie continue d'évoluer, avec ses propres statistiques
 *
 * Chaque niveau a ses statistiques complètes et son prix (pour y arriver depuis le niveau précédent).
 * Le niveau 1 se paie à la pose : son prix est TURRET_PLACE_COST.
 */

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
}

export interface TurretLevel {
  /** Prix en or pour atteindre ce niveau depuis le précédent (niveau 1 : prix de pose). */
  cost: number
  stats: TurretStats
}

export const TURRET_PLACE_COST = 120
/** Coût de franchissement pour les ennemis (ils cassent ce qui bloque). */
export const TURRET_BREAK_COST = 12

/** Niveaux 1 à 3, communs à toutes les tourelles. */
export const TURRET_PLAIN: readonly TurretLevel[] = [
  { cost: TURRET_PLACE_COST, stats: { damage: 13, fireRate: 2.2, range: 220, hp: 180, bulletSpeed: 560 } },
  { cost: 150, stats: { damage: 19, fireRate: 2.2, range: 220, hp: 250, bulletSpeed: 560 } },
  { cost: 250, stats: { damage: 26, fireRate: 2.4, range: 220, hp: 350, bulletSpeed: 560 } }
]

/** Dernier niveau « simple » : à ce niveau l'amélioration suivante est le choix de la branche. */
export const TURRET_PLAIN_MAX = TURRET_PLAIN.length
/** Niveau auquel on choisit la branche (premier niveau d'une branche). */
export const TURRET_SPEC_LEVEL = TURRET_PLAIN_MAX + 1

export interface TurretBranchDef {
  name: string
  /** Phrase affichée sur la carte de choix. */
  blurb: string
  /** Couleur d'accent du canon (rendu). */
  accent: string
  /** Niveaux de la branche : le premier est le niveau 4 (le choix), puis 5, 6, 7. */
  levels: readonly TurretLevel[]
}

export const TURRET_BRANCHES: Record<1 | 2, TurretBranchDef> = {
  1: {
    name: 'Double canons',
    blurb: 'Deux canons en alternance : la cadence explose à chaque niveau.',
    accent: '#4dd0e1',
    levels: [
      { cost: 370, stats: { damage: 26, fireRate: 4.8, range: 220, hp: 410, bulletSpeed: 560 } },
      { cost: 480, stats: { damage: 30, fireRate: 5.4, range: 230, hp: 480, bulletSpeed: 580 } },
      { cost: 600, stats: { damage: 36, fireRate: 6.0, range: 240, hp: 560, bulletSpeed: 590 } },
      { cost: 780, stats: { damage: 44, fireRate: 7.0, range: 250, hp: 660, bulletSpeed: 600 } }
    ]
  },
  2: {
    name: 'Canon lourd',
    blurb: 'Un obus massif : des dégâts énormes, de plus en plus loin.',
    accent: '#ff9800',
    levels: [
      { cost: 420, stats: { damage: 78, fireRate: 2.4, range: 250, hp: 460, bulletSpeed: 640 } },
      { cost: 540, stats: { damage: 92, fireRate: 2.4, range: 262, hp: 540, bulletSpeed: 660 } },
      { cost: 680, stats: { damage: 112, fireRate: 2.5, range: 275, hp: 630, bulletSpeed: 680 } },
      { cost: 850, stats: { damage: 136, fireRate: 2.6, range: 290, hp: 760, bulletSpeed: 700 } }
    ]
  }
}

/** Niveau maximum d'une tourelle (niveaux simples + niveaux de branche). */
export const TURRET_MAX_LEVEL = TURRET_PLAIN_MAX + TURRET_BRANCHES[1].levels.length

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
