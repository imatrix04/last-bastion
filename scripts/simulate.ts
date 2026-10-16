// Simulation sans interface : vérifie que la logique de jeu tient la route.
// Usage : npm run sim
import { actPlace, actUpgrade, applyTurretBranch, placeBuilding, placementStatus, spikesOwned, turretsOwned, upgradeBuilding } from '../src/renderer/src/game/build'
import { acceptRemotePose } from '../src/renderer/src/game/update'
import { defaultLook } from '../src/renderer/src/game/config/appearance'
import { BASE, BUILDS, ENEMIES, START_GOLD, BUILD_ORDER, COLS, OVERCLOCK_LEVELS, ROWS, STEP, type BuildKind } from '../src/renderer/src/game/config/constants'
import { TURRET_BRANCHES, TURRET_MAX_LEVEL, TURRET_PLAIN, turretLevel } from '../src/renderer/src/game/config/turrets'
import { CONTROLS, SKIP_WAVE, type InputLike } from '../src/renderer/src/game/config/controls'
import { idx, isBaseCell } from '../src/renderer/src/game/grid'
import { biomeIndex } from '../src/renderer/src/game/biomes'
import { ABILITY_CONFIG, BIOMES, WAVES } from '../src/renderer/src/game/config/config'
import { ALL_UNLOCKS, PERKS, PERK_INDEX, emptyPerks, sanitizeAbilities, scoreRun, spikeCap, turretCap, unlockMask, type Loadout } from '../src/renderer/src/game/config/progress'
import { createState } from '../src/renderer/src/game/state'
import { fireRateMult, maxLevelOf, nextUpgrade, overclockMult, playerStats, spikeStats, turretStats } from '../src/renderer/src/game/stats'
import type { GameState } from '../src/renderer/src/game/types'
import { step } from '../src/renderer/src/game/update'
import { composeWave, createEnemy } from '../src/renderer/src/game/waves'

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
  if (state.players[0].gold < BUILDS[kind].cost) return false
  if (kind === 'turret' && turretsOwned(state, 0) >= turretCap(state.players[0].perks)) return false
  state.players[0].gold -= BUILDS[kind].cost
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
      if (state.players[0].gold < next.cost) continue
      state.players[0].gold -= next.cost
      upgradeBuilding(state, b)
    } else {
      const branch = ((b.col + b.row + flip++) % 2 === 0 ? 1 : 2) as 1 | 2
      const cost = TURRET_BRANCHES[branch].levels[0].cost
      if (state.players[0].gold < cost) continue
      state.players[0].gold -= cost
      upgradeBuilding(state, b, branch)
    }
  }
}

function botPrep(state: GameState, o: Options): void {
  // Le bot joue pour toute l'équipe : l'or de tous les joueurs est mis en commun chez le joueur 1.
  for (const q of state.players.slice(1)) {
    state.players[0].gold += q.gold
    q.gold = 0
  }
  if (o.turrets) {
    for (const [c, r] of TURRET_SPOTS) tryBuy(state, 'turret', c, r)
    // Anneau de barricades renforcées en pierre autour de la forteresse avec le surplus d'or
    const ring: Array<[number, number]> = []
    for (let c = BASE.col - 3; c <= BASE.col + BASE.cols + 2; c++) ring.push([c, BASE.row - 3], [c, BASE.row + BASE.rows + 2])
    for (const [c, r] of ring) {
      if (!tryBuy(state, 'barricade', c, r)) continue
      const b = state.grid[idx(c, r)]
      const next = b ? nextUpgrade(b, ALL_UNLOCKS) : null
      if (b && next && state.players[0].gold >= next.cost) {
        state.players[0].gold -= next.cost
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
    st.players[0].gold = 9999
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
  ok = report('Mur en pierre verrouillé', wall.level === 1 && st.players[0].gold === 9999) && ok
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
  st.players[0].gold = 9999
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

  // Or séparé : chaque joueur dépense le sien, les gains sont partagés, on n'améliore que ce qui nous appartient
  {
    const input = (down: string[]): InputLike => ({ isDown: () => false, wasPressed: (c) => down.includes(c) })
    const st = createState(2, [FULL, FULL])
    const [a, b] = st.players
    ok = report('Or de départ partagé entre les joueurs', a.gold === START_GOLD / 2 && b.gold === START_GOLD / 2) && ok
    a.gold = 1000
    b.gold = 1000
    a.x = 5 * 40 + 20
    a.y = 5 * 40 + 20
    a.dirX = 1
    a.dirY = 0
    b.x = 5 * 40 + 20
    b.y = 6 * 40 + 20
    b.dirX = 0
    b.dirY = -1
    const wall = placeBuilding(st, 'barricade', 6, 5, 0, 0)
    // Le joueur 2 vise le mur du joueur 1 (case 5,5 → au-dessus de lui : 5,5 ; on le place sur sa cible)
    b.x = 6 * 40 + 20
    b.y = 6 * 40 + 20
    const before = [a.gold, b.gold]
    step(st, STEP, input([CONTROLS[1].upgrade]))
    ok = report('Amélioration d’un bâtiment d’autrui refusée', wall.level === 1 && b.gold === before[1]) && ok
    step(st, STEP, input([CONTROLS[1].remove]))
    ok = report('Démolition d’un bâtiment d’autrui refusée', st.grid[idx(6, 5)] === wall) && ok
    a.x = 5 * 40 + 20
    a.y = 5 * 40 + 20
    step(st, STEP, input([CONTROLS[0].upgrade]))
    ok = report('Le propriétaire améliore avec son or', wall.level === 2 && a.gold < before[0] && b.gold === before[1]) && ok
    // Gains partagés : un monstre tué rapporte la moitié à chacun
    const g0 = [a.gold, b.gold]
    const m = createEnemy(st, 'brute', 800, 300)
    m.hp = 0
    st.enemies.push(m)
    step(st, STEP, input([]))
    const reward = ENEMIES.brute.reward
    ok = report('Gain d’un monstre partagé en deux', Math.abs(a.gold - g0[0] - reward / 2) < 1e-6 && Math.abs(b.gold - g0[1] - reward / 2) < 1e-6) && ok
  }

  // Pieux limités par joueur : 3 de base, +1 par rang de l'amélioration « Pieux », jusqu'à 8
  {
    const lo = loadout(0)
    const st = createState(1, [lo])
    const p = st.players[0]
    p.gold = 9999
    p.selected = BUILD_ORDER.indexOf('spikes')
    for (let c = 10; c < 13; c++) placeBuilding(st, 'spikes', c, 3, 0, 0)
    ok = report('Pieux : limite de 3 de base', spikeCap(p.perks) === 3 && spikesOwned(st, 0) === 3 && placementStatus(st, p, 10, 4) === 'limit') && ok
    p.perks[PERK_INDEX.spikes] = 2
    ok = report('Pieux : +1 par rang', spikeCap(p.perks) === 5 && placementStatus(st, p, 10, 4) === 'ok') && ok
    p.perks[PERK_INDEX.spikes] = PERKS[PERK_INDEX.spikes].costs.length
    ok = report('Pieux : 8 au maximum', spikeCap(p.perks) === 8) && ok
  }

  // Overclocking : seulement les tourelles du joueur qui a la capacité (le rang est pris à la pose)
  {
    const withOc = loadout(0)
    withOc.perks[PERK_INDEX.overclock] = 4
    const st = createState(2, [withOc, loadout(0)])
    const [a, b] = st.players
    a.gold = 9999
    b.gold = 9999
    a.selected = BUILD_ORDER.indexOf('turret')
    b.selected = BUILD_ORDER.indexOf('turret')
    a.x = 5 * 40 + 20
    a.y = 5 * 40 + 20
    a.dirX = 1
    a.dirY = 0
    b.x = 12 * 40 + 20
    b.y = 5 * 40 + 20
    b.dirX = 1
    b.dirY = 0
    actPlace(st, a, true)
    actPlace(st, b, true)
    const ta = st.grid[idx(6, 5)]
    const tb = st.grid[idx(13, 5)]
    ok = report('Overclocking : tourelle du joueur qui l’a', !!ta && ta.boost === 4 && fireRateMult(ta) > 1) && ok
    ok = report('Overclocking : pas sur les tourelles de l’autre', !!tb && tb.boost === 0 && fireRateMult(tb) === 1) && ok
  }

  // Réparation : 50 % des PV par action, puis 3 s de recharge sur la case
  {
    const st = createState(1, [loadout(0)])
    const p = st.players[0]
    p.gold = 9999
    p.x = 5 * 40 + 20
    p.y = 5 * 40 + 20
    p.dirX = 1
    p.dirY = 0
    const w = placeBuilding(st, 'barricade', 6, 5, 0, 0)
    w.hp = w.maxHp * 0.1
    const hp0 = w.hp
    ok = report('Réparation : +50 % des PV max', actPlace(st, p, true) && Math.abs(w.hp - (hp0 + w.maxHp * 0.5)) <= 1) && ok
    const hp1 = w.hp
    ok = report('Réparation : recharge de la case', !actPlace(st, p, true) && w.hp === hp1 && w.repairCd > 2.9) && ok
    const idle: InputLike = { isDown: () => false, wasPressed: () => false }
    for (let i = 0; i < 190; i++) step(st, STEP, idle)
    ok = report('Réparation : de nouveau possible après 3 s', actPlace(st, p, true) && w.hp > hp1) && ok
    for (let i = 0; i < 190; i++) step(st, STEP, idle)
    actPlace(st, p, true)
    ok = report('Réparation : plafonnée aux PV max', w.hp <= w.maxHp) && ok
  }

  // Colosse enragé : à la place du Colosse aux vagues multiples de 10
  {
    const count = (list: string[], kind: string): number => list.filter((k) => k === kind).length
    const w5 = composeWave(5, 1)
    const w10 = composeWave(10, 1)
    const w20 = composeWave(20, 1)
    ok = report('Colosse enragé : vague 5 = Colosse normal', count(w5, 'boss') === 1 && count(w5, 'rageboss') === 0) && ok
    ok = report('Colosse enragé : vague 10 = enragé', count(w10, 'rageboss') === 1 && count(w10, 'boss') === 0) && ok
    ok = report('Colosse enragé : 2 à la vague 20', count(w20, 'rageboss') === 2) && ok
    ok = report('Colosse enragé : plus fort que le Colosse', ENEMIES.rageboss.hp > ENEMIES.boss.hp && ENEMIES.rageboss.damage > ENEMIES.boss.damage && ENEMIES.rageboss.speed > ENEMIES.boss.speed) && ok
  }

  // PV : la hausse commence à la première apparition de chaque type de monstre
  {
    const st = createState(1, [FULL])
    st.wave = 10
    const rage = createEnemy(st, 'rageboss', 300, 300)
    ok = report('PV : Colosse enragé ×1 à la vague 10', rage.maxHp === ENEMIES.rageboss.hp) && ok
    st.wave = 20
    const rage20 = createEnemy(st, 'rageboss', 300, 300)
    ok = report('PV : Colosse enragé en hausse ensuite', rage20.maxHp === Math.round(ENEMIES.rageboss.hp * (1 + 10 * WAVES.hpGrowth))) && ok
    st.wave = 3
    ok = report('PV : Coureur ×1 à la vague 3', createEnemy(st, 'runner', 300, 300).maxHp === ENEMIES.runner.hp) && ok
    ok = report('PV : Rôdeur déjà en hausse à la vague 3', createEnemy(st, 'grunt', 300, 300).maxHp === Math.round(ENEMIES.grunt.hp * (1 + 2 * WAVES.hpGrowth))) && ok
  }

  // Biomes : un nouveau biome toutes les 5 vagues, le dernier se prolonge
  ok = report('Biomes : 1 à 5, 6, 10, 11', biomeIndex(1) === 0 && biomeIndex(5) === 0 && biomeIndex(6) === 1 && biomeIndex(10) === 1 && biomeIndex(11) === 2) && ok
  ok = report('Biomes : le dernier se prolonge', biomeIndex(999) === BIOMES.list.length - 1) && ok

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
