import {
  BUILD_ORDER,
  BUILDS,
  COLS,
  ROWS,
  TILE,
  type BuildKind
} from './config/constants'
import { GAME } from './config/config'
import { addText, burst, ring, smoke, sparks } from './fx'
import { buildingAt, distToRect, idx, isBaseCell } from './grid'
import { PERK_INDEX, spikeCap, turretCap } from './config/progress'
import { branchUnlocked, investedCost, levelName, maxHpOf, nextUpgrade } from './stats'
import { TURRET_BRANCHES, TURRET_PLAIN_MAX, type Branch } from './config/turrets'
import type { Building, GameState, Player } from './types'

export type PlacementStatus = 'ok' | 'repair' | 'upgrade' | 'poor' | 'invalid' | 'occupied' | 'limit'

/** Distance maximale (en cases) entre un joueur et la tourelle qu'il spécialise à distance. */
const PICK_REACH = GAME.pickReach

/** Case ciblée : celle juste devant le joueur. */
export function buildTarget(p: Player): { col: number; row: number } {
  return { col: Math.floor(p.x / TILE) + p.dirX, row: Math.floor(p.y / TILE) + p.dirY }
}

/** On laisse libres le bord de la carte (couloirs d'apparition) et la forteresse. */
export function isBuildable(col: number, row: number): boolean {
  return col >= 1 && row >= 1 && col <= COLS - 2 && row <= ROWS - 2 && !isBaseCell(col, row)
}

/** Pieux encore debout posés par ce joueur. */
export function spikesOwned(state: GameState, owner: number): number {
  return state.grid.reduce((n, b) => (b && b.kind === 'spikes' && b.owner === owner ? n + 1 : n), 0)
}

/** Tourelles encore debout posées par ce joueur. */
export function turretsOwned(state: GameState, owner: number): number {
  return state.grid.reduce((n, b) => (b && b.kind === 'turret' && b.owner === owner ? n + 1 : n), 0)
}

export function placementStatus(state: GameState, p: Player, col: number, row: number): PlacementStatus {
  if (!isBuildable(col, row)) return 'invalid'
  const existing = buildingAt(state, col, row)
  if (existing) {
    if (existing.hp < existing.maxHp) return 'repair'
    // On n'améliore que ce qu'on a construit soi-même.
    if (existing.owner !== p.id) return 'occupied'
    const up = nextUpgrade(existing, p.unlocks)
    return up && !up.locked ? 'upgrade' : 'occupied'
  }
  for (const q of state.players) {
    if (Math.floor(q.x / TILE) === col && Math.floor(q.y / TILE) === row) return 'invalid'
  }
  // Un mur ou une tourelle ne se pose pas sur un monstre : il resterait coincé dedans et ne pourrait plus attaquer.
  if (BUILDS[BUILD_ORDER[p.selected]].solid && enemyOnTile(state, col, row)) return 'invalid'
  if (BUILD_ORDER[p.selected] === 'turret' && turretsOwned(state, p.id) >= turretCap(p.perks)) return 'limit'
  if (BUILD_ORDER[p.selected] === 'spikes' && spikesOwned(state, p.id) >= spikeCap(p.perks)) return 'limit'
  return p.gold >= BUILDS[BUILD_ORDER[p.selected]].cost ? 'ok' : 'poor'
}

/** Un monstre vivant touche-t-il cette case ? */
function enemyOnTile(state: GameState, col: number, row: number): boolean {
  for (const e of state.enemies) {
    if (e.hp > 0 && distToRect(e.x, e.y, col * TILE, row * TILE, TILE, TILE) < e.radius) return true
  }
  return false
}

/** Pose un bâtiment sans contrôle ni paiement (utilisé par la construction et les tests). */
/** `boost` : rang d'Overclocking du joueur qui construit (0 = aucun). */
export function placeBuilding(state: GameState, kind: BuildKind, col: number, row: number, boost = 0, owner = 0): Building {
  const def = BUILDS[kind]
  const b: Building = {
    kind,
    col,
    row,
    hp: def.hp,
    maxHp: def.hp,
    cooldown: 0,
    angle: 0,
    level: 1,
    branch: 0,
    pop: 0,
    recoil: 0,
    side: 1,
    boost,
    web: 0,
    repairCd: 0,
    owner
  }
  state.grid[idx(col, row)] = b
  if (def.solid) state.flowDirty = true
  return b
}

/**
 * Passe un bâtiment au niveau supérieur sans contrôle ni paiement.
 * `branch` ne sert que pour le passage à la spécialisation (niveau 4) d'une tourelle.
 */
export function upgradeBuilding(state: GameState, b: Building, branch: Branch = 0): void {
  const ratio = b.maxHp > 0 ? b.hp / b.maxHp : 1
  if (b.kind === 'turret' && b.level === TURRET_PLAIN_MAX) {
    if (branch === 0) return
    b.branch = branch
  }
  b.level += 1
  b.maxHp = maxHpOf(b.kind, b.level, b.branch)
  b.hp = Math.max(1, Math.round(b.maxHp * ratio))
  b.pop = 1
  // Le coût de franchissement d'une barricade change : les ennemis doivent recalculer leur trajet.
  if (BUILDS[b.kind].solid) state.flowDirty = true
}

function upgradeFx(state: GameState, b: Building): void {
  const cx = (b.col + 0.5) * TILE
  const cy = (b.row + 0.5) * TILE
  ring(state, cx, cy, '#ffd54a', 44)
  sparks(state, cx, cy, '#ffe082', 14, 190)
  smoke(state, cx, cy + 6, '#d7ccc8', 3, 45)
  const label = b.kind === 'turret' && b.branch === 0 ? `Niveau ${b.level}` : levelName(b)
  addText(state, cx, cy - 40, label, '#ffe082')
}

/** Construit sur la case ciblée, ou répare le bâtiment qui s'y trouve. `press` = front montant de la touche. */
export function actPlace(state: GameState, p: Player, press: boolean): boolean {
  const { col, row } = buildTarget(p)
  const cx = (col + 0.5) * TILE
  const cy = (row + 0.5) * TILE
  switch (placementStatus(state, p, col, row)) {
    case 'ok': {
      const kind = BUILD_ORDER[p.selected]
      p.gold -= BUILDS[kind].cost
      const b = placeBuilding(state, kind, col, row, p.perks[PERK_INDEX.overclock] ?? 0, p.id)
      b.pop = 0.7
      burst(state, cx, cy, '#d7ccc8', 6, 70)
      smoke(state, cx, cy + 8, '#a1887f', 3, 40)
      return true
    }
    case 'repair': {
      const b = buildingAt(state, col, row)
      if (!b) return false
      if (b.repairCd > 0) {
        if (press) addText(state, cx, cy - 20, `Réparation prête dans ${Math.ceil(b.repairCd)} s`, '#90caf9')
        return false
      }
      // Chaque réparation rend une part des PV max (50 % par défaut), puis la case est en recharge.
      const amount = Math.min(b.maxHp - b.hp, Math.ceil(b.maxHp * GAME.repair.fraction))
      // Une réparation complète coûte environ la moitié de l'or investi dans le bâtiment.
      const cost = Math.ceil((investedCost(b) * 0.5 * amount) / b.maxHp)
      if (p.gold < cost) {
        if (press) addText(state, p.x, p.y - 24, "Pas assez d'or", '#ff8a65')
        return false
      }
      p.gold -= cost
      b.hp += amount
      b.repairCd = GAME.repair.cooldown
      addText(state, cx, cy - 20, `+${Math.round((amount / b.maxHp) * 100)} % PV`, '#90caf9')
      sparks(state, cx, cy, '#80d8ff', 4, 90)
      burst(state, cx, cy, '#80d8ff', 2, 40, 3)
      return true
    }
    case 'poor':
      if (press) addText(state, p.x, p.y - 24, "Pas assez d'or", '#ff8a65')
      return false
    case 'limit':
      if (press) {
        const spikes = BUILD_ORDER[p.selected] === 'spikes'
        addText(state, p.x, p.y - 24, spikes ? `Limite : ${spikeCap(p.perks)} pieux` : `Limite : ${turretCap(p.perks)} tourelles`, '#ff8a65')
      }
      return false
    case 'invalid':
      if (press) addText(state, p.x, p.y - 24, 'Impossible ici', '#ff8a65')
      return false
    default:
      return false
  }
}

/**
 * Améliore le bâtiment ciblé. Pour une tourelle de niveau 3 rien n'est dépensé : on demande à l'interface
 * de proposer le choix de branche (`state.choice`), puis `applyTurretBranch` conclut.
 */
export function actUpgrade(state: GameState, p: Player): boolean {
  const { col, row } = buildTarget(p)
  const b = buildingAt(state, col, row)
  if (!b) {
    addText(state, p.x, p.y - 24, 'Rien à améliorer', '#b0bec5')
    return false
  }
  if (b.owner !== p.id) {
    addText(state, (col + 0.5) * TILE, (row + 0.5) * TILE - 20, `Appartient au Joueur ${b.owner + 1}`, '#b0bec5')
    return false
  }
  const next = nextUpgrade(b, p.unlocks)
  if (!next) {
    addText(state, (col + 0.5) * TILE, (row + 0.5) * TILE - 20, 'Niveau max', '#b0bec5')
    return false
  }
  if (next.locked) {
    addText(state, (col + 0.5) * TILE, (row + 0.5) * TILE - 20, 'Verrouillé (Compétences)', '#ce93d8')
    return false
  }
  if (p.gold < next.cost) {
    addText(state, p.x, p.y - 24, "Pas assez d'or", '#ff8a65')
    return false
  }
  if (next.mode === 'choice') {
    state.choice = { player: p.id, col, row }
    return true
  }
  p.gold -= next.cost
  upgradeBuilding(state, b)
  upgradeFx(state, b)
  return true
}

/**
 * Passe une tourelle de niveau 3 au niveau 4 avec la branche choisie. `player` : celui qui demande ;
 * il doit avoir débloqué la branche et être à portée de la tourelle.
 */
export function applyTurretBranch(state: GameState, col: number, row: number, branch: Branch, player: Player): boolean {
  if (branch !== 1 && branch !== 2) return false
  const b = buildingAt(state, col, row)
  if (!b || b.kind !== 'turret' || b.level !== TURRET_PLAIN_MAX || b.owner !== player.id) return false
  if (!branchUnlocked(player.unlocks, branch)) return false
  if (Math.hypot(player.x - (col + 0.5) * TILE, player.y - (row + 0.5) * TILE) > PICK_REACH * TILE) return false
  const cost = TURRET_BRANCHES[branch].levels[0].cost
  if (player.gold < cost) {
    addText(state, (col + 0.5) * TILE, (row + 0.5) * TILE - 20, "Pas assez d'or", '#ff8a65')
    return false
  }
  player.gold -= cost
  upgradeBuilding(state, b, branch)
  upgradeFx(state, b)
  state.shake = Math.min(1, state.shake + 0.08)
  return true
}

/** Démolit le bâtiment ciblé (le sien) et rembourse une partie de l'or investi selon son état. */
export function actRemove(state: GameState, p: Player): boolean {
  const { col, row } = buildTarget(p)
  const b = buildingAt(state, col, row)
  if (!b) return false
  if (b.owner !== p.id) {
    addText(state, (col + 0.5) * TILE, (row + 0.5) * TILE - 20, `Appartient au Joueur ${b.owner + 1}`, '#b0bec5')
    return false
  }
  const refund = Math.round(investedCost(b) * 0.5 * (b.hp / b.maxHp))
  p.gold += refund
  state.grid[idx(col, row)] = null
  if (BUILDS[b.kind].solid) state.flowDirty = true
  const cx = (col + 0.5) * TILE
  const cy = (row + 0.5) * TILE
  burst(state, cx, cy, '#bcaaa4', 8, 90)
  smoke(state, cx, cy, '#8d6e63', 3, 50)
  if (refund > 0) addText(state, cx, cy, `+${refund}`, '#ffd54a')
  return true
}
