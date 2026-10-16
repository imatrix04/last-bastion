// Simulation sans interface : vérifie que la logique de jeu tient la route.
// Usage : npm run sim
import { actUpgrade, applyTurretBranch, placeBuilding, placementStatus, turretsOwned, upgradeBuilding } from '../src/renderer/src/game/build'
import { acceptRemotePose } from '../src/renderer/src/game/update'
import { defaultLook } from '../src/renderer/src/game/config/appearance'
import { BASE, BUILDS, BUILD_ORDER, COLS, OVERCLOCK_LEVELS, ROWS, STEP, type BuildKind } from '../src/renderer/src/game/config/constants'
import { TURRET_BRANCHES, TURRET_MAX_LEVEL, TURRET_PLAIN, turretLevel } from '../src/renderer/src/game/config/turrets'
import { CONTROLS, SKIP_WAVE, type InputLike } from '../src/renderer/src/game/config/controls'
import { idx, isBaseCell } from '../src/renderer/src/game/grid'
import { ABILITY_CONFIG } from '../src/renderer/src/game/config/config'
import { ALL_UNLOCKS, PERKS, PERK_INDEX, emptyPerks, sanitizeAbilities, scoreRun, turretCap, unlockMask, type Loadout } from '../src/renderer/src/game/config/progress'
import { createState } from '../src/renderer/src/game/state'
import { fireRateMult, maxLevelOf, nextUpgrade, overclockMult, playerStats, spikeStats, turretStats } from '../src/renderer/src/game/stats'
import type { GameState } from '../src/renderer/src/game/types'
import { step } from '../src/renderer/src/game/update'
import { createEnemy } from '../src/renderer/src/game/waves'

/** Compétences débloquées (et améliorations du joueur au rang demandé). */
const loadout = (unlocks: number, rank = 0): Loadout => ({ unlocks, perks: PERKS.map(() => rank), abilities: [], look: defaultLook(0) })
/** Les compétences à rangs (Overclocking) au rang demandé. */
const withOverclock = (unlocks: number, rank: number): Loadout => {
  const l = loadout(unlocks)
  l.perks[PERK_INDEX.overclock] = rank
  return l
}
const FULL = loadout(ALL_UNLOCKS)

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
  if (kind === 'turret' && turretsOwned(state, 0) >= turretCap(state.players[0].perks)) return false
  state.gold -= BUILDS[kind].cost
  placeBuilding(state, kind, col, row)
  return true
}

/** Le bot améliore ses tourelles dès qu'il en a les moyens (niveau 4 : double canons / canon lourd en alternance). */
function botUpgrade(state: GameState): void {
  let flip = 0
  for (const b of state.grid) {
    if (!b || b.kind !== 'turret') continue
    const next = nextUpgrade(b, ALL_UNLOCKS)
    if (!next) continue
    if (next.mode === 'direct') {
      if (state.gold < next.cost) continue
      state.gold -= next.cost
      upgradeBuilding(state, b)
    } else {
      const branch = ((b.col + b.row + flip++) % 2 === 0 ? 1 : 2) as 1 | 2
      const cost = TURRET_BRANCHES[branch].levels[0].cost
      if (state.gold < cost) continue
      state.gold -= cost
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
      const next = b ? nextUpgrade(b, ALL_UNLOCKS) : null
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
  const state = createState(o.players, [FULL, FULL])
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
  const state = createState(1, [FULL])
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

/** Les améliorations respectent les compétences du joueur, et la formule de points est cohérente. */
function checkUnlocks(): boolean {
  const report = (label: string, ok: boolean): boolean => {
    console.log(`${label.padEnd(34)} ${ok ? 'OK' : 'ÉCHEC'}`)
    return ok
  }
  const fresh = (mask: number): GameState => {
    const st = createState(1, [loadout(mask)])
    st.gold = 9999
    const p = st.players[0]
    p.x = 5 * 40 + 20
    p.y = 5 * 40 + 20
    p.dirX = 1
    p.dirY = 0
    return st
  }
  let ok = true

  // Mur : bois → pierre → bronze → renforcé, chaque niveau derrière sa compétence
  let st = fresh(0)
  const wall = placeBuilding(st, 'barricade', 6, 5)
  actUpgrade(st, st.players[0])
  ok = report('Mur en pierre verrouillé', wall.level === 1 && st.gold === 9999) && ok
  st = fresh(unlockMask(['stone']))
  const w2 = placeBuilding(st, 'barricade', 6, 5)
  for (let i = 0; i < 4; i++) actUpgrade(st, st.players[0])
  ok = report('Pierre débloquée, bronze non', w2.level === 2) && ok
  st = fresh(unlockMask(['stone', 'bronze']))
  const w3 = placeBuilding(st, 'barricade', 6, 5)
  for (let i = 0; i < 4; i++) actUpgrade(st, st.players[0])
  ok = report('Bronze débloqué, renforcé non', w3.level === 3) && ok
  st = fresh(unlockMask(['stone', 'bronze', 'reinforced']))
  const w4 = placeBuilding(st, 'barricade', 6, 5)
  for (let i = 0; i < 5; i++) actUpgrade(st, st.players[0])
  ok = report('Mur renforcé (niveau 4, maximum)', w4.level === maxLevelOf('barricade') && w4.level === 4 && w4.maxHp > w3.maxHp) && ok

  // Pieux : bois → pierre → renforcé
  st = fresh(0)
  const sp0 = placeBuilding(st, 'spikes', 6, 5)
  actUpgrade(st, st.players[0])
  ok = report('Pieux en pierre verrouillés', sp0.level === 1) && ok
  st = fresh(unlockMask(['spikeStone', 'spikeReinforced']))
  const sp1 = placeBuilding(st, 'spikes', 6, 5)
  for (let i = 0; i < 4; i++) actUpgrade(st, st.players[0])
  ok = report('Pieux renforcés (niveau 3, maximum)', sp1.level === 3 && spikeStats(3).dps > spikeStats(1).dps && sp1.maxHp > 220) && ok

  // Tourelle : niveaux 2 et 3 libres, spécialisation (niveau 4) avec la branche débloquée, puis niveaux 5 à 7
  st = fresh(unlockMask(['heavy']))
  const t = placeBuilding(st, 'turret', 6, 5)
  actUpgrade(st, st.players[0])
  actUpgrade(st, st.players[0])
  ok = report('Tourelle niveau 3 sans compétence', t.level === 3 && t.branch === 0 && st.choice === null) && ok
  actUpgrade(st, st.players[0])
  ok = report('Niveau 3 : le pop-up s’ouvre', st.choice !== null && t.level === 3) && ok
  const p = st.players[0]
  ok = report('Double canons verrouillé', !applyTurretBranch(st, 6, 5, 1, p) && t.level === 3) && ok
  ok = report('Canon lourd débloqué (niveau 4)', applyTurretBranch(st, 6, 5, 2, p) && t.level === 4 && t.branch === 2) && ok
  const d4 = turretStats(4, 2).damage
  for (let i = 0; i < 5; i++) actUpgrade(st, p)
  ok = report('Niveau 8 verrouillé sans Canon explosif', t.level === 7 && nextUpgrade(t, p.unlocks)?.locked === true) && ok
  p.unlocks = unlockMask(['heavy', 'explosive'])
  for (let i = 0; i < 5; i++) actUpgrade(st, p)
  ok = report(`Tourelle jusqu’au niveau ${TURRET_MAX_LEVEL}`, t.level === TURRET_MAX_LEVEL && turretStats(t.level, 2).damage > d4) && ok
  ok = report('Canon explosif : zone d’explosion', (turretStats(8, 2).splash ?? 0) > 0 && !turretStats(7, 2).splash) && ok
  ok = report('Niveau maximum : plus d’amélioration', nextUpgrade(t, ALL_UNLOCKS) === null) && ok
  ok =
    report(
      'Branches : statistiques différentes',
      turretStats(7, 1).fireRate > turretStats(7, 2).fireRate && turretStats(7, 2).damage > turretStats(7, 1).damage * 2
    ) && ok
  // Les niveaux croissent : chaque niveau est au moins aussi fort que le précédent, dans chaque branche
  let monotone = true
  for (const branch of [1, 2] as const) {
    for (let l = 4; l < TURRET_MAX_LEVEL; l++) {
      const a = turretLevel(l, branch).stats
      const b = turretLevel(l + 1, branch).stats
      if (b.damage * b.fireRate < a.damage * a.fireRate || b.hp < a.hp) monotone = false
    }
  }
  ok = report('Niveaux de branche croissants', monotone && TURRET_PLAIN.length === 3) && ok
  st = fresh(0)
  const t2 = placeBuilding(st, 'turret', 6, 5)
  upgradeBuilding(st, t2)
  upgradeBuilding(st, t2)
  actUpgrade(st, st.players[0])
  ok = report('Aucune branche : pas de pop-up', st.choice === null && t2.level === 3) && ok

  // Limite de tourelles : 3 de base par joueur, +1 par rang de l'amélioration « Tourelles »
  st = fresh(0)
  const pl = st.players[0]
  pl.selected = BUILD_ORDER.indexOf('turret')
  let placed = 0
  for (let c = 2; c < 10; c++) {
    if (placementStatus(st, pl, c, 2) === 'ok') {
      placeBuilding(st, 'turret', c, 2, 0, pl.id)
      placed++
    }
  }
  const capped = placementStatus(st, pl, 10, 2) === 'limit'
  pl.perks[PERK_INDEX.turrets] = 2
  const more = placementStatus(st, pl, 10, 2) === 'ok' && turretCap(pl.perks) === 5 && turretsOwned(st, pl.id) === 3
  ok = report('Limite de tourelles : 3 de base, +1 par rang', placed === 3 && capped && more) && ok

  // Overclocking : de ×1,2 (rang 1) à ×2 (rang 5), pour les tourelles posées par un joueur qui l'a
  st = createState(1, [withOverclock(0, 5)])
  st.gold = 9999
  st.players[0].x = 5 * 40 + 20
  st.players[0].y = 5 * 40 + 20
  st.players[0].dirX = 1
  st.players[0].dirY = 0
  st.players[0].selected = 1
  const bt = placeBuilding(st, 'turret', 6, 5, 5)
  const plain = placeBuilding(st, 'turret', 6, 6)
  ok = report('Overclocking : ×1,2 au rang 1, ×2 au rang 5', overclockMult(1) === 1.2 && overclockMult(5) === 2 && fireRateMult(bt) === 2 && fireRateMult(plain) === 1) && ok
  ok = report('Overclocking : 5 rangs croissants', OVERCLOCK_LEVELS.length === 5 && OVERCLOCK_LEVELS.every((v, i) => i === 0 || v > OVERCLOCK_LEVELS[i - 1])) && ok

  // Améliorations du joueur : rang max = bonus complet
  const maxed = playerStats(PERKS.map((p) => p.costs.length))
  const base = playerStats(emptyPerks())
  ok = report('Améliorations du joueur', maxed.speed > base.speed && maxed.fireRate > base.fireRate && maxed.damage > base.damage) && ok

  // Araignée : crache une toile sur la tourelle à portée, qui tire alors moins vite
  st = fresh(0)
  const tw = placeBuilding(st, 'turret', 10, 5)
  const sp = createEnemy(st, 'spider', 10 * 40 + 20 + 150, 5 * 40 + 20)
  sp.abilityCd = 0
  st.enemies.push(sp)
  st.phase = 'combat'
  st.spawnQueue = ['grunt']
  st.gateTimers = st.gates.map(() => 9999)
  const idle: InputLike = { isDown: () => false, wasPressed: () => false }
  let sawCast = false
  for (let i = 0; i < 60 * 3 && tw.web === 0; i++) {
    step(st, STEP, idle)
    if (sp.cast > 0) sawCast = true
  }
  ok = report('Araignée : toile sur la tourelle', sawCast && tw.web > 0 && fireRateMult(tw) < 1) && ok

  // Joueur distant : sa position est acceptée si plausible, refusée si c'est une téléportation ou un mur
  st = fresh(0)
  const rp = st.players[1] ?? st.players[0]
  const x0 = rp.x
  const y0 = rp.y
  const near = acceptRemotePose(st, rp, x0 + 6, y0, 1, 0)
  const far = acceptRemotePose(st, rp, x0 + 600, y0, 1, 0)
  placeBuilding(st, 'barricade', 8, 8)
  const inWall = acceptRemotePose(st, rp, 8 * 40 + 20, 8 * 40 + 20, 1, 0)
  ok = report('Position distante : plausible acceptée', near && Math.abs(rp.x - (x0 + 6)) < 0.01 && rp.dirX === 1) && ok
  ok = report('Position distante : téléportation / mur refusés', !far && !inWall) && ok

  // Balles enflammées : capacité active équipée, déclenchée par la touche 1 des capacités
  {
    const cfg = ABILITY_CONFIG.fireBullets
    const input = (down: string[]): InputLike => ({ isDown: () => false, wasPressed: (c) => down.includes(c) })
    const noKeys = input([])
    const lo = loadout(0)
    lo.perks[PERK_INDEX.fireBullets] = 1
    lo.abilities = ['fireBullets']
    const st = createState(1, [lo])
    const p = st.players[0]
    p.x = 400
    p.y = 300
    st.phase = 'combat'
    st.spawnQueue = ['grunt']
    st.gateTimers = st.gates.map(() => 9999)
    const grunt = createEnemy(st, 'grunt', 440, 300)
    grunt.hp = grunt.maxHp = 5000
    st.enemies.push(grunt)
    step(st, STEP, noKeys)
    ok = report('Balles enflammées : pas de brûlure au départ', grunt.burnT === 0) && ok
    step(st, STEP, input([CONTROLS[0].abilities[0]]))
    ok = report('Balles enflammées : activation', p.abilityOn[0] > cfg.ranks[0].duration - 0.1 && p.abilityCd[0] > cfg.ranks[0].cooldown - 0.1) && ok
    let burned = false
    for (let i = 0; i < 120 && !burned; i++) {
      step(st, STEP, noKeys)
      burned = grunt.burnT > 0
    }
    const hp0 = grunt.hp
    for (let i = 0; i < 30; i++) step(st, STEP, noKeys)
    ok = report('Balles enflammées : le monstre brûle', burned && grunt.hp < hp0) && ok
    // Fin d'effet, puis recharge : une nouvelle activation avant la fin de la recharge est refusée
    for (let i = 0; i < Math.ceil((cfg.ranks[0].duration + 0.5) / STEP); i++) step(st, STEP, noKeys)
    ok = report('Balles enflammées : l’effet s’arrête', p.abilityOn[0] === 0 && p.abilityCd[0] > 0) && ok
    step(st, STEP, input([CONTROLS[0].abilities[0]]))
    ok = report('Balles enflammées : recharge', p.abilityOn[0] === 0) && ok
    ok = report('Capacité non débloquée refusée', sanitizeAbilities(['fireBullets'], emptyPerks()).length === 0 && sanitizeAbilities([0, 0, 0], lo.perks).length === 1) && ok
  }

  // Points : (kills pondérés + 10 × vague) × (1 + vague / 10)
  const score = scoreRun([100, 20, 5, 1, 4, 40, 3], 10)
  ok = report('Formule de points', score.kills === 100 + 20 + 15 + 15 + 12 + 20 + 12 && score.total === Math.round((score.kills + 100) * 2)) && ok
  return ok
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
allOk = checkUnlocks() && allOk
for (const r of runs) {
  const { ok } = run(r)
  allOk = allOk && ok
}
console.log(allOk ? '\nOK : aucune vague bloquée, aucune position invalide.' : '\nÉCHEC : voir les messages ci-dessus.')
process.exit(allOk ? 0 : 1)
