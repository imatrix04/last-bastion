import { app, ipcMain, type BrowserWindow } from 'electron'
import WebSocket from 'ws'
import type { LiveConnectResult, LiveEvent, LiveUser } from '../shared/live'

// Mode live TikTok : réservé au développement (`npm run dev`), pour streamer le jeu.
// Les événements viennent de TikFinity (https://tikfinity.zerody.one), qui doit tourner et être connecté
// au live : il expose tout en WebSocket local, sans clé ni serveur de signature.

const TIKFINITY_URL = 'ws://localhost:21213/'

let socket: WebSocket | null = null

/* eslint-disable @typescript-eslint/no-explicit-any */
// Payload TikFinity = celui de TikTok-Live-Connector : à plat (uniqueId, nickname) ou imbriqué (user.uniqueId).
const userOf = (d: any): LiveUser => {
  const u = d?.user ?? d
  const id = u?.uniqueId || u?.displayId || '?'
  return { id, name: u?.nickname || id }
}

function normalize(event: string, d: any): LiveEvent | null {
  switch (event) {
    case 'gift':
      // Les cadeaux « série » (roses…) arrivent à chaque palier : on ne compte que le total final.
      if ((d.giftType ?? d.gift?.type) === 1 && !d.repeatEnd) return null
      return {
        type: 'gift',
        user: userOf(d),
        giftId: Number(d.giftId),
        name: d.giftName || d.gift?.name || `#${d.giftId}`,
        diamonds: d.diamondCount ?? d.gift?.diamondCount ?? 0,
        count: d.repeatCount || 1
      }
    case 'like':
      return { type: 'like', user: userOf(d), count: d.likeCount ?? d.count ?? 1, total: Number(d.totalLikeCount ?? d.total ?? 0) }
    case 'chat':
      return { type: 'chat', user: userOf(d), comment: d.comment ?? d.content ?? '' }
    case 'follow':
      return { type: 'follow', user: userOf(d) }
    case 'share':
      return { type: 'share', user: userOf(d) }
    case 'member':
      return { type: 'join', user: userOf(d) }
    default:
      return null
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function disconnect(): void {
  const s = socket
  socket = null
  if (!s) return
  s.removeAllListeners()
  s.on('error', () => {})
  try {
    s.close()
  } catch {
    /* déjà fermée */
  }
}

export function registerLiveHandlers(getWindow: () => BrowserWindow | null): void {
  if (app.isPackaged) return

  const emit = (event: LiveEvent): void => {
    console.log('[live]', JSON.stringify(event))
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('live:event', event)
  }

  // Le pseudo n'est plus utilisé : TikFinity est déjà connecté au bon compte.
  ipcMain.handle('live:connect', (): Promise<LiveConnectResult> => {
    disconnect()
    emit({ type: 'status', status: 'connecting', detail: 'TikFinity' })
    return new Promise((resolve) => {
      const s = new WebSocket(TIKFINITY_URL)
      socket = s
      let opened = false

      s.on('open', () => {
        opened = true
        emit({ type: 'status', status: 'connected', detail: 'TikFinity' })
        resolve({ ok: true })
      })
      s.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          const ev = normalize(String(msg.event), msg.data ?? {})
          if (ev) emit(ev)
        } catch (err) {
          console.error('[live] message illisible', err)
        }
      })
      s.on('error', (err) => {
        if (socket !== s) return
        const error = opened ? err.message : 'TikFinity injoignable (ws://localhost:21213) : lance TikFinity et connecte-le au live'
        disconnect()
        emit({ type: 'status', status: 'disconnected', detail: error })
        if (!opened) resolve({ ok: false, error })
      })
      s.on('close', () => {
        if (socket !== s) return
        socket = null
        emit({ type: 'status', status: 'disconnected' })
      })
    })
  })

  ipcMain.handle('live:disconnect', () => disconnect())
  app.on('before-quit', disconnect)
}
