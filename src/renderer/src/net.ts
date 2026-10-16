import { NET_PORT, PROTO_VERSION } from './game/config/netproto'
import { skinAt, skinIndex, sanitizeLook } from './game/config/appearance'
import { emptyLoadout, sanitizeMask, sanitizePerks, type Loadout } from './game/config/progress'

/** Évènements de la session de jeu en ligne, tels que les voit le reste de l'application. */
export type SessionEvent =
  | { type: 'ready' } // hôte : le joueur 2 s'est présenté (poignée de main validée)
  | { type: 'left' } // le pair s'est déconnecté
  | { type: 'start' } // client : l'hôte (re)lance la partie
  | { type: 'rejected'; reason: string } // client : l'hôte refuse la connexion
  | { type: 'message'; msg: Record<string, unknown> } // tout le reste (entrées, snapshots)

type Listener = (event: SessionEvent) => void
type Role = 'host' | 'client' | null

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Session réseau unique : encapsule l'API du preload et fait la poignée de main. */
class Session {
  role: Role = null
  /** Hôte : un joueur 2 compatible est connecté. */
  peerReady = false
  /** Hôte : compétences et améliorations du joueur distant (annoncées à la poignée de main). */
  peerLoadout: Loadout = emptyLoadout(1)
  private listeners = new Set<Listener>()
  private unbind: (() => void) | null = null

  get available(): boolean {
    return !!window.api?.net
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async host(): Promise<HostResult> {
    const net = window.api?.net
    if (!net) return { ok: false, error: "Le jeu en ligne nécessite l'application Electron." }
    this.reset()
    this.bind()
    const result = await net.host(NET_PORT)
    if (result.ok) this.role = 'host'
    return result
  }

  /** `loadout` : compétences et améliorations du joueur qui rejoint, envoyées à l'hôte. */
  async join(address: string, loadout: Loadout = emptyLoadout(0)): Promise<JoinResult> {
    const net = window.api?.net
    if (!net) return { ok: false, error: "Le jeu en ligne nécessite l'application Electron." }
    this.reset()
    this.bind()
    const result = await net.join(address)
    if (result.ok) {
      this.role = 'client'
      this.send({ t: 'hello', v: PROTO_VERSION, u: loadout.unlocks, k: loadout.perks, l: [loadout.look.color, skinIndex(loadout.look.hat), skinIndex(loadout.look.weapon), loadout.look.name] })
    }
    return result
  }

  /** `droppable` : message qu'on peut sacrifier si le réseau est saturé (snapshots). */
  send(msg: object, droppable = false): void {
    window.api?.net.send(JSON.stringify(msg), droppable)
  }

  close(): void {
    this.reset()
    void window.api?.net.close()
  }

  private reset(): void {
    this.role = null
    this.peerReady = false
    this.peerLoadout = emptyLoadout(1)
  }

  private bind(): void {
    if (this.unbind) return
    this.unbind = window.api?.net.onEvent((event) => this.onNet(event)) ?? null
  }

  private emit(event: SessionEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }

  private onNet(event: NetEvent): void {
    if (event.type === 'peer-joined') return // on attend la poignée de main (hello)
    if (event.type === 'peer-left') {
      this.peerReady = false
      this.emit({ type: 'left' })
      return
    }

    let msg: unknown
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    if (!isRecord(msg) || typeof msg.t !== 'string') return

    if (this.role === 'host' && msg.t === 'hello') {
      if (msg.v !== PROTO_VERSION) {
        this.send({ t: 'reject', reason: 'Version du jeu différente : mettez à jour les deux PC.' })
        setTimeout(() => void window.api?.net.kick(), 300)
        return
      }
      const l = Array.isArray(msg.l) ? msg.l : []
      this.peerLoadout = {
        unlocks: sanitizeMask(msg.u),
        perks: sanitizePerks(msg.k),
        look: sanitizeLook({ color: l[0], hat: skinAt(l[1]), weapon: skinAt(l[2]), name: l[3] }, 1)
      }
      if (!this.peerReady) {
        this.peerReady = true
        this.emit({ type: 'ready' })
      }
      return
    }
    if (this.role === 'client' && msg.t === 'start') {
      this.emit({ type: 'start' })
      return
    }
    if (msg.t === 'reject') {
      this.emit({ type: 'rejected', reason: typeof msg.reason === 'string' ? msg.reason.slice(0, 200) : "Refusé par l'hôte." })
      return
    }
    this.emit({ type: 'message', msg })
  }
}

export const session = new Session()
