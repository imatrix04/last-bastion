import { ipcMain, type WebContents } from 'electron'
import { networkInterfaces } from 'os'
import { WebSocket, WebSocketServer } from 'ws'

// Un seul pair à la fois : l'hôte héberge un serveur WebSocket, l'autre joueur s'y connecte.
// Tout le trafic de jeu passe par ici ; le renderer ne fait que des appels IPC.

const DEFAULT_PORT = 7777
const MAX_PAYLOAD = 1024 * 1024
/** Au-delà, on abandonne les messages « jetables » (snapshots) plutôt que d'accumuler du retard. */
const MAX_BUFFERED = 256 * 1024
const HEARTBEAT_MS = 5000
const DEAD_AFTER_MS = 15000

type NetEvent = { type: 'peer-joined' } | { type: 'peer-left' } | { type: 'message'; data: string }
type HostResult = { ok: true; ips: string[]; port: number } | { ok: false; error: string }
type JoinResult = { ok: true } | { ok: false; error: string }

let server: WebSocketServer | null = null
let peer: WebSocket | null = null
let target: WebContents | null = null

function emit(ev: NetEvent): void {
  if (target && !target.isDestroyed()) target.send('net:event', ev)
}

function localAddresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal) out.push(info.address)
    }
  }
  return out
}

/** Adresse saisie par le joueur -> URL WebSocket (port 7777 par défaut). */
function toUrl(address: unknown): string | null {
  if (typeof address !== 'string') return null
  const text = address.trim().replace(/^(wss?|https?):\/\//i, '')
  if (!text || text.length > 200) return null
  try {
    const url = new URL(`ws://${text}`)
    if (!url.hostname) return null
    if (!url.port) url.port = String(DEFAULT_PORT)
    return `ws://${url.host}`
  } catch {
    return null
  }
}

function friendlyError(err: unknown): string {
  const e = err as NodeJS.ErrnoException
  switch (e.code) {
    case 'ECONNREFUSED':
      return 'net.refused'
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'net.notFound'
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return 'net.unreachable'
    default:
      return /timed out|timeout/i.test(e.message) ? 'net.timeout' : e.message
  }
}

/** Branche un socket connecté comme unique pair de la partie. */
function attach(ws: WebSocket): void {
  peer = ws
  let lastSeen = Date.now()
  const seen = (): void => {
    lastSeen = Date.now()
  }

  ws.on('message', (data, isBinary) => {
    seen()
    if (!isBinary) emit({ type: 'message', data: data.toString() })
  })
  ws.on('ping', seen)
  ws.on('pong', seen)
  // Détecte un pair disparu sans fermeture propre (câble débranché, PC en veille).
  const timer = setInterval(() => {
    if (Date.now() - lastSeen > DEAD_AFTER_MS) {
      ws.terminate()
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, HEARTBEAT_MS)
  ws.on('close', () => {
    clearInterval(timer)
    if (peer === ws) {
      peer = null
      emit({ type: 'peer-left' })
    }
  })
  ws.on('error', () => {
    /* 'close' suit toujours */
  })
}

function shutdown(): void {
  const p = peer
  peer = null
  p?.terminate()
  if (server) {
    for (const client of server.clients) client.terminate()
    server.close()
    server = null
  }
}

export function registerNetHandlers(): void {
  ipcMain.handle('net:host', (event, port: unknown): Promise<HostResult> => {
    shutdown()
    target = event.sender
    const p = typeof port === 'number' && Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT
    return new Promise((resolve) => {
      const s = new WebSocketServer({ port: p, maxPayload: MAX_PAYLOAD })
      s.on('listening', () => {
        server = s
        resolve({ ok: true, ips: localAddresses(), port: p })
      })
      s.on('connection', (ws) => {
        if (peer) {
          ws.close(1013, 'partie complète')
          return
        }
        attach(ws)
        emit({ type: 'peer-joined' })
      })
      s.on('error', (err: NodeJS.ErrnoException) => {
        // Avant 'listening' : échec du démarrage (port déjà pris...). Après : on ignore.
        resolve({
          ok: false,
          error: err.code === 'EADDRINUSE' ? `net.portInUse|${p}` : err.message
        })
      })
    })
  })

  ipcMain.handle('net:join', (event, address: unknown): Promise<JoinResult> => {
    shutdown()
    target = event.sender
    const url = toUrl(address)
    if (!url) return Promise.resolve({ ok: false, error: 'net.badAddress' })
    return new Promise((resolve) => {
      const ws = new WebSocket(url, { maxPayload: MAX_PAYLOAD, handshakeTimeout: 6000 })
      ws.once('open', () => {
        attach(ws)
        resolve({ ok: true })
      })
      ws.once('error', (err) => resolve({ ok: false, error: friendlyError(err) }))
    })
  })

  // Les snapshots sont envoyés en 'droppable' : on les jette si le réseau est saturé.
  ipcMain.on('net:send', (_event, data: unknown, droppable: unknown) => {
    if (typeof data !== 'string' || !peer || peer.readyState !== WebSocket.OPEN) return
    if (droppable === true && peer.bufferedAmount > MAX_BUFFERED) return
    peer.send(data)
  })

  /** Éjecte le pair courant (version incompatible) sans arrêter le serveur. */
  ipcMain.handle('net:kick', () => {
    const p = peer
    peer = null
    p?.terminate()
  })

  ipcMain.handle('net:close', () => {
    shutdown()
  })
}
