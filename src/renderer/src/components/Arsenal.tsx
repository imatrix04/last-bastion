import { ABILITY_CONFIG, ABILITY_SLOTS } from '../game/config/config'
import { OVERCLOCK_LEVELS } from '../game/config/constants'
import { CONTROLS } from '../game/config/controls'
import { PERKS, PERK_INDEX, abilityRank, type AbilityId, type PerkDef } from '../game/config/progress'
import { useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'
import { IconBack, PERK_ICONS } from './icons'

/** Ce que fait une capacité active à un rang donné. */
function abilityLine(id: AbilityId, rank: number): string {
  const ranks = ABILITY_CONFIG[id].ranks
  const a = ranks[Math.min(ranks.length, Math.max(1, rank)) - 1]
  return `${a.duration} s d’effet · recharge ${a.cooldown} s · brûlure ${a.burnDps}/s`
}

const ACTIVES: readonly PerkDef[] = PERKS.filter((p) => p.group === 'ability')
const PASSIVES: readonly PerkDef[] = PERKS.filter((p) => p.group === 'passive')

function passiveLine(def: PerkDef, rank: number): string {
  if (def.id === 'overclock') return `Cadence de toutes tes tourelles × ${OVERCLOCK_LEVELS[Math.max(1, rank) - 1].toFixed(1)}`
  return def.blurb
}

/**
 * Arsenal : le choix de ce qu'on emporte en partie.
 * Capacités actives (jusqu'à ABILITY_SLOTS, une touche chacune) ; les capacités passives sont toujours actives une fois débloquées.
 */
export function Arsenal(): React.JSX.Element {
  const progress = useStore((s) => s.progress)
  const close = useStore((s) => s.closeArsenal)
  const openSkills = useStore((s) => s.openSkills)
  const toggle = useStore((s) => s.toggleAbility)
  const move = useStore((s) => s.moveAbility)
  const label = useKeyLabels()
  const equipped = progress.abilities
  const full = equipped.length >= ABILITY_SLOTS

  const toSkills = (): void => {
    close()
    openSkills()
  }

  return (
    <div className="screen arsenal">
      <header className="sk-head">
        <button className="back" onClick={close}>
          <IconBack /> Menu
        </button>
        <h2>Arsenal</h2>
        <div className="sk-points" aria-label={`${progress.points} points`}>
          <b>{progress.points}</b>
          <span>points</span>
        </div>
      </header>

      <div className="ar-body">
        <section className="ar-section">
          <h3 className="sk-label">
            Capacités actives · {equipped.length} / {ABILITY_SLOTS} équipées
          </h3>
          <div className="ar-slots">
            {Array.from({ length: ABILITY_SLOTS }, (_, i) => {
              const id = equipped[i]
              const Icon = id ? PERK_ICONS[id] : null
              const def = id ? PERKS[PERK_INDEX[id]] : null
              return (
                <div key={i} className={`ar-slot${id ? ' on' : ''}`}>
                  <span className="ar-key">
                    Emplacement {i + 1} · <kbd>{label(CONTROLS[0].abilities[i])}</kbd>{' '}
                    <small className="dim">
                      / <kbd>{label(CONTROLS[1].abilities[i])}</kbd>
                    </small>
                  </span>
                  {id && def && Icon ? (
                    <>
                      <Icon className="ar-ico" />
                      <b>{def.name}</b>
                      <small>{abilityLine(id, abilityRank(progress.perks, id))}</small>
                      <span className="ar-actions">
                        <button disabled={i === 0} onClick={() => move(id, -1)} aria-label="Déplacer vers la gauche">
                          ◀
                        </button>
                        <button disabled={i === equipped.length - 1} onClick={() => move(id, 1)} aria-label="Déplacer vers la droite">
                          ▶
                        </button>
                        <button onClick={() => toggle(id)}>Retirer</button>
                      </span>
                    </>
                  ) : (
                    <span className="ar-empty">Emplacement libre</span>
                  )}
                </div>
              )
            })}
          </div>

          <h4 className="ar-sub">Disponibles</h4>
          <div className="ar-list">
            {ACTIVES.map((def) => {
              const id = def.id as AbilityId
              const rank = progress.perks[PERK_INDEX[def.id]] ?? 0
              const on = equipped.includes(id)
              const Icon = PERK_ICONS[def.id]
              return (
                <article key={def.id} className={`ar-card${rank === 0 ? ' locked' : ''}${on ? ' on' : ''}`}>
                  <Icon className="ar-ico" />
                  <div className="ar-text">
                    <b>{def.name}</b>
                    <span className="muted">{rank === 0 ? 'Verrouillée' : `Rang ${rank} / ${def.costs.length}`}</span>
                    <p>{def.blurb}</p>
                    {rank > 0 && <small>{abilityLine(id, rank)}</small>}
                  </div>
                  {rank === 0 ? (
                    <button onClick={toSkills}>Débloquer dans Compétences</button>
                  ) : (
                    <button className={on ? '' : 'primary'} disabled={!on && full} onClick={() => toggle(id)}>
                      {on ? 'Retirer' : full ? 'Emplacements pleins' : 'Équiper'}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="ar-section">
          <h3 className="sk-label">Capacités passives · toujours actives</h3>
          <div className="ar-list">
            {PASSIVES.map((def) => {
              const rank = progress.perks[PERK_INDEX[def.id]] ?? 0
              const Icon = PERK_ICONS[def.id]
              return (
                <article key={def.id} className={`ar-card${rank === 0 ? ' locked' : ' on'}`}>
                  <Icon className="ar-ico" />
                  <div className="ar-text">
                    <b>{def.name}</b>
                    <span className="muted">{rank === 0 ? 'Verrouillée' : `Rang ${rank} / ${def.costs.length} · active`}</span>
                    <small>{rank === 0 ? def.blurb : passiveLine(def, rank)}</small>
                  </div>
                  {rank === 0 && <button onClick={toSkills}>Débloquer dans Compétences</button>}
                </article>
              )
            })}
          </div>
        </section>

        <p className="hint">Ces choix valent pour toutes tes parties : solo, coop et en ligne. Les rangs s’achètent dans Compétences.</p>
      </div>
    </div>
  )
}
