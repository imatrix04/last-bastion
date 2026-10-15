import { TURRET_BREAK_COST, TURRET_PLACE_COST, TURRET_PLAIN } from './turrets'

// Monde : grille de 32 x 18 cases de 40 px => 1280 x 720
export const TILE = 40
export const COLS = 32
export const ROWS = 18
export const WIDTH = COLS * TILE
export const HEIGHT = ROWS * TILE

/** La forteresse à défendre, au centre de la carte. */
/** 3 x 3 cases : la grille est paire (32 x 18), le centre tombe donc à un demi-tile près du milieu de la carte. */
export const BASE = { col: 15, row: 7, cols: 3, rows: 3, maxHp: 1200 }

export const PLAYER = {
  radius: 13,
  speed: 150,
  fireRate: 2.5,
  damage: 12,
  range: 250,
  bulletSpeed: 620
}
export const PLAYER_COLORS = ['#4fc3f7', '#f06292']

export const STEP = 1 / 60
export const START_GOLD = 60
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

/** Niveaux des pieux : bois, pierre, pierre renforcé. Le niveau 1 se paie à la pose. */
export interface SpikeLevel {
  name: string
  cost: number
  hp: number
  /** Dégâts par seconde aux ennemis qui marchent dessus. */
  dps: number
  /** Usure du piège par seconde et par ennemi dessus. */
  wearPerSec: number
  /** Multiplicateur de vitesse des ennemis dessus (0,65 = 35 % plus lents). */
  slow: number
  unlock?: TierUnlock
  debris: string
}
export const SPIKE_LEVELS: readonly SpikeLevel[] = [
  { name: 'Pieux en bois', cost: 45, hp: 220, dps: 30, wearPerSec: 14, slow: 0.65, debris: '#b08a55' },
  { name: 'Pieux en pierre', cost: 60, hp: 380, dps: 44, wearPerSec: 12, slow: 0.55, unlock: 'spikeStone', debris: '#a9afbd' },
  { name: 'Pieux en pierre renforcé', cost: 90, hp: 550, dps: 62, wearPerSec: 9, slow: 0.45, unlock: 'spikeReinforced', debris: '#cfd8dc' }
]

export const BUILDS: Record<BuildKind, BuildDef> = {
  barricade: { kind: 'barricade', name: 'Mur en bois', cost: 15, hp: 110, solid: true, breakCost: 5 },
  turret: { kind: 'turret', name: 'Tourelle', cost: TURRET_PLACE_COST, hp: TURRET_PLAIN[0].stats.hp, solid: true, breakCost: TURRET_BREAK_COST },
  spikes: { kind: 'spikes', name: 'Pieux', cost: SPIKE_LEVELS[0].cost, hp: SPIKE_LEVELS[0].hp, solid: false, breakCost: 0 }
}
export const BUILD_ORDER: BuildKind[] = ['barricade', 'turret', 'spikes']

/** Compétences (progress.ts) qui débloquent un niveau de mur ou de pieux. */
export type TierUnlock = 'stone' | 'bronze' | 'reinforced' | 'spikeStone' | 'spikeReinforced'

/**
 * Niveaux de mur à partir du niveau 2, dans l'ordre. Le niveau 1 est le mur en bois (BUILDS.barricade).
 * Pour changer l'ordre ou en ajouter : modifier ce tableau, et la chaîne `requires` des compétences dans progress.ts.
 */
export interface WallTier {
  name: string
  /** Prix pour passer au niveau précédent → celui-ci. */
  cost: number
  hp: number
  breakCost: number
  unlock: TierUnlock
  /** Couleur des éclats quand il est touché. */
  debris: string
}
export const BARRICADE_TIERS: readonly WallTier[] = [
  { name: 'Mur en pierre', cost: 45, hp: 320, breakCost: 14, unlock: 'stone', debris: '#a9afbd' },
  { name: 'Mur en bronze', cost: 60, hp: 600, breakCost: 19, unlock: 'bronze', debris: '#c47a3a' },
  { name: 'Mur en pierre renforcé', cost: 80, hp: 910, breakCost: 26, unlock: 'reinforced', debris: '#cfd8dc' }
]

/** Overclocking : multiplicateur de cadence de tir selon le rang de la compétence (1 à 5), de ×1,2 à ×2. */
export const OVERCLOCK_LEVELS: readonly number[] = [1.2, 1.4, 1.6, 1.8, 2]

/** Toile de l'araignée : posée sur une arme de défense, elle réduit sa cadence de tir. */
export const WEB = {
  /** Portée de crachat (px). */
  range: 180,
  /** Secondes entre deux toiles. */
  cooldown: 4.5,
  /** Préparation avant le tir : l'araignée se dresse, le joueur peut réagir. */
  windup: 0.75,
  /** Vol de la toile (s). */
  flight: 0.4,
  /** Durée du ralentissement (s). */
  duration: 5,
  /** Multiplicateur de cadence sous la toile. */
  slow: 0.4
}

/** Apparence des projectiles : 0 joueur, 1 tourelle, 2 obus lourd. */
export const BULLET_STYLES: ReadonlyArray<{ color: string; radius: number }> = [
  { color: '#fff59d', radius: 3 },
  { color: '#80deea', radius: 3 },
  { color: '#ffb74d', radius: 6 }
]

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'splitter' | 'boss' | 'spider'

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
  grunt: { name: 'Rôdeur', hp: 50, speed: 62, radius: 11, damage: 10, interval: 0.9, reward: 7, color: '#8bc34a' },
  runner: { name: 'Coureur', hp: 35, speed: 115, radius: 9, damage: 8, interval: 0.7, reward: 8, color: '#ffb74d' },
  brute: { name: 'Brute', hp: 370, speed: 40, radius: 15, damage: 38, interval: 1.3, reward: 24, color: '#ba68c8' },
  splitter: { name: 'Éclateur', hp: 230, speed: 46, radius: 14, damage: 25, interval: 1.2, reward: 12, color: '#26c6a2' },
  spider: { name: 'Araignée', hp: 190, speed: 72, radius: 15, damage: 14, interval: 0.9, reward: 22, color: '#9c2a4a' },
  boss: { name: 'Colosse', hp: 1300, speed: 32, radius: 18, damage: 90, interval: 1.6, reward: 180, color: '#e53935' }
}
