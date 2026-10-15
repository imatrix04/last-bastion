import { BUILD_ORDER, BUILDS, COLS, ROWS, TILE, type BuildKind } from './constants'
import { addText, burst } from './fx'
import { buildingAt, idx, isBaseCell } from './grid'
import type { Building, GameState, Player } from './types'

export type PlacementStatus = 'ok' | 'repair' | 'poor' | 'invalid' | 'occupied'

/** Case ciblée : celle juste devant le joueur. */
export function buildTarget(p: Player): { col: number; row: number } {
  return { col: Math.floor(p.x / TILE) + p.dirX, row: Math.floor(p.y / TILE) + p.dirY }
}

/** On laisse libres le bord de la carte (couloirs d'apparition) et la forteresse. */
export function isBuildable(col: number, row: number): boolean {
  return col >= 1 && row >= 1 && col <= COLS - 2 && row <= ROWS - 2 && !isBaseCell(col, row)
}

export function placementStatus(state: GameState, p: Player, col: number, row: number): PlacementStatus {
  if (!isBuildable(col, row)) return 'invalid'
  const existing = buildingAt(state, col, row)
  if (existing) return existing.hp < existing.maxHp ? 'repair' : 'occupied'
  for (const q of state.players) {
    if (Math.floor(q.x / TILE) === col && Math.floor(q.y / TILE) === row) return 'invalid'
  }
  return state.gold >= BUILDS[BUILD_ORDER[p.selected]].cost ? 'ok' : 'poor'
}

/** Pose un bâtiment sans contrôle ni paiement (utilisé par la construction et les tests). */
export function placeBuilding(state: GameState, kind: BuildKind, col: number, row: number): Building {
  const def = BUILDS[kind]
  const b: Building = { kind, col, row, hp: def.hp, maxHp: def.hp, cooldown: 0, angle: 0 }
  state.grid[idx(col, row)] = b
  if (def.solid) state.flowDirty = true
  return b
}

/** Construit sur la case ciblée, ou répare le bâtiment qui s'y trouve. `press` = front montant de la touche. */
export function actPlace(state: GameState, p: Player, press: boolean): boolean {
  const { col, row } = buildTarget(p)
  const cx = (col + 0.5) * TILE
  const cy = (row + 0.5) * TILE
  switch (placementStatus(state, p, col, row)) {
    case 'ok': {
      const kind = BUILD_ORDER[p.selected]
      state.gold -= BUILDS[kind].cost
      placeBuilding(state, kind, col, row)
      burst(state, cx, cy, '#d7ccc8', 6, 70)
      return true
    }
    case 'repair': {
      const b = buildingAt(state, col, row)
      if (!b) return false
      const amount = Math.min(b.maxHp - b.hp, 30)
      // Une réparation complète coûte environ la moitié du prix du bâtiment.
      const cost = Math.ceil((BUILDS[b.kind].cost * 0.5 * amount) / b.maxHp)
      if (state.gold < cost) {
        if (press) addText(state, p.x, p.y - 24, "Pas assez d'or", '#ff8a65')
        return false
      }
      state.gold -= cost
      b.hp += amount
      burst(state, cx, cy, '#80d8ff', 3, 50)
      return true
    }
    case 'poor':
      if (press) addText(state, p.x, p.y - 24, "Pas assez d'or", '#ff8a65')
      return false
    case 'invalid':
      if (press) addText(state, p.x, p.y - 24, 'Impossible ici', '#ff8a65')
      return false
    default:
      return false
  }
}

/** Démolit le bâtiment ciblé et rembourse une partie du prix selon son état. */
export function actRemove(state: GameState, p: Player): boolean {
  const { col, row } = buildTarget(p)
  const b = buildingAt(state, col, row)
  if (!b) return false
  const refund = Math.round(BUILDS[b.kind].cost * 0.5 * (b.hp / b.maxHp))
  state.gold += refund
  state.grid[idx(col, row)] = null
  if (BUILDS[b.kind].solid) state.flowDirty = true
  burst(state, (col + 0.5) * TILE, (row + 0.5) * TILE, '#bcaaa4', 8, 90)
  if (refund > 0) addText(state, (col + 0.5) * TILE, (row + 0.5) * TILE, `+${refund}`, '#ffd54a')
  return true
}
