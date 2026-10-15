import { useEffect, useRef } from 'react'
import { HEIGHT, WIDTH } from '../game/constants'
import { Game } from '../game/engine'
import { gameBridge } from '../game/gameBridge'
import { loadoutOf } from '../game/progress'
import { useStore } from '../store'

export function GameCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const playerCount = useStore((s) => s.playerCount)
  const mode = useStore((s) => s.mode)
  const screen = useStore((s) => s.screen)
  const choiceOpen = useStore((s) => s.choice !== null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = new Game(canvas, playerCount, mode, loadoutOf(useStore.getState().progress), {
      onHud: (hud) => useStore.getState().setHud(hud),
      onGameOver: (result) => useStore.getState().endGame(result),
      onChoice: (request) => useStore.getState().openChoice(request)
    })
    gameRef.current = game
    gameBridge.current = game
    const state = useStore.getState()
    game.setPaused(state.screen !== 'playing' || state.choice !== null)
    game.start()
    return () => {
      game.destroy()
      gameRef.current = null
      if (gameBridge.current === game) gameBridge.current = null
    }
  }, [playerCount, mode])

  useEffect(() => {
    gameRef.current?.setPaused(screen !== 'playing' || choiceOpen)
  }, [screen, choiceOpen])

  return <canvas ref={canvasRef} className="game-canvas" width={WIDTH} height={HEIGHT} />
}
