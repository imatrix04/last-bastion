import { ABILITY_CONFIG, ABILITY_SLOTS } from '../game/config/config'
import { OVERCLOCK_LEVELS } from '../game/config/constants'
import { CONTROLS } from '../game/config/controls'
import { PERKS, PERK_INDEX, abilityRank, type AbilityId, type PerkDef } from '../game/config/progress'
import { t, useT } from '../i18n'
import { useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'
import { IconBack, PERK_ICONS } from './icons'

/** Ce que fait une capacité active à un rang donné. */
function abilityLine(id: AbilityId, rank: number): string {
  const ranks = ABILITY_CONFIG[id].ranks
  const a = ranks[Math.min(ranks.length, Math.max(1, rank)) - 1]
  return t('ability.line', { d: a.duration, c: a.cooldown, b: a.burnDps })
}

const ACTIVES: readonly PerkDef[] = PERKS.filter((p) => p.group === 'ability')
const PASSIVES: readonly PerkDef[] = PERKS.filter((p) => p.group === 'passive')

function passiveLine(def: PerkDef, rank: number): string {
  if (def.id === 'overclock') return t('arsenal.overclockLine', { n: OVERCLOCK_LEVELS[Math.max(1, rank) - 1].toFixed(1) })
  return t(def.blurbKey, def.blurbParams)
}

/**
 * Arsenal : le choix de ce qu'on emporte en partie.
 * Capacités actives (jusqu'à ABILITY_SLOTS, une touche chacune) ; les capacités passives sont toujours actives une fois débloquées.
 */
export function Arsenal(): React.JSX.Element {
  useT()
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
          <IconBack /> {t('common.menu')}
        </button>
        <h2>{t('arsenal.title')}</h2>
        <div className="sk-points" aria-label={`${progress.points} ${t('common.points')}`}>
          <b>{progress.points}</b>
          <span>{t('common.points')}</span>
        </div>
      </header>

      <div className="ar-body">
        <section className="ar-section">
          <h3 className="sk-label">
            {t('arsenal.actives', { n: equipped.length, max: ABILITY_SLOTS })}
          </h3>
          <div className="ar-slots">
            {Array.from({ length: ABILITY_SLOTS }, (_, i) => {
              const id = equipped[i]
              const Icon = id ? PERK_ICONS[id] : null
              const def = id ? PERKS[PERK_INDEX[id]] : null
              return (
                <div key={i} className={`ar-slot${id ? ' on' : ''}`}>
                  <span className="ar-key">
                    {t('arsenal.slot', { n: i + 1 })} · <kbd>{label(CONTROLS[0].abilities[i])}</kbd>{' '}
                    <small className="dim">
                      / <kbd>{label(CONTROLS[1].abilities[i])}</kbd>
                    </small>
                  </span>
                  {id && def && Icon ? (
                    <>
                      <Icon className="ar-ico" />
                      <b>{t(def.nameKey)}</b>
                      <small>{abilityLine(id, abilityRank(progress.perks, id))}</small>
                      <span className="ar-actions">
                        <button disabled={i === 0} onClick={() => move(id, -1)} aria-label={t('arsenal.moveLeft')}>
                          ◀
                        </button>
                        <button disabled={i === equipped.length - 1} onClick={() => move(id, 1)} aria-label={t('arsenal.moveRight')}>
                          ▶
                        </button>
                        <button onClick={() => toggle(id)}>{t('arsenal.remove')}</button>
                      </span>
                    </>
                  ) : (
                    <span className="ar-empty">{t('arsenal.emptySlot')}</span>
                  )}
                </div>
              )
            })}
          </div>

          <h4 className="ar-sub">{t('arsenal.available')}</h4>
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
                    <b>{t(def.nameKey)}</b>
                    <span className="muted">{rank === 0 ? t('arsenal.locked') : t('arsenal.rank', { r: rank, m: def.costs.length })}</span>
                    <p>{t(def.blurbKey, def.blurbParams)}</p>
                    {rank > 0 && <small>{abilityLine(id, rank)}</small>}
                  </div>
                  {rank === 0 ? (
                    <button onClick={toSkills}>{t('arsenal.unlockInSkills')}</button>
                  ) : (
                    <button className={on ? '' : 'primary'} disabled={!on && full} onClick={() => toggle(id)}>
                      {on ? t('arsenal.remove') : full ? t('arsenal.full') : t('arsenal.equip')}
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="ar-section">
          <h3 className="sk-label">{t('arsenal.passives')}</h3>
          <div className="ar-list">
            {PASSIVES.map((def) => {
              const rank = progress.perks[PERK_INDEX[def.id]] ?? 0
              const Icon = PERK_ICONS[def.id]
              return (
                <article key={def.id} className={`ar-card${rank === 0 ? ' locked' : ' on'}`}>
                  <Icon className="ar-ico" />
                  <div className="ar-text">
                    <b>{t(def.nameKey)}</b>
                    <span className="muted">{rank === 0 ? t('arsenal.locked') : t('arsenal.rankActive', { r: rank, m: def.costs.length })}</span>
                    <small>{rank === 0 ? t(def.blurbKey, def.blurbParams) : passiveLine(def, rank)}</small>
                  </div>
                  {rank === 0 && <button onClick={toSkills}>{t('arsenal.unlockInSkills')}</button>}
                </article>
              )
            })}
          </div>
        </section>

        <p className="hint">{t('arsenal.hint')}</p>
      </div>
    </div>
  )
}
