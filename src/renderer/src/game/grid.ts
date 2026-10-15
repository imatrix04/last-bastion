import { BASE, BUILDS, COLS, ROWS, TILE } from './constants'
import type { Building, GameState, Vec } from './types'

export const idx = (col: number, row: number): number => row * COLS + col

export const inBounds = (col: number, row: number): boolean =>
  col >= 0 && row >= 0 && col < COLS && row < ROWS

export const isBaseCell = (col: number, row: number): boolean =>
  col >= BASE.col && col < BASE.col + BASE.cols && row >= BASE.row && row < BASE.row + BASE.rows

export function buildingAt(state: GameState, col: number, row: number): Building | null {
  return inBounds(col, row) ? state.grid[idx(col, row)] : null
}

/** Case qui bloque le passage : la forteresse ou un bâtiment solide. */
export function isSolidCell(state: GameState, col: number, row: number): boolean {
  if (!inBounds(col, row)) return false
  if (isBaseCell(col, row)) return true
  const b = state.grid[idx(col, row)]
  return b !== null && BUILDS[b.kind].solid
}

/** Distance entre un point et un rectangle (0 si le point est dedans). */
export function distToRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): number {
  const nx = Math.max(rx, Math.min(px, rx + rw))
  const ny = Math.max(ry, Math.min(py, ry + rh))
  return Math.hypot(px - nx, py - ny)
}

/** Repousse un cercle hors des cases solides voisines. */
export function resolveTiles(state: GameState, o: Vec, r: number): void {
  const c0 = Math.floor((o.x - r) / TILE)
  const c1 = Math.floor((o.x + r) / TILE)
  const r0 = Math.floor((o.y - r) / TILE)
  const r1 = Math.floor((o.y + r) / TILE)
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!isSolidCell(state, col, row)) continue
      const rx = col * TILE
      const ry = row * TILE
      const nx = Math.max(rx, Math.min(o.x, rx + TILE))
      const ny = Math.max(ry, Math.min(o.y, ry + TILE))
      const dx = o.x - nx
      const dy = o.y - ny
      const d2 = dx * dx + dy * dy
      if (d2 >= r * r) continue
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const push = r - d
        o.x += (dx / d) * push
        o.y += (dy / d) * push
      } else {
        // Centre à l'intérieur de la case : on sort par le bord le plus proche.
        const left = o.x - rx
        const right = rx + TILE - o.x
        const top = o.y - ry
        const bottom = ry + TILE - o.y
        const m = Math.min(left, right, top, bottom)
        if (m === left) o.x = rx - r
        else if (m === right) o.x = rx + TILE + r
        else if (m === top) o.y = ry - r
        else o.y = ry + TILE + r
      }
    }
  }
}
