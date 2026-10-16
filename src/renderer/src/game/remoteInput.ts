import { SKIP_WAVE, type InputLike } from './config/controls'
import { ACTIONS, CODES, type Action } from './config/netproto'

/** Les touches du joueur 2 (sauf « lancer la vague », partagée) : elles sont pilotées par le réseau, pas par le clavier de l'hôte. */
const P2_CODES: ReadonlySet<string> = new Set(ACTIONS.filter((a) => a !== 'skip').map((a) => CODES[1][a]))

/**
 * Entrées du joueur distant, présentées à la simulation comme des touches du joueur 2.
 * Une touche appuyée puis relâchée entre deux pas de simulation compte quand même
 * (« collante » jusqu'à la fin du pas), pour ne pas perdre un tap rapide.
 */
export class RemoteInput implements InputLike {
  private down = new Set<string>()
  private sticky = new Set<string>()
  private pressed = new Set<string>()

  apply(msg: { d: Action[]; p: Action[] }): void {
    this.down = new Set(msg.d.map((a) => CODES[1][a]))
    for (const code of this.down) this.sticky.add(code)
    for (const a of msg.p) {
      const code = CODES[1][a]
      this.pressed.add(code)
      this.sticky.add(code)
    }
  }

  isDown(code: string): boolean {
    return this.sticky.has(code)
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code)
  }

  /** À appeler après chaque pas de simulation. */
  endStep(): void {
    this.pressed.clear()
    this.sticky = new Set(this.down)
  }

  clear(): void {
    this.down.clear()
    this.sticky.clear()
    this.pressed.clear()
  }
}

/** Entrées vues par la simulation de l'hôte : son clavier pour le joueur 1, le réseau pour le joueur 2. */
export class HostInput implements InputLike {
  constructor(
    private local: InputLike,
    private remote: InputLike
  ) {}

  isDown(code: string): boolean {
    return P2_CODES.has(code) ? this.remote.isDown(code) : this.local.isDown(code)
  }

  wasPressed(code: string): boolean {
    if (code === SKIP_WAVE) return this.local.wasPressed(code) || this.remote.wasPressed(code)
    return P2_CODES.has(code) ? this.remote.wasPressed(code) : this.local.wasPressed(code)
  }
}
