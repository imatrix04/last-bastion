/** Qualité graphique, réglable dans les paramètres (pour les PC modestes). Enregistrée sur la machine du joueur. */
export type Quality = 'high' | 'medium' | 'low'

export const QUALITIES: readonly Quality[] = ['high', 'medium', 'low']

interface Preset {
  /** Résolution interne maximale du canvas (1 = 1280×720 de base, 2 = double). */
  maxScale: number
  /** Nombre maximal de particules, de taches au sol. */
  particles: number
  decals: number
  /** Poussières flottantes, reflets qui balaient les murs métalliques, traînées des coureurs. */
  ambient: boolean
  glints: boolean
  trails: boolean
}

const PRESETS: Record<Quality, Preset> = {
  high: { maxScale: 2, particles: 700, decals: 80, ambient: true, glints: true, trails: true },
  medium: { maxScale: 1.25, particles: 350, decals: 40, ambient: true, glints: false, trails: true },
  low: { maxScale: 1, particles: 140, decals: 12, ambient: false, glints: false, trails: false }
}

const KEY = 'last-bastion:quality'

function load(): Quality {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'high' || v === 'medium' || v === 'low') return v
  } catch {
    /* stockage indisponible (script de simulation) : qualité maximale */
  }
  return 'high'
}

let level: Quality = load()

/** Réglages en vigueur : objet mis à jour en place, à lire au moment de dessiner. */
export const GFX: Preset & { quality: Quality } = { quality: level, ...PRESETS[level] }

export function getQuality(): Quality {
  return level
}

export function setQuality(q: Quality): void {
  level = q
  Object.assign(GFX, { quality: q }, PRESETS[q])
  try {
    localStorage.setItem(KEY, q)
  } catch {
    /* ignore */
  }
}
