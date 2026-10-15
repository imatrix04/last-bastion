import { BUILD_ORDER, type BuildKind, type EnemyKind } from './constants'
import type { Branch } from './turrets'
import { CONTROLS, SKIP_WAVE } from './controls'
import { isHexColor, skinIndex } from './appearance'
import { KILL_KINDS } from './progress'
import type { FxEvent, GameState } from './types'

/** À incrémenter à chaque changement du protocole : l'hôte refuse un client d'une autre version. */
export const PROTO_VERSION = 7
export const NET_PORT = 7777
/** Fréquence d'envoi de l'état du jeu par l'hôte : un état tous les 2 pas de simulation (60 Hz). */
export const SNAPSHOT_HZ = 30
/** Nombre de pas de simulation entre deux états envoyés. */
export const SNAPSHOT_STEPS = 2
/** L'invité affiche le monde avec ce retard (s) pour pouvoir interpoler entre deux états reçus : 3 états à 30 Hz. */
export const INTERP_DELAY = 0.1

// ------------------------------------------------------------------- entrées

/** Ce que le joueur distant envoie : des actions logiques, indépendantes de la disposition du clavier. */
export const ACTIONS = ['up', 'down', 'left', 'right', 'place', 'upgrade', 'remove', 'prev', 'next', 's0', 's1', 's2', 'skip'] as const
export type Action = (typeof ACTIONS)[number]
const ACTION_SET: ReadonlySet<string> = new Set(ACTIONS)

function codesFor(player: number): Record<Action, string> {
  const c = CONTROLS[player]
  return {
    up: c.up,
    down: c.down,
    left: c.left,
    right: c.right,
    place: c.place,
    upgrade: c.upgrade,
    remove: c.remove,
    prev: c.prev,
    next: c.next,
    s0: c.slots[0],
    s1: c.slots[1],
    s2: c.slots[2],
    skip: SKIP_WAVE
  }
}

/** CODES[0] : touches du joueur 1 ; CODES[1] : touches du joueur 2. */
export const CODES: readonly Record<Action, string>[] = [codesFor(0), codesFor(1)]

export function decodeInput(raw: Record<string, unknown>): { d: Action[]; p: Action[] } {
  const pick = (v: unknown): Action[] =>
    Array.isArray(v) ? v.filter((x): x is Action => typeof x === 'string' && ACTION_SET.has(x)).slice(0, ACTIONS.length) : []
  return { d: pick(raw.d), p: pick(raw.p) }
}

// ----------------------------------------------------------------- snapshots

const ENEMY_KINDS: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'boss', 'splitter', 'spider']

export const enemyKindAt = (i: number): EnemyKind | undefined => ENEMY_KINDS[i]
export const buildKindAt = (i: number): BuildKind | undefined => BUILD_ORDER[i]

const MAX_ENEMIES = 500
const MAX_BULLETS = 500
const MAX_BUILDINGS = 700
const MAX_FX = 200

/** État du jeu tel que le reçoit le joueur distant (chiffres arrondis, tableaux plats). */
export interface Snap {
  t: 'snap'
  /** Temps de simulation de l'hôte (s) : régulier, c'est lui qui date l'état. */
  ts: number
  gold: number
  baseHp: number
  wave: number
  /** 0 = préparation, 1 = combat */
  phase: 0 | 1
  countdown: number
  queued: number
  kills: number
  over: 0 | 1
  shake: number
  /** [x, y] */
  gates: number[][]
  /** Kills par type (ordre de KILL_KINDS) : sert au calcul des points de fin de partie chez l'invité. */
  kstats: number[]
  /** [x, y, angle de tir, objet sélectionné, dirX, dirY] */
  players: number[][]
  /** Apparence de chaque joueur : [couleur « #rrggbb », index du skin] */
  looks: Array<[string, number]>
  /** [id, type, x, y, pv, pvMax, drapeaux : 1 = flash de dégâts, 2 = attaque en cours, 4 = crache une toile] */
  enemies: number[][]
  /** [x, y, vx, vy, style] (style : index dans BULLET_STYLES) */
  bullets: number[][]
  /** [type, col, row, pv, niveau, branche, rang d'overclocking 0 à 5, toile restante en dixièmes de seconde] */
  buildings: number[][]
  fx: FxEvent[]
}

const r1 = (v: number): number => Math.round(v * 10) / 10

export function encodeSnap(state: GameState): Snap {
  const buildings: number[][] = []
  for (const b of state.grid) if (b) buildings.push([BUILD_ORDER.indexOf(b.kind), b.col, b.row, Math.ceil(b.hp), b.level, b.branch, b.boost, Math.round(b.web * 10)])

  return {
    t: 'snap',
    ts: Math.round(state.time * 1000) / 1000,
    gold: Math.floor(state.gold),
    baseHp: Math.ceil(state.baseHp),
    wave: state.wave,
    phase: state.phase === 'combat' ? 1 : 0,
    countdown: r1(Math.max(0, state.countdown)),
    queued: state.spawnQueue.length,
    kills: state.kills,
    kstats: state.kstats.slice(),
    over: state.gameOver ? 1 : 0,
    shake: r1(state.shake),
    gates: state.gates.map((g) => [Math.round(g.x), Math.round(g.y)]),
    looks: state.players.map((p): [string, number] => [p.look.color, skinIndex(p.look.skin)]),
    players: state.players.map((p) => [r1(p.x), r1(p.y), Math.round(p.aim * 100) / 100, p.selected, p.dirX, p.dirY]),
    enemies: state.enemies.map((e) => [e.id, ENEMY_KINDS.indexOf(e.kind), r1(e.x), r1(e.y), Math.ceil(e.hp), e.maxHp, (e.flash > 0 ? 1 : 0) | (e.attacking ? 2 : 0) | (e.cast > 0 ? 4 : 0)]),
    bullets: state.bullets.map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.style]),
    buildings,
    fx: state.fxLog ? state.fxLog.slice(0, MAX_FX) : []
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const num = (v: unknown, fallback = 0): number => (isNum(v) ? v : fallback)
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Ne garde que les lignes bien formées (tableaux de nombres d'au moins `width` éléments). */
function rows(v: unknown, width: number, max: number): number[][] {
  if (!Array.isArray(v)) return []
  const out: number[][] = []
  for (const row of v) {
    if (out.length >= max) break
    if (Array.isArray(row) && row.length >= width && row.every(isNum)) out.push(row as number[])
  }
  return out
}

function decodeFx(v: unknown): FxEvent[] {
  if (!Array.isArray(v)) return []
  const out: FxEvent[] = []
  for (const e of v) {
    if (out.length >= MAX_FX || !Array.isArray(e)) continue
    if (e[0] === 'b' && isNum(e[1]) && isNum(e[2]) && typeof e[3] === 'string' && isNum(e[4]) && isNum(e[5])) {
      out.push(['b', e[1], e[2], e[3].slice(0, 20), clamp(e[4], 0, 60), clamp(e[5], 0, 400), clamp(Math.round(num(e[6])), 0, 3)])
    } else if (e[0] === 't' && isNum(e[1]) && isNum(e[2]) && typeof e[3] === 'string' && typeof e[4] === 'string') {
      out.push(['t', e[1], e[2], e[3].slice(0, 40), e[4].slice(0, 20)])
    } else if (e[0] === 'r' && isNum(e[1]) && isNum(e[2]) && typeof e[3] === 'string' && isNum(e[4])) {
      out.push(['r', e[1], e[2], e[3].slice(0, 20), clamp(e[4], 0, 300)])
    } else if (e[0] === 'm' && isNum(e[1]) && isNum(e[2]) && isNum(e[3]) && isNum(e[4])) {
      out.push(['m', e[1], e[2], e[3], clamp(Math.round(e[4]), 0, 3)])
    } else if (e[0] === 'w' && isNum(e[1]) && isNum(e[2]) && isNum(e[3]) && isNum(e[4])) {
      out.push(['w', e[1], e[2], e[3], e[4]])
    } else if (e[0] === 'd' && isNum(e[1]) && isNum(e[2]) && typeof e[3] === 'string' && isNum(e[4])) {
      out.push(['d', e[1], e[2], e[3].slice(0, 20), clamp(e[4], 0, 120)])
    }
  }
  return out
}

function decodeLooks(v: unknown): Array<[string, number]> {
  if (!Array.isArray(v)) return []
  const out: Array<[string, number]> = []
  for (const l of v.slice(0, 2)) {
    if (Array.isArray(l) && isHexColor(l[0]) && isNum(l[1])) out.push([l[0].toLowerCase(), Math.round(l[1])])
    else out.push(['', 0])
  }
  return out
}

/** Valide un message reçu du réseau ; renvoie null s'il est inutilisable. */
export function decodeSnap(raw: Record<string, unknown>): Snap | null {
  if (raw.t !== 'snap') return null
  const players = rows(raw.players, 6, 2)
  if (players.length < 2) return null
  return {
    t: 'snap',
    ts: num(raw.ts),
    gold: num(raw.gold),
    baseHp: num(raw.baseHp),
    wave: num(raw.wave),
    phase: raw.phase === 1 ? 1 : 0,
    countdown: num(raw.countdown),
    queued: clamp(num(raw.queued), 0, 100000),
    kills: num(raw.kills),
    kstats: Array.isArray(raw.kstats) ? raw.kstats.slice(0, KILL_KINDS.length).map((v) => Math.max(0, num(v))) : [],
    over: raw.over === 1 ? 1 : 0,
    shake: clamp(num(raw.shake), 0, 1),
    gates: rows(raw.gates, 2, 8),
    players,
    looks: decodeLooks(raw.looks),
    enemies: rows(raw.enemies, 7, MAX_ENEMIES),
    bullets: rows(raw.bullets, 5, MAX_BULLETS),
    buildings: rows(raw.buildings, 8, MAX_BUILDINGS),
    fx: decodeFx(raw.fx)
  }
}

// ------------------------------------------------------- choix d'une branche

/** L'invité a choisi la branche d'une tourelle de niveau 2 (le pop-up est chez lui, l'hôte valide). */
export function decodePick(raw: Record<string, unknown>): { col: number; row: number; branch: Branch } | null {
  const { c, r, b } = raw
  if (!isNum(c) || !isNum(r) || !Number.isInteger(c) || !Number.isInteger(r)) return null
  if (b !== 1 && b !== 2) return null
  return { col: c, row: r, branch: b }
}

// ----------------------------------------------------- position, mesure de latence

/** Position du joueur distant, décidée chez lui (l'hôte vérifie avant d'accepter). */
export function decodePose(raw: Record<string, unknown>): { x: number; y: number; dirX: number; dirY: number } | null {
  const { x, y, dx, dy } = raw
  if (!isNum(x) || !isNum(y)) return null
  const dir = (v: unknown): number => (v === -1 || v === 1 ? v : 0)
  return { x, y, dirX: dir(dx), dirY: dir(dy) }
}

/** Mesure de latence : l'invité envoie son horloge `c` et la latence qu'il a mesurée `r` (ms), l'hôte renvoie `c` tel quel. */
export function decodePing(raw: Record<string, unknown>): { c: number; r: number } | null {
  if (!isNum(raw.c)) return null
  return { c: raw.c, r: clamp(num(raw.r), 0, 5000) }
}
