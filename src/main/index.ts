import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { registerNetHandlers } from './net'
import { registerUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b130e',
    title: 'Last Bastion',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow = win
  win.on('closed', () => {
    mainWindow = null
  })
  win.once('ready-to-show', () => win.show())

  // Le jeu n'ouvre jamais de fenêtre ni ne navigue ailleurs.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('window:toggle-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    win.setFullScreen(!win.isFullScreen())
    return win.isFullScreen()
  })
  ipcMain.handle('app:quit', () => app.quit())
  ipcMain.handle('app:version', () => app.getVersion())
  registerNetHandlers()
  registerUpdater(() => mainWindow)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
