import { app, ipcMain, type BrowserWindow } from 'electron'
import type { TikTokLiveConnection } from 'tiktok-live-connector'
import type { LiveConnectResult, LiveEvent, LiveUser } from '../shared/live'

// Mode live TikTok : réservé au développement (`npm run dev`), pour streamer le jeu.
// La lib est une devDependency : absente du jeu installé, où ces handlers ne sont de toute façon jamais enregistrés.

let connection: TikTokLiveConnection | null = null

const userOf = (u?: { displayId?: string; nickname?: string } | null): LiveUser => ({
  id: u?.displayId || '?',
  name: u?.nickname || u?.displayId || '?'
})

async function disconnect(): Promise<void> {
  const c = connection
  connection = null
  if (!c) return
  c.removeAllListeners()
  try {
    c.disconnect()
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

  ipcMain.handle('live:connect', async (_e, username: string): Promise<LiveConnectResult> => {
    await disconnect()
    const name = String(username).trim().replace(/^@/, '')
    if (!name) return { ok: false, error: 'Pseudo TikTok manquant' }
    emit({ type: 'status', status: 'connecting', detail: name })
    try {
      const { TikTokLiveConnection, WebcastEvent, ControlEvent } = await import('tiktok-live-connector')
      const c = new TikTokLiveConnection(name, {
        enableExtendedGiftInfo: true,
        // Le serveur de signature (Euler Stream) peut exiger une clé : EULER_API_KEY=... npm run dev
        signApiKey: process.env['EULER_API_KEY'] || undefined
      })
      connection = c

      c.on(WebcastEvent.GIFT, (d) => {
        // Les cadeaux « série » (roses…) arrivent à chaque palier : on ne compte que le total final.
        if (d.gift?.type === 1 && !d.repeatEnd) return
        emit({ type: 'gift', user: userOf(d.user), giftId: Number(d.giftId), name: d.gift?.name || `#${d.giftId}`, diamonds: d.gift?.diamondCount ?? 0, count: d.repeatCount || 1 })
      })
      c.on(WebcastEvent.LIKE, (d) => emit({ type: 'like', user: userOf(d.user), count: d.count, total: Number(d.total) }))
      c.on(WebcastEvent.CHAT, (d) => emit({ type: 'chat', user: userOf(d.user), comment: d.content }))
      c.on(WebcastEvent.FOLLOW, (d) => emit({ type: 'follow', user: userOf(d.user) }))
      c.on(WebcastEvent.SHARE, (d) => emit({ type: 'share', user: userOf(d.user) }))
      c.on(WebcastEvent.MEMBER, (d) => emit({ type: 'join', user: userOf(d.user) }))
      c.on(ControlEvent.DISCONNECTED, () => emit({ type: 'status', status: 'disconnected' }))
      c.on(ControlEvent.ERROR, (err) => console.error('[live] erreur', err))

      const state = await c.connect()
      emit({ type: 'status', status: 'connected', detail: state.roomId })
      return { ok: true }
    } catch (err) {
      await disconnect()
      const error = err instanceof Error ? err.message : String(err)
      emit({ type: 'status', status: 'disconnected', detail: error })
      return { ok: false, error }
    }
  })

  ipcMain.handle('live:disconnect', () => disconnect())
  app.on('before-quit', () => void disconnect())
}
