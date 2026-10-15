import type { Branch, BuildKind, EnemyKind } from './constants'

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
  /** Cap affiché (radians), lissé à partir du déplacement. */
  face: number
  /** Secondes depuis l'apparition (animation d'entrée). */
  age: number
  /** Issu de la division d'un Éclateur : récompense réduite. */
  minion: boolean
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
  /** 1 à 3 : barricade (bois / pierre), tourelle (3 niveaux). */
  level: number
  branch: Branch
  /** Rendu seulement : rebond après une amélioration (1 → 0). */
  pop: number
  /** Rendu seulement : recul du canon après un tir (1 → 0). */
  recoil: number
  /** Canon qui a tiré en dernier (double canon) : -1 ou 1. */
  side: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  damage: number
  /** Index dans BULLET_STYLES. */
  style: number
}

/** 0 éclat carré · 1 étincelle (traînée additive) · 2 fumée · 3 lueur additive */
export type ParticleShape = 0 | 1 | 2 | 3

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  shape: ParticleShape
}

/** Onde de choc qui s'étend puis disparaît. */
export interface Ring {
  x: number
  y: number
  maxR: number
  life: number
  maxLife: number
  color: string
}

/** Tache au sol qui s'estompe lentement. */
export interface Decal {
  x: number
  y: number
  size: number
  life: number
  maxLife: number
  color: string
  /** Graine pour la forme des gouttes. */
  seed: number
}

export interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
}

export type Phase = 'prep' | 'combat'

/**
 * Effet visuel à rejouer chez l'autre joueur :
 * particules ['b', x, y, couleur, nombre, vitesse, style], texte ['t', x, y, texte, couleur],
 * onde de choc ['r', x, y, couleur, rayon], flash de bouche ['m', x, y, angle, style], tache ['d', x, y, couleur, taille].
 */
export type FxEvent =
  | ['b', number, number, string, number, number, number]
  | ['t', number, number, string, string]
  | ['r', number, number, string, number]
  | ['m', number, number, number, number]
  | ['d', number, number, string, number]

/** Un joueur veut améliorer une tourelle de niveau 2 : l'interface lui propose le choix de branche. */
export interface ChoiceRequest {
  player: number
  col: number
  row: number
}

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
  rings: Ring[]
  decals: Decal[]
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
  /** Demande de choix de branche, à relayer à l'interface puis effacer. */
  choice: ChoiceRequest | null
  /** Hôte en ligne uniquement : effets à envoyer avec le prochain snapshot. */
  fxLog?: FxEvent[]
}
