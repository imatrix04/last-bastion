import { DEV_CONFIG } from './config'

/** Les touches sont identifiées par `event.code` (position physique) : ZQSD sur AZERTY = WASD sur QWERTY. */
export interface PlayerControls {
  up: string
  down: string
  left: string
  right: string
  place: string
  upgrade: string
  remove: string
  /** Change la cible de la tourelle visée : ennemi le plus proche d'elle / de la forteresse. */
  target: string
  prev: string
  next: string
  /** Sélection directe des 3 objets de construction. */
  slots: string[]
  /** Déclenche les capacités actives équipées (emplacements 1 à 3). */
  abilities: string[]
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
    target: 'KeyG',
    prev: 'KeyQ',
    next: 'KeyE',
    slots: ['Digit1', 'Digit2', 'Digit3'],
    abilities: ['KeyZ', 'KeyX', 'KeyC']
  },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    place: 'Enter',
    upgrade: 'ShiftRight',
    remove: 'Delete',
    target: 'Numpad0',
    prev: 'Comma',
    next: 'Period',
    slots: ['Numpad1', 'Numpad2', 'Numpad3'],
    abilities: ['Numpad4', 'Numpad5', 'Numpad6']
  }
]

/** Lance la vague suivante sans attendre la fin du compte à rebours. */
export const SKIP_WAVE = 'KeyN'

/** Mode développeur (local et hôte) : or à volonté pour tester. Touche pour l'activer / le couper. */
export const DEV_TOGGLE = 'F9'
/** Vrai seulement avec `npm run dev` (Vite) ; faux dans une version installée et dans le script de simulation (Node). */
export const DEV_ENABLED = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV
/** Mode développeur : or gagné par seconde, et multiplicateur des récompenses de monstres. */
export const DEV_GOLD_PER_SEC = DEV_CONFIG.goldPerSecond
export const DEV_REWARD_MULT = DEV_CONFIG.rewardMult

export interface InputLike {
  isDown(code: string): boolean
  wasPressed(code: string): boolean
}

/** Touches dont on bloque le comportement par défaut (défilement, focus...) pendant la partie. */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  ...CONTROLS.flatMap((c) => [c.up, c.down, c.left, c.right, c.place, c.upgrade, c.remove, c.target, c.prev, c.next, ...c.slots, ...c.abilities]),
  SKIP_WAVE,
  DEV_TOGGLE
])
