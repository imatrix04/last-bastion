import { BASE, BUILDS, ENEMIES, TILE, TURRET } from './constants'
import { CONTROLS, type InputLike } from './controls'
import { addText, burst, updateFx } from './fx'
import { idx, inBounds } from './grid'
import { BULLET_COLORS, buildKindAt, enemyKindAt, type Snap } from './netproto'
import type { Building, Enemy, GameState, HudState } from './types'
import { movePlayer, nearestEnemy } from './update'

/** Le joueur distant contrôle toujours le joueur 2 (rose). */
export const LOCAL_ID = 1

interface ViewEnemy extends Enemy {
  /** Position reçue en dernier : l'ennemi affiché s'en rapproche en douceur. */
  tx: number
  ty: number
}

/**
 * Côté joueur distant : il ne simule rien. Il reçoit l'état de l'hôte (apply), l'affiche avec un peu de
 * lissage, et ne calcule que son propre déplacement (prédiction) pour que son personnage réponde sans attendre le réseau.
 */
export class ClientView {
  gameOver = false
  private enemies = new Map<number, ViewEnemy>()
  private partner = { x: 0, y: 0 }
  private ready = false
  private moving = false
  private queued = 0

  constructor(private state: GameState) {}

  /** Vrai dès qu'un premier état de l'hôte est arrivé. */
  get synced(): boolean {
    return this.ready
  }

  apply(s: Snap): void {
    const st = this.state
    st.gold = s.gold
    st.baseHp = s.baseHp
    st.wave = s.wave
    st.phase = s.phase === 1 ? 'combat' : 'prep'
    st.countdown = s.countdown
    st.kills = s.kills
    st.shake = Math.max(st.shake, s.shake)
    st.gates = s.gates.map(([x, y]) => ({ x, y }))
    this.queued = s.queued
    if (s.over === 1) this.gameOver = true

    // Joueurs
    for (let i = 0; i < s.players.length && i < st.players.length; i++) {
      const [x, y, aim, selected, dirX, dirY] = s.players[i]
      const p = st.players[i]
      p.selected = selected
      p.aim = aim
      if (i === LOCAL_ID) {
        // Mon personnage : je fais confiance à ma prédiction pendant que je bouge,
        // et je me recale sur l'hôte à l'arrêt ou en cas de grosse divergence.
        const err = Math.hypot(x - p.x, y - p.y)
        if (!this.ready || err > 96) {
          p.x = x
          p.y = y
        } else if (!this.moving && err > 0.5) {
          p.x += (x - p.x) * 0.35
          p.y += (y - p.y) * 0.35
        }
      } else {
        if (!this.ready) {
          p.x = x
          p.y = y
        }
        this.partner.x = x
        this.partner.y = y
        p.dirX = dirX
        p.dirY = dirY
      }
    }

    // Ennemis
    const seen = new Set<number>()
    const list: ViewEnemy[] = []
    for (const [id, kindIndex, x, y, hp, maxHp, flash] of s.enemies) {
      const kind = enemyKindAt(kindIndex)
      if (!kind) continue
      seen.add(id)
      let e = this.enemies.get(id)
      if (!e) {
        e = {
          id,
          kind,
          x,
          y,
          radius: ENEMIES[kind].radius,
          hp,
          maxHp,
          attackCd: 0,
          flash: 0,
          attacking: false,
          lx: x,
          ly: y,
          checkT: 0,
          stuck: false,
          tx: x,
          ty: y
        }
        this.enemies.set(id, e)
      }
      e.tx = x
      e.ty = y
      e.hp = hp
      e.maxHp = maxHp
      e.flash = flash === 1 ? 0.08 : 0
      list.push(e)
    }
    for (const id of this.enemies.keys()) if (!seen.has(id)) this.enemies.delete(id)
    st.enemies = list

    // Bâtiments (on garde l'angle des tourelles, qui est recalculé ici à chaque image)
    const previous = st.grid.slice()
    st.grid.fill(null)
    for (const [kindIndex, col, row, hp] of s.buildings) {
      const kind = buildKindAt(kindIndex)
      if (!kind || !inBounds(col, row)) continue
      const i = idx(col, row)
      const building: Building = { kind, col, row, hp, maxHp: BUILDS[kind].hp, cooldown: 0, angle: previous[i]?.angle ?? 0 }
      st.grid[i] = building
    }

    // Tirs : repartent de la position reçue et avancent à leur vitesse jusqu'au prochain état
    st.bullets = s.bullets.map(([x, y, vx, vy, color]) => ({
      x,
      y,
      vx,
      vy,
      life: 0.25,
      damage: 0,
      color: BULLET_COLORS[color] ?? BULLET_COLORS[0]
    }))

    // Effets (particules, textes flottants) joués par l'hôte
    for (const ev of s.fx) {
      if (ev[0] === 'b') burst(st, ev[1], ev[2], ev[3], ev[4], ev[5])
      else addText(st, ev[1], ev[2], ev[3], ev[4])
    }

    this.ready = true
  }

  /** Appelé à chaque image avec le temps écoulé. */
  update(dt: number, input: InputLike): void {
    const st = this.state
    st.time += dt
    if (!this.ready) return

    // Prédiction : mon déplacement est calculé tout de suite, avec exactement le même code que l'hôte.
    const c = CONTROLS[0]
    const ix = (input.isDown(c.right) ? 1 : 0) - (input.isDown(c.left) ? 1 : 0)
    const iy = (input.isDown(c.down) ? 1 : 0) - (input.isDown(c.up) ? 1 : 0)
    this.moving = ix !== 0 || iy !== 0
    if (this.moving) movePlayer(st, st.players[LOCAL_ID], ix, iy, dt)

    // Lissage entre deux états reçus
    const k = 1 - Math.exp(-dt * 18)
    for (const e of this.enemies.values()) {
      e.x += (e.tx - e.x) * k
      e.y += (e.ty - e.y) * k
    }
    const partner = st.players[1 - LOCAL_ID]
    partner.x += (this.partner.x - partner.x) * k
    partner.y += (this.partner.y - partner.y) * k

    for (const b of st.bullets) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life -= dt
    }
    st.bullets = st.bullets.filter((b) => b.life > 0)

    // Les tourelles visent localement (même règle que l'hôte : l'ennemi le plus proche à portée)
    for (const b of st.grid) {
      if (!b || b.kind !== 'turret') continue
      const cx = (b.col + 0.5) * TILE
      const cy = (b.row + 0.5) * TILE
      const target = nearestEnemy(st, cx, cy, TURRET.range)
      if (target) b.angle = Math.atan2(target.y - cy, target.x - cx)
    }

    updateFx(st, dt)
  }

  hud(): HudState {
    const st = this.state
    return {
      gold: st.gold,
      wave: st.wave,
      phase: st.phase,
      countdown: Math.ceil(Math.max(0, st.countdown)),
      baseHp: Math.ceil(st.baseHp),
      baseMax: BASE.maxHp,
      enemies: this.enemies.size + this.queued,
      kills: st.kills,
      selected: st.players.map((p) => p.selected)
    }
  }
}
