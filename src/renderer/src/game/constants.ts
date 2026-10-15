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

export const BUILDS: Record<BuildKind, BuildDef> = {
  barricade: { kind: 'barricade', name: 'Mur en bois', cost: 15, hp: 110, solid: true, breakCost: 5 },
  turret: { kind: 'turret', name: 'Tourelle', cost: 120, hp: 180, solid: true, breakCost: 12 },
  spikes: { kind: 'spikes', name: 'Pieux', cost: 45, hp: 220, solid: false, breakCost: 0 }
}
export const BUILD_ORDER: BuildKind[] = ['barricade', 'turret', 'spikes']

/** Spécialisation d'une tourelle (niveau 4) : 0 = aucune, 1 = double canon, 2 = canon lourd. */
export type Branch = 0 | 1 | 2

/** La barricade se renforce en mur de pierre (niveau 2), compétence « Mur en pierre ». */
export const BARRICADE_STONE = { name: 'Mur en pierre', cost: 45, hp: 320, breakCost: 14 }
/** Puis en mur de pierre renforcé (niveau 3), compétence « Mur de pierre renforcé ». Valeurs de départ, à ajuster. */
export const BARRICADE_REINFORCED = { name: 'Mur en pierre renforcé', cost: 75, hp: 580, breakCost: 26 }

export interface TurretStats {
  damage: number
  /** Tirs par seconde. */
  fireRate: number
  range: number
  hp: number
  bulletSpeed: number
}

/** Niveaux 1 à 3 (indice = niveau - 1). Le niveau 4 dépend de la branche choisie (voir TURRET_BRANCHES). */
export const TURRET_LEVELS: TurretStats[] = [
  { damage: 13, fireRate: 2.2, range: 220, hp: 180, bulletSpeed: 560 },
  { damage: 19, fireRate: 2.2, range: 220, hp: 250, bulletSpeed: 560 },
  { damage: 26, fireRate: 2.4, range: 220, hp: 350, bulletSpeed: 560 }
]
/** Prix pour passer la tourelle du niveau 1 au niveau 2, puis du niveau 2 au niveau 3. */
export const TURRET_L2_COST = 150
export const TURRET_L3_COST = 250
/** Dernier niveau « simple » : à ce niveau l'amélioration suivante est le choix de branche (niveau suivant = spécialisation). */
export const TURRET_PLAIN_MAX = TURRET_LEVELS.length

export interface TurretBranchDef {
  name: string
  blurb: string
  /** Prix pour passer du dernier niveau simple à la spécialisation. */
  cost: number
  stats: TurretStats
}

const LAST = TURRET_LEVELS[TURRET_PLAIN_MAX - 1]
export const TURRET_BRANCHES: Record<1 | 2, TurretBranchDef> = {
  1: {
    name: 'Double canons',
    blurb: 'Double canons : double cadence.',
    cost: 370,
    stats: { ...LAST, fireRate: LAST.fireRate * 2, hp: 410 }
  },
  2: {
    name: 'Canon lourd',
    blurb: 'Un obus massif : dégâts triplés, portée accrue.',
    cost: 420,
    stats: { ...LAST, damage: LAST.damage * 3, range: 250, hp: 460, bulletSpeed: 640 }
  }
}

/** Compétence « Overclocking » : multiplie la cadence de tir de toutes les armes de défense construites par le joueur qui l'a. */
export const OVERCLOCK = { fireRate: 1.3 }

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

export const SPIKES = { dps: 30, wearPerSec: 14, slow: 0.65 }

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
