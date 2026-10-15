import { useEffect, useState } from 'react'
import { CONTROLS, SKIP_WAVE } from '../game/controls'
import { UNLOCKS } from '../game/progress'
import { session } from '../net'
import { loadAddress, useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'

export function Menu(): React.JSX.Element {
  const start = useStore((s) => s.start)
  const hostLobby = useStore((s) => s.hostLobby)
  const joinLobby = useStore((s) => s.joinLobby)
  const netError = useStore((s) => s.netError)
  const bestWave = useStore((s) => s.bestWave)
  const openSkills = useStore((s) => s.openSkills)
  const points = useStore((s) => s.progress.points)
  const unlocked = useStore((s) => s.progress.unlocked.length)
  const label = useKeyLabels()
  const [address, setAddress] = useState(loadAddress)
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.api?.version().then(setVersion)
  }, [])

  const move = (i: number): string => {
    const c = CONTROLS[i]
    return [c.up, c.left, c.down, c.right].map(label).join(' ')
  }

  return (
    <div className="screen menu">
      <div className="panel">
        <h1>
          Last <span>Bastion</span>
        </h1>
        <p className="tagline">Tenez la forteresse face aux vagues de monstres. Barricadez, bâtissez, tirez.</p>

        <div className="buttons">
          <button className="primary" onClick={() => start(1)}>
            Solo
          </button>
          <button className="primary" onClick={() => start(2)}>
            Coop · même clavier
          </button>
        </div>
        <div className="buttons">
          <button onClick={openSkills}>
            Compétences · <b>{points}</b> pts · {unlocked}/{UNLOCKS.length}
          </button>
        </div>

        {session.available && (
          <div className="online">
            <div className="online-title">Coop en ligne · chacun sur son PC</div>
            <div className="online-row">
              <button onClick={() => void hostLobby()}>Héberger une partie</button>
              <form
                className="join"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (address.trim()) void joinLobby(address)
                }}
              >
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adresse de l'hôte"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Adresse de l'hôte"
                />
                <button type="submit" disabled={!address.trim()}>
                  Rejoindre
                </button>
              </form>
            </div>
            {netError && <p className="error">{netError}</p>}
            <p className="hint">
              En ligne, chacun joue avec les touches du Joueur 1 (<kbd>{move(0)}</kbd>). L&apos;hôte est le Joueur 1 (bleu), l&apos;invité le
              Joueur 2 (rose).
            </p>
          </div>
        )}

        <table className="controls">
          <thead>
            <tr>
              <th />
              <th style={{ color: '#4fc3f7' }}>Joueur 1</th>
              <th style={{ color: '#f06292' }}>Joueur 2 (même clavier)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Se déplacer</td>
              <td>
                <kbd>{move(0)}</kbd>
              </td>
              <td>
                <kbd>{move(1)}</kbd>
              </td>
            </tr>
            <tr>
              <td>Construire / réparer</td>
              <td>
                <kbd>{label(CONTROLS[0].place)}</kbd>
              </td>
              <td>
                <kbd>{label(CONTROLS[1].place)}</kbd>
              </td>
            </tr>
            <tr>
              <td>Améliorer (barricade → pierre, tourelle niv. 2 puis 3)</td>
              <td>
                <kbd>{label(CONTROLS[0].upgrade)}</kbd>
              </td>
              <td>
                <kbd>{label(CONTROLS[1].upgrade)}</kbd>
              </td>
            </tr>
            <tr>
              <td>Démolir (remboursement partiel)</td>
              <td>
                <kbd>{label(CONTROLS[0].remove)}</kbd>
              </td>
              <td>
                <kbd>{label(CONTROLS[1].remove)}</kbd>
              </td>
            </tr>
            <tr>
              <td>Objet précédent / suivant</td>
              <td>
                <kbd>{label(CONTROLS[0].prev)}</kbd> <kbd>{label(CONTROLS[0].next)}</kbd>
              </td>
              <td>
                <kbd>{label(CONTROLS[1].prev)}</kbd> <kbd>{label(CONTROLS[1].next)}</kbd>
              </td>
            </tr>
            <tr>
              <td>Choix direct de l&apos;objet</td>
              <td>
                <kbd>1</kbd>–<kbd>3</kbd>
              </td>
              <td>
                <kbd>Pavé 1</kbd>–<kbd>3</kbd>
              </td>
            </tr>
          </tbody>
        </table>

        <p className="hint">
          Les joueurs tirent automatiquement sur l&apos;ennemi le plus proche et construisent sur la case devant eux. Lancer la
          vague plus tôt (<kbd>{label(SKIP_WAVE)}</kbd>) rapporte un bonus · Pause <kbd>Échap</kbd> · Plein écran <kbd>F11</kbd>
        </p>

        <div className="footer">
          <span>{bestWave > 0 ? `Record : vague ${bestWave}` : 'Aucun record pour le moment'}</span>
          {window.api && (
            <button className="link" onClick={() => void window.api?.quit()}>
              Quitter
            </button>
          )}
        </div>
        {version && <p className="hint">v{version}</p>}
      </div>
    </div>
  )
}
