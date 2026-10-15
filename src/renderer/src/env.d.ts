/// <reference types="vite/client" />

type NetEvent = { type: 'peer-joined' } | { type: 'peer-left' } | { type: 'message'; data: string }
type HostResult = { ok: true; ips: string[]; port: number } | { ok: false; error: string }
type JoinResult = { ok: true } | { ok: false; error: string }

interface Window {
  /** Exposé par le script preload (absent si la page tourne hors d'Electron). */
  api?: {
    toggleFullscreen(): Promise<boolean>
    quit(): Promise<void>
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
