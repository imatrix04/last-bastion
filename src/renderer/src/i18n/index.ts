import { useSyncExternalStore } from 'react'
import { en } from './en'
import { fr } from './fr'

/**
 * Traduction : deux dictionnaires (fr.ts, en.ts) indexés par clés, et une fonction `t(clé, paramètres)`.
 * fr.ts est la référence : en.ts est typé pour contenir exactement les mêmes clés.
 * Sans dépendance à React hors du hook `useLang` : utilisable depuis la simulation, le rendu canvas et les scripts Node.
 */

export type Lang = 'fr' | 'en'
export const LANGS: readonly { id: Lang; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' }
]

const DICTS: Record<Lang, Record<string, string>> = { fr, en }
const LANG_KEY = 'last-bastion:lang'

const isLang = (v: unknown): v is Lang => v === 'fr' || v === 'en'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (isLang(saved)) return saved
  } catch {
    /* stockage indisponible : on retombe sur la langue du système */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr'
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

let current: Lang = detect()
const listeners = new Set<() => void>()

function applyDocumentLang(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = current
}
applyDocumentLang()

export const getLang = (): Lang => current

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* ignore */
  }
  applyDocumentLang()
  for (const l of [...listeners]) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Langue courante, pour les composants React : ils se redessinent quand elle change. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang)

export type Params = Record<string | number, string | number>

/** Remplace les `{nom}` d'un texte par les paramètres ; un paramètre absent laisse le `{nom}` tel quel. */
function fill(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
}

/** Texte traduit. Une clé inconnue est renvoyée telle quelle (utile pour les messages d'erreur bruts du système). */
export function t(key: string, params?: Params): string {
  const text = DICTS[current][key] ?? DICTS.fr[key]
  return text === undefined ? key : fill(text, params)
}

/** Pour les composants : `const t = useT()` les fait se redessiner au changement de langue. */
export function useT(): typeof t {
  useLang()
  return t
}

// -------------------------------------------- textes qui voyagent (réseau, messages flottants)

/**
 * Un texte « à traduire plus tard » : `clé|valeur0|valeur1…`. Il circule tel quel entre l'hôte et l'invité,
 * et chacun le traduit dans sa propre langue à l'affichage : `{0}`, `{1}`… dans le dictionnaire.
 */
export const spec = (key: string, ...params: Array<string | number>): string => [key, ...params].join('|')

/** Traduit un texte produit par `spec`. */
export function tr(text: string): string {
  const [key, ...rest] = text.split('|')
  // Pas une clé connue (message d'erreur brut du système, par exemple) : affiché tel quel
  if (!(key in DICTS.fr)) return text
  const params: Params = {}
  rest.forEach((v, i) => {
    params[i] = v
  })
  return t(key, params)
}

/** Les messages flottants en jeu : un « @ » devant le texte signale un `spec` ; sans lui, le texte est affiché tel quel (« +12 »). */
export const floating = (key: string, ...params: Array<string | number>): string => '@' + spec(key, ...params)
export const floatingText = (text: string): string => (text.startsWith('@') ? tr(text.slice(1)) : text)
