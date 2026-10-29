import { contextBridge, ipcRenderer } from 'electron'
import type { LiveConnectResult, LiveEvent } from '../shared/live'

type NetEvent = { type: 'peer-joined' } | { type: 'peer-left' } | { type: 'message'; data: string }

type UpdateEvent =
  | { type: 'available'; version: string; releases: unknown[] }
  | { type: 'progress'; percent: number }
  | { type: 'ready' }
  | { type: 'error'; message: string }

// API minimale exposée au renderer : rien d'autre que ce dont le jeu a besoin.
const api = {
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-fullscreen'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  update: {
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),
    onEvent: (callback: (event: UpdateEvent) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: UpdateEvent): void => callback(event)
      ipcRenderer.on('update:event', handler)
      return () => {
        ipcRenderer.removeListener('update:event', handler)
      }
    }
  },
  /** Mode live TikTok : handlers présents seulement en développement. */
  live: {
    connect: (username: string): Promise<LiveConnectResult> => ipcRenderer.invoke('live:connect', username),
    disconnect: (): Promise<void> => ipcRenderer.invoke('live:disconnect'),
    onEvent: (callback: (event: LiveEvent) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: LiveEvent): void => callback(event)
      ipcRenderer.on('live:event', handler)
      return () => {
        ipcRenderer.removeListener('live:event', handler)
      }
    }
  },
  net: {
    host: (port?: number): Promise<{ ok: true; ips: string[]; port: number } | { ok: false; error: string }> =>
      ipcRenderer.invoke('net:host', port),
    join: (address: string): Promise<{ ok: true } | { ok: false; error: string }> => ipcRenderer.invoke('net:join', address),
    send: (data: string, droppable = false): void => ipcRenderer.send('net:send', data, droppable),
    kick: (): Promise<void> => ipcRenderer.invoke('net:kick'),
    close: (): Promise<void> => ipcRenderer.invoke('net:close'),
    /** Retourne une fonction pour se désabonner. */
    onEvent: (callback: (event: NetEvent) => void): (() => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: NetEvent): void => callback(event)
      ipcRenderer.on('net:event', handler)
      return () => {
        ipcRenderer.removeListener('net:event', handler)
      }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
