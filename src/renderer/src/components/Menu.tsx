import { useEffect, useState } from 'react'
import { SKIN_BY_ID } from '../game/appearance'
import { CONTROLS, SKIP_WAVE } from '../game/controls'
import { PERKS, UNLOCKS } from '../game/progress'
import { session } from '../net'
import { loadAddress, useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'
import { AvatarCanvas } from './AvatarCanvas'
import logo from '../assets/logo.png'

export function Menu(): React.JSX.Element {
  const start = useStore((s) => s.start)
  const hostLobby = useStore((s) => s.hostLobby)
  const joinLobby = useStore((s) => s.joinLobby)
  const netError = useStore((s) => s.netError)
  const bestWave = useStore((s) => s.bestWave)
  const openSkills = useStore((s) => s.openSkills)
  const openShop = useStore((s) => s.openShop)
  const progress = useStore((s) => s.progress)
  const label = useKeyLabels()
  const [address, setAddress] = useState(loadAddress)
  const [online, setOnline] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.api?.version().then(setVersion)
  }, [])

  const move = (i: number): string => {
    const c = CONTROLS[i]
    return [c.up, c.left, c.down, c.right].map(label).join(' ')
  }
  const look = progress.looks[0]
  const done = progress.unlocked.length + progress.perks.reduce((n, r) => n + r, 0)
  const total = UNLOCKS.length + PERKS.reduce((n, p) => n + p.costs.length, 0)

  return (
    <div className="screen home">
      <section className="home-rail">
        <header className="brand">
          <img className="brand-mark" src={logo} alt="" />
          <div>
            <h1>
              Last <span>Bastion</span>
            </h1>
            <p className="tagline">Tenez la forteresse. Barricadez, bâtissez, tirez.</p>
          </div>
        </header>

        <nav className="menu-list" aria-label="Menu principal">
          <button className="mi primary" onClick={() => start(1)}>
            <span className="mi-n">01</span>
            <span className="mi-label">Solo</span>
          </button>
          <button className="mi" onClick={() => start(2)}>
            <span className="mi-n">02</span>
            <span className="mi-label">Coop · même clavier</span>
          </button>
          {session.available && (
            <button className={`mi${online ? ' open' : ''}`} onClick={() => setOnline((o) => !o)} aria-expanded={online}>
              <span className="mi-n">03</span>
              <span className="mi-label">Coop en ligne</span>
              <span className="mi-meta">{online ? '−' : '+'}</span>
            </button>
          )}
          {session.available && online && (
            <div className="online-box">
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
              {netError && <p className="error">{netError}</p>}
              <p className="hint">
                En ligne, chacun joue avec les touches du Joueur 1 (<kbd>{move(0)}</kbd>). L&apos;hôte est le Joueur 1, l&apos;invité le Joueur 2.
              </p>
            </div>
          )}

          <div className="mi-sep" />
          <button className="mi" onClick={openSkills}>
            <span className="mi-n">04</span>
            <span className="mi-label">Compétences</span>
            <span className="mi-meta amber">{progress.points} pts</span>
          </button>
          <button className="mi" onClick={openShop}>
            <span className="mi-n">05</span>
            <span className="mi-label">Boutique</span>
          </button>
          <button className="mi" onClick={() => setSheet(true)}>
            <span className="mi-n">06</span>
            <span className="mi-label">Commandes</span>
          </button>
        </nav>

        <footer className="home-foot">
          <span>
            {bestWave > 0 ? `Record · vague ${bestWave}` : 'Aucune partie jouée'}
            {version && <span className="dim"> · v{version}</span>}
          </span>
          {window.api && (
            <button className="link" onClick={() => void window.api?.quit()}>
              Quitter
            </button>
          )}
        </footer>
      </section>

      <aside className="home-hero">
        <div className="hero-frame">
          <AvatarCanvas look={look} scale={6} className="hero-canvas" />
        </div>
        <dl className="hero-meta">
          <div>
            <dt>Joueur 1</dt>
            <dd>
              <i className="swatch-dot" style={{ background: look.color }} /> {SKIN_BY_ID[look.skin].name}
            </dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd className="amber">{progress.points}</dd>
          </div>
          <div>
            <dt>Progression</dt>
            <dd>
              {done} <span className="dim">/ {total}</span>
            </dd>
          </div>
        </dl>
        <button className="link hero-edit" onClick={openShop}>
          Personnaliser le personnage
        </button>
      </aside>

      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Commandes">
            <header>
              <h2>Commandes</h2>
              <button className="link" onClick={() => setSheet(false)}>
                Fermer
              </button>
            </header>
            <table className="controls">
              <thead>
                <tr>
                  <th />
                  <th>Joueur 1</th>
                  <th>Joueur 2 · même clavier</th>
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
                  <td>Améliorer</td>
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
              On tire automatiquement sur l&apos;ennemi le plus proche et on construit sur la case devant soi. Lancer la vague plus tôt (
              <kbd>{label(SKIP_WAVE)}</kbd>) rapporte un bonus · Pause <kbd>Échap</kbd> · Plein écran <kbd>F11</kbd>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
