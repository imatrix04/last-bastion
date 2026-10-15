import { ENEMIES, HEIGHT, TILE, WIDTH, type EnemyKind } from './constants'
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
  const mult = players === 2 ? 1.6 : 1
  const grunts = Math.round((5 + wave * 2.2) * mult)
  const runners = wave >= 3 ? Math.round((1 + (wave - 3) * 1.3) * mult) : 0
  const brutes = wave >= 5 ? Math.round((1 + (wave - 5) * 0.7) * mult) : 0
  const bosses = wave % 5 === 0 ? Math.ceil(wave / 10) : 0

  const list: EnemyKind[] = []
  for (let i = 0; i < grunts; i++) list.push('grunt')
  for (let i = 0; i < runners; i++) list.push('runner')
  for (let i = 0; i < brutes; i++) list.push('brute')
  shuffle(list)
  for (let i = 0; i < bosses; i++) list.push('boss')
  return list
}

export const waveScale = (wave: number): number => 1 + (wave - 1) * 0.1

export const spawnInterval = (wave: number): number => Math.max(0.25, 0.8 - wave * 0.04)

/** Points d'entrée : 1 côté au début, jusqu'aux 4 côtés plus tard. */
export function pickGates(wave: number): Vec[] {
  const count = wave <= 2 ? 1 : wave <= 5 ? 2 : wave <= 9 ? 3 : 4
  const sides = shuffle(['top', 'right', 'bottom', 'left']).slice(0, count)
  return sides.map((side) => {
    const t = 0.25 + Math.random() * 0.5
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
  })
}

export function spawnEnemy(state: GameState, kind: EnemyKind): void {
  const def = ENEMIES[kind]
  const gate = state.gates[Math.floor(Math.random() * state.gates.length)]
  const onHorizontalEdge = gate.y < TILE || gate.y > HEIGHT - TILE
  const jitter = (Math.random() - 0.5) * 90
  const x = onHorizontalEdge ? Math.max(def.radius, Math.min(WIDTH - def.radius, gate.x + jitter)) : gate.x
  const y = onHorizontalEdge ? gate.y : Math.max(def.radius, Math.min(HEIGHT - def.radius, gate.y + jitter))
  const hp = Math.round(def.hp * state.waveScale)
  const enemy: Enemy = {
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
    lx: x,
    ly: y,
    checkT: 1.5,
    stuck: false
  }
  state.enemies.push(enemy)
}
