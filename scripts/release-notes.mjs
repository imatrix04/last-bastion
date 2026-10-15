// Usage : node scripts/release-notes.mjs v1.2.3 notes.md
// Vérifie tag == package.json et présence dans changelog.json, puis écrit les notes de version.
import { readFileSync, writeFileSync } from 'node:fs'

const [tag, out] = process.argv.slice(2)
const version = (tag ?? '').replace(/^v/, '')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
if (pkg.version !== version) {
  console.error(`Le tag ${tag} ne correspond pas à package.json (${pkg.version}).`)
  process.exit(1)
}
const release = JSON.parse(readFileSync('changelog.json', 'utf8')).releases.find((r) => r.version === version)
if (!release) {
  console.error(`Aucune entrée ${version} dans changelog.json.`)
  process.exit(1)
}
const section = (title, items) => (items?.length ? `### ${title}\n${items.map((i) => `- ${i}`).join('\n')}\n\n` : '')
writeFileSync(
  out,
  section('Ajouts', release.added) + section('Modifications', release.changed) + section('Corrections', release.fixed)
)
