/// <reference types="vite/client" />

type NetEvent = { type: 'peer-joined' } | { type: 'peer-left' } | { type: 'message'; data: string }
type HostResult = { ok: true; ips: string[]; port: number } | { ok: false; error: string }
type JoinResult = { ok: true } | { ok: false; error: string }

type UpdateEvent =
  | { type: 'available'; version: string; releases: import('../../shared/changelog').ChangelogRelease[] }
  | { type: 'progress'; percent: number }
  | { type: 'ready' }
  | { type: 'error'; message: string }

interface Window {
  /** Exposé par le script preload (absent si la page tourne hors d'Electron). */
  api?: {
    toggleFullscreen(): Promise<boolean>
    quit(): Promise<void>
    version(): Promise<string>
    update: {
      download(): Promise<void>
      onEvent(callback: (event: UpdateEvent) => void): () => void
    }
    live: {
      connect(username: string): Promise<import('../../shared/live').LiveConnectResult>
      disconnect(): Promise<void>
      onEvent(callback: (event: import('../../shared/live').LiveEvent) => void): () => void
    }
    net: {
      host(port?: number): Promise<HostResult>
      join(address: string): Promise<JoinResult>
      send(data: string, droppable?: boolean): void
      kick(): Promise<void>
      close(): Promise<void>
      onEvent(callback: (event: NetEvent) => void): () => void
    }
  }
}
