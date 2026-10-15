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

export type BuildKind = 'barricade' | 'wall' | 'turret' | 'spikes'

export interface BuildDef {
  kind: BuildKind
  name: string
  cost: number
  hp: number
  /** Bloque les déplacements (joueurs et ennemis). */
  solid: boolean
  /** Coût de franchissement pour le pathfinding des ennemis (ils cassent ce qui bloque). */
  breakCost: number
}

export const BUILDS: Record<BuildKind, BuildDef> = {
  barricade: { kind: 'barricade', name: 'Barricade', cost: 10, hp: 120, solid: true, breakCost: 5 },
  wall: { kind: 'wall', name: 'Mur de pierre', cost: 30, hp: 420, solid: true, breakCost: 14 },
  turret: { kind: 'turret', name: 'Tourelle', cost: 90, hp: 140, solid: true, breakCost: 12 },
  spikes: { kind: 'spikes', name: 'Pieux', cost: 25, hp: 220, solid: false, breakCost: 0 }
}
export const BUILD_ORDER: BuildKind[] = ['barricade', 'wall', 'turret', 'spikes']

export const TURRET = { range: 240, fireRate: 2.2, damage: 9, bulletSpeed: 560 }
export const SPIKES = { dps: 30, wearPerSec: 14, slow: 0.65 }

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'boss'

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
  boss: { name: 'Colosse', hp: 1100, speed: 32, radius: 18, damage: 70, interval: 1.6, reward: 150, color: '#e53935' }
}
