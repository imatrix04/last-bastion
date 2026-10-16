import {
  BASE_CONFIG,
  ENEMY_STATS,
  GAME,
  OVERCLOCK_LEVELS as OVERCLOCK_CONFIG,
  PLAYER_COLORS as PLAYER_COLORS_CONFIG,
  PLAYER_CONFIG,
  SPIKE_TIERS,
  WALL_BASE,
  WALL_TIERS,
  WEB_CONFIG,
  WORLD
} from './config'
import { TURRET_BREAK_COST, TURRET_PLACE_COST, TURRET_PLAIN } from './turrets'

// Les valeurs modifiables sont dans config.ts ; ce fichier les expose sous leurs noms habituels et définit les types.


// Monde : grille de 32 x 18 cases de 40 px => 1280 x 720
export const TILE = WORLD.tile
export const COLS = WORLD.cols
export const ROWS = WORLD.rows
export const WIDTH = COLS * TILE
export const HEIGHT = ROWS * TILE

/** La forteresse à défendre, au centre de la carte. */
/** 3 x 3 cases : la grille est paire (32 x 18), le centre tombe donc à un demi-tile près du milieu de la carte. */
export const BASE = BASE_CONFIG

export const PLAYER = PLAYER_CONFIG
export const PLAYER_COLORS = PLAYER_COLORS_CONFIG

export const STEP = 1 / 60
export const START_GOLD = GAME.startGold
export const FIRST_PREP = GAME.firstPrep
export const PREP_TIME = GAME.prepTime
export const BUILD_REPEAT = GAME.buildRepeat

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
export const SPIKE_LEVELS: readonly SpikeLevel[] = SPIKE_TIERS

export const BUILDS: Record<BuildKind, BuildDef> = {
  barricade: { kind: 'barricade', name: 'Mur en bois', cost: WALL_BASE.cost, hp: WALL_BASE.hp, solid: true, breakCost: WALL_BASE.breakCost },
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
export const BARRICADE_TIERS: readonly WallTier[] = WALL_TIERS

/** Overclocking : multiplicateur de cadence de tir selon le rang de la compétence (1 à 5), de ×1,2 à ×2. */
export const OVERCLOCK_LEVELS: readonly number[] = OVERCLOCK_CONFIG

/** Toile de l'araignée : posée sur une arme de défense, elle réduit sa cadence de tir. */
export const WEB = WEB_CONFIG

/** Apparence des projectiles : 0 joueur, 1 tourelle, 2 obus lourd, 3 minigun, 4 obus explosif. */
export const BULLET_STYLES: ReadonlyArray<{ color: string; radius: number }> = [
  { color: '#fff59d', radius: 3 },
  { color: '#80deea', radius: 3 },
  { color: '#ffb74d', radius: 6 },
  { color: '#fff176', radius: 2.5 },
  { color: '#ff7043', radius: 7 }
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

export const ENEMIES: Record<EnemyKind, EnemyDef> = ENEMY_STATS
