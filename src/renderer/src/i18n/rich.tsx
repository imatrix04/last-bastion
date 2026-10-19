import { Fragment, type ReactNode } from 'react'
import { t, type Params } from './index'

/**
 * Texte traduit contenant des éléments React : `{nom}` dans le dictionnaire est remplacé par `parts.nom`.
 * Exemple : rich('hud.skip', { key: <kbd>N</kbd> }) avec « {key} pour lancer ».
 */
export function rich(key: string, parts: Record<string, ReactNode>, params?: Params): ReactNode {
  const text = t(key, params)
  return text.split(/(\{\w+\})/g).map((chunk, i) => {
    const m = /^\{(\w+)\}$/.exec(chunk)
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : chunk}</Fragment>
  })
}
