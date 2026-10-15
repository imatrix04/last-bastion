import { buildTarget } from './build'
import { BASE, ENEMIES, HEIGHT, TILE, TURRET_PLAIN_MAX, WIDTH, type Branch } from './constants'
import { CONTROLS, type InputLike } from './controls'
import { addText, burst, decal, muzzle, ring, updateFx, webShot } from './fx'
import { buildingAt, idx, inBounds } from './grid'
import { buildKindAt, enemyKindAt, type Snap } from './netproto'
import { KILL_KINDS } from './progress'
import { maxHpOf, nextUpgrade, turretStats } from './stats'
import type { ChoiceRequest, Enemy, GameState, HudState } from './types'
import { advanceWebs, decayBuildingFx, movePlayer, nearestEnemy } from './update'

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
    if (s.kstats.length === KILL_KINDS.length) st.kstats = s.kstats
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
    for (const [id, kindIndex, x, y, hp, maxHp, flags] of s.enemies) {
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
          face: Math.atan2(HEIGHT / 2 - y, WIDTH / 2 - x),
          age: 0,
          minion: false,
          abilityCd: 0,
          cast: 0,
          webCol: 0,
          webRow: 0,
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
      e.flash = (flags & 1) !== 0 ? 0.08 : 0
      e.attacking = (flags & 2) !== 0
      e.cast = (flags & 4) !== 0 ? 0.1 : 0
      list.push(e)
    }
    for (const id of this.enemies.keys()) if (!seen.has(id)) this.enemies.delete(id)
    st.enemies = list

    // Bâtiments (on garde l'angle et les animations des tourelles, recalculés ici à chaque image)
    const previous = st.grid.slice()
    st.grid.fill(null)
    for (const [kindIndex, col, row, hp, rawLevel, rawBranch, rawBoost, rawWeb] of s.buildings) {
      const kind = buildKindAt(kindIndex)
      if (!kind || !inBounds(col, row)) continue
      const i = idx(col, row)
      const level = Math.min(TURRET_PLAIN_MAX + 1, Math.max(1, Math.round(rawLevel)))
      const branch: Branch = rawBranch === 1 || rawBranch === 2 ? rawBranch : 0
      const old = previous[i]
      const same = old && old.kind === kind
      st.grid[i] = {
        kind,
        col,
        row,
        hp,
        maxHp: maxHpOf(kind, level, branch),
        cooldown: 0,
        angle: same ? old.angle : 0,
        level,
        branch,
        // Un niveau de plus qu'à l'image précédente : rebond d'amélioration.
        pop: same && old.level < level ? 1 : same ? old.pop : 0,
        recoil: same ? old.recoil : 0,
        side: same ? old.side : 1,
        boost: rawBoost === 1,
        web: Math.max(0, rawWeb / 10)
      }
    }

    // Tirs : repartent de la position reçue et avancent à leur vitesse jusqu'au prochain état
    st.bullets = s.bullets.map(([x, y, vx, vy, style]) => ({
      x,
      y,
      vx,
      vy,
      life: 0.25,
      damage: 0,
      style: style >= 0 && style <= 2 ? Math.round(style) : 0
    }))

    // Effets (particules, textes flottants) joués par l'hôte
    for (const ev of s.fx) {
      switch (ev[0]) {
        case 'b':
          burst(st, ev[1], ev[2], ev[3], ev[4], ev[5], ev[6] as 0 | 1 | 2 | 3)
          break
        case 't':
          addText(st, ev[1], ev[2], ev[3], ev[4])
          break
        case 'r':
          ring(st, ev[1], ev[2], ev[3], ev[4])
          break
        case 'd':
          decal(st, ev[1], ev[2], ev[3], ev[4])
          break
        case 'w':
          webShot(st, ev[1], ev[2], ev[3], ev[4])
          break
        case 'm':
          muzzle(st, ev[1], ev[2], ev[3], ev[4])
          if (ev[4] >= 1) this.kick(ev[1], ev[2], ev[3], ev[4])
          break
      }
    }

    this.ready = true
  }

  /** Une tourelle vient de tirer (flash de bouche reçu) : recul, et canon qui a tiré pour le double canon. */
  private kick(x: number, y: number, angle: number, style: number): void {
    const col = Math.floor(x / TILE)
    const row = Math.floor(y / TILE)
    const b = buildingAt(this.state, col, row)
    if (!b || b.kind !== 'turret') return
    b.recoil = 1
    if (style === 2) {
      const lateral = (x - (col + 0.5) * TILE) * -Math.sin(angle) + (y - (row + 0.5) * TILE) * Math.cos(angle)
      b.side = lateral > 0 ? 1 : -1
    }
  }

  /**
   * Si le joueur local vise une tourelle de niveau 2 qu'il peut s'offrir, l'interface doit proposer le choix de branche
   * (le pop-up est de son côté ; l'hôte ne reçoit que sa décision).
   */
  choiceRequest(): ChoiceRequest | null {
    const p = this.state.players[LOCAL_ID]
    const { col, row } = buildTarget(p)
    const b = buildingAt(this.state, col, row)
    if (!b || b.kind !== 'turret' || b.level !== TURRET_PLAIN_MAX) return null
    const next = nextUpgrade(b, p.unlocks)
    if (!next || next.locked || this.state.gold < next.cost) return null
    return { player: LOCAL_ID, col, row }
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
    const kTurn = 1 - Math.exp(-dt * 12)
    for (const e of this.enemies.values()) {
      const dx = e.tx - e.x
      const dy = e.ty - e.y
      e.age += dt
      if (Math.hypot(dx, dy) > 0.6) {
        const d = Math.atan2(Math.sin(Math.atan2(dy, dx) - e.face), Math.cos(Math.atan2(dy, dx) - e.face))
        e.face += d * kTurn
      }
      e.x += dx * k
      e.y += dy * k
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
      if (!b) continue
      decayBuildingFx(b, dt)
      if (b.kind !== 'turret') continue
      const cx = (b.col + 0.5) * TILE
      const cy = (b.row + 0.5) * TILE
      const target = nearestEnemy(st, cx, cy, turretStats(b.level, b.branch).range)
      if (target) b.angle = Math.atan2(target.y - cy, target.x - cx)
    }

    advanceWebs(st, dt, false)
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
