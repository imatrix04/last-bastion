/** Les touches sont identifiées par `event.code` (position physique) : ZQSD sur AZERTY = WASD sur QWERTY. */
export interface PlayerControls {
  up: string
  down: string
  left: string
  right: string
  place: string
  upgrade: string
  remove: string
  prev: string
  next: string
  /** Sélection directe des 3 objets de construction. */
  slots: string[]
}

export const CONTROLS: PlayerControls[] = [
  {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    place: 'KeyF',
    upgrade: 'KeyR',
    remove: 'Backspace',
    prev: 'KeyQ',
    next: 'KeyE',
    slots: ['Digit1', 'Digit2', 'Digit3']
  },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    place: 'Enter',
    upgrade: 'ShiftRight',
    remove: 'Delete',
    prev: 'Comma',
    next: 'Period',
    slots: ['Numpad1', 'Numpad2', 'Numpad3']
  }
]

/** Lance la vague suivante sans attendre la fin du compte à rebours. */
export const SKIP_WAVE = 'KeyN'

/** Mode développeur (local et hôte) : or à volonté pour tester. Touche pour l'activer / le couper. */
export const DEV_TOGGLE = 'F9'
/** Mode développeur : or gagné par seconde, et multiplicateur des récompenses de monstres. */
export const DEV_GOLD_PER_SEC = 150
export const DEV_REWARD_MULT = 10

export interface InputLike {
  isDown(code: string): boolean
  wasPressed(code: string): boolean
}

/** Touches dont on bloque le comportement par défaut (défilement, focus...) pendant la partie. */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  ...CONTROLS.flatMap((c) => [c.up, c.down, c.left, c.right, c.place, c.upgrade, c.remove, c.prev, c.next, ...c.slots]),
  SKIP_WAVE,
  DEV_TOGGLE
])
