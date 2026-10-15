/** Les touches sont identifiées par `event.code` (position physique) : ZQSD sur AZERTY = WASD sur QWERTY. */
export interface PlayerControls {
  up: string
  down: string
  left: string
  right: string
  place: string
  remove: string
  prev: string
  next: string
  /** Sélection directe des 4 objets de construction. */
  slots: string[]
}

export const CONTROLS: PlayerControls[] = [
  {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    place: 'Space',
    remove: 'KeyF',
    prev: 'KeyQ',
    next: 'KeyE',
    slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4']
  },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    place: 'Enter',
    remove: 'ShiftRight',
    prev: 'Comma',
    next: 'Period',
    slots: ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4']
  }
]

/** Lance la vague suivante sans attendre la fin du compte à rebours. */
export const SKIP_WAVE = 'KeyN'

export interface InputLike {
  isDown(code: string): boolean
  wasPressed(code: string): boolean
}

/** Touches dont on bloque le comportement par défaut (défilement, focus...) pendant la partie. */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  ...CONTROLS.flatMap((c) => [c.up, c.down, c.left, c.right, c.place, c.remove, c.prev, c.next, ...c.slots]),
  SKIP_WAVE
])
