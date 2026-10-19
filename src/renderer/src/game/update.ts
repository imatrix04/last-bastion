import { actPlace, actRemove, actToggleTarget, actUpgrade } from './build'
import {
  BASE,
  BUILD_ORDER,
  BUILD_REPEAT,
  BUILDS,
  BULLET_STYLES,
  COLS,
  ENEMIES,
  HEIGHT,
  isBossKind,
  JUMP,
  PLAYER,
  PREP_TIME,
  ROWS,
  SPIT,
  TILE,
  WEB,
  WIDTH
} from './config/constants'
import { fmtGold, shareGold } from './economy'
import { activateAbility, activeBurn, tickAbilities } from './abilities'
import { ABILITY_CONFIG, EXPLOSION, MINIGUN, PLAYER_AIM, WAVES } from './config/config'
import { CONTROLS, DEV_ENABLED, DEV_GOLD_PER_SEC, DEV_REWARD_MULT, DEV_TOGGLE, SKIP_WAVE, type InputLike } from './config/controls'
import { floating } from '../i18n'
import { addText, burst, decal, muzzle, ring, smoke, sparks, updateFx, webShot } from './fx'
import { distToRect, idx, isBaseCell, isSolidCell, resolveTiles } from './grid'
import { advanceEvent, eventMods, playerSight, rollEvent, turretSees } from './events'
import { computeFlow, nextCell, nextCellAir } from './pathing'
import { killIndex } from './config/progress'
import { fireRateMult, isWeapon, playerStats, spikeStats, tierOf, turretStats } from './stats'
import { turretForm } from './config/turrets'
import type { Building, Enemy, GameState, Player } from './types'
import { composeWave, createEnemy, pickGates, spawnEnemy, spawnInterval } from './waves'

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Un pas de simulation (dt en secondes). */
export function step(state: GameState, dt: number, input: InputLike): void {
  if (state.gameOver) return
  state.time += dt

  // Mode développeur : seulement avec `npm run dev` (absent des versions installées).
  if (DEV_ENABLED && input.wasPressed(DEV_TOGGLE)) {
    state.dev = !state.dev
    addText(state, WIDTH / 2, 70, floating(state.dev ? 'float.devOn' : 'float.devOff'), state.dev ? '#ffd54a' : '#b0bec5')
  }
  if (state.dev) for (const p of state.players) p.gold += DEV_GOLD_PER_SEC * dt

  updatePlayers(state, dt, input)
  updateWaves(state, dt, input)
  advanceEvent(state, dt)
  if (state.flowDirty) computeFlow(state)
  updateEnemies(state, dt)
  updateTurrets(state, dt)
  updateSpikes(state, dt)
  updateBullets(state, dt)
  advanceWebs(state, dt, true)
  reapEnemies(state)
  updateFx(state, dt)

  if (state.baseHp <= 0) {
    state.baseHp = 0
    state.gameOver = true
  }
}

// ---------------------------------------------------------------- utilitaires

export function nearestEnemy(state: GameState, x: number, y: number, range: number, canSee?: (e: Enemy) => boolean): Enemy | null {
  let best: Enemy | null = null
  let bestD = range * range
  for (const e of state.enemies) {
    if (e.hp <= 0 || (canSee && !canSee(e))) continue
    const dx = e.x - x
    const dy = e.y - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/**
 * Cible d'une tourelle selon son mode : l'ennemi le plus proche d'elle (0) ou de la forteresse (1), parmi ceux à portée.
 * Partagé avec l'affichage de l'invité (clientView.ts).
 */
export function turretTarget(state: GameState, b: Building, cx: number, cy: number, range: number): Enemy | null {
  // Sans visuel (brouillard), une tourelle ne tire pas
  const canSee = (e: Enemy): boolean => turretSees(state, cx, cy, e)
  if (b.targeting !== 1) return nearestEnemy(state, cx, cy, range, canSee)
  const bx = (BASE.col + BASE.cols / 2) * TILE
  const by = (BASE.row + BASE.rows / 2) * TILE
  let best: Enemy | null = null
  let bestD = Infinity
  for (const e of state.enemies) {
    if (e.hp <= 0 || Math.hypot(e.x - cx, e.y - cy) > range || !canSee(e)) continue
    const d = Math.hypot(e.x - bx, e.y - by)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/**
 * Cible du joueur : un Cracheur à portée passe avant tout le monde (il détruit les tourelles),
 * sinon l'ennemi le plus proche.
 */
export function priorityEnemy(state: GameState, x: number, y: number, rawRange: number): Enemy | null {
  // Brouillard : le joueur ne tire que sur ce qu'il voit
  const range = Math.min(rawRange, playerSight(state))
  let best: Enemy | null = null
  let bestD = range * range
  for (const e of state.enemies) {
    if (e.hp <= 0 || e.kind !== 'spitter') continue
    const dx = e.x - x
    const dy = e.y - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best ?? nearestEnemy(state, x, y, range)
}

/**
 * Angle de tir vers un ennemi. `lead` (0 à 1) dose l'anticipation : 0 vise sa position actuelle,
 * 1 vise le point d'interception (là où la balle et lui se rejoignent s'il garde sa vitesse).
 */
function leadAngle(x: number, y: number, e: Enemy, bulletSpeed: number, lead: number): number {
  const dx = e.x - x
  const dy = e.y - y
  const direct = Math.atan2(dy, dx)
  if (lead <= 0 || (e.vx === 0 && e.vy === 0)) return direct
  // Temps t > 0 tel que |(dx + vx·t, dy + vy·t)| = bulletSpeed·t
  const a = e.vx * e.vx + e.vy * e.vy - bulletSpeed * bulletSpeed
  const b = 2 * (dx * e.vx + dy * e.vy)
  const c = dx * dx + dy * dy
  let t: number
  if (Math.abs(a) < 1e-6) {
    t = b < 0 ? -c / b : 0
  } else {
    const disc = b * b - 4 * a * c
    if (disc < 0) return direct
    const s = Math.sqrt(disc)
    const t1 = (-b - s) / (2 * a)
    const t2 = (-b + s) / (2 * a)
    const lo = Math.min(t1, t2)
    t = lo > 0 ? lo : Math.max(t1, t2)
  }
  if (!(t > 0)) return direct
  return Math.atan2(dy + e.vy * t * lead, dx + e.vx * t * lead)
}

function fire(
  state: GameState,
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number,
  range: number,
  style: number,
  splash = 0,
  burn = 0
): void {
  state.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: range / speed + 0.15,
    damage,
    style,
    splash,
    burn
  })
}

function damageEnemy(e: Enemy, amount: number): void {
  e.hp -= amount
  e.flash = 0.08
}

/** Couleur des éclats d'un bâtiment : bois, pierre ou métal. */
function debrisColor(b: Building): string {
  return tierOf(b.kind, b.level)?.debris ?? '#78909c'
}

function damageBuilding(state: GameState, b: Building, amount: number): void {
  b.hp -= amount
  const cx = (b.col + 0.5) * TILE
  const cy = (b.row + 0.5) * TILE
  if (b.hp > 0) {
    // Les pieux s'usent en continu : pas d'éclats à chaque pas.
    if (amount >= 3) burst(state, cx, cy, debrisColor(b), 3, 90)
    return
  }
  state.grid[idx(b.col, b.row)] = null
  if (BUILDS[b.kind].solid) state.flowDirty = true
  burst(state, cx, cy, debrisColor(b), 12, 140)
  smoke(state, cx, cy, '#8d6e63', 4, 60)
  ring(state, cx, cy, '#bcaaa4', 34)
}

function hitBase(state: GameState, amount: number, from: Enemy): void {
  state.baseHp -= amount
  state.shake = Math.min(1, state.shake + 0.12)
  sparks(state, from.x, from.y, '#ffcc80', 5, 120)
}

// -------------------------------------------------------------------- joueurs

/**
 * Déplace un joueur selon son intention (ix, iy ∈ {-1, 0, 1}) et met à jour la case qu'il vise.
 * Partagé avec la prédiction du joueur distant (clientView.ts) : même code des deux côtés.
 */
export function movePlayer(state: GameState, p: Player, ix: number, iy: number, dt: number): void {
  if (ix !== 0 || iy !== 0) {
    const len = Math.hypot(ix, iy)
    const speed = playerStats(p.perks).speed
    p.x += (ix / len) * speed * dt
    p.y += (iy / len) * speed * dt
    if (iy === 0) {
      p.dirX = Math.sign(ix)
      p.dirY = 0
    } else if (ix === 0) {
      p.dirX = 0
      p.dirY = Math.sign(iy)
    } else if (p.dirX !== Math.sign(ix) && p.dirY !== Math.sign(iy)) {
      // En diagonale, on garde la direction si elle fait partie du mouvement, sinon on prend l'horizontale.
      p.dirX = Math.sign(ix)
      p.dirY = 0
    }
  }
  p.x = clamp(p.x, PLAYER.radius, WIDTH - PLAYER.radius)
  p.y = clamp(p.y, PLAYER.radius, HEIGHT - PLAYER.radius)
  resolveTiles(state, p, PLAYER.radius)
}

/**
 * Position annoncée par le joueur distant. On lui fait confiance tant que c'est plausible : pas de téléportation
 * lointaine, pas dans un mur. Sinon on l'ignore, et son snapshot le recalera sur la position de l'hôte.
 */
export function acceptRemotePose(state: GameState, p: Player, x: number, y: number, dirX: number, dirY: number): boolean {
  const px = clamp(x, PLAYER.radius, WIDTH - PLAYER.radius)
  const py = clamp(y, PLAYER.radius, HEIGHT - PLAYER.radius)
  if (Math.hypot(px - p.x, py - p.y) > 200) return false
  if (isSolidCell(state, Math.floor(px / TILE), Math.floor(py / TILE))) return false
  p.x = px
  p.y = py
  // Direction de construction : cardinale, jamais nulle
  if ((dirX !== 0) !== (dirY !== 0)) {
    p.dirX = dirX
    p.dirY = dirY
  }
  return true
}

function updatePlayers(state: GameState, dt: number, input: InputLike): void {
  for (const p of state.players) {
    const c = CONTROLS[p.id]

    // Déplacement
    const ix = (input.isDown(c.right) ? 1 : 0) - (input.isDown(c.left) ? 1 : 0)
    const iy = (input.isDown(c.down) ? 1 : 0) - (input.isDown(c.up) ? 1 : 0)
    // Joueur distant (côté hôte) : sa position arrive du réseau, on l'empêche seulement de rester dans un mur apparu entre-temps.
    if (p.remote) resolveTiles(state, p, PLAYER.radius)
    else movePlayer(state, p, ix, iy, dt)

    // Choix de l'objet à construire
    c.slots.forEach((code, i) => {
      if (input.wasPressed(code)) p.selected = i
    })
    const n = BUILD_ORDER.length
    if (input.wasPressed(c.next)) p.selected = (p.selected + 1) % n
    if (input.wasPressed(c.prev)) p.selected = (p.selected + n - 1) % n

    // Capacités actives : écoulement des durées / recharges, puis déclenchement par les touches 1 à 3
    tickAbilities(p, dt)
    c.abilities.forEach((code, i) => {
      if (input.wasPressed(code)) activateAbility(state, p, i)
    })

    // Amélioration (une pression = une amélioration)
    if (input.wasPressed(c.upgrade)) actUpgrade(state, p)
    if (input.wasPressed(c.target)) actToggleTarget(state, p)

    // Construction / réparation / démolition (la touche maintenue répète l'action)
    p.buildCd -= dt
    if (p.buildCd <= 0) {
      if (input.isDown(c.place)) {
        p.buildCd = actPlace(state, p, input.wasPressed(c.place)) ? BUILD_REPEAT : 0.12
      } else if (input.isDown(c.remove)) {
        p.buildCd = actRemove(state, p) ? BUILD_REPEAT : 0.12
      }
    }

    // Tir automatique sur l'ennemi le plus proche
    p.shootCd -= dt
    const ps = playerStats(p.perks)
    const target = priorityEnemy(state, p.x, p.y, ps.range)
    if (target) {
      p.aim = leadAngle(p.x, p.y, target, ps.bulletSpeed, ps.lead)
      if (p.shootCd <= 0) {
        const spread = (Math.random() - 0.5) * PLAYER_AIM.spread * (1 - ps.lead * PLAYER_AIM.spreadReductionAtMax)
        const angle = p.aim + spread
        const burn = activeBurn(p)
        fire(state, p.x, p.y, angle, ps.bulletSpeed, ps.damage, ps.range, burn > 0 ? 5 : 0, 0, burn)
        muzzle(state, p.x + Math.cos(angle) * 22, p.y + Math.sin(angle) * 22, angle, 0)
        p.shootCd = 1 / ps.fireRate
      }
    } else {
      p.aim = Math.atan2(p.dirY, p.dirX)
    }
  }
}

// --------------------------------------------------------------------- vagues

function updateWaves(state: GameState, dt: number, input: InputLike): void {
  if (state.phase === 'prep') {
    state.countdown -= dt
    if (input.wasPressed(SKIP_WAVE) && state.countdown > 0) {
      // Lancer plus tôt rapporte un petit bonus.
      const bonus = Math.floor(state.countdown) * WAVES.skipBonusPerSecond
      if (bonus > 0) {
        shareGold(state, bonus)
        addText(state, BASE.col * TILE + (BASE.cols * TILE) / 2, BASE.row * TILE - 30, floating('float.skipBonus', bonus), '#ffd54a')
      }
      state.countdown = 0
    }
    if (state.countdown <= 0) startWave(state)
    return
  }

  if (state.spawnQueue.length > 0) {
    // Chaque entrée a sa propre cadence : plus il y a d'entrées, plus les monstres arrivent nombreux en même temps.
    for (let i = 0; i < state.gates.length && state.spawnQueue.length > 0; i++) {
      state.gateTimers[i] = (state.gateTimers[i] ?? 0) - dt
      if (state.gateTimers[i] <= 0) {
        const kind = state.spawnQueue.shift()
        if (kind) spawnEnemy(state, kind, i)
        state.gateTimers[i] = spawnInterval(state.wave)
      }
    }
  } else if (state.enemies.length === 0) {
    endWave(state)
  }
}

function startWave(state: GameState): void {
  state.wave += 1
  state.spawnQueue = composeWave(state.wave, state.playerCount)
  state.event = rollEvent(state.wave)
  // Départs décalés pour que les entrées ne crachent pas toutes au même instant.
  state.gateTimers = state.gates.map((_, i) => 0.5 + i * 0.12)
  state.phase = 'combat'
}

function endWave(state: GameState): void {
  const bonus = WAVES.reward.goldBase + state.wave * WAVES.reward.goldPerWave
  shareGold(state, bonus)
  state.baseHp = Math.min(BASE.maxHp, state.baseHp + BASE.maxHp * WAVES.reward.baseHeal)
  addText(
    state,
    BASE.col * TILE + (BASE.cols * TILE) / 2,
    BASE.row * TILE - 30,
    floating('float.waveRepelled', state.wave, bonus),
    '#a5d6a7'
  )
  state.phase = 'prep'
  state.event = null
  state.countdown = PREP_TIME
  state.gates = pickGates(state.wave + 1)
}

// -------------------------------------------------------------------- ennemis

/** Arme de défense la plus proche (qui n'est pas déjà sous une toile), dans un rayon donné. */
function nearestWeapon(state: GameState, x: number, y: number, range: number): Building | null {
  let best: Building | null = null
  let bestD = range * range
  for (const b of state.grid) {
    if (!b || !isWeapon(b.kind) || b.web > 0) continue
    const dx = (b.col + 0.5) * TILE - x
    const dy = (b.row + 0.5) * TILE - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

/**
 * L'araignée se dresse puis crache une toile sur une arme de défense à portée : sa cadence de tir est réduite
 * pendant quelques secondes. Renvoie vrai tant qu'elle prépare son tir (elle est alors immobile).
 */
function spiderAbility(state: GameState, e: Enemy, dt: number): boolean {
  if (e.cast > 0) {
    e.cast -= dt
    turnToward(e, Math.atan2((e.webRow + 0.5) * TILE - e.y, (e.webCol + 0.5) * TILE - e.x), dt * 2)
    if (e.cast > 0) return true
    e.cast = 0
    const b = state.grid[idx(e.webCol, e.webRow)]
    if (b && isWeapon(b.kind)) {
      const a = Math.atan2((e.webRow + 0.5) * TILE - e.y, (e.webCol + 0.5) * TILE - e.x)
      webShot(state, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, (e.webCol + 0.5) * TILE, (e.webRow + 0.5) * TILE, e.webCol, e.webRow)
    }
    return false
  }
  e.abilityCd -= dt
  if (e.abilityCd > 0) return false
  const target = nearestWeapon(state, e.x, e.y, WEB.range)
  if (!target) {
    e.abilityCd = 0.4
    return false
  }
  e.webCol = target.col
  e.webRow = target.row
  e.cast = WEB.windup
  e.abilityCd = WEB.cooldown
  return true
}

/** Tourelle la plus proche dans un rayon donné. */
function nearestTurret(state: GameState, x: number, y: number, range: number): Building | null {
  let best: Building | null = null
  let bestD = range * range
  for (const b of state.grid) {
    if (!b || b.kind !== 'turret') continue
    const dx = (b.col + 0.5) * TILE - x
    const dy = (b.row + 0.5) * TILE - y
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

/**
 * Le Cracheur s'arrête dès qu'une tourelle est à portée et la bombarde d'acide tant qu'il vit.
 * Renvoie vrai tant qu'il tient sa position (préparation ou attente entre deux crachats).
 */
function spitterAbility(state: GameState, e: Enemy, dt: number): boolean {
  if (e.cast > 0) {
    e.cast -= dt
    turnToward(e, Math.atan2((e.webRow + 0.5) * TILE - e.y, (e.webCol + 0.5) * TILE - e.x), dt * 2)
    if (e.cast > 0) return true
    e.cast = 0
    const b = state.grid[idx(e.webCol, e.webRow)]
    if (b && b.kind === 'turret') {
      const a = Math.atan2((e.webRow + 0.5) * TILE - e.y, (e.webCol + 0.5) * TILE - e.x)
      webShot(state, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, (e.webCol + 0.5) * TILE, (e.webRow + 0.5) * TILE, e.webCol, e.webRow, true)
    }
    return true
  }
  e.abilityCd -= dt
  const target = nearestTurret(state, e.x, e.y, SPIT.range)
  if (!target) return false
  turnToward(e, Math.atan2((target.row + 0.5) * TILE - e.y, (target.col + 0.5) * TILE - e.x), dt * 2)
  if (e.abilityCd > 0) return true
  e.webCol = target.col
  e.webRow = target.row
  e.cast = SPIT.windup
  e.abilityCd = SPIT.cooldown
  return true
}

/** Fait voler les toiles et l'acide ; à l'arrivée (hôte seulement), la toile englue l'arme visée, l'acide blesse la tourelle. */
export function advanceWebs(state: GameState, dt: number, apply: boolean): void {
  let w = 0
  for (const web of state.webs) {
    web.t += dt
    if (web.t < web.dur) {
      state.webs[w++] = web
      continue
    }
    if (!apply || web.col < 0) continue
    const b = state.grid[idx(web.col, web.row)]
    if (!b || !isWeapon(b.kind)) continue
    if (web.acid) {
      sparks(state, web.tx, web.ty, '#b2ff59', 10, 130)
      ring(state, web.tx, web.ty, '#aeea00', 30)
      damageBuilding(state, b, SPIT.damage)
      continue
    }
    b.web = WEB.duration
    sparks(state, web.tx, web.ty, '#f5f5ff', 8, 130)
    ring(state, web.tx, web.ty, '#e8eaf6', 30)
  }
  state.webs.length = w
}

/** Tourne progressivement l'ennemi vers un cap (par le chemin le plus court). */
function turnToward(e: Enemy, target: number, dt: number): void {
  let d = target - e.face
  d = Math.atan2(Math.sin(d), Math.cos(d))
  e.face += d * (1 - Math.exp(-dt * 12))
}

/**
 * Le Sauteur bondit par-dessus le bâtiment solide qui lui barre la route, dans la direction `dc, dr`.
 * Renvoie faux s'il n'y a pas de case libre à portée de bond (il attaque alors l'obstacle comme les autres).
 */
function startJump(state: GameState, e: Enemy, dc: number, dr: number, col: number, row: number): boolean {
  for (let k = 0; k <= JUMP.maxCells; k++) {
    const c = col + dc * k
    const r = row + dr * k
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false
    if (isBaseCell(c, r)) return false
    if (isSolidCell(state, c, r)) continue
    e.jx0 = e.x
    e.jy0 = e.y
    e.jx1 = (c + 0.5) * TILE
    e.jy1 = (r + 0.5) * TILE
    e.jump = JUMP.duration
    e.jumpDur = JUMP.duration
    smoke(state, e.x, e.y, '#bcaaa4', 2, 40)
    return true
  }
  return false
}

/** Fait avancer le bond en cours. */
function advanceJump(state: GameState, e: Enemy, dt: number): void {
  e.jump = Math.max(0, e.jump - dt)
  const k = 1 - e.jump / e.jumpDur
  const nx = e.jx0 + (e.jx1 - e.jx0) * k
  const ny = e.jy0 + (e.jy1 - e.jy0) * k
  e.vx = (nx - e.x) / dt
  e.vy = (ny - e.y) / dt
  e.x = nx
  e.y = ny
  turnToward(e, Math.atan2(e.jy1 - e.jy0, e.jx1 - e.jx0), dt)
  if (e.jump <= 0) {
    smoke(state, e.x, e.y, '#bcaaa4', 3, 50)
    ring(state, e.x, e.y, '#d7ccc8', 22)
  }
}

/** Attaque ce qui bloque l'ennemi : un bâtiment ou la forteresse. */
function strike(state: GameState, e: Enemy, target: Building | null, onBase: boolean): void {
  const def = ENEMIES[e.kind]
  e.attackCd = def.interval
  if (onBase) hitBase(state, def.damage, e)
  else if (target) damageBuilding(state, target, def.damage)
}

/** Dernier recours pour un ennemi coincé : s'en prendre à l'obstacle solide le plus proche. */
function chew(state: GameState, e: Enemy): void {
  if (e.attackCd > 0) return
  const col = clamp(Math.floor(e.x / TILE), 0, COLS - 1)
  const row = clamp(Math.floor(e.y / TILE), 0, ROWS - 1)
  let bestD = e.radius + 6
  let bestB: Building | null = null
  let onBase = false
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue
      const base = isBaseCell(c, r)
      const b = state.grid[idx(c, r)]
      if (!base && !(b && BUILDS[b.kind].solid)) continue
      const d = distToRect(e.x, e.y, c * TILE, r * TILE, TILE, TILE)
      if (d < bestD) {
        bestD = d
        bestB = base ? null : b
        onBase = base
      }
    }
  }
  if (onBase || bestB) strike(state, e, bestB, onBase)
}

function updateEnemies(state: GameState, dt: number): void {
  const list = state.enemies

  for (const e of list) {
    if (e.hp <= 0) continue
    const def = ENEMIES[e.kind]
    e.flash = Math.max(0, e.flash - dt)
    e.attackCd -= dt
    e.age += dt
    e.vx = 0
    e.vy = 0
    if (e.burnT > 0) {
      e.burnT -= dt
      e.hp -= e.burnDps * dt
      if (e.hp <= 0) continue
    }
    if (e.jump > 0) {
      // En plein bond : ni attaque ni collision, il suit son arc jusqu'à l'atterrissage.
      e.attacking = false
      advanceJump(state, e, dt)
      continue
    }
    if (e.kind === 'spider' && spiderAbility(state, e, dt)) {
      e.attacking = false
      continue
    }
    if (e.kind === 'spitter' && spitterAbility(state, e, dt)) {
      e.attacking = false
      continue
    }

    // Contrôle toutes les 1,2 s : un ennemi qui n'avance plus et n'attaque pas est considéré coincé.
    e.checkT -= dt
    if (e.checkT <= 0) {
      e.checkT = 1.2
      e.stuck = Math.hypot(e.x - e.lx, e.y - e.ly) < 6 && !e.attacking
      e.lx = e.x
      e.ly = e.y
    }

    const col = clamp(Math.floor(e.x / TILE), 0, COLS - 1)
    const row = clamp(Math.floor(e.y / TILE), 0, ROWS - 1)
    const next = e.kind === 'jumper' ? nextCellAir(state, col, row) : nextCell(state, col, row)
    if (!next) continue

    const target = state.grid[idx(next.col, next.row)]
    const onBase = isBaseCell(next.col, next.row)
    const blocking = onBase || (target !== null && BUILDS[target.kind].solid)

    if (blocking) {
      const d = distToRect(e.x, e.y, next.col * TILE, next.row * TILE, TILE, TILE)
      if (d <= e.radius + 4) {
        if (e.kind === 'jumper' && !onBase && startJump(state, e, next.col - col, next.row - row, next.col, next.row)) continue
        e.attacking = true
        turnToward(e, Math.atan2((next.row + 0.5) * TILE - e.y, (next.col + 0.5) * TILE - e.x), dt)
        if (e.attackCd <= 0) strike(state, e, target, onBase)
        continue
      }
    }
    e.attacking = false
    if (e.stuck) chew(state, e)

    let speed = def.speed * eventMods(state).mobSpeed
    const here = state.grid[idx(col, row)]
    if (here && here.kind === 'spikes') speed *= spikeStats(here.level).slow
    const tx = (next.col + 0.5) * TILE
    const ty = (next.row + 0.5) * TILE
    const dx = tx - e.x
    const dy = ty - e.y
    const dist = Math.hypot(dx, dy) || 1
    const move = Math.min(dist, speed * dt)
    if (dist > 0.5) turnToward(e, Math.atan2(dy, dx), dt)
    e.x += (dx / dist) * move
    e.y += (dy / dist) * move
    e.vx = ((dx / dist) * move) / dt
    e.vy = ((dy / dist) * move) / dt
  }

  // Séparation douce pour éviter que les ennemis ne s'empilent
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.hp <= 0) continue
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      if (b.hp <= 0) continue
      const min = a.radius + b.radius
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min) continue
      if (d2 < 1e-4) {
        a.x -= Math.random() - 0.5
        a.y -= Math.random() - 0.5
        continue
      }
      const d = Math.sqrt(d2)
      const push = (min - d) * 0.3
      const nx = dx / d
      const ny = dy / d
      a.x -= nx * push
      a.y -= ny * push
      b.x += nx * push
      b.y += ny * push
    }
  }

  for (const e of list) {
    if (e.hp <= 0) continue
    e.x = clamp(e.x, e.radius, WIDTH - e.radius)
    e.y = clamp(e.y, e.radius, HEIGHT - e.radius)
    if (e.jump <= 0) resolveTiles(state, e, e.radius)
  }
}

/** Effets de mort : gerbe, tache au sol, onde de choc pour les gros. */
function deathFx(state: GameState, e: Enemy): void {
  const def = ENEMIES[e.kind]
  const boss = isBossKind(e.kind)
  const big = e.kind === 'rageboss' ? 2 : boss ? 1.5 : 1
  burst(state, e.x, e.y, def.color, boss ? (e.kind === 'rageboss' ? 50 : 34) : 8 + Math.round(e.radius / 2), 130 * big)
  sparks(state, e.x, e.y, '#fff3e0', 3, 150)
  smoke(state, e.x, e.y, '#6d5d4b', boss ? 8 : 2, 50)
  decal(state, e.x, e.y, def.color, e.radius * 1.5 * big)
  if (e.kind === 'brute' || e.kind === 'splitter') ring(state, e.x, e.y, def.color, 52)
  if (boss) {
    ring(state, e.x, e.y, '#ffcdd2', 130 * big / 1.5)
    ring(state, e.x, e.y, def.color, 80 * big / 1.5)
    state.shake = Math.min(1, state.shake + (e.kind === 'rageboss' ? 1 : 0.7))
  }
}

/** Un Éclateur qui meurt se divise en 4 Rôdeurs. */
function split(state: GameState, e: Enemy, out: Enemy[]): void {
  const base = Math.random() * Math.PI
  const r = ENEMIES.grunt.radius
  for (let k = 0; k < 4; k++) {
    const a = base + (k * Math.PI) / 2
    const x = clamp(e.x + Math.cos(a) * 16, r, WIDTH - r)
    const y = clamp(e.y + Math.sin(a) * 16, r, HEIGHT - r)
    const child = createEnemy(state, 'grunt', x, y, 0.7, true)
    child.face = a
    out.push(child)
    burst(state, x, y, ENEMIES.splitter.color, 2, 0, 3)
    burst(state, x, y, ENEMIES.splitter.color, 4, 90)
  }
}

function reapEnemies(state: GameState): void {
  const list = state.enemies
  const born: Enemy[] = []
  let w = 0
  for (const e of list) {
    if (e.hp > 0) {
      list[w++] = e
      continue
    }
    const def = ENEMIES[e.kind]
    const reward = (e.minion ? Math.ceil(def.reward / 2) : def.reward) * (state.dev ? DEV_REWARD_MULT : 1)
    const share = shareGold(state, reward)
    state.kills += 1
    state.kstats[killIndex(e.kind, e.minion)] += 1
    deathFx(state, e)
    if (e.kind === 'splitter') split(state, e, born)
    addText(state, e.x, e.y - 12, `+${fmtGold(share)}`, '#ffd54a')
  }
  list.length = w
  // Ajoutés après la boucle : la vague ne peut pas se terminer entre la mort d'un Éclateur et l'arrivée de ses petits.
  for (const c of born) list.push(c)
}

// ------------------------------------------------------- tourelles, pièges, tirs

/** Animations des bâtiments (rebond d'amélioration, recul du canon) : partagé avec l'affichage de l'invité. */
export function decayBuildingFx(b: Building, dt: number): void {
  b.pop = Math.max(0, b.pop - dt * 2.5)
  b.recoil = Math.max(0, b.recoil - dt * 7)
  b.web = Math.max(0, b.web - dt)
  b.repairCd = Math.max(0, b.repairCd - dt)
}

function updateTurrets(state: GameState, dt: number): void {
  for (const b of state.grid) {
    if (!b) continue
    decayBuildingFx(b, dt)
    if (b.kind !== 'turret') continue
    b.cooldown -= dt
    const cx = (b.col + 0.5) * TILE
    const cy = (b.row + 0.5) * TILE
    const stats = turretStats(b.level, b.branch)
    const target = turretTarget(state, b, cx, cy, stats.range)
    if (!target) continue
    b.angle = Math.atan2(target.y - cy, target.x - cx)
    if (b.cooldown <= 0) {
      const form = turretForm(b.level, b.branch)
      const minigun = form === 'minigun'
      const heavy = form === 'heavy' || form === 'explosive'
      const double = form === 'double' || minigun
      // Double canon et minigun : les tubes tirent à tour de rôle, décalés de part et d'autre de l'axe.
      b.side = -b.side
      const lateral = double ? b.side * (minigun ? 3 : 4.5) : 0
      const muzzleLen = heavy ? 22 : 17
      const mx = cx + Math.cos(b.angle) * muzzleLen - Math.sin(b.angle) * lateral
      const my = cy + Math.sin(b.angle) * muzzleLen + Math.cos(b.angle) * lateral
      // Le minigun arrose : léger écart aléatoire à chaque balle.
      const angle = minigun ? b.angle + (Math.random() - 0.5) * MINIGUN.spread : b.angle
      fire(state, mx, my, angle, stats.bulletSpeed, stats.damage * eventMods(state).turretDamage, stats.range, minigun ? 3 : form === 'explosive' ? 4 : heavy ? 2 : 1, stats.splash ?? 0)
      muzzle(state, mx, my, angle, heavy ? 3 : double ? 2 : 1)
      b.recoil = 1
      if (heavy) state.shake = Math.min(1, state.shake + (form === 'explosive' ? 0.06 : 0.04))
      b.cooldown = 1 / (stats.fireRate * fireRateMult(b))
    }
  }
}

function updateSpikes(state: GameState, dt: number): void {
  for (const e of state.enemies) {
    if (e.hp <= 0) continue
    const col = clamp(Math.floor(e.x / TILE), 0, COLS - 1)
    const row = clamp(Math.floor(e.y / TILE), 0, ROWS - 1)
    const b = state.grid[idx(col, row)]
    if (!b || b.kind !== 'spikes') continue
    const spikes = spikeStats(b.level)
    e.hp -= spikes.dps * dt
    e.flash = Math.max(e.flash, 0.05)
    damageBuilding(state, b, spikes.wearPerSec * dt)
  }
}

/** Explosion à l'impact : tous les ennemis dans le rayon sont touchés, de moins en moins fort vers le bord (100 % → 50 %). */
function explode(state: GameState, x: number, y: number, radius: number, damage: number, color: string): void {
  for (const e of state.enemies) {
    if (e.hp <= 0) continue
    const d = Math.max(0, Math.hypot(e.x - x, e.y - y) - e.radius)
    if (d > radius) continue
    damageEnemy(e, damage * (1 - (1 - EXPLOSION.edgeDamage) * (d / radius)))
  }
  ring(state, x, y, color, radius)
  burst(state, x, y, color, 10, 170)
  burst(state, x, y, '#fff3e0', 2, 0, 3)
  sparks(state, x, y, '#ffe0b2', 10, 260)
  smoke(state, x, y, '#8d6e63', 3, 50)
  state.shake = Math.min(1, state.shake + 0.05)
}

function updateBullets(state: GameState, dt: number): void {
  const bullets = state.bullets
  let w = 0
  for (const b of bullets) {
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.life -= dt
    let alive = b.life > 0 && b.x > -20 && b.x < WIDTH + 20 && b.y > -20 && b.y < HEIGHT + 20
    if (alive) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue
        const r = e.radius + 3
        const dx = e.x - b.x
        const dy = e.y - b.y
        if (dx * dx + dy * dy <= r * r) {
          const style = BULLET_STYLES[b.style] ?? BULLET_STYLES[0]
          if (b.splash > 0) {
            explode(state, b.x, b.y, b.splash, b.damage, style.color)
          } else if (b.style === 2) {
            sparks(state, b.x, b.y, style.color, 8, 200)
            burst(state, b.x, b.y, style.color, 1, 0, 3)
            ring(state, b.x, b.y, style.color, 26)
            damageEnemy(e, b.damage)
          } else {
            damageEnemy(e, b.damage)
            sparks(state, b.x, b.y, style.color, 3, 150)
          }
          // Balle enflammée : le monstre brûle (la brûlure repart de zéro à chaque balle, elle ne s'additionne pas).
          if (b.burn > 0) {
            e.burnT = ABILITY_CONFIG.fireBullets.burnSeconds
            e.burnDps = b.burn
          }
          alive = false
          break
        }
      }
    }
    if (alive) bullets[w++] = b
  }
  bullets.length = w
}
