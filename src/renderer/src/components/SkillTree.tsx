import { useEffect, useRef, useState } from 'react'
import { BARRICADE_TIERS, BUILDS, OVERCLOCK_LEVELS, PLAYER, SPIKE_LEVELS } from '../game/config/constants'
import { ABILITY_CONFIG, SPIKE_LIMIT, TURRET_LIMIT } from '../game/config/config'
import { PERKS, UNLOCKS, UNLOCK_BY_ID, perkMult, type PerkDef, type PerkId, type TreeBranch, type UnlockDef, type UnlockId } from '../game/config/progress'
import { TURRET_BASE_MAX_LEVEL, TURRET_BRANCHES, TURRET_EVOLVE_LEVEL, TURRET_MAX_LEVEL, TURRET_PLAIN, TURRET_PLAIN_MAX, TURRET_SPEC_LEVEL } from '../game/config/turrets'
import { t, useT } from '../i18n'
import { useStore } from '../store'
import { IconBack, PERK_ICONS, UNLOCK_ICONS } from './icons'

const LAST = TURRET_PLAIN[TURRET_PLAIN_MAX - 1].stats

type Row = [label: string, value: string]

const pct = (v: number): string => `${Math.round(v * 100)} %`
const slowPct = (slow: number): string => pct(1 - slow)
const gold = (n: number | string): string => t('common.goldAmount', { n })
const wallRows = (from: number, to: number, cost: number): Row[] => [
  [t('row.hp'), `${from} → ${to}`],
  [t('row.upgrade'), gold(cost)]
]
const spikeRows = (i: number): Row[] => {
  const a = SPIKE_LEVELS[i - 1]
  const b = SPIKE_LEVELS[i]
  return [
    [t('row.dps'), `${a.dps} → ${b.dps}`],
    [t('row.slow'), `${slowPct(a.slow)} → ${slowPct(b.slow)}`],
    [t('row.hp'), `${a.hp} → ${b.hp}`],
    [t('row.upgrade'), gold(b.cost)]
  ]
}
const branchRows = (id: 1 | 2): Row[] => {
  const lv = TURRET_BRANCHES[id].levels.slice(0, TURRET_BASE_MAX_LEVEL - TURRET_PLAIN_MAX)
  const first = lv[0].stats
  const top = lv[lv.length - 1].stats
  const prices: Row = [t('row.prices', { a: TURRET_SPEC_LEVEL, b: TURRET_BASE_MAX_LEVEL }), gold(lv.map((l) => l.cost).join(' / '))]
  return id === 1
    ? [
        [t('row.rateAt', { n: TURRET_SPEC_LEVEL }), t('val.rate', { a: LAST.fireRate, b: first.fireRate })],
        [t('row.rateAt', { n: TURRET_BASE_MAX_LEVEL }), t('val.rateOnly', { n: top.fireRate })],
        prices
      ]
    : [
        [t('row.damageAt', { n: TURRET_SPEC_LEVEL }), `${LAST.damage} → ${first.damage}`],
        [t('row.damageAt', { n: TURRET_BASE_MAX_LEVEL }), t('val.damageRange', { damage: top.damage, range: top.range })],
        prices
      ]
}

const evolveRows = (id: 1 | 2): Row[] => {
  const lv = TURRET_BRANCHES[id].levels.slice(TURRET_EVOLVE_LEVEL - TURRET_SPEC_LEVEL)
  const before = TURRET_BRANCHES[id].levels[TURRET_EVOLVE_LEVEL - TURRET_SPEC_LEVEL - 1].stats
  const top = lv[lv.length - 1].stats
  const prices: Row = [t('row.prices', { a: TURRET_EVOLVE_LEVEL, b: TURRET_MAX_LEVEL }), gold(lv.map((l) => l.cost).join(' / '))]
  return id === 1
    ? [
        [t('row.rateRange', { a: TURRET_BASE_MAX_LEVEL, b: TURRET_MAX_LEVEL }), t('val.rate', { a: before.fireRate, b: top.fireRate })],
        [t('row.damageAt', { n: TURRET_MAX_LEVEL }), t('val.perBullet', { damage: top.damage, range: top.range })],
        prices
      ]
    : [
        [t('row.damageRange', { a: TURRET_BASE_MAX_LEVEL, b: TURRET_MAX_LEVEL }), `${before.damage} → ${top.damage}`],
        [t('row.splash', { n: TURRET_MAX_LEVEL }), t('val.radius', { n: top.splash ?? 0 })],
        prices
      ]
}

/** Ce que chaque compétence change, chiffré à partir de la configuration (donc toujours à jour quand on rééquilibre). Calculé à l'affichage : suit la langue. */
const EFFECTS: Record<UnlockId, () => Row[]> = {
  stone: () => wallRows(BUILDS.barricade.hp, BARRICADE_TIERS[0].hp, BARRICADE_TIERS[0].cost),
  bronze: () => wallRows(BARRICADE_TIERS[0].hp, BARRICADE_TIERS[1].hp, BARRICADE_TIERS[1].cost),
  reinforced: () => wallRows(BARRICADE_TIERS[1].hp, BARRICADE_TIERS[2].hp, BARRICADE_TIERS[2].cost),
  spikeStone: () => spikeRows(1),
  spikeReinforced: () => spikeRows(2),
  double: () => branchRows(1),
  heavy: () => branchRows(2),
  minigun: () => evolveRows(1),
  explosive: () => evolveRows(2)
}

const BRANCH_TITLES: Record<TreeBranch, string> = {
  barricade: 'skills.branch.barricade',
  spikes: 'skills.branch.spikes',
  turret: 'skills.branch.turret',
  tech: 'skills.branch.tech'
}

/** Statistiques de base du joueur et leur unité (clé de traduction), pour afficher « actuel → prochain rang ». */
const BASE_VALUES: Record<Exclude<PerkId, 'overclock' | 'precision' | 'turrets' | 'fireBullets' | 'spikes'>, { base: number; unit: string; digits: number }> = {
  speed: { base: PLAYER.speed, unit: 'unit.pxs', digits: 0 },
  fireRate: { base: PLAYER.fireRate, unit: 'unit.shots', digits: 1 },
  range: { base: PLAYER.range, unit: 'unit.px', digits: 0 },
  damage: { base: PLAYER.damage, unit: 'unit.damage', digits: 1 },
  bulletSpeed: { base: PLAYER.bulletSpeed, unit: 'unit.pxs', digits: 0 }
}

type Sel = { kind: 'unlock'; id: UnlockId } | { kind: 'perk'; id: PerkId }

/** Vrai pendant 0,8 s quand `value` augmente (jamais au premier affichage) : sert à jouer l'animation d'achat. */
function useBump(value: number): boolean {
  const prev = useRef(value)
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (value <= prev.current) {
      prev.current = value
      return
    }
    prev.current = value
    setOn(true)
    const id = setTimeout(() => setOn(false), 800)
    return () => clearTimeout(id)
  }, [value])
  return on
}

/** Nombre qui défile vers sa nouvelle valeur ; `dir` vaut 'up' ou 'down' un instant après un gain ou une dépense. */
function useCountUp(value: number): { text: number; dir: '' | 'up' | 'down' } {
  const [shown, setShown] = useState(value)
  const [dir, setDir] = useState<'' | 'up' | 'down'>('')
  const from = useRef(value)
  useEffect(() => {
    const a = from.current
    if (a === value) return
    setDir(value > a ? 'up' : 'down')
    const start = performance.now()
    let raf = 0
    const tick = (now: number): void => {
      const k = Math.min(1, (now - start) / 650)
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)))
      setShown(v)
      from.current = v
      if (k < 1) raf = requestAnimationFrame(tick)
      else setDir('')
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return { text: shown, dir }
}

type IconType = (p: { className?: string }) => React.JSX.Element

/**
 * Bouton d'achat : un liquide doré le remplit de gauche à droite selon les points qu'on a (70 sur 210 = un tiers).
 * Trop cher : le clic agite le liquide, qui vire au rouge un instant. Le bouton n'est jamais désactivé pour pouvoir réagir au clic.
 */
function BuyButton({ cost, points, label, onBuy }: { cost: number; points: number; label: string; onBuy: () => void }): React.JSX.Element {
  const [denied, setDenied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const fill = cost > 0 ? Math.min(1, Math.max(0, points / cost)) : 1
  const affordable = fill >= 1
  const click = (): void => {
    if (affordable) return onBuy()
    setDenied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDenied(false), 900)
  }
  return (
    <button
      className={`buy${affordable ? ' full' : ''}${denied ? ' denied' : ''}${fill === 0 ? ' empty' : ''}`}
      style={{ '--fill': fill } as React.CSSProperties}
      aria-disabled={!affordable}
      onClick={click}
    >
      <span className="buy-liquid" aria-hidden="true" />
      <span className="buy-label">{label}</span>
    </button>
  )
}

/**
 * En-tête du détail : l'icône flotte doucement et s'incline vers la souris quand elle passe dessus.
 * Le style est posé directement sur l'élément (pas de rendu React à chaque mouvement).
 */
function DetailHead({ icon: Icon, kind, title }: { icon: IconType; kind: string; title: string }): React.JSX.Element {
  const tilt = useRef<HTMLDivElement>(null)
  const move = (e: React.MouseEvent): void => {
    const el = tilt.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const range = 140
    const mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / range))
    const my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / range))
    el.style.setProperty('--mx', mx.toFixed(3))
    el.style.setProperty('--my', my.toFixed(3))
    el.classList.add('live')
  }
  const leave = (): void => {
    const el = tilt.current
    if (!el) return
    el.style.setProperty('--mx', '0')
    el.style.setProperty('--my', '0')
    el.classList.remove('live')
  }
  return (
    <header className="d-head" onMouseMove={move} onMouseLeave={leave}>
      <div className="d-float">
        <div ref={tilt} className="d-tilt">
          <Icon className="d-ico" />
        </div>
      </div>
      <div>
        <p className="d-kind">{kind}</p>
        <h3>{title}</h3>
      </div>
    </header>
  )
}

function Tile({ def, selected, onSelect }: { def: UnlockDef; selected: boolean; onSelect: () => void }): React.JSX.Element {
  useT()
  const progress = useStore((s) => s.progress)
  const owned = progress.unlocked.includes(def.id)
  const blocked = def.requires !== undefined && !progress.unlocked.includes(def.requires)
  const state = owned ? 'owned' : blocked ? 'blocked' : progress.points >= def.cost ? 'ready' : 'poor'
  const Icon = UNLOCK_ICONS[def.id]
  const bought = useBump(owned ? 1 : 0)
  return (
    <button className={`node ${state}${selected ? ' sel' : ''}${bought ? ' bought' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <Icon className="node-ico" />
      <span className="node-name">{t(def.nameKey)}</span>
      <span className="node-cost">{owned ? t('skills.owned') : blocked ? t('skills.blocked') : `${def.cost} ${t('common.pts')}`}</span>
    </button>
  )
}

function PerkTile({ def, index, selected, onSelect }: { def: PerkDef; index: number; selected: boolean; onSelect: () => void }): React.JSX.Element {
  useT()
  const rank = useStore((s) => s.progress.perks[index] ?? 0)
  const points = useStore((s) => s.progress.points)
  const max = def.costs.length
  const state = rank >= max ? 'owned' : points >= def.costs[rank] ? 'ready' : 'poor'
  const Icon = PERK_ICONS[def.id]
  const bought = useBump(rank)
  return (
    <button className={`node perk ${state}${selected ? ' sel' : ''}${bought ? ' bought' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <Icon className="node-ico" />
      <span className="node-name">{t(def.nameKey)}</span>
      <span className="pips" aria-label={t('skills.rankAria', { r: rank, m: max })}>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < rank ? 'on' : ''} />
        ))}
      </span>
    </button>
  )
}

function UnlockDetail({ def }: { def: UnlockDef }): React.JSX.Element {
  useT()
  const progress = useStore((s) => s.progress)
  const buy = useStore((s) => s.buyUnlock)
  const owned = progress.unlocked.includes(def.id)
  const blockedBy = def.requires && !progress.unlocked.includes(def.requires) ? UNLOCK_BY_ID[def.requires] : null
  const Icon = UNLOCK_ICONS[def.id]
  return (
    <>
      <DetailHead key={def.id} icon={Icon} kind={t(BRANCH_TITLES[def.branch])} title={t(def.nameKey)} />
      <p className="d-text">{t(def.blurbKey)}</p>
      <dl className="d-stats">
        {EFFECTS[def.id]().map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="d-buy">
        {owned ? (
          <p className="d-status ok">{t('skills.acquired')}</p>
        ) : blockedBy ? (
          <p className="d-status lock">{t('skills.requires', { name: t(blockedBy.nameKey) })}</p>
        ) : (
          <BuyButton cost={def.cost} points={progress.points} label={t('skills.unlockCost', { cost: def.cost })} onBuy={() => buy(def.id)} />
        )}
      </div>
    </>
  )
}

function PerkDetail({ def, index }: { def: PerkDef; index: number }): React.JSX.Element {
  useT()
  const points = useStore((s) => s.progress.points)
  const rank = useStore((s) => s.progress.perks[index] ?? 0)
  const buy = useStore((s) => s.buyPerk)
  const max = def.costs.length
  const maxed = rank >= max
  const cost = maxed ? 0 : def.costs[rank]
  const Icon = PERK_ICONS[def.id]
  // Valeur affichée au rang r : statistique du joueur, ou multiplicateur de cadence pour l'Overclocking
  let show: (r: number) => string
  let gain: string
  if (def.id === 'turrets') {
    show = (r) => t('perk.turretsN', { n: TURRET_LIMIT.base + r })
    gain = show(max)
  } else if (def.id === 'spikes') {
    show = (r) => t('perk.spikesN', { n: SPIKE_LIMIT.base + r * SPIKE_LIMIT.perRank })
    gain = show(max)
  } else if (def.id === 'fireBullets') {
    const stats = (r: number): string => {
      const a = ABILITY_CONFIG.fireBullets.ranks[Math.min(ABILITY_CONFIG.fireBullets.ranks.length, r) - 1]
      return t('ability.line', { d: a.duration, c: a.cooldown, b: a.burnDps })
    }
    show = (r) => (r === 0 ? t('perk.locked') : stats(r))
    gain = stats(max)
  } else if (def.id === 'overclock') {
    show = (r) => (r === 0 ? t('perk.none') : `× ${OVERCLOCK_LEVELS[r - 1].toFixed(1)}`)
    gain = t('perk.overclockGain', { max: OVERCLOCK_LEVELS[max - 1].toFixed(1), n: Math.round((OVERCLOCK_LEVELS[max - 1] - 1) * 100) })
  } else if (def.id === 'precision') {
    show = (r) => (r === 0 ? t('perk.noneF') : t('perk.anticipation', { n: Math.round(r * def.perRank * 100) }))
    gain = t('perk.precisionGain', { value: show(max), n: Math.round(max * def.perRank * 50) })
  } else {
    const v = BASE_VALUES[def.id]
    const at = (r: number): number => v.base * perkMult(PERKS.map((_, i) => (i === index ? r : 0)), def.id)
    show = (r) => `${at(r).toFixed(v.digits)} ${t(v.unit)}`
    gain = `${show(max)} (+${Math.round(def.perRank * max * 100)} %)`
  }
  const tech = def.group === 'tech' || def.group === 'passive' || def.group === 'ability'
  return (
    <>
      <DetailHead key={def.id} icon={Icon} kind={t('skills.kindRank', { kind: t(`skills.kind.${def.group}`), r: rank, m: max })} title={t(def.nameKey)} />
      <p className="d-text">{t(def.blurbKey, def.blurbParams)}</p>
      <dl className="d-stats">
        <div>
          <dt>{t('skills.current')}</dt>
          <dd>{show(rank)}</dd>
        </div>
        {!maxed && (
          <div>
            <dt>{t('skills.nextRank')}</dt>
            <dd className="up">{show(rank + 1)}</dd>
          </div>
        )}
        <div>
          <dt>{t('skills.maxRank')}</dt>
          <dd>{gain}</dd>
        </div>
      </dl>
      {def.group === 'passive' && <p className="d-note">{t('skills.passiveNote')}</p>}
      {def.group === 'ability' && rank > 0 && <p className="d-note">{t('skills.abilityNote')}</p>}
      <div className="d-buy">
        {maxed ? (
          <p className="d-status ok">{t('skills.maxed')}</p>
        ) : (
          <BuyButton cost={cost} points={points} label={t('skills.buy', { label: tech && rank === 0 ? t('skills.unlock') : t('skills.rank', { n: rank + 1 }), cost })} onBuy={() => buy(def.id)} />
        )}
      </div>
    </>
  )
}

export function SkillTree(): React.JSX.Element {
  useT()
  const points = useStore((s) => s.progress.points)
  const unlocked = useStore((s) => s.progress.unlocked)
  const counter = useCountUp(points)
  const close = useStore((s) => s.closeSkills)
  const devAdd = useStore((s) => s.devAddPoints)
  const devReset = useStore((s) => s.devReset)
  const [sel, setSel] = useState<Sel>({ kind: 'unlock', id: UNLOCKS[0].id })
  const branches: TreeBranch[] = ['barricade', 'spikes', 'turret', 'tech']

  return (
    <div className="screen sk">
      <header className="sk-head">
        <button className="back" onClick={close}>
          <IconBack /> {t('common.menu')}
        </button>
        <h2>{t('skills.title')}</h2>
        <div className={`sk-points ${counter.dir}`} aria-label={`${points} ${t('common.points')}`}>
          <b>{counter.text}</b>
          <span>{t('common.points')}</span>
        </div>
      </header>

      <div className="sk-body">
        <div className="sk-graph">
          <div className="sk-branches">
            {branches.map((b) => {
              const defs = UNLOCKS.filter((u) => u.branch === b)
              const tiers = [...new Set(defs.map((u) => u.tier))].sort((x, y) => x - y)
              return (
                <section key={b} className={`sk-col b-${b}`}>
                  <h3 className="sk-label">{t(BRANCH_TITLES[b])}</h3>
                  {b === 'tech' &&
                    PERKS.map((p, i) =>
                      p.group === 'tech' || p.group === 'passive' ? (
                        <div key={p.id} className="sk-tier">
                          <PerkTile def={p} index={i} selected={sel.kind === 'perk' && sel.id === p.id} onSelect={() => setSel({ kind: 'perk', id: p.id })} />
                        </div>
                      ) : null
                    )}
                  {tiers.map((tier, i) => {
                    const nodes = defs.filter((u) => u.tier === tier)
                    return (
                      <div
                        key={tier}
                        className={`sk-tier${nodes.length > 1 ? ' fork' : ''}${i > 0 ? ' linked' : ''}${i > 0 && defs.some((u) => u.tier === tiers[i - 1] && unlocked.includes(u.id)) ? ' lit' : ''}`}
                      >
                        {nodes.map((n) => (
                          <Tile key={n.id} def={n} selected={sel.kind === 'unlock' && sel.id === n.id} onSelect={() => setSel({ kind: 'unlock', id: n.id })} />
                        ))}
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </div>

          <section className="sk-perks">
            <h3 className="sk-label">{t('skills.soldier')}</h3>
            <div className="perk-row">
              {PERKS.map((p, i) =>
                p.group === 'soldier' ? (
                  <PerkTile key={p.id} def={p} index={i} selected={sel.kind === 'perk' && sel.id === p.id} onSelect={() => setSel({ kind: 'perk', id: p.id })} />
                ) : null
              )}
            </div>
          </section>

          <section className="sk-perks">
            <h3 className="sk-label">{t('skills.abilities')}</h3>
            <div className="perk-row">
              {PERKS.map((p, i) =>
                p.group === 'ability' ? (
                  <PerkTile key={p.id} def={p} index={i} selected={sel.kind === 'perk' && sel.id === p.id} onSelect={() => setSel({ kind: 'perk', id: p.id })} />
                ) : null
              )}
            </div>
          </section>
        </div>

        <aside className="sk-detail" aria-live="polite">
          {sel.kind === 'unlock' ? (
            <UnlockDetail def={UNLOCK_BY_ID[sel.id]} />
          ) : (
            <PerkDetail def={PERKS[PERKS.findIndex((p) => p.id === sel.id)]} index={PERKS.findIndex((p) => p.id === sel.id)} />
          )}
          {import.meta.env.DEV && (
            <>
              <button className="link dev" onClick={() => devAdd(500)}>
                {t('skills.devPoints')}
              </button>
              <button className="link dev" onClick={devReset}>
                {t('skills.devReset')}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
