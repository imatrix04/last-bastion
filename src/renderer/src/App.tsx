import { useEffect } from 'react'
import { GameCanvas } from './components/GameCanvas'
import { Hud } from './components/Hud'
import { Lobby } from './components/Lobby'
import { Menu } from './components/Menu'
import { Shop } from './components/Shop'
import { SkillTree } from './components/SkillTree'
import { UpgradePicker } from './components/UpgradePicker'
import { GameOverOverlay, PauseOverlay } from './components/Overlays'
import { UpdateDialog } from './components/UpdateDialog'
import { useStore } from './store'

export default function App(): React.JSX.Element {
  const screen = useStore((s) => s.screen)
  const runId = useStore((s) => s.runId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'F11') {
        e.preventDefault()
        void window.api?.toggleFullscreen()
        return
      }
      if (e.repeat) return
      if (e.code === 'Escape' || e.code === 'KeyP') {
        const s = useStore.getState()
        if (s.choice) {
          // Le pop-up de choix passe avant la pause : Échap l'annule.
          if (e.code === 'Escape') s.closeChoice()
          return
        }
        if (s.screen === 'playing') s.pause()
        else if (s.screen === 'paused') s.resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choice = useStore((s) => s.choice)
  const inGame = screen === 'playing' || screen === 'paused' || screen === 'gameover'

  return (
    <div className="app">
      <div className="stage">
        {inGame && <GameCanvas key={runId} />}
        {inGame && <Hud />}
        {screen === 'playing' && choice && <UpgradePicker request={choice} />}
        {screen === 'paused' && <PauseOverlay />}
        {screen === 'gameover' && <GameOverOverlay />}
        {screen === 'lobby' && <Lobby />}
        {screen === 'menu' && <Menu />}
        {screen === 'skills' && <SkillTree />}
        {screen === 'shop' && <Shop />}
        <UpdateDialog />
      </div>
    </div>
  )
}
