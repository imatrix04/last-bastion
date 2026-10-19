import { useT } from '../i18n'
import { useStore } from '../store'

export function PauseOverlay(): React.JSX.Element {
  const t = useT()
  const resume = useStore((s) => s.resume)
  const toMenu = useStore((s) => s.toMenu)
  const mode = useStore((s) => s.mode)

  return (
    <div className="screen overlay">
      <div className="panel small">
        <h2>{mode === 'local' ? t('pause.title') : t('pause.onlineTitle')}</h2>
        {mode !== 'local' && <p className="hint">{t('pause.onlineHint')}</p>}
        <div className="buttons column">
          <button className="primary" onClick={resume}>
            {t('pause.resume')}
          </button>
          <button onClick={toMenu}>{mode === 'local' ? t('pause.toMenu') : t('pause.leave')}</button>
        </div>
      </div>
    </div>
  )
}

export function GameOverOverlay(): React.JSX.Element {
  const t = useT()
  const result = useStore((s) => s.result)
  const restart = useStore((s) => s.restart)
  const toMenu = useStore((s) => s.toMenu)
  const bestWave = useStore((s) => s.bestWave)
  const mode = useStore((s) => s.mode)
  const openSkills = useStore((s) => s.openSkills)
  const total = useStore((s) => s.progress.points)

  const toSkills = (): void => {
    toMenu()
    openSkills()
  }

  return (
    <div className="screen overlay">
      <div className="panel small">
        <h2 className="danger">{t('over.title')}</h2>
        <div className="stats">
          <div>
            <b>{result?.wave ?? 0}</b>
            <span>{t('over.wave')}</span>
          </div>
          <div>
            <b>{result?.kills ?? 0}</b>
            <span>{t('over.kills')}</span>
          </div>
        </div>
        {result && (
          <div className="earn">
            <span className="total">{t('over.earned', { n: result.points })}</span>
            <span className="calc">
              {t('over.calc', { kills: Math.round(result.score.kills), waves: result.score.waves, mult: result.score.mult.toFixed(1), total })}
            </span>
          </div>
        )}
        <p className="hint">{result?.newRecord ? t('over.newRecord') : t('over.record', { n: bestWave })}</p>
        <div className="buttons column">
          {mode === 'client' ? (
            <p className="waiting">{t('over.waitHost')}</p>
          ) : (
            <button className="primary" onClick={restart}>
              {t('over.replay')}
            </button>
          )}
          <button onClick={toSkills}>{t('over.skills')}</button>
          <button onClick={toMenu}>{mode === 'local' ? t('pause.toMenu') : t('pause.leave')}</button>
        </div>
      </div>
    </div>
  )
}
