import { BASE, BUILDS, COLS, ROWS } from './config/constants'
import { idx, inBounds, isBaseCell } from './grid'
import { breakCostOf } from './stats'
import type { GameState } from './types'

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0]
]

/** Coût pour entrer dans une case : 1, plus le prix à payer pour casser un bâtiment solide. */
export function cellCost(state: GameState, col: number, row: number): number {
  if (isBaseCell(col, row)) return 1
  const b = state.grid[idx(col, row)]
  if (b && BUILDS[b.kind].solid) return 1 + breakCostOf(b)
  return 1
}

/**
 * Champ de distance depuis la forteresse (Dijkstra par file avec re-relaxation).
 * Les bâtiments solides ne sont pas infranchissables : ils coûtent cher, donc les
 * ennemis contournent si c'est moins cher, sinon ils attaquent le point le plus faible.
 */
export function computeFlow(state: GameState): void {
  const dist = state.flow
  dist.fill(Infinity)
  const queue: number[] = []
  const inQueue = new Uint8Array(COLS * ROWS)

  for (let row = BASE.row; row < BASE.row + BASE.rows; row++) {
    for (let col = BASE.col; col < BASE.col + BASE.cols; col++) {
      const i = idx(col, row)
      dist[i] = 0
      queue.push(i)
      inQueue[i] = 1
    }
  }

  let head = 0
  while (head < queue.length) {
    const i = queue[head++]
    inQueue[i] = 0
    const col = i % COLS
    const row = Math.floor(i / COLS)
    // Un voisin qui passe par la case (col,row) paie son coût d'entrée.
    const through = dist[i] + cellCost(state, col, row)
    for (const [dc, dr] of DIRS) {
      const nc = col + dc
      const nr = row + dr
      if (!inBounds(nc, nr)) continue
      const j = idx(nc, nr)
      if (through < dist[j]) {
        dist[j] = through
        if (!inQueue[j]) {
          inQueue[j] = 1
          queue.push(j)
        }
      }
    }
  }
  state.flowDirty = false
}

/** Case voisine à rejoindre pour se rapprocher de la forteresse au moindre coût. */
export function nextCell(state: GameState, col: number, row: number): { col: number; row: number } | null {
  let best: { col: number; row: number } | null = null
  let bestVal = Infinity
  for (const [dc, dr] of DIRS) {
    const nc = col + dc
    const nr = row + dr
    if (!inBounds(nc, nr)) continue
    const val = cellCost(state, nc, nr) + state.flow[idx(nc, nr)]
    if (val < bestVal) {
      bestVal = val
      best = { col: nc, row: nr }
    }
  }
  return best
}
