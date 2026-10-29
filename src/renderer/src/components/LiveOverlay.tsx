import { useEffect, useState } from 'react'
import type { LiveEvent } from '../../../shared/live'
import type { EnemyKind } from '../game/config/constants'
import { gameBridge } from '../game/gameBridge'

/** Compte TikTok dont on écoute le live (mode live, développement uniquement). */
const LIVE_USERNAME = 'lastbastionFR'
const KEEP = 6
/** Likes nécessaires pour faire apparaître un petit monstre, et plafond par événement (un gros paquet de likes ne noie pas le jeu). */
const LIKES_PER_MOB = 10
const MAX_MOBS_PER_EVENT = 8
const SMALL_MOBS: EnemyKind[] = ['grunt', 'runner', 'jumper']

type Line = { id: number; text: string }

function describe(e: LiveEvent): string | null {
  switch (e.type) {
    case 'gift':
      return `🎁 ${e.user.name} · ${e.name} ×${e.count} (${e.diamonds * e.count} 💎)`
    case 'like':
      return `❤ ${e.user.name} · ${e.count} like${e.count > 1 ? 's' : ''}`
    case 'chat':
      return `💬 ${e.user.name} : ${e.comment}`
    case 'follow':
      return `➕ ${e.user.name} s'abonne`
    case 'share':
      return `↗ ${e.user.name} partage`
    case 'join':
      return null
    case 'status':
      return null
  }
}

/** Prototype du mode live : connecte le jeu au live, affiche l'état et les derniers events. */
export function LiveOverlay(): React.JSX.Element | null {
  const [status, setStatus] = useState<string>('connexion…')
  const [lines, setLines] = useState<Line[]>([])

  useEffect(() => {
    const api = window.api?.live
    if (!api) return
    let n = 0
    // Compteur de likes propre à chaque spectateur (clé : @pseudo unique).
    const likes = new Map<string, number>()
    const off = api.onEvent((e) => {
      if (e.type === 'status') {
        setStatus(e.status === 'connected' ? 'connecté' : e.status === 'connecting' ? 'connexion…' : `déconnecté${e.detail ? ` · ${e.detail}` : ''}`)
        return
      }
      if (e.type === 'like') {
        // Chaque spectateur cumule ses propres likes : un petit monstre à son nom tous les LIKES_PER_MOB likes.
        const total = (likes.get(e.user.id) ?? 0) + e.count
        const earned = Math.floor(total / LIKES_PER_MOB)
        likes.set(e.user.id, total - earned * LIKES_PER_MOB)
        const mobs = Math.min(MAX_MOBS_PER_EVENT, earned)
        for (let i = 0; i < mobs; i++) gameBridge.current?.spawnLive(SMALL_MOBS[Math.floor(Math.random() * SMALL_MOBS.length)], e.user.name)
        if (mobs > 0) setLines((l) => [...l.slice(-(KEEP - 1)), { id: n++, text: `👾 ${e.user.name} invoque ${mobs} monstre${mobs > 1 ? 's' : ''}` }])
      }
      const text = describe(e)
      if (text) setLines((l) => [...l.slice(-(KEEP - 1)), { id: n++, text }])
    })
    void api.connect(LIVE_USERNAME)
    return () => {
      off()
      void api.disconnect()
    }
  }, [])

  if (!window.api?.live) return null
  return (
    <aside className="live-overlay" aria-live="polite">
      <header>
        <b>LIVE</b> @{LIVE_USERNAME} <span className="dim">· {status}</span>
      </header>
      {lines.map((l) => (
        <p key={l.id}>{l.text}</p>
      ))}
    </aside>
  )
}
