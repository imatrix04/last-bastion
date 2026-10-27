import { useEffect, useState } from 'react'
import { LANGS, setLang, useLang, useT } from '../i18n'
import { BIND_ACTIONS, allBindIds, bindingOwner, getBinding, resetBindings, setBinding, type BindAction, type BindId } from '../game/config/controls'
import { QUALITIES, getQuality, setQuality, type Quality } from '../game/config/graphics'
import { useKeyLabels } from '../useKeyLabels'
import { useStore } from '../store'
import { IconBack } from './icons'

/** Paramètres : langue, qualité graphique et touches (tout est appliqué tout de suite et enregistré). */
export function Settings(): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const close = useStore((s) => s.closeSettings)
  const label = useKeyLabels()
  const [quality, setQualityState] = useState<Quality>(getQuality())
  const [player, setPlayer] = useState<0 | 1>(0)
  /** Action en attente d'une touche. */
  const [capturing, setCapturing] = useState<BindId | null>(null)
  const [notice, setNotice] = useState('')
  // Les touches vivent hors de React : on force l'affichage après chaque changement.
  const [, refresh] = useState(0)

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      if (e.code === 'Escape') {
        setCapturing(null)
        setNotice('')
        return
      }
      const other = bindingOwner(e.code, capturing)
      if (!setBinding(capturing, e.code)) {
        setNotice(t('settings.keyReserved', { key: label(e.code) }))
        return
      }
      setNotice(other ? t('settings.keySwapped', { key: label(e.code) }) : '')
      setCapturing(null)
      refresh((n) => n + 1)
    }
    // Phase de capture : devant les raccourcis globaux (Échap, P...)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing, label, t])

  const pick = (q: Quality): void => {
    setQuality(q)
    setQualityState(q)
  }

  const nameOf = (id: BindId): string => {
    if (id === 'skip') return t('bind.skip')
    if (id === 'fold') return t('bind.fold')
    const action = id.slice(2) as BindAction
    if (/^s\d$/.test(action)) return t('bind.slot', { n: Number(action[1]) + 1 })
    if (/^a\d$/.test(action)) return t('bind.ability', { n: Number(action[1]) + 1 })
    return t(`bind.${action}`)
  }

  const row = (id: BindId): React.JSX.Element => (
    <div className="bind-row" key={id}>
      <span>{nameOf(id)}</span>
      <button
        className={capturing === id ? 'bind-key waiting' : 'bind-key'}
        onClick={() => {
          setNotice('')
          setCapturing(capturing === id ? null : id)
        }}
      >
        {capturing === id ? t('settings.pressKey') : <kbd>{label(getBinding(id))}</kbd>}
      </button>
    </div>
  )

  const shared = allBindIds().filter((id) => id === 'skip' || id === 'fold')

  return (
    <div className="screen settings">
      <header className="sk-head">
        <button className="back" onClick={close}>
          <IconBack /> {t('common.menu')}
        </button>
        <h2>{t('settings.title')}</h2>
        <span />
      </header>

      <div className="ar-body">
        <section className="ar-section">
          <h3 className="sk-label">{t('settings.language')}</h3>
          <div className="lang-choice" role="radiogroup" aria-label={t('settings.language')}>
            {LANGS.map((l) => (
              <button key={l.id} role="radio" aria-checked={lang === l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)} lang={l.id}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="hint">{t('settings.languageHint')}</p>
        </section>

        <section className="ar-section">
          <h3 className="sk-label">{t('settings.quality')}</h3>
          <div className="lang-choice" role="radiogroup" aria-label={t('settings.quality')}>
            {QUALITIES.map((q) => (
              <button key={q} role="radio" aria-checked={quality === q} className={quality === q ? 'on' : ''} onClick={() => pick(q)}>
                {t(`settings.quality.${q}`)}
              </button>
            ))}
          </div>
          <p className="hint">{t(`settings.quality.${quality}.hint`)}</p>
          <p className="hint">{t('settings.qualityHint')}</p>
        </section>

        <section className="ar-section">
          <h3 className="sk-label">{t('settings.keys')}</h3>
          <div className="lang-choice" role="radiogroup" aria-label={t('settings.keys')}>
            {([0, 1] as const).map((p) => (
              <button key={p} role="radio" aria-checked={player === p} className={player === p ? 'on' : ''} onClick={() => { setPlayer(p); setCapturing(null); setNotice('') }}>
                {t('player.n', { n: p + 1 })}
              </button>
            ))}
          </div>
          <div className="bind-grid">{BIND_ACTIONS.map((a) => row(`${player}.${a}`))}</div>
          <h4 className="bind-sub">{t('settings.keysShared')}</h4>
          <div className="bind-grid">{shared.map(row)}</div>
          <p className="hint">{notice || t('settings.keysHint')}</p>
          <button
            onClick={() => {
              resetBindings()
              setCapturing(null)
              setNotice('')
              refresh((n) => n + 1)
            }}
          >
            {t('settings.keysReset')}
          </button>
        </section>
      </div>
    </div>
  )
}
