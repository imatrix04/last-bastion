export interface ChangelogSections {
  added: string[]
  changed: string[]
  fixed: string[]
}

/**
 * Les listes à la racine sont en français. `en` (facultatif) donne les mêmes listes en anglais : une application
 * plus ancienne, qui ne connaît pas ce champ, l'ignore et affiche le français sans erreur.
 */
export interface ChangelogRelease extends ChangelogSections {
  version: string
  date?: string
  en?: ChangelogSections
}

export interface Changelog {
  releases: ChangelogRelease[]
}

/** Compare deux versions "x.y.z" : >0 si a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
