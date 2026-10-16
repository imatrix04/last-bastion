import { useEffect, useState } from 'react'
import { DEFAULT_COLORS, NAME_MAX, PALETTE, SKINS, SKIN_BY_ID, isHexColor, type SkinId, type SkinPart } from '../game/config/appearance'
import { useStore } from '../store'
import { AvatarCanvas } from './AvatarCanvas'
import { IconBack } from './icons'

/** Un groupe par emplacement : chaque joueur équipe un chapeau et un canon, indépendamment. */
const GROUPS: readonly { part: SkinPart; title: string }[] = [
  { part: 'hat', title: 'Chapeaux' },
  { part: 'weapon', title: 'Canons' }
]

/** Boutique : couleur libre du personnage (gratuite) et skins achetés avec les points de compétence. */
export function Shop(): React.JSX.Element {
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
          <IconBack /> Menu
        </button>
        <h2>Boutique</h2>
        <div className="sk-points" aria-label={`${progress.points} points`}>
          <b>{progress.points}</b>
          <span>points</span>
        </div>
      </header>

      <div className="shop-body">
        <section className="shop-stage">
          <div className="tabs" role="tablist" aria-label="Joueur à personnaliser">
            <button role="tab" aria-selected={slot === 0} className={slot === 0 ? 'on' : ''} onClick={() => setSlot(0)}>
              Joueur 1
            </button>
            <button role="tab" aria-selected={slot === 1} className={slot === 1 ? 'on' : ''} onClick={() => setSlot(1)}>
              Joueur 2 · même clavier
            </button>
          </div>

          <div className="hero-frame">
            <AvatarCanvas look={look} scale={7} className="hero-canvas" />
          </div>

          <div className="color-panel">
            <h3 className="sk-label">Couleur · gratuite, au choix</h3>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`swatch${c === look.color ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setLook(slot, { color: c })}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
            <div className="color-row">
              <label className="picker-native">
                <input type="color" value={look.color} onChange={(e) => setLook(slot, { color: e.target.value })} aria-label="Choisir une couleur" />
                <span>Palette complète</span>
              </label>
              <label className="hexfield">
                <span>HEX</span>
                <input value={hex} onChange={(e) => typeHex(e.target.value.trim())} maxLength={7} spellCheck={false} aria-label="Code couleur" />
              </label>
              <button className="link" onClick={() => setLook(slot, { color: DEFAULT_COLORS[slot] })}>
                Couleur d’origine
              </button>
            </div>
          </div>
          <div className="name-panel">
            <h3 className="sk-label">Pseudo</h3>
            <label className="namefield">
              <input
                value={look.name}
                onChange={(e) => setLook(slot, { name: e.target.value })}
                maxLength={NAME_MAX}
                placeholder={`Joueur ${slot + 1}`}
                spellCheck={false}
                aria-label="Pseudo"
              />
              <span className="dim">
                {look.name.length}/{NAME_MAX}
              </span>
            </label>
            <p className="hint">Affiché au-dessus du personnage, en jeu et dans le menu.</p>
          </div>
          <p className="hint">En ligne, tu joues avec l’apparence du Joueur 1.</p>
        </section>

        <section className="shop-list">
          {GROUPS.map(({ part, title }) => (
            <div key={part} className="skin-group">
              <h3 className="sk-label">{title}</h3>
              <ul>
                {[SKIN_BY_ID.none, ...SKINS.filter((s) => s.part === part)].map((s) => {
                  const owned = s.id === 'none' || progress.skins.includes(s.id)
                  const equipped = look[part] === s.id
                  const missing = s.price - progress.points
                  const equip = (id: SkinId): void => setLook(slot, part === 'hat' ? { hat: id } : { weapon: id })
                  return (
                    <li key={s.id} className={`skin-row${equipped ? ' on' : ''}`}>
                      <AvatarCanvas look={{ ...look, [part]: s.id }} scale={2.4} className="skin-thumb" />
                      <div className="skin-info">
                        <h4>{s.name}</h4>
                        <p>{s.blurb}</p>
                      </div>
                      <div className="skin-act">
                        {equipped ? (
                          <span className="tag on">Équipé</span>
                        ) : owned ? (
                          <button onClick={() => equip(s.id)}>Équiper</button>
                        ) : (
                          <button
                            className={missing > 0 ? '' : 'primary'}
                            disabled={missing > 0}
                            onClick={() => {
                              if (buySkin(s.id)) equip(s.id)
                            }}
                          >
                            {s.price} pts{missing > 0 ? ` · manque ${missing}` : ''}
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <p className="hint">Un chapeau et un canon peuvent être équipés en même temps. Les points se gagnent à chaque partie.</p>
        </section>
      </div>
    </div>
  )
}
