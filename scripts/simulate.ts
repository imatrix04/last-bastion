// Simulation sans interface : vérifie que la logique de jeu tient la route.
// Usage : npm run sim
import { placeBuilding, upgradeBuilding } from '../src/renderer/src/game/build'
import { BASE, BUILDS, COLS, ROWS, STEP, TURRET_BRANCHES, type BuildKind } from '../src/renderer/src/game/constants'
import { SKIP_WAVE, type InputLike } from '../src/renderer/src/game/controls'
import { idx, isBaseCell } from '../src/renderer/src/game/grid'
import { createState } from '../src/renderer/src/game/state'
import { nextUpgrade } from '../src/renderer/src/game/stats'
import type { GameState } from '../src/renderer/src/game/types'
import { step } from '../src/renderer/src/game/update'
import { createEnemy } from '../src/renderer/src/game/waves'

const TURRET_SPOTS: Array<[number, number]> = [
  [12, 5], [19, 5], [12, 12], [19, 12], [16, 4], [16, 13], [11, 9], [20, 9],
  [13, 3], [18, 3], [13, 14], [18, 14], [9, 7], [22, 7], [9, 11], [22, 11]
]

interface Options {
  label: string
  players: 1 | 2
  turrets: boolean
  maze: boolean
  maxWaves: number
  maxMinutes: number
}

function tryBuy(state: GameState, kind: BuildKind, col: number, row: number): boolean {
  if (state.grid[idx(col, row)] || isBaseCell(col, row)) return false
  if (state.gold < BUILDS[kind].cost) return false
  state.gold -= BUILDS[kind].cost
  placeBuilding(state, kind, col, row)
  return true
}

/** Le bot améliore ses tourelles dès qu'il en a les moyens (niveau 3 : double canon / canon lourd en alternance). */
function botUpgrade(state: GameState): void {
  let flip = 0
  for (const b of state.grid) {
    if (!b || b.kind !== 'turret') continue
    const next = nextUpgrade(b)
    if (!next) continue
    if (next.mode === 'direct') {
      if (state.gold < next.cost) continue
      state.gold -= next.cost
      upgradeBuilding(state, b)
    } else {
      const branch = ((b.col + b.row + flip++) % 2 === 0 ? 1 : 2) as 1 | 2
      if (state.gold < TURRET_BRANCHES[branch].cost) continue
      state.gold -= TURRET_BRANCHES[branch].cost
      upgradeBuilding(state, b, branch)
    }
  }
}

function botPrep(state: GameState, o: Options): void {
  if (o.turrets) {
    for (const [c, r] of TURRET_SPOTS) tryBuy(state, 'turret', c, r)
    // Anneau de barricades renforcées en pierre autour de la forteresse avec le surplus d'or
    const ring: Array<[number, number]> = []
    for (let c = BASE.col - 3; c <= BASE.col + BASE.cols + 2; c++) ring.push([c, BASE.row - 3], [c, BASE.row + BASE.rows + 2])
    for (const [c, r] of ring) {
      if (!tryBuy(state, 'barricade', c, r)) continue
      const b = state.grid[idx(c, r)]
      const next = b ? nextUpgrade(b) : null
      if (b && next && state.gold >= next.cost) {
        state.gold -= next.cost
        upgradeBuilding(state, b)
      }
    }
    botUpgrade(state)
  }
  if (o.maze) {
    for (let i = 0; i < 8; i++) {
      const c = 1 + Math.floor(Math.random() * (COLS - 2))
      const r = 1 + Math.floor(Math.random() * (ROWS - 2))
      const b = placeBuilding(state, 'barricade', c, r)
      if (Math.random() < 0.5) upgradeBuilding(state, b)
    }
  }
}

function run(o: Options): { ok: boolean } {
  const state = createState(o.players)
  const input: InputLike = {
    isDown: () => false,
    wasPressed: (code) => code === SKIP_WAVE && state.phase === 'prep'
  }

  // Tout doit être atteignable depuis n'importe quelle case.
  for (let i = 0; i < state.flow.length; i++) {
    if (!Number.isFinite(state.flow[i])) throw new Error(`case inatteignable : ${i}`)
  }

  let lastWave = 0
  let waveStart = 0
  let worstWave = 0
  let maxAlive = 0
  let problems = 0
  const maxSteps = Math.round((o.maxMinutes * 60) / STEP)

  for (let s = 0; s < maxSteps && !state.gameOver; s++) {
    if (state.phase === 'prep' && state.countdown === 20 || (state.phase === 'prep' && state.wave === 0 && s === 0)) {
      botPrep(state, o)
    }
    step(state, STEP, input)

    if (state.wave !== lastWave) {
      if (lastWave > 0) worstWave = Math.max(worstWave, state.time - waveStart)
      lastWave = state.wave
      waveStart = state.time
      if (state.wave > o.maxWaves) break
    }
    maxAlive = Math.max(maxAlive, state.enemies.length)
    for (const e of state.enemies) {
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
        problems++
        throw new Error('position non finie')
      }
    }
    // Une vague qui dure plus de 5 minutes de jeu = ennemis coincés.
    if (state.phase === 'combat' && state.time - waveStart > 300) {
      problems++
      console.log(`  ! vague ${state.wave} bloquée (${state.enemies.length} ennemis restants)`)
      break
    }
  }

  const mins = (state.time / 60).toFixed(1)
  console.log(
    `${o.label.padEnd(34)} vague ${String(state.wave).padStart(2)} | ${state.gameOver ? 'FORTERESSE TOMBÉE' : 'toujours debout  '} | ` +
      `${mins} min | ${state.kills} kills | max ${maxAlive} ennemis | vague la plus longue ${worstWave.toFixed(0)}s`
  )
  return { ok: problems === 0 }
}

/** Un Éclateur qui meurt donne 4 Rôdeurs, et la vague ne se termine pas avant eux. */
function checkSplitter(): boolean {
  const state = createState(1)
  state.wave = 5
  state.waveScale = 1.4
  state.phase = 'combat'
  state.spawnQueue = []
  state.countdown = 0
  const e = createEnemy(state, 'splitter', 300, 300)
  state.enemies.push(e)
  const idle: InputLike = { isDown: () => false, wasPressed: () => false }
  e.hp = 0
  step(state, STEP, idle)
  const grunts = state.enemies.filter((x) => x.kind === 'grunt' && x.minion).length
  const okSplit = state.enemies.length === 4 && grunts === 4
  const okPhase = state.phase === 'combat' && state.kills === 1
  const finite = state.enemies.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y) && x.hp > 0)
  console.log(`Éclateur -> 4 Rôdeurs${' '.repeat(14)} ${okSplit && okPhase && finite ? 'OK' : 'ÉCHEC'} (${state.enemies.length} ennemis, phase ${state.phase})`)
  return okSplit && okPhase && finite
}

const runs: Options[] = [
  { label: 'Solo, sans défense', players: 1, turrets: false, maze: false, maxWaves: 30, maxMinutes: 30 },
  { label: 'Duo, sans défense', players: 2, turrets: false, maze: false, maxWaves: 30, maxMinutes: 30 },
  { label: 'Solo, tourelles + murs', players: 1, turrets: true, maze: false, maxWaves: 20, maxMinutes: 60 },
  { label: 'Duo, tourelles + murs', players: 2, turrets: true, maze: false, maxWaves: 20, maxMinutes: 60 },
  { label: 'Solo, labyrinthes aléatoires', players: 1, turrets: true, maze: true, maxWaves: 20, maxMinutes: 60 },
  { label: 'Duo, labyrinthes aléatoires', players: 2, turrets: true, maze: true, maxWaves: 20, maxMinutes: 60 }
]

let allOk = checkSplitter()
for (const r of runs) {
  const { ok } = run(r)
  allOk = allOk && ok
}
console.log(allOk ? '\nOK : aucune vague bloquée, aucune position invalide.' : '\nÉCHEC : voir les messages ci-dessus.')
process.exit(allOk ? 0 : 1)
