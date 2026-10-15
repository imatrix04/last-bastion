// Monde : grille de 32 x 18 cases de 40 px => 1280 x 720
export const TILE = 40
export const COLS = 32
export const ROWS = 18
export const WIDTH = COLS * TILE
export const HEIGHT = ROWS * TILE

/** La forteresse à défendre, au centre de la carte. */
export const BASE = { col: 14, row: 7, cols: 4, rows: 4, maxHp: 1200 }

export const PLAYER = {
  radius: 13,
  speed: 215,
  fireRate: 5,
  damage: 9,
  range: 280,
  bulletSpeed: 620
}
export const PLAYER_COLORS = ['#4fc3f7', '#f06292']

export const STEP = 1 / 60
export const START_GOLD = 140
export const FIRST_PREP = 30
export const PREP_TIME = 20
export const BUILD_REPEAT = 0.14

export type BuildKind = 'barricade' | 'turret' | 'spikes'

export interface BuildDef {
  kind: BuildKind
  name: string
  /** Prix de pose (niveau 1). */
  cost: number
  /** PV au niveau 1. */
  hp: number
  /** Bloque les déplacements (joueurs et ennemis). */
  solid: boolean
  /** Coût de franchissement pour le pathfinding des ennemis (ils cassent ce qui bloque), niveau 1. */
  breakCost: number
}

export const BUILDS: Record<BuildKind, BuildDef> = {
  barricade: { kind: 'barricade', name: 'Barricade', cost: 10, hp: 120, solid: true, breakCost: 5 },
  turret: { kind: 'turret', name: 'Tourelle', cost: 90, hp: 140, solid: true, breakCost: 12 },
  spikes: { kind: 'spikes', name: 'Pieux', cost: 25, hp: 220, solid: false, breakCost: 0 }
}
export const BUILD_ORDER: BuildKind[] = ['barricade', 'turret', 'spikes']

/** Spécialisation d'une tourelle de niveau 3 : 0 = aucune, 1 = double canon, 2 = canon lourd. */
export type Branch = 0 | 1 | 2

/** La barricade se renforce en mur de pierre (niveau 2). */
export const BARRICADE_STONE = { name: 'Mur de pierre', cost: 25, hp: 420, breakCost: 14 }

export interface TurretStats {
  damage: number
  /** Tirs par seconde. */
  fireRate: number
  range: number
  hp: number
  bulletSpeed: number
}

/** Niveaux 1 et 2 (indice = niveau - 1). Le niveau 3 dépend de la branche choisie. */
export const TURRET_LEVELS: TurretStats[] = [
  { damage: 9, fireRate: 2.2, range: 240, hp: 140, bulletSpeed: 560 },
  { damage: 13, fireRate: 2.2, range: 240, hp: 180, bulletSpeed: 560 }
]
/** Prix pour passer la tourelle du niveau 1 au niveau 2. */
export const TURRET_L2_COST = 60

export interface TurretBranchDef {
  name: string
  blurb: string
  /** Prix pour passer du niveau 2 au niveau 3 avec cette branche. */
  cost: number
  stats: TurretStats
}

const L2 = TURRET_LEVELS[1]
export const TURRET_BRANCHES: Record<1 | 2, TurretBranchDef> = {
  1: {
    name: 'Double canon',
    blurb: 'Deux canons en alternance : cadence doublée.',
    cost: 110,
    stats: { ...L2, fireRate: L2.fireRate * 2, hp: 240 }
  },
  2: {
    name: 'Canon lourd',
    blurb: 'Un obus massif : dégâts triplés, portée accrue.',
    cost: 130,
    stats: { ...L2, damage: L2.damage * 3, range: 270, hp: 240, bulletSpeed: 640 }
  }
}

export const SPIKES = { dps: 30, wearPerSec: 14, slow: 0.65 }

/** Apparence des projectiles : 0 joueur, 1 tourelle, 2 obus lourd. */
export const BULLET_STYLES: ReadonlyArray<{ color: string; radius: number }> = [
  { color: '#fff59d', radius: 3 },
  { color: '#80deea', radius: 3 },
  { color: '#ffb74d', radius: 6 }
]

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'splitter' | 'boss'

export interface EnemyDef {
  name: string
  hp: number
  speed: number
  radius: number
  damage: number
  /** Secondes entre deux coups. */
  interval: number
  reward: number
  color: string
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: { name: 'Rôdeur', hp: 36, speed: 58, radius: 11, damage: 7, interval: 0.9, reward: 6, color: '#8bc34a' },
  runner: { name: 'Coureur', hp: 20, speed: 112, radius: 9, damage: 5, interval: 0.7, reward: 5, color: '#ffb74d' },
  brute: { name: 'Brute', hp: 190, speed: 40, radius: 15, damage: 26, interval: 1.3, reward: 20, color: '#ba68c8' },
  splitter: { name: 'Éclateur', hp: 150, speed: 44, radius: 14, damage: 20, interval: 1.2, reward: 10, color: '#26c6a2' },
  boss: { name: 'Colosse', hp: 1100, speed: 32, radius: 18, damage: 70, interval: 1.6, reward: 150, color: '#e53935' }
}
