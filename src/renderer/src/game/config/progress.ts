import { defaultLook, isSkinId, sanitizeLook, type Look, type SkinId } from './appearance'
import { ABILITY_SLOTS, PERK_BALANCE, SCORE, SPIKE_LIMIT, TURRET_LIMIT, UNLOCK_COST } from './config'
import type { EnemyKind, TierUnlock } from './constants'

/**
 * Progression entre les parties : des points gagnés à la fin de chaque partie permettent de
 * débloquer de nouvelles options de défense et d'améliorer le joueur (arbre de compétences).
 * Ce fichier est sans dépendance à React ni au stockage : la sauvegarde est dans store.ts.
 */

// ------------------------------------------------------------ compétences à débloquer

export type UnlockId = TierUnlock | 'double' | 'heavy' | 'minigun' | 'explosive'
export type TreeBranch = 'barricade' | 'spikes' | 'turret' | 'tech'

export interface UnlockDef {
  id: UnlockId
  branch: TreeBranch
  /** Clés de traduction (i18n) : nom et description. */
  nameKey: string
  blurbKey: string
  /** Points à dépenser. */
  cost: number
  /** Compétence à avoir débloquée avant celle-ci. */
  requires?: UnlockId
  /** Rang dans la branche (0 = haut de l'arbre), pour l'affichage. */
  tier: number
}

/**
 * L'ordre fixe les bits de `unlockMask` (échangé entre les joueurs en ligne) : ajouter à la fin de préférence.
 * Les noms et les valeurs des niveaux de mur et de pieux sont dans constants.ts (BARRICADE_TIERS, SPIKE_LEVELS).
 */
export const UNLOCKS: readonly UnlockDef[] = [
  {
    id: 'stone',
    branch: 'barricade',
    nameKey: 'unlock.stone.name',
    blurbKey: 'unlock.stone.blurb',
    cost: UNLOCK_COST.stone,
    tier: 0
  },
  {
    id: 'bronze',
    branch: 'barricade',
    nameKey: 'unlock.bronze.name',
    blurbKey: 'unlock.bronze.blurb',
    cost: UNLOCK_COST.bronze,
    requires: 'stone',
    tier: 1
  },
  {
    id: 'reinforced',
    branch: 'barricade',
    nameKey: 'unlock.reinforced.name',
    blurbKey: 'unlock.reinforced.blurb',
    cost: UNLOCK_COST.reinforced,
    requires: 'bronze',
    tier: 2
  },
  {
    id: 'spikeStone',
    branch: 'spikes',
    nameKey: 'unlock.spikeStone.name',
    blurbKey: 'unlock.spikeStone.blurb',
    cost: UNLOCK_COST.spikeStone,
    tier: 0
  },
  {
    id: 'spikeReinforced',
    branch: 'spikes',
    nameKey: 'unlock.spikeReinforced.name',
    blurbKey: 'unlock.spikeReinforced.blurb',
    cost: UNLOCK_COST.spikeReinforced,
    requires: 'spikeStone',
    tier: 1
  },
  {
    id: 'double',
    branch: 'turret',
    nameKey: 'unlock.double.name',
    blurbKey: 'unlock.double.blurb',
    cost: UNLOCK_COST.double,
    tier: 0
  },
  {
    id: 'heavy',
    branch: 'turret',
    nameKey: 'unlock.heavy.name',
    blurbKey: 'unlock.heavy.blurb',
    cost: UNLOCK_COST.heavy,
    tier: 0
  },
  {
    id: 'minigun',
    branch: 'turret',
    nameKey: 'unlock.minigun.name',
    blurbKey: 'unlock.minigun.blurb',
    cost: UNLOCK_COST.minigun,
    requires: 'double',
    tier: 1
  },
  {
    id: 'explosive',
    branch: 'turret',
    nameKey: 'unlock.explosive.name',
    blurbKey: 'unlock.explosive.blurb',
    cost: UNLOCK_COST.explosive,
    requires: 'heavy',
    tier: 1
  }
]

/** Ajoute à une liste de compétences celles qu'elles exigent (une sauvegarde ancienne peut en manquer). */
export function closeUnlocks(ids: readonly UnlockId[]): UnlockId[] {
  const out = new Set<UnlockId>(ids)
  for (let again = true; again; ) {
    again = false
    for (const u of UNLOCKS) {
      if (out.has(u.id) && u.requires && !out.has(u.requires)) {
        out.add(u.requires)
        again = true
      }
    }
  }
  return [...out]
}

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

export type PerkId = 'speed' | 'fireRate' | 'range' | 'damage' | 'bulletSpeed' | 'overclock' | 'precision' | 'turrets' | 'fireBullets' | 'spikes'

export interface PerkDef {
  id: PerkId
  /**
   * `soldier` : améliore le joueur · `tech` : améliore ses défenses (colonne Technologie) ·
   * `passive` : capacité passive, toujours active une fois débloquée (jamais équipée) ·
   * `ability` : capacité active, à équiper (jusqu'à ABILITY_SLOTS) et à déclencher en jeu.
   */
  group: 'soldier' | 'tech' | 'passive' | 'ability'
  /** Clés de traduction (i18n) : nom et description ; `blurbParams` : valeurs insérées dans la description. */
  nameKey: string
  blurbKey: string
  blurbParams?: Record<string, number>
  /** Prix de chaque rang (la longueur donne le rang maximum). */
  costs: readonly number[]
  /** Bonus par rang, en fraction de la valeur de base (0,1 = +10 %). Sans objet pour l'Overclocking (voir OVERCLOCK_LEVELS). */
  perRank: number
}

/** L'ordre fixe la position dans la sauvegarde et dans le message réseau : seulement ajouter à la fin. */
export const PERKS: readonly PerkDef[] = [
  { id: 'speed', group: 'soldier', nameKey: 'perk.speed.name', blurbKey: 'perk.speed.blurb', costs: PERK_BALANCE.speed.costs, perRank: PERK_BALANCE.speed.perRank },
  { id: 'fireRate', group: 'soldier', nameKey: 'perk.fireRate.name', blurbKey: 'perk.fireRate.blurb', costs: PERK_BALANCE.fireRate.costs, perRank: PERK_BALANCE.fireRate.perRank },
  { id: 'range', group: 'soldier', nameKey: 'perk.range.name', blurbKey: 'perk.range.blurb', costs: PERK_BALANCE.range.costs, perRank: PERK_BALANCE.range.perRank },
  { id: 'damage', group: 'soldier', nameKey: 'perk.damage.name', blurbKey: 'perk.damage.blurb', costs: PERK_BALANCE.damage.costs, perRank: PERK_BALANCE.damage.perRank },
  { id: 'precision', group: 'soldier', nameKey: 'perk.precision.name', blurbKey: 'perk.precision.blurb', costs: PERK_BALANCE.precision.costs, perRank: PERK_BALANCE.precision.perRank },
  { id: 'bulletSpeed', group: 'soldier', nameKey: 'perk.bulletSpeed.name', blurbKey: 'perk.bulletSpeed.blurb', costs: PERK_BALANCE.bulletSpeed.costs, perRank: PERK_BALANCE.bulletSpeed.perRank },
  {
    id: 'overclock',
    group: 'passive',
    nameKey: 'perk.overclock.name',
    blurbKey: 'perk.overclock.blurb',
    costs: PERK_BALANCE.overclock.costs,
    perRank: PERK_BALANCE.overclock.perRank
  },
  {
    id: 'turrets',
    group: 'tech',
    nameKey: 'perk.turrets.name',
    blurbKey: 'perk.turrets.blurb',
    blurbParams: { base: TURRET_LIMIT.base, max: TURRET_LIMIT.base + TURRET_LIMIT.perRank * PERK_BALANCE.turrets.costs.length },
    costs: PERK_BALANCE.turrets.costs,
    perRank: PERK_BALANCE.turrets.perRank
  },
  {
    id: 'fireBullets',
    group: 'ability',
    nameKey: 'perk.fireBullets.name',
    blurbKey: 'perk.fireBullets.blurb',
    costs: PERK_BALANCE.fireBullets.costs,
    perRank: PERK_BALANCE.fireBullets.perRank
  },
  {
    id: 'spikes',
    group: 'tech',
    nameKey: 'perk.spikes.name',
    blurbKey: 'perk.spikes.blurb',
    blurbParams: { base: SPIKE_LIMIT.base, max: SPIKE_LIMIT.base + SPIKE_LIMIT.perRank * PERK_BALANCE.spikes.costs.length },
    costs: PERK_BALANCE.spikes.costs,
    perRank: PERK_BALANCE.spikes.perRank
  }
]

// ------------------------------------------------------------- capacités actives

/** L'ordre fixe l'index envoyé sur le réseau : seulement ajouter à la fin. `perk` : l'amélioration qui la débloque (rang 1) et la fait progresser. */
export const ABILITIES = [{ id: 'fireBullets', perk: 'fireBullets' }] as const
export type AbilityId = (typeof ABILITIES)[number]['id']
export { ABILITY_SLOTS }

export const ABILITY_INDEX: Readonly<Record<AbilityId, number>> = Object.fromEntries(ABILITIES.map((a, i) => [a.id, i])) as Record<AbilityId, number>

/** Rang de l'amélioration qui gouverne une capacité (0 = verrouillée). */
export const abilityRank = (perks: readonly number[], id: AbilityId): number => perks[PERK_INDEX[ABILITIES[ABILITY_INDEX[id]].perk]] ?? 0

/** Capacités équipées reçues du réseau ou de la sauvegarde (identifiants ou index) : uniques, débloquées, au plus ABILITY_SLOTS. */
export function sanitizeAbilities(v: unknown, perks: readonly number[]): AbilityId[] {
  const out: AbilityId[] = []
  if (!Array.isArray(v)) return out
  for (const x of v) {
    const a = typeof x === 'number' ? ABILITIES[x] : ABILITIES.find((d) => d.id === x)
    if (a && !out.includes(a.id) && abilityRank(perks, a.id) > 0 && out.length < ABILITY_SLOTS) out.push(a.id)
  }
  return out
}

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

/** Nombre de tourelles qu'un joueur peut poser, selon le rang de l'amélioration « Tourelles ». */
/** Nombre de pieux qu'un joueur peut poser, selon le rang de l'amélioration « Pieux ». */
export const spikeCap = (perks: readonly number[]): number => SPIKE_LIMIT.base + (perks[PERK_INDEX.spikes] ?? 0) * SPIKE_LIMIT.perRank

export const turretCap = (perks: readonly number[]): number => TURRET_LIMIT.base + (perks[PERK_INDEX.turrets] ?? 0) * TURRET_LIMIT.perRank

/** Tout ce qu'un joueur apporte en partie : compétences débloquées (bits), rangs d'améliorations et apparence. */
export interface Loadout {
  unlocks: number
  perks: number[]
  /** Capacités actives équipées pour la partie (dans l'ordre des touches). */
  abilities: AbilityId[]
  look: Look
}

export const emptyLoadout = (slot = 0): Loadout => ({ unlocks: 0, perks: emptyPerks(), abilities: [], look: defaultLook(slot) })

// -------------------------------------------------------------------------- gains

/** Ordre des compteurs de kills (partagé avec le réseau). `minion` : petits issus d'une division. */
export const KILL_KINDS = ['grunt', 'runner', 'brute', 'boss', 'splitter', 'minion', 'spider', 'rageboss', 'spitter', 'jumper'] as const
export type KillKind = (typeof KILL_KINDS)[number]

export const killIndex = (kind: EnemyKind, minion: boolean): number => (minion ? 5 : KILL_KINDS.indexOf(kind))

/** Points rapportés par un monstre abattu. */
export const KILL_POINTS: Readonly<Record<KillKind, number>> = SCORE.killPoints
/** Points par vague atteinte. */
export const WAVE_POINTS = SCORE.wavePoints
/** Chaque vague atteinte augmente le total de 10 % : tenir longtemps est récompensé. */
export const WAVE_BONUS = SCORE.waveBonus

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
  /** Capacités actives équipées (au plus ABILITY_SLOTS, parmi celles débloquées). */
  abilities: AbilityId[]
  /** Skins achetés (le skin « aucun » est toujours disponible). */
  skins: SkinId[]
  /** Apparence de chaque emplacement : joueur 1 et joueur 2 (même clavier). La couleur est libre. */
  looks: [Look, Look]
}

export const emptyProgress = (): SavedProgress => ({
  points: 0,
  unlocked: [],
  perks: emptyPerks(),
  abilities: [],
  skins: ['none'],
  looks: [defaultLook(0), defaultLook(1)]
})

export const sanitizeSkins = (v: unknown): SkinId[] => [...new Set<SkinId>(['none', ...(Array.isArray(v) ? v.filter(isSkinId) : [])])]

export const sanitizeLooks = (v: unknown): [Look, Look] => {
  const a = Array.isArray(v) ? v : []
  return [sanitizeLook(a[0], 0), sanitizeLook(a[1], 1)]
}

/** Ce qu'apporte l'emplacement de joueur `slot` (0 = joueur 1, 1 = joueur 2 au même clavier). */
export const loadoutOf = (p: SavedProgress, slot = 0): Loadout => {
  const perks = sanitizePerks(p.perks)
  return { unlocks: unlockMask(p.unlocked), perks, abilities: sanitizeAbilities(p.abilities, perks), look: p.looks[slot] ?? p.looks[0] }
}
