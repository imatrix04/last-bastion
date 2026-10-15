import type { EnemyKind } from './constants'

/**
 * Progression entre les parties : des points gagnés à la fin de chaque partie permettent de
 * débloquer de nouvelles options de défense et d'améliorer le joueur (arbre de compétences).
 * Ce fichier est sans dépendance à React ni au stockage : la sauvegarde est dans store.ts.
 */

// ------------------------------------------------------------ compétences à débloquer

export type UnlockId = 'stone' | 'reinforced' | 'double' | 'heavy' | 'overclock'
export type TreeBranch = 'barricade' | 'turret' | 'tech'

export interface UnlockDef {
  id: UnlockId
  branch: TreeBranch
  name: string
  blurb: string
  /** Points à dépenser. */
  cost: number
  /** Compétence à avoir débloquée avant celle-ci. */
  requires?: UnlockId
  /** Rang dans la branche (0 = haut de l'arbre), pour l'affichage. */
  tier: number
}

/** L'ordre fixe les bits de `unlockMask` : ne jamais réordonner, seulement ajouter à la fin. */
export const UNLOCKS: readonly UnlockDef[] = [
  {
    id: 'stone',
    branch: 'barricade',
    name: 'Mur en pierre',
    blurb: 'La barricade peut être renforcée en pierre : bien plus résistante.',
    cost: 120,
    tier: 0
  },
  {
    id: 'reinforced',
    branch: 'barricade',
    name: 'Mur en pierre renforcé',
    blurb: 'Dernier niveau de la barricade : un rempart blindé.',
    cost: 350,
    requires: 'stone',
    tier: 1
  },
  {
    id: 'double',
    branch: 'turret',
    name: 'Double canons',
    blurb: 'Choix possible au niveau 4 d’une tourelle : double cadence.',
    cost: 250,
    tier: 0
  },
  {
    id: 'heavy',
    branch: 'turret',
    name: 'Canon lourd',
    blurb: 'Choix possible au niveau 4 d’une tourelle : dégâts triplés.',
    cost: 250,
    tier: 0
  },
  {
    id: 'overclock',
    branch: 'tech',
    name: 'Overclocking',
    blurb: 'Toutes tes tourelles (et futures armes de défense) tirent plus vite.',
    cost: 450,
    tier: 0
  }
]

export const UNLOCK_BY_ID: Readonly<Record<UnlockId, UnlockDef>> = Object.fromEntries(UNLOCKS.map((u) => [u.id, u])) as Record<
  UnlockId,
  UnlockDef
>

const BIT: Readonly<Record<UnlockId, number>> = Object.fromEntries(UNLOCKS.map((u, i) => [u.id, 1 << i])) as Record<UnlockId, number>
const ALL_BITS = (1 << UNLOCKS.length) - 1

/** Toutes les compétences à débloquer (tests, simulation). */
export const ALL_UNLOCKS = ALL_BITS

export const unlockMask = (ids: readonly UnlockId[]): number => ids.reduce((m, id) => m | BIT[id], 0)
export const hasUnlock = (mask: number, id: UnlockId): boolean => (mask & BIT[id]) !== 0

/** Masque reçu du réseau : on ne garde que les bits qui existent. */
export const sanitizeMask = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v & ALL_BITS : 0)

export const isUnlockId = (v: unknown): v is UnlockId => typeof v === 'string' && v in BIT

// ------------------------------------------------------------- améliorations du joueur

export type PerkId = 'speed' | 'fireRate' | 'range' | 'damage' | 'bulletSpeed'

export interface PerkDef {
  id: PerkId
  name: string
  blurb: string
  /** Prix de chaque rang (la longueur donne le rang maximum). */
  costs: readonly number[]
  /** Bonus par rang, en fraction de la valeur de base (0,1 = +10 %). */
  perRank: number
}

/** L'ordre fixe la position dans la sauvegarde et dans le message réseau : seulement ajouter à la fin. */
export const PERKS: readonly PerkDef[] = [
  { id: 'speed', name: 'Vitesse', blurb: 'Se déplacer plus vite.', costs: [50, 90, 140, 200, 280], perRank: 0.05 },
  { id: 'fireRate', name: 'Cadence de tir', blurb: 'Tirer plus souvent.', costs: [60, 100, 160, 230, 320], perRank: 0.1 },
  { id: 'range', name: 'Portée', blurb: 'Toucher plus loin.', costs: [50, 90, 140, 200, 280], perRank: 0.05 },
  { id: 'damage', name: 'Dégâts', blurb: 'Des balles plus puissantes.', costs: [60, 100, 160, 230, 320], perRank: 0.1 },
  { id: 'bulletSpeed', name: 'Vitesse des balles', blurb: 'Des balles plus rapides, moins de tirs manqués.', costs: [40, 70, 110, 160, 220], perRank: 0.08 }
]

export const PERK_INDEX: Readonly<Record<PerkId, number>> = Object.fromEntries(PERKS.map((p, i) => [p.id, i])) as Record<PerkId, number>

export const emptyPerks = (): number[] => PERKS.map(() => 0)

/** Rangs reçus du réseau ou de la sauvegarde : un entier entre 0 et le rang maximum, pour chaque amélioration. */
export const sanitizePerks = (v: unknown): number[] =>
  PERKS.map((p, i) => {
    const r = Array.isArray(v) ? v[i] : 0
    return typeof r === 'number' && Number.isInteger(r) ? Math.max(0, Math.min(p.costs.length, r)) : 0
  })

/** Multiplicateur appliqué à une statistique de base du joueur. */
export const perkMult = (perks: readonly number[], id: PerkId): number => 1 + (perks[PERK_INDEX[id]] ?? 0) * PERKS[PERK_INDEX[id]].perRank

/** Tout ce qu'un joueur apporte en partie : compétences débloquées (bits) et rangs d'améliorations. */
export interface Loadout {
  unlocks: number
  perks: number[]
}

export const emptyLoadout = (): Loadout => ({ unlocks: 0, perks: emptyPerks() })

// -------------------------------------------------------------------------- gains

/** Ordre des compteurs de kills (partagé avec le réseau). `minion` : petits issus d'une division. */
export const KILL_KINDS = ['grunt', 'runner', 'brute', 'boss', 'splitter', 'minion', 'spider'] as const
export type KillKind = (typeof KILL_KINDS)[number]

export const killIndex = (kind: EnemyKind, minion: boolean): number => (minion ? 5 : KILL_KINDS.indexOf(kind))

/** Points rapportés par un monstre abattu. */
export const KILL_POINTS: Readonly<Record<KillKind, number>> = {
  grunt: 1,
  runner: 1,
  brute: 3,
  splitter: 3,
  boss: 15,
  minion: 0.5,
  spider: 4
}
/** Points par vague atteinte. */
export const WAVE_POINTS = 10
/** Chaque vague atteinte augmente le total de 10 % : tenir longtemps est récompensé. */
export const WAVE_BONUS = 0.1

export interface RunScore {
  /** Somme des kills pondérés par type. */
  kills: number
  /** Points de vagues atteintes. */
  waves: number
  /** Multiplicateur lié à la vague atteinte. */
  mult: number
  /** Total gagné (arrondi). */
  total: number
}

/** (Σ kills × valeur du type + 10 × vague) × (1 + vague / 10). */
export function scoreRun(kstats: readonly number[], wave: number): RunScore {
  let kills = 0
  KILL_KINDS.forEach((k, i) => {
    kills += (kstats[i] ?? 0) * KILL_POINTS[k]
  })
  const waves = WAVE_POINTS * wave
  const mult = 1 + wave * WAVE_BONUS
  return { kills, waves, mult, total: Math.round((kills + waves) * mult) }
}

export interface SavedProgress {
  points: number
  unlocked: UnlockId[]
  /** Rang de chaque amélioration du joueur, dans l'ordre de PERKS. */
  perks: number[]
}

export const emptyProgress = (): SavedProgress => ({ points: 0, unlocked: [], perks: emptyPerks() })

export const loadoutOf = (p: SavedProgress): Loadout => ({ unlocks: unlockMask(p.unlocked), perks: sanitizePerks(p.perks) })
