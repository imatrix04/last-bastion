export interface ChangelogRelease {
  version: string
  date?: string
  added: string[]
  changed: string[]
  fixed: string[]
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
