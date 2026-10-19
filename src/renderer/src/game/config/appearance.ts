import { t } from '../../i18n'

/**
 * Apparence du personnage : une couleur libre et un skin (accessoire). Sans dépendance : partagé entre le jeu,
 * la boutique, le menu et le réseau (chaque joueur envoie la sienne).
 */

export type SkinId = 'none' | 'cat' | 'gold' | 'hearts' | 'tech'

/** Emplacement d'un skin : un chapeau sur la tête, ou un canon dans la main. Un joueur peut équiper un de chaque. */
export type SkinPart = 'hat' | 'weapon' | 'trail'

export interface SkinDef {
  id: SkinId
  /** Emplacement, `null` pour « Aucun ». */
  part: SkinPart | null
  /** Clés de traduction (i18n) : nom et description. */
  nameKey: string
  blurbKey: string
  /** Prix en points de compétence. */
  price: number
}

/** L'ordre fixe l'index envoyé sur le réseau : ne jamais réordonner, seulement ajouter à la fin. */
export const SKINS: readonly SkinDef[] = [
  { id: 'none', part: null, nameKey: 'skin.none.name', blurbKey: 'skin.none.blurb', price: 0 },
  {
    id: 'cat',
    part: 'hat',
    nameKey: 'skin.cat.name', blurbKey: 'skin.cat.blurb',
    price: 720
  },
  {
    id: 'gold',
    part: 'weapon',
    nameKey: 'skin.gold.name', blurbKey: 'skin.gold.blurb',
    price: 1050
  },
  {
    id: 'hearts',
    part: 'trail',
    nameKey: 'skin.hearts.name', blurbKey: 'skin.hearts.blurb',
    price: 480
  },
  {
    id: 'tech',
    part: 'trail',
    nameKey: 'skin.tech.name', blurbKey: 'skin.tech.blurb',
    price: 600
  }
]

export const SKIN_BY_ID: Readonly<Record<SkinId, SkinDef>> = Object.fromEntries(SKINS.map((s) => [s.id, s])) as Record<SkinId, SkinDef>

export const isSkinId = (v: unknown): v is SkinId => typeof v === 'string' && v in SKIN_BY_ID
export const skinIndex = (id: SkinId): number => Math.max(0, SKINS.findIndex((s) => s.id === id))
export const skinAt = (i: unknown): SkinId => (typeof i === 'number' && Number.isInteger(i) ? (SKINS[i]?.id ?? 'none') : 'none')

/** Vrai si `id` peut être équipé à l'emplacement `part` (« Aucun » va partout). */
export const skinFits = (id: SkinId, part: SkinPart): boolean => id === 'none' || SKIN_BY_ID[id].part === part

export interface Look {
  /** Couleur du personnage, « #rrggbb ». */
  color: string
  /** Chapeau équipé (skins de l'emplacement « hat »). */
  hat: SkinId
  /** Canon équipé (skins de l'emplacement « weapon »). */
  weapon: SkinId
  /** Traînée équipée (skins de l'emplacement « trail »). */
  trail: SkinId
  /** Pseudo affiché au-dessus du personnage. Vide = « J1 » / « J2 ». */
  name: string
}

export const NAME_MAX = 12

/** Pseudo reçu ou saisi : texte d'une ligne, sans espaces superflus, limité à NAME_MAX caractères. */
export const sanitizeName = (v: unknown): string => (typeof v === 'string' ? v.replace(/[\r\n\t]/g, ' ').trim().slice(0, NAME_MAX) : '')

/** Ce qui s'affiche pour un joueur : son pseudo, ou « J1 » / « J2 » à défaut. */
export const playerLabel = (look: Look, slot: number): string => look.name.trim() || t('player.short', { n: slot + 1 })

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

export const defaultLook = (slot: number): Look => ({ color: DEFAULT_COLORS[slot] ?? DEFAULT_COLORS[0], hat: 'none', weapon: 'none', trail: 'none', name: '' })

const HEX = /^#[0-9a-fA-F]{6}$/
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

/** Apparence reçue du réseau ou de la sauvegarde : on ne garde que ce qui est valide. */
export function sanitizeLook(v: unknown, slot = 0): Look {
  const fallback = defaultLook(slot)
  if (typeof v !== 'object' || v === null) return fallback
  const o = v as { color?: unknown; hat?: unknown; weapon?: unknown; trail?: unknown; skin?: unknown; name?: unknown }
  // Ancien format (un seul « skin ») : il devient le chapeau ou le canon selon son emplacement.
  const legacy = isSkinId(o.skin) ? o.skin : 'none'
  const hat = isSkinId(o.hat) ? o.hat : legacy
  const weapon = isSkinId(o.weapon) ? o.weapon : legacy
  return {
    color: isHexColor(o.color) ? o.color.toLowerCase() : fallback.color,
    hat: skinFits(hat, 'hat') ? hat : 'none',
    weapon: skinFits(weapon, 'weapon') ? weapon : 'none',
    trail: isSkinId(o.trail) && skinFits(o.trail, 'trail') ? o.trail : 'none',
    name: sanitizeName(o.name)
  }
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
