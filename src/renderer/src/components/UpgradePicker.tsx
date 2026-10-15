import { useEffect, useRef, type CSSProperties } from 'react'
import { DEFAULT_COLORS } from '../game/appearance'
import { TURRET_BRANCHES, TURRET_MAX_LEVEL, TURRET_PLAIN_MAX, type Branch } from '../game/turrets'
import { gameBridge } from '../game/gameBridge'
import { drawTurret } from '../game/sprites'
import { unlockMask } from '../game/progress'
import { TURRET_SPEC_LEVEL, branchUnlocked, turretStats } from '../game/stats'
import type { ChoiceRequest } from '../game/types'
import { useStore } from '../store'

const CHOICES: Array<1 | 2> = [1, 2]

const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/** Petite tourelle animée qui tire en boucle, pour montrer à quoi ressemble la branche. */
function TurretPreview({ branch }: { branch: Branch }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rate = turretStats(TURRET_SPEC_LEVEL, branch).fireRate
    let raf = 0
    const t0 = performance.now()
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame)
      const t = (now - t0) / 1000
      const cycle = t * rate
      const look = {
        level: TURRET_SPEC_LEVEL,
        branch,
        angle: -0.5 + Math.sin(t * 0.9) * 0.5,
        recoil: Math.max(0, 1 - (cycle % 1) * 5),
        side: Math.floor(cycle) % 2 === 0 ? 1 : -1,
        pop: 0
      }
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, 48, 48)
      ctx.fillStyle = 'rgba(31, 51, 36, 0.9)'
      ctx.fillRect(0, 0, 48, 48)
      drawTurret(ctx, 24, 24, look, t)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [branch])

  return <canvas ref={ref} className="pcard-preview" width={96} height={96} />
}

function StatRow({ label, from, to, unit }: { label: string; from: number; to: number; unit?: string }): React.JSX.Element {
  const cls = to > from ? 'up' : to < from ? 'down' : ''
  return (
    <div className="pstat">
      <span>{label}</span>
      <span className={`val ${cls}`}>
        {fmt(from)} → <b>{fmt(to)}</b>
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}

/** Pop-up de choix de la spécialisation (niveau 4) d'une tourelle : deux cartes comparées à la tourelle actuelle, choix à la souris. */
export function UpgradePicker({ request }: { request: ChoiceRequest }): React.JSX.Element {
  const gold = useStore((s) => s.hud.gold)
  const color = useStore((s) => s.hud.colors[request.player]) ?? DEFAULT_COLORS[request.player]
  const unlocked = useStore((s) => s.progress.unlocked)
  const mask = unlockMask(unlocked)
  const close = useStore((s) => s.closeChoice)
  const cur = turretStats(TURRET_PLAIN_MAX, 0)

  const pick = (branch: 1 | 2): void => {
    if (!branchUnlocked(mask, branch) || gold < TURRET_BRANCHES[branch].levels[0].cost) return
    gameBridge.current?.pickBranch(request, branch)
    close()
  }

  // Raccourcis 1 / 2 en plus de la souris
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.repeat) return
      if (e.code === 'Digit1' || e.code === 'Numpad1') pick(1)
      else if (e.code === 'Digit2' || e.code === 'Numpad2') pick(2)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="screen overlay" onClick={close}>
      <div className="picker" onClick={(e) => e.stopPropagation()} style={{ '--pc': color } as CSSProperties}>
        <h2>
          <span className="who">J{request.player + 1}</span> Spécialiser la tourelle · niveau {TURRET_SPEC_LEVEL}
        </h2>
        <p className="hint">
          Clique sur une carte (ou <kbd>1</kbd> / <kbd>2</kbd>) · <kbd>Échap</kbd> pour annuler
        </p>
        <div className="pcards">
          {CHOICES.map((branch, i) => {
            const def = TURRET_BRANCHES[branch]
            const first = def.levels[0]
            const s = first.stats
            const top = def.levels[def.levels.length - 1].stats
            const locked = !branchUnlocked(mask, branch)
            const poor = !locked && gold < first.cost
            return (
              <button key={branch} className={`pcard b${branch}${poor ? ' poor' : ''}${locked ? ' locked' : ''}`} onClick={() => pick(branch)} disabled={poor || locked}>
                <span className="pnum">{i + 1}</span>
                <TurretPreview branch={branch} />
                <span className="pname">{def.name}</span>
                <span className="pblurb">{def.blurb}</span>
                <div className="pstats">
                  <StatRow label="Vitesse" from={cur.fireRate} to={s.fireRate} unit="tirs/s" />
                  <StatRow label="Dégâts" from={cur.damage} to={s.damage} />
                  <StatRow label="PV" from={cur.hp} to={s.hp} />
                  <StatRow label="Portée" from={cur.range} to={s.range} />
                  <StatRow label="Dégâts / s" from={Math.round(cur.damage * cur.fireRate)} to={Math.round(s.damage * s.fireRate)} />
                </div>
                <p className="pfoot">
                  Évolue jusqu’au niveau {TURRET_MAX_LEVEL} : {top.fireRate} tirs/s · {top.damage} dégâts · {top.range} px
                </p>
                {locked ? (
                  <span className="plock">Verrouillé · à débloquer dans Compétences</span>
                ) : (
                  <span className="pcost">{poor ? `${first.cost} or (manque ${first.cost - gold})` : `${first.cost} or`}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
