import { buildTarget } from './build'
import { BASE, BULLET_STYLES, ENEMIES, HEIGHT, OVERCLOCK_LEVELS, TILE, WIDTH } from './config/constants'
import { abilityHud } from './abilities'
import { CONTROLS, type InputLike } from './config/controls'
import { skinAt } from './config/appearance'
import { addText, burst, decal, heavyImpact, muzzle, repaired, upgraded, wallBuilt, turretBuilt, spikesBuilt, ring, sounds, updateFx, webShot } from './fx'
import { buildingAt, idx, inBounds } from './grid'
import { INTERP_DELAY, buildKindAt, enemyKindAt, type Snap } from './config/netproto'
import { KILL_KINDS } from './config/progress'
import { maxLevelOf, maxHpOf, nextUpgrade, playerStats, turretStats } from './stats'
import { TURRET_PLAIN_MAX, type Branch } from './config/turrets'
import type { Bullet, ChoiceRequest, Enemy, GameState, HudState } from './types'
import { EVENT_KINDS, advanceEvent } from './events'
import { advanceWebs, decayBuildingFx, movePlayer, turretTarget } from './update'

/** Le joueur distant contrôle toujours le joueur 2 (rose). */
export const LOCAL_ID = 1

/** Position envoyée à l'hôte : c'est le joueur distant qui décide où se trouve son personnage, l'hôte vérifie. */
export interface Pose {
  x: number
  y: number
  dirX: number
  dirY: number
}

/** Un état reçu de l'hôte, daté avec le temps de simulation de l'hôte (régulier, contrairement à l'arrivée des paquets). */
interface Stamped {
  t: number
  snap: Snap
  enemies: Map<number, number[]>
  fxDone: boolean
}

const MAX_SNAPS = 12
/** Intervalle minimal entre deux envois de position (s). */
const POSE_EVERY = 1 / 30
/** Après ce temps immobile, on se recale doucement sur l'hôte s'il n'est pas d'accord avec notre position. */
const SETTLE_AFTER = 0.6

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Côté joueur distant : il ne simule rien. Il reçoit l'état de l'hôte (apply), l'affiche avec un léger retard
 * (INTERP_DELAY) en interpolant entre deux états connus, ce qui efface les à-coups du réseau.
 * Son propre personnage est prédit localement (même code que l'hôte) et sa position est envoyée à l'hôte.
 */
export class ClientView {
  gameOver = false
  /** Latence aller-retour mesurée (ms), 0 si inconnue. Renseignée par le moteur. */
  rtt = 0
  private enemies = new Map<number, Enemy>()
  private snaps: Stamped[] = []
  /** Écart entre l'horloge locale et le temps de simulation de l'hôte (s). */
  private offset = 0
  /** Gigue moyenne du réseau (s) : retard d'arrivée des paquets par rapport au plus rapide. */
  private jitter = 0
  /** Retard d'affichage courant (s) : suit la gigue, mais lentement pour ne pas déformer le temps. */
  private delay = INTERP_DELAY
  private ready = false
  private moving = false
  private stillFor = 0
  private poseNeeded = false
  private lastPose = 0
  private hostPose = { x: 0, y: 0 }
  private queued = 0

  constructor(private state: GameState) {}

  /** Vrai dès qu'un premier état de l'hôte est arrivé. */
  get synced(): boolean {
    return this.ready
  }

  apply(s: Snap): void {
    const st = this.state
    const now = performance.now() / 1000

    // Horloge : on retient l'écart le plus favorable (paquet le plus rapide) et on le laisse dériver lentement vers le haut.
    const sample = now - s.ts
    if (!this.ready) this.offset = sample
    else this.offset = sample < this.offset ? sample : this.offset + (sample - this.offset) * 0.02
    this.jitter += (Math.max(0, sample - this.offset) - this.jitter) * 0.05

    // Ce qui n'a pas besoin d'être interpolé s'affiche tout de suite.
    st.baseHp = s.baseHp
    st.wave = s.wave
    st.phase = s.phase === 1 ? 'combat' : 'prep'
    st.countdown = s.countdown
    st.kills = s.kills
    if (s.kstats.length === KILL_KINDS.length) st.kstats = s.kstats
    st.shake = Math.max(st.shake, s.shake)
    st.event = s.ev > 0 ? (EVENT_KINDS[s.ev - 1] ?? null) : null
    st.gates = s.gates.map(([x, y]) => ({ x, y }))
    this.queued = s.queued
    if (s.over === 1) this.gameOver = true

    for (let i = 0; i < s.players.length && i < st.players.length; i++) {
      const p = st.players[i]
      p.selected = s.players[i][3]
      p.gold = s.gold[i] ?? p.gold
      // Durée d'effet et recharge de chaque emplacement de capacité (envoyées par l'hôte)
      for (let k = 0; k < p.abilityOn.length; k++) {
        p.abilityOn[k] = s.players[i][6 + 2 * k] ?? 0
        p.abilityCd[k] = s.players[i][7 + 2 * k] ?? 0
      }
      const look = s.looks[i]
      if (i !== LOCAL_ID && look && look[0]) p.look = { color: look[0], hat: skinAt(look[1]), weapon: skinAt(look[2]), trail: skinAt(look[3]), name: look[4] }
      if (i === LOCAL_ID) {
        this.hostPose.x = s.players[i][0]
        this.hostPose.y = s.players[i][1]
        p.aim = s.players[i][2]
        if (!this.ready) {
          p.x = s.players[i][0]
          p.y = s.players[i][1]
        }
      }
    }

    // Bâtiments (on garde l'angle et les animations des tourelles, recalculés à chaque image)
    const previous = st.grid.slice()
    st.grid.fill(null)
    for (const [kindIndex, col, row, hp, rawLevel, rawBranch, rawBoost, rawWeb, rawOwner, rawTargeting] of s.buildings) {
      const kind = buildKindAt(kindIndex)
      if (!kind || !inBounds(col, row)) continue
      const i = idx(col, row)
      const level = Math.min(maxLevelOf(kind), Math.max(1, Math.round(rawLevel)))
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
        owner: rawOwner === 1 ? 1 : 0,
        targeting: rawTargeting === 1 ? 1 : 0,
        // Un niveau de plus qu'à l'image précédente : rebond d'amélioration.
        pop: same && old.level < level ? 1 : same ? old.pop : 0,
        recoil: same ? old.recoil : 0,
        side: same ? old.side : 1,
        boost: Math.min(OVERCLOCK_LEVELS.length, Math.max(0, Math.round(rawBoost))),
        web: Math.max(0, rawWeb / 10),
        repairCd: 0
      }
    }

    // Ennemis, joueur partenaire, tirs et effets sont mis en file et rejoués à l'heure de l'hôte.
    const byId = new Map<number, number[]>()
    for (const row of s.enemies) byId.set(row[0], row)
    this.snaps.push({ t: s.ts, snap: s, enemies: byId, fxDone: false })
    if (this.snaps.length > MAX_SNAPS) this.snaps.shift()
    this.ready = true
  }

  private playFx(s: Snap): void {
    const st = this.state
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
          webShot(st, ev[1], ev[2], ev[3], ev[4], -1, -1, ev[5] === 1)
          break
        case 's':
          if (ev[1] === 1) heavyImpact(st, ev[2], ev[3])
          else if (ev[1] === 2) wallBuilt(st, ev[2], ev[3])
          else if (ev[1] === 3) upgraded(st, ev[2], ev[3])
          else if (ev[1] === 4) repaired(st, ev[2], ev[3])
          else if (ev[1] === 5) turretBuilt(st, ev[2], ev[3])
          else if (ev[1] === 6) spikesBuilt(st, ev[2], ev[3])
          break
        case 'm':
          muzzle(st, ev[1], ev[2], ev[3], ev[4])
          if (ev[4] >= 1) this.kick(ev[1], ev[2], ev[3], ev[4])
          break
      }
    }
  }

  /** Une tourelle vient de tirer (flash de bouche reçu) : recul, et canon qui a tiré pour le double canon. */
  private kick(x: number, y: number, angle: number, style: number): void {
    const col = Math.floor(x / TILE)
    const row = Math.floor(y / TILE)
    const b = buildingAt(this.state, col, row)
    if (!b || b.kind !== 'turret') return
    b.recoil = 1
    if (style === 2 || style === 4) {
      const lateral = (x - (col + 0.5) * TILE) * -Math.sin(angle) + (y - (row + 0.5) * TILE) * Math.cos(angle)
      b.side = lateral > 0 ? 1 : -1
    }
  }

  /**
   * Si le joueur local vise une tourelle de niveau 3 qu'il peut s'offrir, l'interface doit proposer le choix de branche
   * (le pop-up est de son côté ; l'hôte ne reçoit que sa décision).
   */
  choiceRequest(): ChoiceRequest | null {
    const p = this.state.players[LOCAL_ID]
    const { col, row } = buildTarget(p)
    const b = buildingAt(this.state, col, row)
    if (!b || b.kind !== 'turret' || b.level !== TURRET_PLAIN_MAX || b.owner !== LOCAL_ID) return null
    const next = nextUpgrade(b, p.unlocks)
    if (!next || next.locked || p.gold < next.cost) return null
    return { player: LOCAL_ID, col, row }
  }

  /** Position à envoyer à l'hôte (au plus 30 fois par seconde en mouvement, plus une dernière à l'arrêt), sinon null. */
  poseDue(): Pose | null {
    if (!this.ready) return null
    const now = performance.now() / 1000
    if (!this.moving && !this.poseNeeded) return null
    if (this.moving && now - this.lastPose < POSE_EVERY) return null
    this.lastPose = now
    this.poseNeeded = this.moving
    const p = this.state.players[LOCAL_ID]
    return { x: p.x, y: p.y, dirX: p.dirX, dirY: p.dirY }
  }

  /** Appelé à chaque image avec le temps écoulé. */
  update(dt: number, input: InputLike): void {
    const st = this.state
    st.time += dt
    if (!this.ready) return

    const now = performance.now() / 1000
    // Plus le réseau est irrégulier, plus on affiche en retard (de 0,1 s à 0,25 s), avec une variation lente (3 % de vitesse au plus).
    const wanted = Math.min(0.25, Math.max(INTERP_DELAY, 0.07 + 2.5 * this.jitter))
    this.delay += Math.max(-dt * 0.03, Math.min(dt * 0.03, wanted - this.delay))
    const rt = now - this.offset - this.delay

    // --- Mon personnage : prédiction locale (même code que l'hôte), l'hôte suit ma position.
    const me = st.players[LOCAL_ID]
    const c = CONTROLS[0]
    const ix = (input.isDown(c.right) ? 1 : 0) - (input.isDown(c.left) ? 1 : 0)
    const iy = (input.isDown(c.down) ? 1 : 0) - (input.isDown(c.up) ? 1 : 0)
    const wasMoving = this.moving
    this.moving = ix !== 0 || iy !== 0
    if (this.moving) {
      movePlayer(st, me, ix, iy, dt)
      this.stillFor = 0
    } else {
      this.stillFor += dt
      if (wasMoving) this.poseNeeded = true
    }
    // L'hôte peut refuser une position (mur apparu, par exemple) : à l'arrêt on se recale doucement, en cas de gros écart tout de suite.
    const err = Math.hypot(this.hostPose.x - me.x, this.hostPose.y - me.y)
    if (err > 200) {
      me.x = this.hostPose.x
      me.y = this.hostPose.y
    } else if (!this.moving && this.stillFor > SETTLE_AFTER && err > 8) {
      const k = 1 - Math.exp(-dt * 8)
      me.x += (this.hostPose.x - me.x) * k
      me.y += (this.hostPose.y - me.y) * k
    }

    // --- Quel couple d'états encadre l'heure à afficher ?
    const snaps = this.snaps
    let ia = 0
    while (ia + 1 < snaps.length && snaps[ia + 1].t <= rt) ia++
    const a = snaps[ia]
    const b = snaps[ia + 1] ?? a
    const alpha = b === a ? 0 : Math.min(1, Math.max(0, (rt - a.t) / (b.t - a.t)))
    if (ia > 1) snaps.splice(0, ia - 1)

    // Effets de chaque état, joués quand leur heure est venue
    for (const s of snaps) {
      if (s.t > rt) break
      if (!s.fxDone) {
        s.fxDone = true
        this.playFx(s.snap)
      }
    }

    // --- Ennemis : position interpolée entre a et b ; un ennemi absent de b (mort) reste affiché jusqu'à b.
    const kTurn = 1 - Math.exp(-dt * 12)
    const list: Enemy[] = []
    const seen = new Set<number>()
    for (const [id, ra] of a.enemies) {
      const kind = enemyKindAt(ra[1])
      if (!kind) continue
      const rb = b.enemies.get(id)
      const x = rb ? lerp(ra[2], rb[2], alpha) : ra[2]
      const y = rb ? lerp(ra[3], rb[3], alpha) : ra[3]
      let e = this.enemies.get(id)
      if (!e) {
        e = {
          id,
          kind,
          x,
          y,
          radius: ENEMIES[kind].radius,
          hp: ra[4],
          maxHp: ra[5],
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
          vx: 0,
          vy: 0,
          burnT: 0,
          burnDps: 0,
          jump: 0,
          jumpDur: 0,
          jx0: 0,
          jy0: 0,
          jx1: 0,
          jy1: 0
        }
        this.enemies.set(id, e)
      }
      const dx = x - e.x
      const dy = y - e.y
      if (Math.hypot(dx, dy) > 0.2) {
        const target = Math.atan2(dy, dx)
        e.face += Math.atan2(Math.sin(target - e.face), Math.cos(target - e.face)) * kTurn
      }
      e.x = x
      e.y = y
      e.age += dt
      e.hp = ra[4]
      e.maxHp = ra[5]
      e.flash = (ra[6] & 1) !== 0 ? 0.08 : 0
      e.attacking = (ra[6] & 2) !== 0
      e.cast = (ra[6] & 4) !== 0 ? 0.1 : 0
      e.burnT = (ra[6] & 8) !== 0 ? 1 : 0
      // Bond : l'invité ne connaît que l'état « en l'air », affiché à mi-hauteur
      e.jump = (ra[6] & 16) !== 0 ? 0.3 : 0
      e.jumpDur = 0.6
      list.push(e)
      seen.add(id)
    }
    for (const id of this.enemies.keys()) if (!seen.has(id)) this.enemies.delete(id)
    st.enemies = list

    // --- Joueur partenaire (l'hôte), interpolé de la même façon
    const partner = st.players[1 - LOCAL_ID]
    const pa = a.snap.players[1 - LOCAL_ID]
    const pb = b.snap.players[1 - LOCAL_ID]
    if (pa) {
      const ox = partner.x
      const oy = partner.y
      partner.x = pb ? lerp(pa[0], pb[0], alpha) : pa[0]
      partner.y = pb ? lerp(pa[1], pb[1], alpha) : pa[1]
      // Pas du partenaire, déduits de son déplacement (ignorés si la position saute, ex. à la réapparition)
      const moved = Math.hypot(partner.x - ox, partner.y - oy)
      if (moved < 60) sounds.step(partner.id, moved, playerStats(partner.perks).speed, partner.x, partner.y)
      partner.aim = pa[2]
      partner.dirX = pa[4]
      partner.dirY = pa[5]
    }

    // --- Tirs : position exacte à l'heure affichée (position reçue + vitesse × temps écoulé depuis cet état)
    const elapsed = Math.min(0.25, Math.max(0, rt - a.t))
    const bullets: Bullet[] = []
    for (const [x, y, vx, vy, style] of a.snap.bullets) {
      bullets.push({ x: x + vx * elapsed, y: y + vy * elapsed, vx, vy, life: 1, damage: 0, style: style >= 0 && style < BULLET_STYLES.length ? Math.round(style) : 0, splash: 0, burn: 0 })
    }
    st.bullets = bullets

    // --- Les tourelles visent localement (même règle que l'hôte : l'ennemi le plus proche à portée)
    for (const bd of st.grid) {
      if (!bd) continue
      decayBuildingFx(bd, dt)
      if (bd.kind !== 'turret') continue
      const cx = (bd.col + 0.5) * TILE
      const cy = (bd.row + 0.5) * TILE
      const target = turretTarget(st, bd, cx, cy, turretStats(bd.level, bd.branch).range)
      if (target) bd.angle = Math.atan2(target.y - cy, target.x - cx)
    }

    advanceWebs(st, dt, false)
    advanceEvent(st, dt)
    updateFx(st, dt)
  }

  hud(): HudState {
    const st = this.state
    return {
      golds: st.players.map((p) => p.gold),
      wave: st.wave,
      phase: st.phase,
      countdown: Math.ceil(Math.max(0, st.countdown)),
      baseHp: Math.ceil(st.baseHp),
      baseMax: BASE.maxHp,
      enemies: this.enemies.size + this.queued,
      kills: st.kills,
      dev: false,
      selected: st.players.map((p) => p.selected),
      ping: Math.round(this.rtt),
      colors: st.players.map((p) => p.look.color),
      abilities: st.players.map((p) => abilityHud(p))
    }
  }
}

