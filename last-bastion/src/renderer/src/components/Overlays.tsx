import { useStore } from '../store'

export function PauseOverlay(): React.JSX.Element {
  const resume = useStore((s) => s.resume)
  const toMenu = useStore((s) => s.toMenu)
  const mode = useStore((s) => s.mode)

  return (
    <div className="screen overlay">
      <div className="panel small">
        <h2>{mode === 'local' ? 'Pause' : 'Menu'}</h2>
        {mode !== 'local' && <p className="hint">En ligne, le jeu continue pendant que ce menu est ouvert.</p>}
        <div className="buttons column">
          <button className="primary" onClick={resume}>
            Reprendre
          </button>
          <button onClick={toMenu}>{mode === 'local' ? 'Menu principal' : 'Quitter la partie'}</button>
        </div>
      </div>
    </div>
  )
}

export function GameOverOverlay(): React.JSX.Element {
  const result = useStore((s) => s.result)
  const restart = useStore((s) => s.restart)
  const toMenu = useStore((s) => s.toMenu)
  const bestWave = useStore((s) => s.bestWave)
  const mode = useStore((s) => s.mode)

  return (
    <div className="screen overlay">
      <div className="panel small">
        <h2 className="danger">La forteresse est tombée</h2>
        <div className="stats">
          <div>
            <b>{result?.wave ?? 0}</b>
            <span>vague atteinte</span>
          </div>
          <div>
            <b>{result?.kills ?? 0}</b>
            <span>monstres abattus</span>
          </div>
        </div>
        <p className="hint">{result?.newRecord ? 'Nouveau record !' : `Record : vague ${bestWave}`}</p>
        <div className="buttons column">
          {mode === 'client' ? (
            <p className="waiting">En attente de l&apos;hôte pour rejouer</p>
          ) : (
            <button className="primary" onClick={restart}>
              Rejouer
            </button>
          )}
          <button onClick={toMenu}>{mode === 'local' ? 'Menu principal' : 'Quitter la partie'}</button>
        </div>
      </div>
    </div>
  )
}
