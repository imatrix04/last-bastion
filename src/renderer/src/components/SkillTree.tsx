import type { CSSProperties } from 'react'
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

const LAST = TURRET_LEVELS[TURRET_PLAIN_MAX - 1]

/** Ce que la compétence change, chiffré à partir de constants.ts (donc toujours à jour quand on rééquilibre). */
const DETAILS: Record<UnlockId, { glyph: string; color: string; lines: string[] }> = {
  stone: { glyph: '▦', color: '#a9afbd', lines: [`PV ${BUILDS.barricade.hp} → ${BARRICADE_STONE.hp}`, `Amélioration : ${BARRICADE_STONE.cost} or`] },
  reinforced: {
    glyph: '▣',
    color: '#cfd8dc',
    lines: [`PV ${BARRICADE_STONE.hp} → ${BARRICADE_REINFORCED.hp}`, `Amélioration : ${BARRICADE_REINFORCED.cost} or`]
  },
  double: {
    glyph: '◉◉',
    color: '#4dd0e1',
    lines: [`Cadence ${LAST.fireRate} → ${TURRET_BRANCHES[1].stats.fireRate} tirs/s`, `Amélioration : ${TURRET_BRANCHES[1].cost} or`]
  },
  heavy: {
    glyph: '◎',
    color: '#ff9800',
    lines: [`Dégâts ${LAST.damage} → ${TURRET_BRANCHES[2].stats.damage}`, `Amélioration : ${TURRET_BRANCHES[2].cost} or`]
  },
  overclock: {
    glyph: '⚡',
    color: '#ffca28',
    lines: [`Cadence × ${OVERCLOCK.fireRate} (+${Math.round((OVERCLOCK.fireRate - 1) * 100)} %)`, 'Tourelles construites par toi']
  }
}

const BRANCH_TITLES: Record<TreeBranch, string> = { barricade: 'Murs', turret: 'Tourelles · niveau 4', tech: 'Technologie' }

/** Valeur de base et unité de chaque statistique du joueur, pour afficher « actuel → prochain rang ». */
const BASE_VALUES: Record<PerkId, { base: number; unit: string; digits: number }> = {
  speed: { base: PLAYER.speed, unit: 'px/s', digits: 0 },
  fireRate: { base: PLAYER.fireRate, unit: 'tirs/s', digits: 1 },
  range: { base: PLAYER.range, unit: 'px', digits: 0 },
  damage: { base: PLAYER.damage, unit: '', digits: 1 },
  bulletSpeed: { base: PLAYER.bulletSpeed, unit: 'px/s', digits: 0 }
}

function Node({ def }: { def: UnlockDef }): React.JSX.Element {
  const progress = useStore((s) => s.progress)
  const buy = useStore((s) => s.buyUnlock)
  const owned = progress.unlocked.includes(def.id)
  const blockedBy = def.requires && !progress.unlocked.includes(def.requires) ? UNLOCK_BY_ID[def.requires] : null
  const missing = def.cost - progress.points
  const d = DETAILS[def.id]
  const state = owned ? 'owned' : blockedBy ? 'blocked' : missing > 0 ? 'poor' : 'ready'

  return (
    <div className={`snode ${state}`} style={{ '--nc': d.color } as CSSProperties}>
      <div className="sglyph">{d.glyph}</div>
      <div className="sname">{def.name}</div>
      <p className="sblurb">{def.blurb}</p>
      <ul className="sdetails">
        {d.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {owned ? (
        <div className="sstatus">✔ Débloqué</div>
      ) : blockedBy ? (
        <div className="sstatus lock">🔒 Requiert : {blockedBy.name}</div>
      ) : (
        <button className={missing > 0 ? '' : 'primary'} disabled={missing > 0} onClick={() => buy(def.id)}>
          Débloquer · {def.cost}
          {missing > 0 ? ` (il manque ${missing})` : ''}
        </button>
      )}
    </div>
  )
}

/** Un niveau de l'arbre : une ou plusieurs compétences côte à côte, reliées au niveau précédent. */
function Tier({ nodes, first }: { nodes: UnlockDef[]; first: boolean }): React.JSX.Element {
  return (
    <>
      {!first && <div className="slink" />}
      <div className="stier">
        {nodes.map((n) => (
          <Node key={n.id} def={n} />
        ))}
      </div>
    </>
  )
}

/** Une amélioration du joueur : plusieurs rangs, chacun plus cher que le précédent. */
function Perk({ def, index }: { def: PerkDef; index: number }): React.JSX.Element {
  const points = useStore((s) => s.progress.points)
  const rank = useStore((s) => s.progress.perks[index] ?? 0)
  const buy = useStore((s) => s.buyPerk)
  const max = def.costs.length
  const maxed = rank >= max
  const cost = maxed ? 0 : def.costs[rank]
  const missing = cost - points
  const v = BASE_VALUES[def.id]
  const fmt = (n: number): string => n.toFixed(v.digits)
  const perks = (r: number): number[] => PERKS.map((_, i) => (i === index ? r : 0))
  const current = v.base * perkMult(perks(rank), def.id)
  const next = v.base * perkMult(perks(rank + 1), def.id)
  const unit = v.unit ? ` ${v.unit}` : ''

  return (
    <div className={`perk ${maxed ? 'owned' : missing > 0 ? 'poor' : 'ready'}`}>
      <div className="sname">{def.name}</div>
      <div className="pips" aria-label={`Rang ${rank} sur ${max}`}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < rank ? 'on' : ''} />
        ))}
      </div>
      <p className="sblurb">{def.blurb}</p>
      <div className="sdetails">
        {maxed ? (
          <>
            {fmt(current)}
            {unit} (+{Math.round(def.perRank * max * 100)} %)
          </>
        ) : (
          <>
            {fmt(current)} → <b>{fmt(next)}</b>
            {unit}
          </>
        )}
      </div>
      {maxed ? (
        <div className="sstatus">✔ Rang max</div>
      ) : (
        <button className={missing > 0 ? '' : 'primary'} disabled={missing > 0} onClick={() => buy(def.id)}>
          Rang {rank + 1} · {cost}
          {missing > 0 ? ` (manque ${missing})` : ''}
        </button>
      )}
    </div>
  )
}

export function SkillTree(): React.JSX.Element {
  const points = useStore((s) => s.progress.points)
  const owned = useStore((s) => s.progress.unlocked.length)
  const close = useStore((s) => s.closeSkills)
  const devAdd = useStore((s) => s.devAddPoints)
  const branches: TreeBranch[] = ['barricade', 'turret', 'tech']

  return (
    <div className="screen skills">
      <div className="panel wide">
        <div className="skills-head">
          <h2>Compétences</h2>
          <div className="chip gold">
            <span className="coin" />
            <b>{points}</b>
            <span className="muted">points</span>
          </div>
        </div>
        <p className="hint">
          Les points se gagnent à la fin de chaque partie (vague atteinte, monstres abattus : les gros rapportent plus). {owned}/{UNLOCKS.length}{' '}
          compétences débloquées.
        </p>

        <div className="sbranches">
          {branches.map((b) => {
            const defs = UNLOCKS.filter((u) => u.branch === b)
            const tiers = [...new Set(defs.map((u) => u.tier))].sort((x, y) => x - y)
            return (
              <div key={b} className={`sbranch b-${b}`}>
                <h3>{BRANCH_TITLES[b]}</h3>
                {tiers.map((t, i) => (
                  <Tier key={t} nodes={defs.filter((u) => u.tier === t)} first={i === 0} />
                ))}
              </div>
            )
          })}
        </div>

        <h3 className="sperks-title">Soldat · améliorer le joueur</h3>
        <div className="sperks">
          {PERKS.map((p, i) => (
            <Perk key={p.id} def={p} index={i} />
          ))}
        </div>

        <div className="footer">
          {import.meta.env.DEV ? (
            <button className="link" onClick={() => devAdd(500)}>
              +500 points (dev)
            </button>
          ) : (
            <span />
          )}
          <button onClick={close}>Retour</button>
        </div>
      </div>
    </div>
  )
}
