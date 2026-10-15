import { useEffect, useRef } from 'react'
import { HEIGHT, WIDTH } from '../game/constants'
import { Game } from '../game/engine'
import { useStore } from '../store'

export function GameCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const playerCount = useStore((s) => s.playerCount)
  const mode = useStore((s) => s.mode)
  const screen = useStore((s) => s.screen)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = new Game(canvas, playerCount, mode, {
      onHud: (hud) => useStore.getState().setHud(hud),
      onGameOver: (result) => useStore.getState().endGame(result)
    })
    gameRef.current = game
    game.setPaused(useStore.getState().screen !== 'playing')
    game.start()
    return () => {
      game.destroy()
      gameRef.current = null
    }
  }, [playerCount, mode])

  useEffect(() => {
    gameRef.current?.setPaused(screen !== 'playing')
  }, [screen])

  return <canvas ref={canvasRef} className="game-canvas" width={WIDTH} height={HEIGHT} />
}
