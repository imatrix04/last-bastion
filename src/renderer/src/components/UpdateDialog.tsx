import { useEffect, useState } from 'react'
import { getLang, useT } from '../i18n'
import { useStore } from '../store'
import logo from '../assets/logo.png'

type Release = Extract<UpdateEvent, { type: 'available' }>['releases'][number]

type State = Extract<UpdateEvent, { type: 'available' }> & { phase: 'ask' | 'downloading' | 'ready'; percent: number }

const SECTIONS = [
  ['added', 'update.added'],
  ['changed', 'update.changed'],
  ['fixed', 'update.fixed']
] as const

/** « 2026-10-15 » → « 15 octobre 2026 » / « October 15, 2026 » */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Lignes d'une section dans la langue choisie ; une version sans traduction anglaise reste en français. */
function linesOf(r: Release, key: 'added' | 'changed' | 'fixed'): string[] {
  const en = getLang() === 'en' ? r.en?.[key] : undefined
  return en && en.length > 0 ? en : r[key]
}

export function UpdateDialog(): React.JSX.Element | null {
  const t = useT()
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

  const percent = Math.round(state.percent)

  return (
    <div className="screen overlay">
      <div className="panel update" role="dialog" aria-labelledby="update-title">
        <header className="update-head">
          <img className="update-mark" src={logo} alt="" />
          <div>
            <p className="kicker">{t('update.available')}</p>
            <h2 id="update-title">v{state.version}</h2>
          </div>
        </header>

        <div className="update-notes">
          {state.releases.map((r) => (
            <section key={r.version} className="cl-release">
              <header className="cl-release-head">
                <span className="cl-version">v{r.version}</span>
                {r.date && <time className="cl-date">{formatDate(r.date)}</time>}
              </header>
              {SECTIONS.map(([key, titleKey]) => {
                const lines = linesOf(r, key)
                return lines.length ? (
                  <div key={key} className={`cl-sec ${key}`}>
                    <h4>
                      {t(titleKey)}
                      <span className="cl-count">{lines.length}</span>
                    </h4>
                    <ul>
                      {lines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null
              })}
            </section>
          ))}
        </div>

        <footer className="update-foot">
          {state.phase === 'ask' && (
            <div className="buttons">
              <button className="primary" onClick={() => void window.api?.update.download()}>
                {t('update.install')}
              </button>
              <button onClick={() => setDismissed(true)}>{t('update.later')}</button>
            </div>
          )}
          {state.phase === 'downloading' && (
            <div
              className="update-progress"
              role="progressbar"
              aria-label={t('update.downloadLabel')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className="bar">
                <i style={{ width: `${percent}%` }} />
              </div>
              <p className="hint">{t('update.downloading', { n: percent })}</p>
            </div>
          )}
          {state.phase === 'ready' && (
            <div className="update-progress done">
              <div className="bar">
                <i style={{ width: '100%' }} />
              </div>
              <p className="hint">{t('update.restarting')}</p>
            </div>
          )}
        </footer>
      </div>
    </div>
  )
}
