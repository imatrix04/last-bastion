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

/** Lance la vague suivante sans attendre la fin du compte à rebours. Modifiable (voir setBinding) : lire la valeur au moment de l'usage. */
export let SKIP_WAVE = 'KeyN'

/** Replie / déplie la barre de construction en bas de l'écran (affichage seulement). Modifiable aussi. */
export let FOLD_HUD = 'KeyH'

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

/** Touches dont on bloque le comportement par défaut (défilement, focus...) pendant la partie. Mis à jour quand on change une touche. */
export const GAME_KEYS: Set<string> = new Set()

// ------------------------------------------------------------------ touches modifiables

/** Actions propres à chaque joueur. */
export const BIND_ACTIONS = ['up', 'down', 'left', 'right', 'place', 'upgrade', 'remove', 'target', 'prev', 'next', 's0', 's1', 's2', 'a0', 'a1', 'a2'] as const
export type BindAction = (typeof BIND_ACTIONS)[number]
/** `0.up` : monter du joueur 1 · `skip` / `fold` : touches communes aux deux joueurs. */
export type BindId = `${0 | 1}.${BindAction}` | 'skip' | 'fold'

/** Touches réservées : pause, plein écran, mode développeur. */
const RESERVED: ReadonlySet<string> = new Set(['Escape', 'KeyP', 'F11', DEV_TOGGLE])

const KEYS_STORAGE = 'last-bastion:keys'
const listeners = new Set<() => void>()

const DEFAULT_KEYS: Record<string, string> = {}

/** Appelé après chaque changement de touche (les modules qui gardent une copie des codes la rafraîchissent). */
export function onBindingsChange(fn: () => void): void {
  listeners.add(fn)
}

export function allBindIds(): BindId[] {
  const ids: BindId[] = []
  for (const p of [0, 1] as const) for (const a of BIND_ACTIONS) ids.push(`${p}.${a}`)
  ids.push('skip', 'fold')
  return ids
}

export function getBinding(id: BindId): string {
  if (id === 'skip') return SKIP_WAVE
  if (id === 'fold') return FOLD_HUD
  const c = CONTROLS[Number(id[0])]
  const a = id.slice(2) as BindAction
  if (a[0] === 's' && a.length === 2) return c.slots[Number(a[1])]
  if (a[0] === 'a' && a.length === 2) return c.abilities[Number(a[1])]
  return c[a as Exclude<BindAction, 's0' | 's1' | 's2' | 'a0' | 'a1' | 'a2'>]
}

function write(id: BindId, code: string): void {
  if (id === 'skip') SKIP_WAVE = code
  else if (id === 'fold') FOLD_HUD = code
  else {
    const c = CONTROLS[Number(id[0])]
    const a = id.slice(2) as BindAction
    if (a[0] === 's' && a.length === 2) c.slots[Number(a[1])] = code
    else if (a[0] === 'a' && a.length === 2) c.abilities[Number(a[1])] = code
    else c[a as Exclude<BindAction, 's0' | 's1' | 's2' | 'a0' | 'a1' | 'a2'>] = code
  }
}

function refresh(save: boolean): void {
  GAME_KEYS.clear()
  for (const c of CONTROLS) for (const k of [c.up, c.down, c.left, c.right, c.place, c.upgrade, c.remove, c.target, c.prev, c.next, ...c.slots, ...c.abilities]) GAME_KEYS.add(k)
  GAME_KEYS.add(SKIP_WAVE)
  GAME_KEYS.add(DEV_TOGGLE)
  if (save) {
    try {
      const changed: Record<string, string> = {}
      for (const id of allBindIds()) if (getBinding(id) !== DEFAULT_KEYS[id]) changed[id] = getBinding(id)
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(changed))
    } catch {
      /* stockage indisponible : le changement reste valable pour cette session */
    }
  }
  for (const fn of listeners) fn()
}

/** Action (autre que `except`) qui utilise déjà cette touche, ou null. */
export function bindingOwner(code: string, except?: BindId): BindId | null {
  return allBindIds().find((o) => o !== except && getBinding(o) === code) ?? null
}

/** Change la touche d'une action. Si une autre action l'utilisait déjà, les deux touches sont échangées. Faux si la touche est réservée. */
export function setBinding(id: BindId, code: string): boolean {
  if (RESERVED.has(code)) return false
  const old = getBinding(id)
  if (old === code) return true
  const other = bindingOwner(code, id)
  if (other) write(other, old)
  write(id, code)
  refresh(true)
  return true
}

export function resetBindings(): void {
  for (const id of allBindIds()) write(id, DEFAULT_KEYS[id])
  refresh(true)
}

for (const id of allBindIds()) DEFAULT_KEYS[id] = getBinding(id)

// Touches enregistrées : ignorées en bloc si elles sont incohérentes (touche réservée ou utilisée deux fois).
try {
  const raw = JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? 'null') as Record<string, unknown> | null
  if (raw && typeof raw === 'object') {
    const next: Record<string, string> = { ...DEFAULT_KEYS }
    for (const id of allBindIds()) {
      const v = raw[id]
      if (typeof v === 'string' && v.length > 0 && v.length < 32) next[id] = v
    }
    const codes = Object.values(next)
    if (new Set(codes).size === codes.length && !codes.some((c) => RESERVED.has(c))) for (const id of allBindIds()) write(id, next[id])
  }
} catch {
  /* rien d'enregistré, ou stockage indisponible (script de simulation) : touches par défaut */
}
refresh(false)
