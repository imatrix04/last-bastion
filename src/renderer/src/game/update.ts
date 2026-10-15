import { actPlace, actRemove } from './build'
import {
  BASE,
  BUILD_ORDER,
  BUILD_REPEAT,
  BUILDS,
  COLS,
  ENEMIES,
  HEIGHT,
  PLAYER,
  PREP_TIME,
  ROWS,
  SPIKES,
  TILE,
  TURRET,
  WIDTH
} from './constants'
import { CONTROLS, SKIP_WAVE, type InputLike } from './controls'
import { addText, burst, updateFx } from './fx'
import { distToRect, idx, isBaseCell, resolveTiles } from './grid'
import { computeFlow, nextCell } from './pathing'
import type { Building, Enemy, GameState, Player } from './types'
import { composeWave, pickGates, spawnEnemy, spawnInterval, waveScale } from './waves'

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Un pas de simulation (dt en secondes). */
export function step(state: GameState, dt: number, input: InputLike): void {
  if (state.gameOver) return
  state.time += dt

  updatePlayers(state, dt, input)
  updateWaves(state, dt, input)
  if (state.flowDirty) computeFlow(state)
  updateEnemies(state, dt)
  updateTurrets(state, dt)
  updateSpikes(state, dt)
  updateBullets(state, dt)
  reapEnemies(state)
  updateFx(state, dt)

  if (state.baseHp <= 0) {
    state.baseHp = 0
    state.gameOver = true
  }
}

// ---------------------------------------------------------------- utilitaires

export function nearestEnemy(state: GameState, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null
  let bestD = range * range
  for (const e of state.enemies) {
    if (e.hp <= 0) continue
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

function fire(
  state: GameState,
  x: number,
  y: number,
  angle: number,
  speed: number,
  damage: number,
  range: number,
  color: string
): void {
  state.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: range / speed + 0.15,
    damage,
    color
  })
}

function damageEnemy(e: Enemy, amount: number): void {
  e.hp -= amount
  e.flash = 0.08
}

function damageBuilding(state: GameState, b: Building, amount: number): void {
  b.hp -= amount
  if (b.hp > 0) return
  state.grid[idx(b.col, b.row)] = null
  if (BUILDS[b.kind].solid) state.flowDirty = true
  burst(state, (b.col + 0.5) * TILE, (b.row + 0.5) * TILE, '#bcaaa4', 12, 130)
}

function hitBase(state: GameState, amount: number, from: Enemy): void {
  state.baseHp -= amount
  state.shake = Math.min(1, state.shake + 0.12)
  burst(state, from.x, from.y, '#ffcc80', 3, 70)
}

// -------------------------------------------------------------------- joueurs

/**
 * Déplace un joueur selon son intention (ix, iy ∈ {-1, 0, 1}) et met à jour la case qu'il vise.
 * Partagé avec la prédiction du joueur distant (clientView.ts) : même code des deux côtés.
 */
export function movePlayer(state: GameState, p: Player, ix: number, iy: number, dt: number): void {
  if (ix !== 0 || iy !== 0) {
    const len = Math.hypot(ix, iy)
    p.x += (ix / len) * PLAYER.speed * dt
    p.y += (iy / len) * PLAYER.speed * dt
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

function updatePlayers(state: GameState, dt: number, input: InputLike): void {
  for (const p of state.players) {
    const c = CONTROLS[p.id]

    // Déplacement
    const ix = (input.isDown(c.right) ? 1 : 0) - (input.isDown(c.left) ? 1 : 0)
    const iy = (input.isDown(c.down) ? 1 : 0) - (input.isDown(c.up) ? 1 : 0)
    movePlayer(state, p, ix, iy, dt)

    // Choix de l'objet à construire
    c.slots.forEach((code, i) => {
      if (input.wasPressed(code)) p.selected = i
    })
    const n = BUILD_ORDER.length
    if (input.wasPressed(c.next)) p.selected = (p.selected + 1) % n
    if (input.wasPressed(c.prev)) p.selected = (p.selected + n - 1) % n

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
    const target = nearestEnemy(state, p.x, p.y, PLAYER.range)
    if (target) {
      p.aim = Math.atan2(target.y - p.y, target.x - p.x)
      if (p.shootCd <= 0) {
        const spread = (Math.random() - 0.5) * 0.08
        fire(state, p.x, p.y, p.aim + spread, PLAYER.bulletSpeed, PLAYER.damage, PLAYER.range, '#fff59d')
        p.shootCd = 1 / PLAYER.fireRate
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
      const bonus = Math.floor(state.countdown) * 2
      if (bonus > 0) {
        state.gold += bonus
        addText(state, BASE.col * TILE + (BASE.cols * TILE) / 2, BASE.row * TILE - 30, `+${bonus} (appel anticipé)`, '#ffd54a')
      }
      state.countdown = 0
    }
    if (state.countdown <= 0) startWave(state)
    return
  }

  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt
    if (state.spawnTimer <= 0) {
      const kind = state.spawnQueue.shift()
      if (kind) spawnEnemy(state, kind)
      state.spawnTimer = spawnInterval(state.wave)
    }
  } else if (state.enemies.length === 0) {
    endWave(state)
  }
}

function startWave(state: GameState): void {
  state.wave += 1
  state.waveScale = waveScale(state.wave)
  state.spawnQueue = composeWave(state.wave, state.playerCount)
  state.spawnTimer = 0.5
  state.phase = 'combat'
}

function endWave(state: GameState): void {
  const bonus = 30 + state.wave * 12
  state.gold += bonus
  state.baseHp = Math.min(BASE.maxHp, state.baseHp + BASE.maxHp * 0.08)
  addText(
    state,
    BASE.col * TILE + (BASE.cols * TILE) / 2,
    BASE.row * TILE - 30,
    `Vague ${state.wave} repoussée  +${bonus}`,
    '#a5d6a7'
  )
  state.phase = 'prep'
  state.countdown = PREP_TIME
  state.gates = pickGates(state.wave + 1)
}

// -------------------------------------------------------------------- ennemis

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
    const next = nextCell(state, col, row)
    if (!next) continue

    const target = state.grid[idx(next.col, next.row)]
    const onBase = isBaseCell(next.col, next.row)
    const blocking = onBase || (target !== null && BUILDS[target.kind].solid)

    if (blocking) {
      const d = distToRect(e.x, e.y, next.col * TILE, next.row * TILE, TILE, TILE)
      if (d <= e.radius + 4) {
        e.attacking = true
        if (e.attackCd <= 0) strike(state, e, target, onBase)
        continue
      }
    }
    e.attacking = false
    if (e.stuck) chew(state, e)

    let speed = def.speed
    const here = state.grid[idx(col, row)]
    if (here && here.kind === 'spikes') speed *= SPIKES.slow
    const tx = (next.col + 0.5) * TILE
    const ty = (next.row + 0.5) * TILE
    const dx = tx - e.x
    const dy = ty - e.y
    const dist = Math.hypot(dx, dy) || 1
    const move = Math.min(dist, speed * dt)
    e.x += (dx / dist) * move
    e.y += (dy / dist) * move
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
    resolveTiles(state, e, e.radius)
  }
}

function reapEnemies(state: GameState): void {
  const list = state.enemies
  let w = 0
  for (const e of list) {
    if (e.hp > 0) {
      list[w++] = e
      continue
    }
    const def = ENEMIES[e.kind]
    state.gold += def.reward
    state.kills += 1
    burst(state, e.x, e.y, def.color, e.kind === 'boss' ? 30 : 10)
    addText(state, e.x, e.y - 12, `+${def.reward}`, '#ffd54a')
  }
  list.length = w
}

// ------------------------------------------------------- tourelles, pièges, tirs

function updateTurrets(state: GameState, dt: number): void {
  for (const b of state.grid) {
    if (!b || b.kind !== 'turret') continue
    b.cooldown -= dt
    const cx = (b.col + 0.5) * TILE
    const cy = (b.row + 0.5) * TILE
    const target = nearestEnemy(state, cx, cy, TURRET.range)
    if (!target) continue
    b.angle = Math.atan2(target.y - cy, target.x - cx)
    if (b.cooldown <= 0) {
      const muzzle = 16
      fire(
        state,
        cx + Math.cos(b.angle) * muzzle,
        cy + Math.sin(b.angle) * muzzle,
        b.angle,
        TURRET.bulletSpeed,
        TURRET.damage,
        TURRET.range,
        '#80deea'
      )
      b.cooldown = 1 / TURRET.fireRate
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
    e.hp -= SPIKES.dps * dt
    e.flash = Math.max(e.flash, 0.05)
    damageBuilding(state, b, SPIKES.wearPerSec * dt)
  }
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
          damageEnemy(e, b.damage)
          burst(state, b.x, b.y, b.color, 3, 80)
          alive = false
          break
        }
      }
    }
    if (alive) bullets[w++] = b
  }
  bullets.length = w
}
