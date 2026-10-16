import { BARRICADE_TIERS, BUILDS, OVERCLOCK_LEVELS, PLAYER, SPIKE_LEVELS, WEB, type BuildKind, type SpikeLevel, type TierUnlock } from './constants'
import { PERKS, PERK_INDEX, hasUnlock, perkMult } from './progress'
import {
  TURRET_BRANCHES,
  TURRET_EVOLVE_LEVEL,
  TURRET_MAX_LEVEL,
  TURRET_PLAIN_MAX,
  TURRET_SPEC_LEVEL,
  turretInvested,
  turretLevel,
  turretForm,
  turretNextCost,
  type Branch,
  type TurretStats
} from './turrets'
import type { Building } from './types'

/** Ce qui définit le niveau d'un bâtiment (partagé entre la simulation, l'invité et l'interface). */
export type Leveled = Pick<Building, 'kind' | 'level' | 'branch'>

// ------------------------------------------------------------ murs et pieux : niveaux

/** Un niveau de mur ou de pieux. */
export interface Tier {
  name: string
  /** Prix pour atteindre ce niveau depuis le précédent (niveau 1 : prix de pose). */
  cost: number
  hp: number
  breakCost: number
  /** Compétence qui débloque ce niveau. */
  unlock?: TierUnlock
  /** Couleur des éclats quand il est touché. */
  debris: string
}

const WALL_TIERS: readonly Tier[] = [
  { name: BUILDS.barricade.name, cost: BUILDS.barricade.cost, hp: BUILDS.barricade.hp, breakCost: BUILDS.barricade.breakCost, debris: '#9c6a35' },
  ...BARRICADE_TIERS
]
const SPIKE_TIERS: readonly Tier[] = SPIKE_LEVELS.map((l) => ({ name: l.name, cost: l.cost, hp: l.hp, breakCost: 0, unlock: l.unlock, debris: l.debris }))

/** Niveaux d'un mur ou de pieux (null pour une tourelle, qui a sa propre configuration : turrets.ts). */
export function tiersOf(kind: BuildKind): readonly Tier[] | null {
  return kind === 'barricade' ? WALL_TIERS : kind === 'spikes' ? SPIKE_TIERS : null
}

export const maxLevelOf = (kind: BuildKind): number => tiersOf(kind)?.length ?? TURRET_MAX_LEVEL

export function tierOf(kind: BuildKind, level: number): Tier | null {
  const t = tiersOf(kind)
  return t ? t[Math.min(t.length, Math.max(1, level)) - 1] : null
}

export const spikeStats = (level: number): SpikeLevel => SPIKE_LEVELS[Math.min(SPIKE_LEVELS.length, Math.max(1, level)) - 1]

// ------------------------------------------------------------------------ tourelles

export { TURRET_SPEC_LEVEL }

export const turretStats = (level: number, branch: Branch): TurretStats => turretLevel(level, branch).stats

/** Armes de défense : ce que l'Overclocking accélère et que les araignées prennent pour cible. */
export const isWeapon = (kind: BuildKind): boolean => kind === 'turret'

/** Multiplicateur de l'Overclocking pour un rang donné (0 = pas d'Overclocking). */
export const overclockMult = (rank: number): number => (rank > 0 ? OVERCLOCK_LEVELS[Math.min(OVERCLOCK_LEVELS.length, rank) - 1] : 1)

/** Multiplicateur de cadence de tir d'une arme : Overclocking du joueur qui l'a construite, toile d'araignée. */
export function fireRateMult(b: Pick<Building, 'boost' | 'web'>): number {
  return overclockMult(b.boost) * (b.web > 0 ? WEB.slow : 1)
}

// ------------------------------------------------------------------ points de vie, prix

export function maxHpOf(kind: BuildKind, level: number, branch: Branch): number {
  if (kind === 'turret') return turretStats(level, branch).hp
  return tierOf(kind, level)?.hp ?? BUILDS[kind].hp
}

export function breakCostOf(b: Pick<Building, 'kind' | 'level'>): number {
  return tierOf(b.kind, b.level)?.breakCost ?? BUILDS[b.kind].breakCost
}

/** Or dépensé pour obtenir ce bâtiment (pose + améliorations) : sert au remboursement et au prix des réparations. */
export function investedCost(b: Leveled): number {
  if (b.kind === 'turret') return turretInvested(b.level, b.branch)
  const tiers = tiersOf(b.kind)
  if (!tiers) return BUILDS[b.kind].cost
  let total = 0
  for (let l = 1; l <= Math.min(b.level, tiers.length); l++) total += tiers[l - 1].cost
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
  if (b.kind === 'turret') {
    const cost = turretNextCost(b.level, b.branch)
    if (cost === null) return null
    if (b.level === TURRET_PLAIN_MAX) {
      const open = (['double', 'heavy'] as const).filter((id) => hasUnlock(unlocks, id))
      const cheapest = open.length > 0 ? Math.min(...open.map((id) => TURRET_BRANCHES[id === 'double' ? 1 : 2].levels[0].cost)) : cost
      return { mode: 'choice', cost: cheapest, label: `Niveau ${TURRET_SPEC_LEVEL} : choisir`, locked: open.length === 0 }
    }
    if (b.level + 1 === TURRET_EVOLVE_LEVEL) {
      const need = b.branch === 1 ? 'minigun' : 'explosive'
      return { mode: 'direct', cost, label: `Niveau ${b.level + 1} · ${b.branch === 1 ? 'Minigun' : 'Canon explosif'}`, locked: !hasUnlock(unlocks, need) }
    }
    return { mode: 'direct', cost, label: `Niveau ${b.level + 1}`, locked: false }
  }
  const tiers = tiersOf(b.kind)
  const next = tiers && b.level < tiers.length ? tiers[b.level] : null
  if (!next) return null
  return { mode: 'direct', cost: next.cost, label: next.name, locked: next.unlock !== undefined && !hasUnlock(unlocks, next.unlock) }
}

/** Compétence qui débloque une branche de tourelle (1 = double canons, 2 = canon lourd). */
export const branchUnlocked = (unlocks: number, branch: 1 | 2): boolean => hasUnlock(unlocks, branch === 1 ? 'double' : 'heavy')

export const levelName = (b: Leveled): string => {
  if (b.kind === 'turret') {
    const form = turretForm(b.level, b.branch)
    const name = form === 'minigun' ? 'Minigun' : form === 'explosive' ? 'Canon explosif' : b.branch !== 0 ? TURRET_BRANCHES[b.branch].name : ''
    return name ? `${name} · niv. ${b.level}` : `Tourelle niv. ${b.level}`
  }
  return tierOf(b.kind, b.level)?.name ?? BUILDS[b.kind].name
}

// ------------------------------------------------------------------------- joueur

export interface PlayerStats {
  speed: number
  fireRate: number
  damage: number
  range: number
  bulletSpeed: number
  /** Part de l'anticipation du mouvement des ennemis (0 = vise leur position actuelle, 1 = interception complète). */
  lead: number
}

/** Statistiques du joueur : valeurs de base (PLAYER) × bonus de ses améliorations. */
export function playerStats(perks: readonly number[]): PlayerStats {
  return {
    lead: Math.min(1, (perks[PERK_INDEX.precision] ?? 0) * PERKS[PERK_INDEX.precision].perRank),
    speed: PLAYER.speed * perkMult(perks, 'speed'),
    fireRate: PLAYER.fireRate * perkMult(perks, 'fireRate'),
    damage: PLAYER.damage * perkMult(perks, 'damage'),
    range: PLAYER.range * perkMult(perks, 'range'),
    bulletSpeed: PLAYER.bulletSpeed * perkMult(perks, 'bulletSpeed')
  }
}
