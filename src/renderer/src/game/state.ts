import { BASE, COLS, FIRST_PREP, ROWS, START_GOLD, TILE } from './constants'
import { computeFlow } from './pathing'
import type { GameState, Player } from './types'
import { pickGates } from './waves'

function makePlayer(id: 0 | 1, x: number, y: number): Player {
  return { id, x, y, dirX: 0, dirY: 1, aim: Math.PI / 2, selected: 0, shootCd: 0, buildCd: 0 }
}

export function createState(playerCount: 1 | 2): GameState {
  const cx = (BASE.col + BASE.cols / 2) * TILE
  const below = (BASE.row + BASE.rows) * TILE + 56
  const players = [makePlayer(0, cx - 30, below)]
  if (playerCount === 2) players.push(makePlayer(1, cx + 30, below))

  const state: GameState = {
    time: 0,
    playerCount,
    players,
    enemies: [],
    bullets: [],
    particles: [],
    rings: [],
    decals: [],
    texts: [],
    grid: new Array(COLS * ROWS).fill(null),
    baseHp: BASE.maxHp,
    gold: START_GOLD,
    wave: 0,
    phase: 'prep',
    countdown: FIRST_PREP,
    spawnQueue: [],
    spawnTimer: 0,
    gates: pickGates(1),
    waveScale: 1,
    flow: new Float32Array(COLS * ROWS),
    flowDirty: true,
    nextEnemyId: 1,
    kills: 0,
    gameOver: false,
    shake: 0,
    choice: null
  }
  computeFlow(state)
  return state
}
