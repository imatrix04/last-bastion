import { BASE, COLS, FIRST_PREP, ROWS, START_GOLD, TILE } from './config/constants'
import { computeFlow } from './pathing'
import type { GameState, Player } from './types'
import { ABILITY_SLOTS, KILL_KINDS, emptyLoadout, type Loadout } from './config/progress'
import { pickGates } from './waves'

const ABILITY_ZEROS = (): number[] => Array.from({ length: ABILITY_SLOTS }, () => 0)

function makePlayer(id: 0 | 1, x: number, y: number, loadout: Loadout, gold: number): Player {
  return { id, x, y, dirX: 0, dirY: 1, aim: Math.PI / 2, selected: 0, unlocks: loadout.unlocks, perks: loadout.perks.slice(), abilities: loadout.abilities.slice(), abilityOn: ABILITY_ZEROS(), abilityCd: ABILITY_ZEROS(), look: { ...loadout.look }, shootCd: 0, buildCd: 0, gold }
}

/** `loadouts` : compétences et améliorations de chaque joueur ; un joueur sans valeur n'a rien débloqué. */
export function createState(playerCount: 1 | 2, loadouts: Loadout[] = []): GameState {
  const cx = (BASE.col + BASE.cols / 2) * TILE
  const below = (BASE.row + BASE.rows) * TILE + 56
  // L'or de départ est partagé entre les joueurs.
  const gold = START_GOLD / playerCount
  const players = [makePlayer(0, cx - 30, below, loadouts[0] ?? emptyLoadout(0), gold)]
  if (playerCount === 2) players.push(makePlayer(1, cx + 30, below, loadouts[1] ?? emptyLoadout(1), gold))

  const state: GameState = {
    time: 0,
    playerCount,
    players,
    enemies: [],
    bullets: [],
    particles: [],
    rings: [],
    webs: [],
    decals: [],
    texts: [],
    grid: new Array(COLS * ROWS).fill(null),
    baseHp: BASE.maxHp,
    wave: 0,
    phase: 'prep',
    countdown: FIRST_PREP,
    spawnQueue: [],
    gateTimers: [],
    gates: pickGates(1),
    waveScale: 1,
    flow: new Float32Array(COLS * ROWS),
    flowDirty: true,
    nextEnemyId: 1,
    kills: 0,
    dev: false,
    kstats: KILL_KINDS.map(() => 0),
    gameOver: false,
    shake: 0,
    choice: null
  }
  computeFlow(state)
  return state
}
