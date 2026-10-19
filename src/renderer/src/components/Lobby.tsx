import { useT } from '../i18n'
import { rich } from '../i18n/rich'
import { useStore } from '../store'

/** Salle d'attente : l'hôte attend le joueur 2, le joueur 2 attend que l'hôte lance. */
export function Lobby(): React.JSX.Element {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const lobby = useStore((s) => s.lobby)
  const toMenu = useStore((s) => s.toMenu)

  return (
    <div className="screen">
      <div className="panel small">
        {mode === 'host' ? (
          <>
            <h2>{t('lobby.title')}</h2>
            <p className="waiting">{t('lobby.waitingP2')}</p>
            <p className="hint">{t('lobby.giveAddress')}</p>
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
                <li className="muted">{t('lobby.noAddress')}</li>
              )}
            </ul>
            <p className="hint">{rich('lobby.help', { port: <b>{lobby?.port ?? 7777}</b> })}</p>
          </>
        ) : (
          <>
            <h2>{t('lobby.connecting')}</h2>
            <p className="waiting">{t('lobby.waitingHost')}</p>
          </>
        )}
        <div className="buttons column">
          <button onClick={toMenu}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  )
}
