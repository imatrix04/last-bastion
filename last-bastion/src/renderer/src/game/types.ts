import type { BuildKind, EnemyKind } from './constants'

export interface Vec {
  x: number
  y: number
}

export interface Player {
  id: 0 | 1
  x: number
  y: number
  /** Direction cardinale visée pour construire (une case devant le joueur). */
  dirX: number
  dirY: number
  /** Angle de tir (vers l'ennemi le plus proche). */
  aim: number
  selected: number
  shootCd: number
  buildCd: number
}

export interface Enemy {
  id: number
  kind: EnemyKind
  x: number
  y: number
  radius: number
  hp: number
  maxHp: number
  attackCd: number
  flash: number
  attacking: boolean
  /** Détection de blocage : position au dernier contrôle et minuteur. */
  lx: number
  ly: number
  checkT: number
  stuck: boolean
}

export interface Building {
  kind: BuildKind
  col: number
  row: number
  hp: number
  maxHp: number
  cooldown: number
  angle: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  damage: number
  color: string
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
}

export type Phase = 'prep' | 'combat'

/** Effet visuel à rejouer chez l'autre joueur : particules ['b', x, y, couleur, nombre, vitesse] ou texte ['t', x, y, texte, couleur]. */
export type FxEvent = ['b', number, number, string, number, number] | ['t', number, number, string, string]

/** Ce que l'interface React a besoin de savoir (envoyé ~10 fois par seconde). */
export interface HudState {
  gold: number
  wave: number
  phase: Phase
  countdown: number
  baseHp: number
  baseMax: number
  /** Ennemis vivants + ennemis restant à faire apparaître. */
  enemies: number
  kills: number
  /** Objet de construction sélectionné par joueur. */
  selected: number[]
}

export interface RunResult {
  wave: number
  kills: number
}

export interface GameState {
  time: number
  playerCount: 1 | 2
  players: Player[]
  enemies: Enemy[]
  bullets: Bullet[]
  particles: Particle[]
  texts: FloatText[]
  /** Une entrée par case (COLS * ROWS). */
  grid: (Building | null)[]
  baseHp: number
  gold: number
  /** Numéro de la vague en cours (0 avant la première). */
  wave: number
  phase: Phase
  countdown: number
  spawnQueue: EnemyKind[]
  spawnTimer: number
  /** Points d'apparition de la prochaine vague / de la vague en cours. */
  gates: Vec[]
  waveScale: number
  /** Coût cumulé jusqu'à la forteresse, par case. */
  flow: Float32Array
  flowDirty: boolean
  nextEnemyId: number
  kills: number
  gameOver: boolean
  shake: number
  /** Hôte en ligne uniquement : effets à envoyer avec le prochain snapshot. */
  fxLog?: FxEvent[]
}
