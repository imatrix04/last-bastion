// Mesure du trafic réseau d'une partie simulée (état envoyé par l'hôte). Usage : npx tsx scripts/measure-net.ts
import { deflateRawSync } from 'zlib'
import { placeBuilding, upgradeBuilding, turretsOwned } from '../src/renderer/src/game/build'
import { defaultLook } from '../src/renderer/src/game/config/appearance'
import { BASE, BUILDS, START_GOLD, COLS, ROWS, STEP } from '../src/renderer/src/game/config/constants'
import { SKIP_WAVE, type InputLike } from '../src/renderer/src/game/config/controls'
import { idx, isBaseCell } from '../src/renderer/src/game/grid'
import { ALL_UNLOCKS, PERKS, turretCap, type Loadout } from '../src/renderer/src/game/config/progress'
import { encodeSnap, SNAPSHOT_STEPS } from '../src/renderer/src/game/config/netproto'
import { createState } from '../src/renderer/src/game/state'
import { nextUpgrade } from '../src/renderer/src/game/stats'
import { step } from '../src/renderer/src/game/update'

void START_GOLD
const FULL: Loadout = { unlocks: ALL_UNLOCKS, perks: PERKS.map(() => 0), abilities: [], look: defaultLook(0) }
const SPOTS: Array<[number, number]> = [[12, 5], [19, 5], [12, 12], [19, 12], [16, 4], [16, 13], [11, 9], [20, 9], [13, 3], [18, 3], [13, 14], [18, 14], [9, 7], [22, 7], [9, 11], [22, 11]]

const state = createState(2, [FULL, FULL])
state.fxLog = []
const input: InputLike = { isDown: () => false, wasPressed: (c) => c === SKIP_WAVE && state.phase === 'prep' }

function prep(): void {
  for (const q of state.players.slice(1)) {
    state.players[0].gold += q.gold
    q.gold = 0
  }
  const g = state.players[0]
  g.gold += 4000 + state.wave * 1500 // le bot est généreux : on veut mesurer des vagues avancées, pas l'équilibrage
  for (const [c, r] of SPOTS) {
    if (state.grid[idx(c, r)] || g.gold < BUILDS.turret.cost || turretsOwned(state, 0) >= turretCap(g.perks)) continue
    g.gold -= BUILDS.turret.cost
    placeBuilding(state, 'turret', c, r)
  }
  for (let c = BASE.col - 3; c <= BASE.col + BASE.cols + 2; c++) {
    for (const r of [BASE.row - 3, BASE.row + BASE.rows + 2]) {
      if (state.grid[idx(c, r)] || isBaseCell(c, r) || g.gold < BUILDS.barricade.cost) continue
      g.gold -= BUILDS.barricade.cost
      placeBuilding(state, 'barricade', c, r)
    }
  }
  for (const b of state.grid) {
    if (!b) continue
    for (let n = 0; n < 6; n++) {
      const next = nextUpgrade(b, ALL_UNLOCKS)
      if (!next || next.mode !== 'direct' || g.gold < next.cost) break
      g.gold -= next.cost
      upgradeBuilding(state, b)
    }
  }
}

interface Acc { raw: number; zip: number; n: number; max: number; enemies: number }
const perWave = new Map<number, Acc>()
let lastWave = 0
for (let s = 0; s < 60 * 60 * 45 && !state.gameOver && state.wave <= 30; s++) {
  if (state.phase === 'prep' && (state.countdown === 20 || s === 0)) prep()
  state.baseHp = state.baseMaxHp ?? 1e9
  step(state, STEP, input)
  if (s % SNAPSHOT_STEPS === 0) {
    const json = JSON.stringify(encodeSnap(state))
    state.fxLog!.length = 0
    if (state.phase === 'combat') {
      const a = perWave.get(state.wave) ?? { raw: 0, zip: 0, n: 0, max: 0, enemies: 0 }
      const len = Buffer.byteLength(json)
      a.raw += len
      a.zip += deflateRawSync(json).length
      a.n++
      a.max = Math.max(a.max, len)
      a.enemies = Math.max(a.enemies, state.enemies.length)
      perWave.set(state.wave, a)
    }
  }
  if (state.wave !== lastWave) lastWave = state.wave
}

console.log('vague | ennemis max | taille moy. (Ko) | max (Ko) | Ko/s brut | Ko/s compressé')
let totRaw = 0, totZip = 0, totN = 0
for (const [w, a] of [...perWave].sort((x, y) => x[0] - y[0])) {
  const hz = 30
  console.log(`${String(w).padStart(5)} | ${String(a.enemies).padStart(11)} | ${(a.raw / a.n / 1024).toFixed(1).padStart(16)} | ${(a.max / 1024).toFixed(1).padStart(8)} | ${((a.raw / a.n) * hz / 1024).toFixed(0).padStart(9)} | ${((a.zip / a.n) * hz / 1024).toFixed(0).padStart(14)}`)
  totRaw += a.raw; totZip += a.zip; totN += a.n
}
console.log(`\nMoyenne en combat : ${((totRaw / totN) * 30 / 1024).toFixed(0)} Ko/s brut, ${((totZip / totN) * 30 / 1024).toFixed(0)} Ko/s compressé`)
console.log(`=> par heure de combat : ${((totRaw / totN) * 30 * 3600 / 1024 / 1024 / 1024).toFixed(2)} Go brut, ${((totZip / totN) * 30 * 3600 / 1024 / 1024 / 1024).toFixed(2)} Go compressé`)
console.log(`Fin : vague ${state.wave}, ${state.gameOver ? 'forteresse tombée' : 'debout'} (${(state.time / 60).toFixed(1)} min de jeu)`)
void COLS; void ROWS
