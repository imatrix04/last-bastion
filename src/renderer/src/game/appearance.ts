/**
 * Apparence du personnage : une couleur libre et un skin (accessoire). Sans dépendance : partagé entre le jeu,
 * la boutique, le menu et le réseau (chaque joueur envoie la sienne).
 */

export type SkinId = 'none' | 'cat'

export interface SkinDef {
  id: SkinId
  name: string
  blurb: string
  /** Prix en points de compétence. */
  price: number
}

/** L'ordre fixe l'index envoyé sur le réseau : ne jamais réordonner, seulement ajouter à la fin. */
export const SKINS: readonly SkinDef[] = [
  { id: 'none', name: 'Aucun', blurb: 'Le soldat tel quel.', price: 0 },
  { id: 'cat', name: 'Oreilles de chat', blurb: 'Rose unique, dégradé bordeaux, avec des oreilles qui frémissent.', price: 420 }
]

export const SKIN_BY_ID: Readonly<Record<SkinId, SkinDef>> = Object.fromEntries(SKINS.map((s) => [s.id, s])) as Record<SkinId, SkinDef>

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && v in SKIN_BY_ID
export const skinIndex = (id: SkinId): number => Math.max(0, SKINS.findIndex((s) => s.id === id))
export const skinAt = (i: unknown): SkinId => (typeof i === 'number' && Number.isInteger(i) ? (SKINS[i]?.id ?? 'none') : 'none')

export interface Look {
  /** Couleur du personnage, « #rrggbb ». */
  color: string
  skin: SkinId
}

/** Couleurs de départ : joueur 1 bleu, joueur 2 rose. */
export const DEFAULT_COLORS = ['#4fc3f7', '#f06292'] as const

/** Couleurs proposées d'un clic (n'importe quelle autre est possible avec le sélecteur). */
export const PALETTE: readonly string[] = [
  '#4fc3f7',
  '#26c6da',
  '#66bb6a',
  '#c0ca33',
  '#ffd54f',
  '#ffa726',
  '#ff7043',
  '#ef5350',
  '#f06292',
  '#ba68c8',
  '#7e8bff',
  '#e8eaf0'
]

export const defaultLook = (slot: number): Look => ({ color: DEFAULT_COLORS[slot] ?? DEFAULT_COLORS[0], skin: 'none' })

const HEX = /^#[0-9a-fA-F]{6}$/
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

/** Apparence reçue du réseau ou de la sauvegarde : on ne garde que ce qui est valide. */
export function sanitizeLook(v: unknown, slot = 0): Look {
  const fallback = defaultLook(slot)
  if (typeof v !== 'object' || v === null) return fallback
  const o = v as { color?: unknown; skin?: unknown }
  return { color: isHexColor(o.color) ? o.color.toLowerCase() : fallback.color, skin: isSkinId(o.skin) ? o.skin : 'none' }
}

// ------------------------------------------------------------------ couleurs

export function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/** Mélange une couleur avec une autre : t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

/** Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur, de -1 (noir) à 1 (blanc). */
export const shade = (hex: string, amount: number): string => (amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount))

export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Luminosité perçue 0..1 : pour choisir un texte lisible sur une couleur. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
