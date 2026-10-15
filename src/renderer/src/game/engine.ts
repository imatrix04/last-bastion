import { session, type SessionEvent } from '../net'
import { applyTurretBranch } from './build'
import { BASE, HEIGHT, STEP, WIDTH } from './constants'
import type { Branch } from './turrets'
import { ClientView } from './clientView'
import { Input } from './input'
import {
  ACTIONS,
  CODES,
  SNAPSHOT_STEPS,
  decodeInput,
  decodePick,
  decodePing,
  decodePose,
  decodeSnap,
  encodeSnap,
  type Action
} from './netproto'
import { emptyLoadout, scoreRun, type Loadout } from './progress'
import { HostInput, RemoteInput } from './remoteInput'
import { createBackground, render } from './render'
import { createState } from './state'
import type { ChoiceRequest, GameState, HudState, RunResult } from './types'
import { acceptRemotePose, step } from './update'
import type { InputLike } from './controls'

export interface GameCallbacks {
  onHud(hud: HudState): void
  onGameOver(result: RunResult): void
  /** Un joueur local veut spécialiser une tourelle de niveau 2 : afficher le pop-up de choix. */
  onChoice(request: ChoiceRequest): void
}

/**
 * local  : une seule machine (solo, ou 2 joueurs sur le même clavier)
 * host   : simule le jeu et envoie l'état au joueur distant (contrôle le joueur 1)
 * client : n'affiche que l'état reçu de l'hôte et lui envoie ses touches (contrôle le joueur 2)
 */
export type GameMode = 'local' | 'host' | 'client'

/** Boucle de jeu : pas fixe de 1/60 s pour la simulation, rendu à chaque image. */
export class Game {
  private state: GameState
  private input = new Input()
  private remote = new RemoteInput()
  private sim: InputLike
  private view: ClientView | null = null
  private unsubscribe: (() => void) | null = null
  private ctx: CanvasRenderingContext2D
  private bg: CanvasImageSource
  private raf = 0
  private last = 0
  private acc = 0
  private hudTimer = 0
  private snapTimer = 0
  private stepsSinceSnap = 0
  private pingTimer = 0
  private peerPing = 0
  private lastDown = ''
  private paused = false
  private ended = false
  private scale = 1
  private observer: ResizeObserver

  constructor(
    private canvas: HTMLCanvasElement,
    playerCount: 1 | 2,
    private mode: GameMode,
    /** Compétences, améliorations et apparence du joueur de cette machine : [joueur 1, joueur 2 au même clavier]. */
    loadouts: Loadout[],
    private callbacks: GameCallbacks
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D indisponible')
    this.ctx = ctx
    // Local : les deux joueurs partagent la sauvegarde. En ligne : chacun a les siennes (l'hôte est le joueur 1, l'invité le joueur 2).
    const own = loadouts[0]
    const sets = mode === 'local' ? [own, loadouts[1] ?? own] : mode === 'host' ? [own, session.peerLoadout] : [emptyLoadout(0), own]
    this.state = createState(mode === 'local' ? playerCount : 2, sets)
    this.sim = this.input

    if (mode === 'host') {
      this.state.fxLog = []
      // Le joueur 2 décide de sa position (envoyée par son PC, vérifiée ici) : on ne le déplace pas avec ses touches.
      this.state.players[1].remote = true
      this.sim = new HostInput(this.input, this.remote)
    } else if (mode === 'client') {
      this.view = new ClientView(this.state)
    }
    if (mode !== 'local') this.unsubscribe = session.subscribe(this.onSession)
    // Un nouveau jeu côté hôte : le joueur distant (déjà connecté) doit passer à l'écran de jeu.
    if (mode === 'host' && session.peerReady) session.send({ t: 'start' })

    this.bg = createBackground(1)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
  }

  start(): void {
    this.callbacks.onHud(this.hud())
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  /** En local la pause fige le jeu. En ligne on ne peut pas figer l'autre joueur : le jeu continue, les touches sont juste ignorées. */
  setPaused(paused: boolean): void {
    this.paused = paused && this.mode === 'local'
    this.input.enabled = !paused
    this.input.reset()
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.observer.disconnect()
    this.input.dispose()
    this.unsubscribe?.()
  }

  private onSession = (event: SessionEvent): void => {
    if (this.mode === 'host') {
      if (event.type === 'message' && event.msg.t === 'in') this.remote.apply(decodeInput(event.msg))
      else if (event.type === 'message' && event.msg.t === 'pick') this.onRemotePick(event.msg)
      else if (event.type === 'message' && event.msg.t === 'pos') this.onRemotePose(event.msg)
      else if (event.type === 'message' && event.msg.t === 'ping') this.onPing(event.msg)
      else if (event.type === 'ready') {
        this.state.players[1].unlocks = session.peerLoadout.unlocks // ses compétences ont pu changer
        this.state.players[1].perks = session.peerLoadout.perks.slice()
        this.state.players[1].look = { ...session.peerLoadout.look }
        session.send({ t: 'start' }) // le joueur 2 revient en pleine partie
      }
      else if (event.type === 'left') this.remote.clear()
    } else if (this.mode === 'client' && event.type === 'message') {
      if (event.msg.t === 'snap') {
        const snap = decodeSnap(event.msg)
        if (snap) this.view?.apply(snap)
      } else if (event.msg.t === 'pong' && typeof event.msg.c === 'number' && this.view) {
        // Latence aller-retour, lissée pour que l'affichage ne saute pas
        const sample = performance.now() - event.msg.c
        if (sample >= 0 && sample < 10000) this.view.rtt = this.view.rtt === 0 ? sample : this.view.rtt * 0.7 + sample * 0.3
      }
    }
  }

  /** Position annoncée par le joueur distant : acceptée si plausible (voir acceptRemotePose). */
  private onRemotePose(msg: Record<string, unknown>): void {
    const pose = decodePose(msg)
    if (pose && !this.ended) acceptRemotePose(this.state, this.state.players[1], pose.x, pose.y, pose.dirX, pose.dirY)
  }

  /** Mesure de latence : on renvoie l'horloge de l'invité telle quelle, et on retient la latence qu'il a mesurée. */
  private onPing(msg: Record<string, unknown>): void {
    const ping = decodePing(msg)
    if (!ping) return
    this.peerPing = ping.r
    session.send({ t: 'pong', c: ping.c })
  }

  /** Le joueur distant (joueur 2) a choisi la branche d'une tourelle : l'hôte vérifie puis applique. */
  private onRemotePick(msg: Record<string, unknown>): void {
    const pick = decodePick(msg)
    if (pick && !this.ended) applyTurretBranch(this.state, pick.col, pick.row, pick.branch, this.state.players[1])
  }

  /** Choix de branche fait dans le pop-up (local, hôte ou invité). */
  pickBranch(request: ChoiceRequest, branch: Branch): void {
    if (this.mode === 'client') {
      session.send({ t: 'pick', c: request.col, r: request.row, b: branch })
    } else if (!this.ended) {
      applyTurretBranch(this.state, request.col, request.row, branch, this.state.players[request.player])
    }
  }

  /** Résolution interne adaptée à la taille réelle affichée (écrans HiDPI, plein écran). */
  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const wanted = (rect.width * dpr) / WIDTH
    const scale = Math.min(2, Math.max(1, Math.round(wanted * 4) / 4))
    if (scale === this.scale && this.canvas.width === Math.round(WIDTH * scale)) return
    this.scale = scale
    this.canvas.width = Math.round(WIDTH * scale)
    this.canvas.height = Math.round(HEIGHT * scale)
    this.bg = createBackground(scale)
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now

    if (this.mode === 'client') this.frameClient(dt)
    else this.frameSim(dt)

    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
    render(this.ctx, this.state, this.bg)
  }

  /** Local et hôte : la simulation tourne ici. */
  private frameSim(dt: number): void {
    if (!this.paused && !this.ended) {
      this.acc += dt
      while (this.acc >= STEP) {
        step(this.state, STEP, this.sim)
        this.input.endStep()
        this.remote.endStep()
        this.acc -= STEP
        // Un état tous les SNAPSHOT_STEPS pas : l'intervalle est régulier dans le temps de simulation, l'invité s'en sert pour dater l'affichage.
        if (this.mode === 'host' && ++this.stepsSinceSnap >= SNAPSHOT_STEPS) {
          this.stepsSinceSnap = 0
          this.sendSnapshot()
        }
        if (this.state.gameOver) break
      }
    }

    // Demande de choix de branche : en ligne, celles du joueur 2 sont traitées chez lui.
    const choice = this.state.choice
    if (choice) {
      this.state.choice = null
      if (this.mode !== 'host' || choice.player === 0) this.callbacks.onChoice(choice)
    }

    // Partie finie : plus de pas de simulation, on continue d'envoyer l'état (2 fois par seconde) pour que l'invité voie la fin.
    if (this.mode === 'host' && this.ended) {
      this.snapTimer += dt
      if (this.snapTimer >= 0.5) {
        this.snapTimer = 0
        this.sendSnapshot()
      }
    }
    this.updateHud(dt, this.state.gameOver)
  }

  /** Joueur distant : envoie ses touches, lisse l'état reçu. */
  private frameClient(dt: number): void {
    const view = this.view
    if (!view) return
    view.update(dt, this.input)
    // Tourelle niveau 2 visée : le pop-up s'ouvre ici, l'hôte n'est prévenu qu'au moment du choix.
    let skip: Action | null = null
    if (this.input.wasPressed(CODES[0].upgrade)) {
      const request = view.choiceRequest()
      if (request) {
        this.callbacks.onChoice(request)
        skip = 'upgrade'
      }
    }
    this.sendInput(skip)
    const pose = view.poseDue()
    if (pose) session.send({ t: 'pos', x: Math.round(pose.x * 10) / 10, y: Math.round(pose.y * 10) / 10, dx: pose.dirX, dy: pose.dirY })
    this.pingTimer -= dt
    if (this.pingTimer <= 0) {
      this.pingTimer = 1
      session.send({ t: 'ping', c: performance.now(), r: Math.round(view.rtt) })
    }
    this.input.endStep()
    this.updateHud(dt, view.gameOver)
  }

  /** L'hôte envoie l'état du jeu SNAPSHOT_HZ fois par seconde (voir frameSim). */
  private sendSnapshot(): void {
    const log = this.state.fxLog
    if (!session.peerReady) {
      if (log) log.length = 0
      return
    }
    session.send(encodeSnap(this.state), true)
    if (log) log.length = 0
  }

  /** Le joueur distant n'envoie que les changements : touches maintenues, et appuis rapides. */
  private sendInput(skip: Action | null): void {
    const down: Action[] = []
    const pressed: Action[] = []
    for (const action of ACTIONS) {
      const code = CODES[0][action]
      if (this.input.isDown(code)) down.push(action)
      if (action !== skip && this.input.wasPressed(code)) pressed.push(action)
    }
    const key = down.join(',')
    if (key === this.lastDown && pressed.length === 0) return
    this.lastDown = key
    session.send({ t: 'in', d: down, p: pressed })
  }

  private updateHud(dt: number, over: boolean): void {
    if (over && !this.ended) {
      this.ended = true
      this.callbacks.onHud(this.hud())
      const score = scoreRun(this.state.kstats, this.state.wave)
      this.callbacks.onGameOver({ wave: this.state.wave, kills: this.state.kills, points: score.total, score })
      return
    }
    if (this.ended) return
    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1
      this.callbacks.onHud(this.hud())
    }
  }

  private hud(): HudState {
    if (this.view) return this.view.hud()
    const s = this.state
    return {
      gold: s.gold,
      wave: s.wave,
      phase: s.phase,
      countdown: Math.ceil(Math.max(0, s.countdown)),
      baseHp: Math.ceil(s.baseHp),
      baseMax: BASE.maxHp,
      enemies: s.enemies.length + s.spawnQueue.length,
      kills: s.kills,
      selected: s.players.map((p) => p.selected),
      ping: Math.round(this.peerPing),
      colors: s.players.map((p) => p.look.color)
    }
  }
}
