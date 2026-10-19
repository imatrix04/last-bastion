import { useEffect, useState } from 'react'
import { DEFAULT_COLORS, NAME_MAX, PALETTE, SKINS, SKIN_BY_ID, isHexColor, type SkinId, type SkinPart } from '../game/config/appearance'
import { useT } from '../i18n'
import { useStore } from '../store'
import { AvatarCanvas } from './AvatarCanvas'
import { IconBack } from './icons'

/** Un groupe par emplacement : chaque joueur équipe un chapeau et un canon, indépendamment. */
const GROUPS: readonly { part: SkinPart; titleKey: string }[] = [
  { part: 'hat', titleKey: 'shop.hats' },
  { part: 'weapon', titleKey: 'shop.weapons' },
  { part: 'trail', titleKey: 'shop.trails' }
]

/** Boutique : couleur libre du personnage (gratuite) et skins achetés avec les points de compétence. */
export function Shop(): React.JSX.Element {
  const t = useT()
  const progress = useStore((s) => s.progress)
  const close = useStore((s) => s.closeShop)
  const setLook = useStore((s) => s.setLook)
  const buySkin = useStore((s) => s.buySkin)
  const [slot, setSlot] = useState<0 | 1>(0)
  const look = progress.looks[slot]
  const [hex, setHex] = useState(look.color)

  // Le champ texte suit la couleur choisie ailleurs (palette, sélecteur, changement de joueur).
  useEffect(() => setHex(look.color), [look.color, slot])

  const typeHex = (raw: string): void => {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    setHex(v)
    if (isHexColor(v)) setLook(slot, { color: v })
  }

  return (
    <div className="screen shop">
      <header className="sk-head">
        <button className="back" onClick={close}>
          <IconBack /> {t('common.menu')}
        </button>
        <h2>{t('shop.title')}</h2>
        <div className="sk-points" aria-label={`${progress.points} ${t('common.points')}`}>
          <b>{progress.points}</b>
          <span>{t('common.points')}</span>
        </div>
      </header>

      <div className="shop-body">
        <section className="shop-stage">
          <div className="tabs" role="tablist" aria-label={t('shop.playerTab')}>
            <button role="tab" aria-selected={slot === 0} className={slot === 0 ? 'on' : ''} onClick={() => setSlot(0)}>
              {t('player.n', { n: 1 })}
            </button>
            <button role="tab" aria-selected={slot === 1} className={slot === 1 ? 'on' : ''} onClick={() => setSlot(1)}>
              {t('player.p2Local')}
            </button>
          </div>

          <div className="hero-frame">
            <AvatarCanvas look={look} scale={7} className="hero-canvas" />
          </div>

          <div className="color-panel">
            <h3 className="sk-label">{t('shop.colorTitle')}</h3>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`swatch${c === look.color ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setLook(slot, { color: c })}
                  aria-label={t('shop.colorAria', { c })}
                />
              ))}
            </div>
            <div className="color-row">
              <label className="picker-native">
                <input type="color" value={look.color} onChange={(e) => setLook(slot, { color: e.target.value })} aria-label={t('shop.pickColor')} />
                <span>{t('shop.fullPalette')}</span>
              </label>
              <label className="hexfield">
                <span>HEX</span>
                <input value={hex} onChange={(e) => typeHex(e.target.value.trim())} maxLength={7} spellCheck={false} aria-label={t('shop.hexAria')} />
              </label>
              <button className="link" onClick={() => setLook(slot, { color: DEFAULT_COLORS[slot] })}>
                {t('shop.resetColor')}
              </button>
            </div>
          </div>
          <div className="name-panel">
            <h3 className="sk-label">{t('shop.nameTitle')}</h3>
            <label className="namefield">
              <input
                value={look.name}
                onChange={(e) => setLook(slot, { name: e.target.value })}
                maxLength={NAME_MAX}
                placeholder={t('player.n', { n: slot + 1 })}
                spellCheck={false}
                aria-label={t('shop.nameTitle')}
              />
              <span className="dim">
                {look.name.length}/{NAME_MAX}
              </span>
            </label>
            <p className="hint">{t('shop.nameHint')}</p>
          </div>
          <p className="hint">{t('shop.onlineHint')}</p>
        </section>

        <section className="shop-list">
          {GROUPS.map(({ part, titleKey }) => (
            <div key={part} className="skin-group">
              <h3 className="sk-label">{t(titleKey)}</h3>
              <ul>
                {[SKIN_BY_ID.none, ...SKINS.filter((s) => s.part === part)].map((s) => {
                  const owned = s.id === 'none' || progress.skins.includes(s.id)
                  const equipped = look[part] === s.id
                  const missing = s.price - progress.points
                  const equip = (id: SkinId): void => setLook(slot, part === 'hat' ? { hat: id } : part === 'weapon' ? { weapon: id } : { trail: id })
                  return (
                    <li key={s.id} className={`skin-row${equipped ? ' on' : ''}`}>
                      <AvatarCanvas look={{ ...look, [part]: s.id }} scale={2.4} className="skin-thumb" />
                      <div className="skin-info">
                        <h4>{t(s.nameKey)}</h4>
                        <p>{t(s.blurbKey)}</p>
                      </div>
                      <div className="skin-act">
                        {equipped ? (
                          <span className="tag on">{t('shop.equipped')}</span>
                        ) : owned ? (
                          <button onClick={() => equip(s.id)}>{t('shop.equip')}</button>
                        ) : (
                          <button
                            className={missing > 0 ? '' : 'primary'}
                            disabled={missing > 0}
                            onClick={() => {
                              if (buySkin(s.id)) equip(s.id)
                            }}
                          >
                            {missing > 0 ? t('shop.priceMissing', { price: s.price, missing }) : t('shop.price', { price: s.price })}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <p className="hint">{t('shop.footHint')}</p>
        </section>
      </div>
    </div>
  )
}
