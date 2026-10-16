import { WAVES } from './config/config'
import { ENEMIES, HEIGHT, TILE, WIDTH, isBossKind, type EnemyKind } from './config/constants'
import { smoke } from './fx'
import type { Enemy, GameState, Vec } from './types'

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Liste des ennemis d'une vague, dans l'ordre d'apparition. */
export function composeWave(wave: number, players: 1 | 2): EnemyKind[] {
  const mult = players === 2 ? WAVES.twoPlayerMult : 1
  const grown = (g: { from: number; base: number; perWave: number }): number =>
    wave >= g.from ? Math.round((g.base + (wave - g.from) * g.perWave) * mult) : 0
  const grunts = Math.round((WAVES.grunts.base + wave * WAVES.grunts.perWave) * mult)
  const runners = grown(WAVES.runners)
  const splitters = grown(WAVES.splitters)
  const brutes = grown(WAVES.brutes)
  const spiders = grown(WAVES.spiders)
  const bosses = wave % WAVES.boss.every === 0 ? Math.ceil(wave / WAVES.boss.per) : 0

  const list: EnemyKind[] = []
  for (let i = 0; i < grunts; i++) list.push('grunt')
  for (let i = 0; i < runners; i++) list.push('runner')
  for (let i = 0; i < brutes; i++) list.push('brute')
  for (let i = 0; i < splitters; i++) list.push('splitter')
  for (let i = 0; i < spiders; i++) list.push('spider')
  shuffle(list)
  // Aux vagues multiples de 10, le Colosse est remplacé par sa version enragée.
  const bossKind: EnemyKind = wave % WAVES.rageBoss.every === 0 ? 'rageboss' : 'boss'
  for (let i = 0; i < bosses; i++) list.push(bossKind)
  return list
}

export const waveScale = (wave: number): number => 1 + (wave - 1) * WAVES.hpGrowth

export const spawnInterval = (wave: number): number => Math.max(WAVES.spawn.min, WAVES.spawn.base - wave * WAVES.spawn.perWave)

/** Points d'entrée : 1 au début, jusqu'à 8 plus tard (répartis sur les 4 côtés, 2 par côté au maximum). */
export function pickGates(wave: number): Vec[] {
  const count = WAVES.gates.find((g) => wave <= g.upToWave)?.count ?? WAVES.maxGates
  const sides = shuffle(['top', 'right', 'bottom', 'left'])
  // Chaque côté reçoit ses entrées à tour de rôle, et se partage en tranches pour qu'elles ne se superposent pas.
  const perSide = [0, 0, 0, 0]
  for (let i = 0; i < count; i++) perSide[i % 4]++
  return sides.flatMap((side, s) => {
    const n = perSide[s]
    const span = 0.5 / n
    return Array.from({ length: n }, (_, j) => gateOn(side, 0.25 + j * span + Math.random() * span))
  })
}

/** Point d'entrée sur un côté, à la fraction `t` de ce côté. */
function gateOn(side: string, t: number): Vec {
  switch (side) {
    case 'top':
      return { x: WIDTH * t, y: TILE * 0.5 }
    case 'bottom':
      return { x: WIDTH * t, y: HEIGHT - TILE * 0.5 }
    case 'left':
      return { x: TILE * 0.5, y: HEIGHT * t }
    default:
      return { x: WIDTH - TILE * 0.5, y: HEIGHT * t }
  }
}

/** Crée un ennemi (sans l'ajouter à la partie). `hpMult` : fraction des PV normaux de ce type à cette vague. */
export function createEnemy(state: GameState, kind: EnemyKind, x: number, y: number, hpMult = 1, minion = false): Enemy {
  const def = ENEMIES[kind]
  const hp = Math.max(1, Math.round(def.hp * state.waveScale * hpMult))
  return {
    id: state.nextEnemyId++,
    kind,
    x,
    y,
    radius: def.radius,
    hp,
    maxHp: hp,
    attackCd: Math.random() * def.interval,
    flash: 0,
    attacking: false,
    face: Math.atan2(HEIGHT / 2 - y, WIDTH / 2 - x),
    age: 0,
    minion,
    abilityCd: 1 + Math.random() * 2,
    cast: 0,
    webCol: 0,
    webRow: 0,
    lx: x,
    ly: y,
    checkT: 1.5,
    stuck: false,
    vx: 0,
    vy: 0,
    burnT: 0,
    burnDps: 0
  }
}

/** Fait apparaître un ennemi à l'entrée `gateIndex` (au hasard si non précisée). */
export function spawnEnemy(state: GameState, kind: EnemyKind, gateIndex = Math.floor(Math.random() * state.gates.length)): void {
  const def = ENEMIES[kind]
  const gate = state.gates[gateIndex]
  const onHorizontalEdge = gate.y < TILE || gate.y > HEIGHT - TILE
  const jitter = (Math.random() - 0.5) * 90
  const x = onHorizontalEdge ? Math.max(def.radius, Math.min(WIDTH - def.radius, gate.x + jitter)) : gate.x
  const y = onHorizontalEdge ? gate.y : Math.max(def.radius, Math.min(HEIGHT - def.radius, gate.y + jitter))
  state.enemies.push(createEnemy(state, kind, x, y))
  smoke(state, x, y, '#8d6e63', isBossKind(kind) ? 8 : 3, 50)
}
