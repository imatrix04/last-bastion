import { useState } from 'react'
import {
  BARRICADE_REINFORCED,
  BARRICADE_STONE,
  BUILDS,
  OVERCLOCK,
  PLAYER,
  TURRET_BRANCHES,
  TURRET_LEVELS,
  TURRET_PLAIN_MAX
} from '../game/constants'
import { PERKS, UNLOCKS, UNLOCK_BY_ID, perkMult, type PerkDef, type PerkId, type TreeBranch, type UnlockDef, type UnlockId } from '../game/progress'
import { useStore } from '../store'
import { IconBack, PERK_ICONS, UNLOCK_ICONS } from './icons'

const LAST = TURRET_LEVELS[TURRET_PLAIN_MAX - 1]

type Row = [label: string, value: string]

/** Ce que chaque compétence change, chiffré à partir de constants.ts (donc toujours à jour quand on rééquilibre). */
const EFFECTS: Record<UnlockId, Row[]> = {
  stone: [
    ['Points de vie', `${BUILDS.barricade.hp} → ${BARRICADE_STONE.hp}`],
    ['Amélioration en jeu', `${BARRICADE_STONE.cost} or`]
  ],
  reinforced: [
    ['Points de vie', `${BARRICADE_STONE.hp} → ${BARRICADE_REINFORCED.hp}`],
    ['Amélioration en jeu', `${BARRICADE_REINFORCED.cost} or`]
  ],
  double: [
    ['Cadence', `${LAST.fireRate} → ${TURRET_BRANCHES[1].stats.fireRate} tirs/s`],
    ['Amélioration en jeu', `${TURRET_BRANCHES[1].cost} or`]
  ],
  heavy: [
    ['Dégâts par tir', `${LAST.damage} → ${TURRET_BRANCHES[2].stats.damage}`],
    ['Portée', `${LAST.range} → ${TURRET_BRANCHES[2].stats.range} px`],
    ['Amélioration en jeu', `${TURRET_BRANCHES[2].cost} or`]
  ],
  overclock: [
    ['Cadence de tir', `× ${OVERCLOCK.fireRate} (+${Math.round((OVERCLOCK.fireRate - 1) * 100)} %)`],
    ['S’applique à', 'tes tourelles et futures armes']
  ]
}

const BRANCH_TITLES: Record<TreeBranch, string> = { barricade: 'Murs', turret: 'Tourelles · niveau 4', tech: 'Technologie' }

/** Statistiques de base du joueur et leur unité, pour afficher « actuel → prochain rang ». */
const BASE_VALUES: Record<PerkId, { base: number; unit: string; digits: number }> = {
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
  const v = BASE_VALUES[def.id]
  const fmt = (n: number): string => n.toFixed(v.digits)
  const at = (r: number): number => v.base * perkMult(PERKS.map((_, i) => (i === index ? r : 0)), def.id)
  const Icon = PERK_ICONS[def.id]
  return (
    <>
      <header className="d-head">
        <Icon className="d-ico" />
        <div>
          <p className="d-kind">Soldat · rang {rank} / {max}</p>
          <h3>{def.name}</h3>
        </div>
      </header>
      <p className="d-text">{def.blurb}</p>
      <dl className="d-stats">
        <div>
          <dt>Actuel</dt>
          <dd>
            {fmt(at(rank))} {v.unit}
          </dd>
        </div>
        {!maxed && (
          <div>
            <dt>Rang suivant</dt>
            <dd className="up">
              {fmt(at(rank + 1))} {v.unit}
            </dd>
          </div>
        )}
        <div>
          <dt>Rang maximum</dt>
          <dd>
            {fmt(at(max))} {v.unit} (+{Math.round(def.perRank * max * 100)} %)
          </dd>
        </div>
      </dl>
      <div className="d-buy">
        {maxed ? (
          <p className="d-status ok">Rang maximum</p>
        ) : (
          <button className={missing > 0 ? '' : 'primary'} disabled={missing > 0} onClick={() => buy(def.id)}>
            Rang {rank + 1} · {cost} pts{missing > 0 ? ` (il manque ${missing})` : ''}
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
  const branches: TreeBranch[] = ['barricade', 'turret', 'tech']

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
              {PERKS.map((p, i) => (
                <PerkTile key={p.id} def={p} index={i} selected={sel.kind === 'perk' && sel.id === p.id} onSelect={() => setSel({ kind: 'perk', id: p.id })} />
              ))}
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
