import { useEffect, useState } from 'react'
import { SKIN_BY_ID, playerLabel } from '../game/config/appearance'
import { ABILITY_SLOTS } from '../game/config/config'
import { CONTROLS, DEV_ENABLED, SKIP_WAVE } from '../game/config/controls'
import { PERKS, UNLOCKS } from '../game/config/progress'
import { tr, useT } from '../i18n'
import { rich } from '../i18n/rich'
import { session } from '../net'
import { loadAddress, useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'
import { AvatarCanvas } from './AvatarCanvas'
import logo from '../assets/logo.png'

export function Menu(): React.JSX.Element {
  const t = useT()
  const start = useStore((s) => s.start)
  const hostLobby = useStore((s) => s.hostLobby)
  const joinLobby = useStore((s) => s.joinLobby)
  const netError = useStore((s) => s.netError)
  const bestWave = useStore((s) => s.bestWave)
  const openSkills = useStore((s) => s.openSkills)
  const openShop = useStore((s) => s.openShop)
  const openArsenal = useStore((s) => s.openArsenal)
  const openSettings = useStore((s) => s.openSettings)
  const progress = useStore((s) => s.progress)
  const label = useKeyLabels()
  const [address, setAddress] = useState(loadAddress)
  const [online, setOnline] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [version, setVersion] = useState('')
  useEffect(() => {
    void window.api?.version().then(setVersion)
  }, [])

  // Mode live (TikTok) : proposé seulement en développement. Installé, Solo / Coop lancent la partie directement.
  const [pick, setPick] = useState<1 | 2 | null>(null)
  const launch = (players: 1 | 2): void => {
    if (DEV_ENABLED) setPick((p) => (p === players ? null : players))
    else start(players)
  }
  const modeBox = (players: 1 | 2): React.JSX.Element => (
    <div className="online-box mode-box">
      <button onClick={() => start(players)}>{t('menu.modeNormal')}</button>
      <button className="live" onClick={() => start(players, true)}>
        {t('menu.modeLive')}
      </button>
    </div>
  )

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
            <p className="tagline">{t('menu.tagline')}</p>
          </div>
        </header>

        <nav className="menu-list" aria-label={t('menu.navLabel')}>
          <button className={`mi primary${pick === 1 ? ' open' : ''}`} onClick={() => launch(1)} aria-expanded={DEV_ENABLED ? pick === 1 : undefined}>
            <span className="mi-n">01</span>
            <span className="mi-label">{t('menu.solo')}</span>
          </button>
          {pick === 1 && modeBox(1)}
          <button className={`mi${pick === 2 ? ' open' : ''}`} onClick={() => launch(2)} aria-expanded={DEV_ENABLED ? pick === 2 : undefined}>
            <span className="mi-n">02</span>
            <span className="mi-label">{t('menu.coop')}</span>
          </button>
          {pick === 2 && modeBox(2)}
          {session.available && (
            <button className={`mi${online ? ' open' : ''}`} onClick={() => setOnline((o) => !o)} aria-expanded={online}>
              <span className="mi-n">03</span>
              <span className="mi-label">{t('menu.online')}</span>
              <span className="mi-meta">{online ? '−' : '+'}</span>
            </button>
          )}
          {session.available && online && (
            <div className="online-box">
              <button onClick={() => void hostLobby()}>{t('online.host')}</button>
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
                  placeholder={t('online.addressPlaceholder')}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={t('online.addressPlaceholder')}
                />
                <button type="submit" disabled={!address.trim()}>
                  {t('online.join')}
                </button>
              </form>
              {netError && <p className="error">{tr(netError)}</p>}
              <p className="hint">{rich('online.hint', { keys: <kbd>{move(0)}</kbd> })}</p>
            </div>
          )}

          <div className="mi-sep" />
          <button className="mi" onClick={openSkills}>
            <span className="mi-n">04</span>
            <span className="mi-label">{t('menu.skills')}</span>
            <span className="mi-meta amber">
              {progress.points} {t('common.pts')}
            </span>
          </button>
          <button className="mi" onClick={openArsenal}>
            <span className="mi-n">05</span>
            <span className="mi-label">{t('menu.arsenal')}</span>
            <span className="mi-meta">
              {progress.abilities.length} / {ABILITY_SLOTS}
            </span>
          </button>
          <button className="mi" onClick={openShop}>
            <span className="mi-n">06</span>
            <span className="mi-label">{t('menu.shop')}</span>
          </button>
          <button className="mi" onClick={() => setSheet(true)}>
            <span className="mi-n">07</span>
            <span className="mi-label">{t('menu.controls')}</span>
          </button>
          <button className="mi" onClick={openSettings}>
            <span className="mi-n">08</span>
            <span className="mi-label">{t('menu.settings')}</span>
          </button>
        </nav>

        <footer className="home-foot">
          <span>
            {bestWave > 0 ? t('menu.record', { n: bestWave }) : t('menu.noGame')}
            {version && <span className="dim"> · v{version}</span>}
          </span>
          {window.api && (
            <button className="link" onClick={() => void window.api?.quit()}>
              {t('menu.quit')}
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
            <dt>{t('player.n', { n: 1 })}</dt>
            <dd>
              <i className="swatch-dot" style={{ background: look.color }} /> {playerLabel(look, 0)}
              <small className="dim">
                {' '}
                · {[look.hat, look.weapon, look.trail].filter((id) => id !== 'none').map((id) => t(SKIN_BY_ID[id].nameKey)).join(' · ') || t('menu.noAccessory')}
              </small>
            </dd>
          </div>
          <div>
            <dt>{t('common.points')}</dt>
            <dd className="amber">{progress.points}</dd>
          </div>
          <div>
            <dt>{t('menu.progress')}</dt>
            <dd>
              {done} <span className="dim">/ {total}</span>
            </dd>
          </div>
        </dl>
        <button className="link hero-edit" onClick={openShop}>
          {t('menu.customize')}
        </button>
      </aside>

      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('controls.title')}>
            <header>
              <h2>{t('controls.title')}</h2>
              <button className="link" onClick={() => setSheet(false)}>
                {t('common.close')}
              </button>
            </header>
            <table className="controls">
              <thead>
                <tr>
                  <th />
                  <th>{t('controls.player1')}</th>
                  <th>{t('player.p2Local')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('controls.move')}</td>
                  <td>
                    <kbd>{move(0)}</kbd>
                  </td>
                  <td>
                    <kbd>{move(1)}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.build')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].place)}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].place)}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.upgrade')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].upgrade)}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].upgrade)}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.target')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].target)}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].target)}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.demolish')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].remove)}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].remove)}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.prevNext')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].prev)}</kbd> <kbd>{label(CONTROLS[0].next)}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].prev)}</kbd> <kbd>{label(CONTROLS[1].next)}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.abilities')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].abilities[0])}</kbd> <kbd>{label(CONTROLS[0].abilities[1])}</kbd> <kbd>{label(CONTROLS[0].abilities[2])}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].abilities[0])}</kbd> <kbd>{label(CONTROLS[1].abilities[1])}</kbd> <kbd>{label(CONTROLS[1].abilities[2])}</kbd>
                  </td>
                </tr>
                <tr>
                  <td>{t('controls.direct')}</td>
                  <td>
                    <kbd>{label(CONTROLS[0].slots[0])}</kbd>–<kbd>{label(CONTROLS[0].slots[2])}</kbd>
                  </td>
                  <td>
                    <kbd>{label(CONTROLS[1].slots[0])}</kbd>–<kbd>{label(CONTROLS[1].slots[2])}</kbd>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="hint">
              {rich('controls.hint', {
                skip: <kbd>{label(SKIP_WAVE)}</kbd>,
                pause: <kbd>{label('Escape')}</kbd>,
                full: <kbd>F11</kbd>
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
