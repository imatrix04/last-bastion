import { LANGS, setLang, useLang, useT } from '../i18n'
import { useStore } from '../store'
import { IconBack } from './icons'

/** Paramètres : pour l'instant la langue (appliquée tout de suite et enregistrée). */
export function Settings(): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const close = useStore((s) => s.closeSettings)

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
      </div>
    </div>
  )
}
