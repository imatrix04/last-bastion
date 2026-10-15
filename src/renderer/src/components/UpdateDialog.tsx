import { useEffect, useState } from 'react'
import { useStore } from '../store'

type State = Extract<UpdateEvent, { type: 'available' }> & { phase: 'ask' | 'downloading' | 'ready'; percent: number }

const SECTIONS = [
  ['added', 'Ajouts'],
  ['changed', 'Modifications'],
  ['fixed', 'Corrections']
] as const

export function UpdateDialog(): React.JSX.Element | null {
  const [state, setState] = useState<State | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const screen = useStore((s) => s.screen)

  useEffect(() => {
    return window.api?.update.onEvent((e) => {
      if (e.type === 'available') setState({ ...e, phase: 'ask', percent: 0 })
      else if (e.type === 'progress') setState((s) => (s ? { ...s, phase: 'downloading', percent: e.percent } : s))
      else if (e.type === 'ready') setState((s) => (s ? { ...s, phase: 'ready' } : s))
      else if (e.type === 'error') setState((s) => (s && s.phase !== 'ask' ? { ...s, phase: 'ask' } : s))
    })
  }, [])

  // Ne jamais interrompre une partie : la fenêtre n'apparaît que dans le menu.
  if (!state || (dismissed && state.phase === 'ask') || screen !== 'menu') return null

  return (
    <div className="screen overlay">
      <div className="panel small">
        <h2>Nouvelle version disponible : v{state.version}</h2>
        {state.releases.map((r) => (
          <div key={r.version} className="changelog">
            {state.releases.length > 1 && <h3>v{r.version}</h3>}
            {SECTIONS.map(([key, title]) =>
              r[key].length ? (
                <div key={key}>
                  <strong>{title}</strong>
                  <ul>
                    {r[key].map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        ))}
        {state.phase === 'ask' && (
          <div className="buttons">
            <button className="primary" onClick={() => void window.api?.update.download()}>
              Mettre à jour
            </button>
            <button onClick={() => setDismissed(true)}>Plus tard</button>
          </div>
        )}
        {state.phase === 'downloading' && <p className="hint">Téléchargement… {Math.round(state.percent)} %</p>}
        {state.phase === 'ready' && <p className="hint">Redémarrage de l'application…</p>}
      </div>
    </div>
  )
}
