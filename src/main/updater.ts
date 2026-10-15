import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { compareVersions, type Changelog, type ChangelogRelease } from '../shared/changelog'

const REPO_RAW = 'https://raw.githubusercontent.com/imatrix04/last-bastion'

export type UpdateEvent =
  | { type: 'available'; version: string; releases: ChangelogRelease[] }
  | { type: 'progress'; percent: number }
  | { type: 'ready' }
  | { type: 'error'; message: string }

async function fetchChangelog(version: string): Promise<ChangelogRelease[]> {
  for (const ref of [`v${version}`, 'main']) {
    try {
      const res = await fetch(`${REPO_RAW}/${ref}/changelog.json`)
      if (!res.ok) continue
      const data = (await res.json()) as Changelog
      return data.releases
        .filter((r) => compareVersions(r.version, app.getVersion()) > 0 && compareVersions(r.version, version) <= 0)
        .sort((a, b) => compareVersions(b.version, a.version))
    } catch {
      /* on essaie la source suivante */
    }
  }
  return []
}

export function registerUpdater(getWindow: () => BrowserWindow | null): void {
  const send = (event: UpdateEvent): void => {
    getWindow()?.webContents.send('update:event', event)
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', async (info) => {
    send({ type: 'available', version: info.version, releases: await fetchChangelog(info.version) })
  })
  autoUpdater.on('download-progress', (p) => send({ type: 'progress', percent: p.percent }))
  autoUpdater.on('update-downloaded', () => {
    send({ type: 'ready' })
    // Silencieux + relance automatique de l'application mise à jour.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 800)
  })
  autoUpdater.on('error', (err) => send({ type: 'error', message: String(err?.message ?? err) }))

  ipcMain.handle('update:download', () => {
    void autoUpdater.downloadUpdate().catch(() => undefined)
  })

  // Le jeu reste jouable hors-ligne : en dev ou sans réseau, on ne fait rien de plus.
  if (app.isPackaged) {
    setTimeout(() => void autoUpdater.checkForUpdates().catch(() => undefined), 2000)
  }
}
