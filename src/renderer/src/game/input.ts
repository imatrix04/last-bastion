import { GAME_KEYS, type InputLike } from './controls'

/** Clavier : état des touches (par `event.code`) + fronts montants consommés à chaque pas de simulation. */
export class Input implements InputLike {
  /** Désactivé en pause : on ne bloque plus les touches pour laisser les boutons fonctionner. */
  enabled = true
  private down = new Set<string>()
  private pressed = new Set<string>()

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.reset)
  }

  isDown(code: string): boolean {
    return this.enabled && this.down.has(code)
  }

  wasPressed(code: string): boolean {
    return this.enabled && this.pressed.has(code)
  }

  /** À appeler après chaque pas de simulation. */
  endStep(): void {
    this.pressed.clear()
  }

  reset = (): void => {
    this.down.clear()
    this.pressed.clear()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.reset)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    if (!e.repeat) this.pressed.add(e.code)
    this.down.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code)
  }
}
