import { useStore } from '../store'

/** Salle d'attente : l'hôte attend le joueur 2, le joueur 2 attend que l'hôte lance. */
export function Lobby(): React.JSX.Element {
  const mode = useStore((s) => s.mode)
  const lobby = useStore((s) => s.lobby)
  const toMenu = useStore((s) => s.toMenu)

  return (
    <div className="screen">
      <div className="panel small">
        {mode === 'host' ? (
          <>
            <h2>Partie en ligne</h2>
            <p className="waiting">En attente du joueur 2…</p>
            <p className="hint">Donne-lui l&apos;une de ces adresses :</p>
            <ul className="ips">
              {lobby && lobby.ips.length > 0 ? (
                lobby.ips.map((ip) => (
                  <li key={ip}>
                    <kbd>
                      {ip}:{lobby.port}
                    </kbd>
                  </li>
                ))
              ) : (
                <li className="muted">Aucune adresse réseau détectée</li>
              )}
            </ul>
            <p className="hint">
              Même réseau (même box / Wi-Fi) : l&apos;adresse ci-dessus suffit. À distance : redirige le port TCP{' '}
              <b>{lobby?.port ?? 7777}</b> de ta box vers ce PC, ou utilise un VPN privé (Tailscale, ZeroTier, Radmin VPN) et
              donne l&apos;adresse du VPN. Windows peut te demander d&apos;autoriser le jeu dans le pare-feu : accepte.
            </p>
          </>
        ) : (
          <>
            <h2>Connexion…</h2>
            <p className="waiting">En attente de l&apos;hôte</p>
          </>
        )}
        <div className="buttons column">
          <button onClick={toMenu}>Annuler</button>
        </div>
      </div>
    </div>
  )
}
