import { contextBridge, ipcRenderer } from 'electron'

type NetEvent = { type: 'peer-joined' } | { type: 'peer-left' } | { type: 'message'; data: string }

// API minimale exposée au renderer : rien d'autre que ce dont le jeu a besoin.
const api = {
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-fullscreen'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
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
