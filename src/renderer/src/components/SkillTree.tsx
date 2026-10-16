import { useState } from 'react'
import { BARRICADE_TIERS, BUILDS, OVERCLOCK_LEVELS, PLAYER, SPIKE_LEVELS } from '../game/config/constants'
import { ABILITY_CONFIG, TURRET_LIMIT } from '../game/config/config'
import { PERKS, UNLOCKS, UNLOCK_BY_ID, perkMult, type PerkDef, type PerkId, type TreeBranch, type UnlockDef, type UnlockId } from '../game/config/progress'
import { TURRET_BASE_MAX_LEVEL, TURRET_BRANCHES, TURRET_EVOLVE_LEVEL, TURRET_MAX_LEVEL, TURRET_PLAIN, TURRET_PLAIN_MAX, TURRET_SPEC_LEVEL } from '../game/config/turrets'
import { useStore } from '../store'
import { IconBack, PERK_ICONS, UNLOCK_ICONS } from './icons'

const LAST = TURRET_PLAIN[TURRET_PLAIN_MAX - 1].stats

type Row = [label: string, value: string]

const pct = (v: number): string => `${Math.round(v * 100)} %`
const slowPct = (slow: number): string => pct(1 - slow)
const wallRows = (from: number, to: number, cost: number): Row[] => [
  ['Points de vie', `${from} → ${to}`],
  ['Amélioration en jeu', `${cost} or`]
]
const spikeRows = (i: number): Row[] => {
  const a = SPIKE_LEVELS[i - 1]
  const b = SPIKE_LEVELS[i]
  return [
    ['Dégâts par seconde', `${a.dps} → ${b.dps}`],
    ['Ralentissement', `${slowPct(a.slow)} → ${slowPct(b.slow)}`],
    ['Points de vie', `${a.hp} → ${b.hp}`],
    ['Amélioration en jeu', `${b.cost} or`]
  ]
}
const branchRows = (id: 1 | 2): Row[] => {
  const lv = TURRET_BRANCHES[id].levels.slice(0, TURRET_BASE_MAX_LEVEL - TURRET_PLAIN_MAX)
  const first = lv[0].stats
  const top = lv[lv.length - 1].stats
  return id === 1
    ? [
        ['Cadence au niveau 4', `${LAST.fireRate} → ${first.fireRate} tirs/s`],
        [`Cadence au niveau ${TURRET_BASE_MAX_LEVEL}`, `${top.fireRate} tirs/s`],
        ['Prix des niveaux 4 à 7', lv.map((l) => l.cost).join(' / ') + ' or']
      ]
    : [
        ['Dégâts au niveau 4', `${LAST.damage} → ${first.damage}`],
        [`Dégâts au niveau ${TURRET_BASE_MAX_LEVEL}`, `${top.damage} · portée ${top.range} px`],
        ['Prix des niveaux 4 à 7', lv.map((l) => l.cost).join(' / ') + ' or']
      ]
}

const evolveRows = (id: 1 | 2): Row[] => {
  const lv = TURRET_BRANCHES[id].levels.slice(TURRET_EVOLVE_LEVEL - TURRET_SPEC_LEVEL)
  const before = TURRET_BRANCHES[id].levels[TURRET_EVOLVE_LEVEL - TURRET_SPEC_LEVEL - 1].stats
  const top = lv[lv.length - 1].stats
  return id === 1
    ? [
        [`Cadence ${TURRET_BASE_MAX_LEVEL} → ${TURRET_MAX_LEVEL}`, `${before.fireRate} → ${top.fireRate} tirs/s`],
        [`Dégâts au niveau ${TURRET_MAX_LEVEL}`, `${top.damage} par balle · portée ${top.range} px`],
        [`Prix des niveaux ${TURRET_EVOLVE_LEVEL} à ${TURRET_MAX_LEVEL}`, lv.map((l) => l.cost).join(' / ') + ' or']
      ]
    : [
        [`Dégâts ${TURRET_BASE_MAX_LEVEL} → ${TURRET_MAX_LEVEL}`, `${before.damage} → ${top.damage}`],
        [`Zone d’explosion au niveau ${TURRET_MAX_LEVEL}`, `${top.splash} px de rayon`],
        [`Prix des niveaux ${TURRET_EVOLVE_LEVEL} à ${TURRET_MAX_LEVEL}`, lv.map((l) => l.cost).join(' / ') + ' or']
      ]
}

/** Ce que chaque compétence change, chiffré à partir de la configuration (donc toujours à jour quand on rééquilibre). */
const EFFECTS: Record<UnlockId, Row[]> = {
  stone: wallRows(BUILDS.barricade.hp, BARRICADE_TIERS[0].hp, BARRICADE_TIERS[0].cost),
  bronze: wallRows(BARRICADE_TIERS[0].hp, BARRICADE_TIERS[1].hp, BARRICADE_TIERS[1].cost),
  reinforced: wallRows(BARRICADE_TIERS[1].hp, BARRICADE_TIERS[2].hp, BARRICADE_TIERS[2].cost),
  spikeStone: spikeRows(1),
  spikeReinforced: spikeRows(2),
  double: branchRows(1),
  heavy: branchRows(2),
  minigun: evolveRows(1),
  explosive: evolveRows(2)
}

const BRANCH_TITLES: Record<TreeBranch, string> = { barricade: 'Murs', spikes: 'Pieux', turret: 'Tourelles · niveau 4 à 10', tech: 'Technologie' }

/** Statistiques de base du joueur et leur unité, pour afficher « actuel → prochain rang ». */
const BASE_VALUES: Record<Exclude<PerkId, 'overclock' | 'precision' | 'turrets' | 'fireBullets'>, { base: number; unit: string; digits: number }> = {
  speed: { base: PLAYER.speed, unit: 'px/s', digits: 0 },
  fireRate: { base: PLAYER.fireRate, unit: 'tirs/s', digits: 1 },
  range: { base: PLAYER.range, unit: 'px', digits: 0 },
  damage: { base: PLAYER.damage, unit: 'dégâts', digits: 1 },
  bulletSpeed: { base: PLAYER.bulletSpeed, unit: 'px/s', digits: 0 }
}

type Sel = { kind: 'unlock'; id: UnlockId } | { kind: 'perk'; id: PerkId }

function Tile({ def, selected, onSelect }: { def: UnlockDef; selected: boolean; onSelect: () => void }): React.JSX.Element {
  const progress = useStore((s) => s.progress)
  const owned = progress.unlocked.includes(def.id)
  const blocked = def.requires !== undefined && !progress.unlocked.includes(def.requires)
  const state = owned ? 'owned' : blocked ? 'blocked' : progress.points >= def.cost ? 'ready' : 'poor'
  const Icon = UNLOCK_ICONS[def.id]
  return (
    <button className={`node ${state}${selected ? ' sel' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <Icon className="node-ico" />
      <span className="node-name">{def.name}</span>
      <span className="node-cost">{owned ? 'Acquis' : blocked ? 'Verrouillé' : `${def.cost} pts`}</span>
    </button>
  )
}

function PerkTile({ def, index, selected, onSelect }: { def: PerkDef; index: number; selected: boolean; onSelect: () => void }): React.JSX.Element {
  const rank = useStore((s) => s.progress.perks[index] ?? 0)
  const points = useStore((s) => s.progress.points)
  const max = def.costs.length
  const state = rank >= max ? 'owned' : points >= def.costs[rank] ? 'ready' : 'poor'
  const Icon = PERK_ICONS[def.id]
  return (
    <button className={`node perk ${state}${selected ? ' sel' : ''}`} onClick={onSelect} aria-pressed={selected}>
      <Icon className="node-ico" />
      <span className="node-name">{def.name}</span>
      <span className="pips" aria-label={`Rang ${rank} sur ${max}`}>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={i < rank ? 'on' : ''} />
        ))}
      </span>
    </button>
  )
}

function UnlockDetail({ def }: { def: UnlockDef }): React.JSX.Element {
  const progress = useStore((s) => s.progress)
  const buy = useStore((s) => s.buyUnlock)
  const owned = progress.unlocked.includes(def.id)
  const blockedBy = def.requires && !progress.unlocked.includes(def.requires) ? UNLOCK_BY_ID[def.requires] : null
  const missing = def.cost - progress.points
  const Icon = UNLOCK_ICONS[def.id]
  return (
    <>
      <header className="d-head">
        <Icon className="d-ico" />
        <div>
          <p className="d-kind">{BRANCH_TITLES[def.branch]}</p>
          <h3>{def.name}</h3>
        </div>
      </header>
      <p className="d-text">{def.blurb}</p>
      <dl className="d-stats">
        {EFFECTS[def.id].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="d-buy">
        {owned ? (
          <p className="d-status ok">Compétence acquise</p>
        ) : blockedBy ? (
          <p className="d-status lock">Requiert « {blockedBy.name} »</p>
        ) : (
          <button className={missing > 0 ? '' : 'primary'} disabled={missing > 0} onClick={() => buy(def.id)}>
            Débloquer · {def.cost} pts{missing > 0 ? ` (il manque ${missing})` : ''}
          </button>
        )}
      </div>
    </>
  )
}

function PerkDetail({ def, index }: { def: PerkDef; index: number }): React.JSX.Element {
  const points = useStore((s) => s.progress.points)
  const rank = useStore((s) => s.progress.perks[index] ?? 0)
  const buy = useStore((s) => s.buyPerk)
  const max = def.costs.length
  const maxed = rank >= max
  const cost = maxed ? 0 : def.costs[rank]
  const missing = cost - points
  const Icon = PERK_ICONS[def.id]
  // Valeur affichée au rang r : statistique du joueur, ou multiplicateur de cadence pour l'Overclocking
  let show: (r: number) => string
  let gain: string
  if (def.id === 'turrets') {
    show = (r) => `${TURRET_LIMIT.base + r} tourelles`
    gain = show(max)
  } else if (def.id === 'fireBullets') {
    const stats = (r: number): string => {
      const a = ABILITY_CONFIG.fireBullets.ranks[Math.min(ABILITY_CONFIG.fireBullets.ranks.length, r) - 1]
      return `${a.duration} s d’effet · recharge ${a.cooldown} s · brûlure ${a.burnDps}/s`
    }
    show = (r) => (r === 0 ? 'verrouillée' : stats(r))
    gain = stats(max)
  } else if (def.id === 'overclock') {
    show = (r) => (r === 0 ? 'aucun' : `× ${OVERCLOCK_LEVELS[r - 1].toFixed(1)}`)
    gain = `× ${OVERCLOCK_LEVELS[max - 1].toFixed(1)} (+${Math.round((OVERCLOCK_LEVELS[max - 1] - 1) * 100)} %)`
  } else if (def.id === 'precision') {
    show = (r) => (r === 0 ? 'aucune' : `${Math.round(r * def.perRank * 100)} % d’anticipation`)
    gain = `${show(max)}, dispersion −${Math.round(max * def.perRank * 50)} %`
  } else {
    const v = BASE_VALUES[def.id]
    const at = (r: number): number => v.base * perkMult(PERKS.map((_, i) => (i === index ? r : 0)), def.id)
    show = (r) => `${at(r).toFixed(v.digits)} ${v.unit}`
    gain = `${show(max)} (+${Math.round(def.perRank * max * 100)} %)`
  }
  const tech = def.group === 'tech' || def.group === 'passive' || def.group === 'ability'
  const kind = def.group === 'tech' ? 'Technologie' : def.group === 'passive' ? 'Capacité passive' : def.group === 'ability' ? 'Capacité active' : 'Soldat'
  return (
    <>
      <header className="d-head">
        <Icon className="d-ico" />
        <div>
          <p className="d-kind">
            {kind} · rang {rank} / {max}
          </p>
          <h3>{def.name}</h3>
        </div>
      </header>
      <p className="d-text">{def.blurb}</p>
      <dl className="d-stats">
        <div>
          <dt>Actuel</dt>
          <dd>{show(rank)}</dd>
        </div>
        {!maxed && (
          <div>
            <dt>Rang suivant</dt>
            <dd className="up">{show(rank + 1)}</dd>
          </div>
        )}
        <div>
          <dt>Rang maximum</dt>
          <dd>{gain}</dd>
        </div>
      </dl>
      {def.group === 'passive' && <p className="d-note">Passive : toujours active une fois débloquée, sans emplacement à équiper.</p>}
      {def.group === 'ability' && rank > 0 && <p className="d-note">S’équipe dans l’Arsenal (menu principal).</p>}
      <div className="d-buy">
        {maxed ? (
          <p className="d-status ok">Rang maximum</p>
        ) : (
          <button className={missing > 0 ? '' : 'primary'} disabled={missing > 0} onClick={() => buy(def.id)}>
            {tech && rank === 0 ? 'Débloquer' : `Rang ${rank + 1}`} · {cost} pts{missing > 0 ? ` (il manque ${missing})` : ''}
          </button>
        )}
      </div>
    </>
  )
}

export function SkillTree(): React.JSX.Element {
  const points = useStore((s) => s.progress.points)
  const close = useStore((s) => s.closeSkills)
  const devAdd = useStore((s) => s.devAddPoints)
  const [sel, setSel] = useState<Sel>({ kind: 'unlock', id: UNLOCKS[0].id })
  const branches: TreeBranch[] = ['barricade', 'spikes', 'turret', 'tech']

  return (
    <div className="screen sk">
      <header className="sk-head">
        <button className="back" onClick={close}>
          <IconBack /> Menu
        </button>
        <h2>Compétences</h2>
        <div className="sk-points" aria-label={`${points} points`}>
          <b>{points}</b>
          <span>points</span>
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
                  <h3 className="sk-label">{BRANCH_TITLES[b]}</h3>
                  {b === 'tech' &&
                    PERKS.map((p, i) =>
                      p.group === 'tech' || p.group === 'passive' ? (
                        <div key={p.id} className="sk-tier">
                          <PerkTile def={p} index={i} selected={sel.kind === 'perk' && sel.id === p.id} onSelect={() => setSel({ kind: 'perk', id: p.id })} />
                        </div>
                      ) : null
                    )}
                  {tiers.map((t, i) => {
                    const nodes = defs.filter((u) => u.tier === t)
                    return (
                      <div key={t} className={`sk-tier${nodes.length > 1 ? ' fork' : ''}${i > 0 ? ' linked' : ''}`}>
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
            <h3 className="sk-label">Soldat · améliorer le joueur</h3>
            <div className="perk-row">
              {PERKS.map((p, i) =>
                p.group === 'soldier' ? (
                  <PerkTile key={p.id} def={p} index={i} selected={sel.kind === 'perk' && sel.id === p.id} onSelect={() => setSel({ kind: 'perk', id: p.id })} />
                ) : null
              )}
            </div>
          </section>

          <section className="sk-perks">
            <h3 className="sk-label">Capacités actives · à équiper dans l’Arsenal</h3>
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
            <button className="link dev" onClick={() => devAdd(500)}>
              +500 points (dev)
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
