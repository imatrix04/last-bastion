import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEFAULT_COLORS } from '../game/config/appearance'
import { BUILD_ORDER, BUILDS } from '../game/config/constants'
import { CONTROLS, SKIP_WAVE } from '../game/config/controls'
import type { AbilityHud } from '../game/types'
import { PERK_ICONS } from './icons'
import { useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'

const ABILITY_NAMES = { fireBullets: 'Balles enflammées' } as const
const GLYPHS = { barricade: '▤', turret: '◉', spikes: '▲' } as const

/** Or affiché : le nombre glisse vers sa nouvelle valeur, la pièce brille à chaque gain, un « +N » s'envole (rouge « −N » à la dépense). */
function GoldChip({ gold, tag, color }: { gold: number; tag?: string; color?: string }): React.JSX.Element {
  const [shown, setShown] = useState(gold)
  const [pops, setPops] = useState<{ id: number; amount: number }[]>([])
  const [flash, setFlash] = useState<'gain' | 'spend' | ''>('')
  const prev = useRef(gold)
  const shownRef = useRef(gold)
  const nextId = useRef(0)

  useEffect(() => {
    const delta = Math.floor(gold) - Math.floor(prev.current)
    prev.current = gold
    if (delta === 0) return
    // Les petits gains continus (mode dev) ne créent pas un « +N » à chaque mise à jour.
    if (Math.abs(delta) >= 3) {
      const id = nextId.current++
      setPops((p) => [...p.slice(-4), { id, amount: delta }])
      window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900)
    }
    setFlash(delta > 0 ? 'gain' : 'spend')
    const t = window.setTimeout(() => setFlash(''), 260)
    return () => window.clearTimeout(t)
  }, [gold])

  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      const diff = gold - shownRef.current
      shownRef.current = Math.abs(diff) < 0.6 ? gold : shownRef.current + diff * 0.2
      setShown(shownRef.current)
      if (shownRef.current !== gold) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gold])

  return (
    <div className={`chip gold${flash ? ` ${flash}` : ''}${tag ? ' tagged' : ''}`} style={color ? ({ '--pc': color } as CSSProperties) : undefined}>
      {tag && <span className="gold-tag">{tag}</span>}
      <span className="coin" />
      <b>{Math.round(shown)}</b>
      <span className="muted">or</span>
      {pops.map((p) => (
        <span key={p.id} className={`gold-pop ${p.amount > 0 ? 'up' : 'down'}`}>
          {p.amount > 0 ? '+' : '−'}
          {Math.abs(p.amount)}
        </span>
      ))}
    </div>
  )
}

export function Hud(): React.JSX.Element {
  const hud = useStore((s) => s.hud)
  const playerCount = useStore((s) => s.playerCount)
  const mode = useStore((s) => s.mode)
  const peerOnline = useStore((s) => s.peerOnline)
  const label = useKeyLabels()

  const ratio = hud.baseMax > 0 ? hud.baseHp / hud.baseMax : 0
  const barColor = ratio > 0.5 ? '#66bb6a' : ratio > 0.25 ? '#ffa726' : '#ef5350'
  // En ligne, chacun joue avec les touches du joueur 1 ; l'hôte est le joueur 1, l'invité le joueur 2.
  const myIndex = mode === 'client' ? 1 : 0

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          {Array.from({ length: playerCount }, (_, i) => (
            <GoldChip
              key={i}
              gold={hud.golds[i] ?? 0}
              tag={playerCount > 1 ? `J${i + 1}` : undefined}
              color={playerCount > 1 ? (hud.colors[i] ?? DEFAULT_COLORS[i]) : undefined}
            />
          ))}
          <div className="chip kills">
            <span className="skull" aria-hidden>
              ☠
            </span>
            <b>{hud.kills}</b>
            <span className="muted">monstres tués</span>
          </div>
          {hud.dev && <div className="chip dev">MODE DEV · or rapide (F9 pour couper)</div>}
        </div>

        <div className="chip wave">
          {hud.phase === 'prep' ? (
            <>
              Vague <b>{hud.wave + 1}</b> dans <b>{hud.countdown}s</b>
              <span className="muted">
                <kbd>{label(SKIP_WAVE)}</kbd> pour lancer
              </span>
            </>
          ) : (
            <>
              Vague <b>{hud.wave}</b>
              <span className="muted">{hud.enemies} ennemis</span>
            </>
          )}
        </div>

        <div className="chip base">
          <span className="muted">Forteresse</span>
          <div className="bar">
            <div className="fill" style={{ width: `${ratio * 100}%`, background: barColor }} />
          </div>
          <b>{hud.baseHp}</b>
        </div>
      </div>

      {mode === 'host' && (
        <div className={`chip net-status ${peerOnline ? 'on' : 'off'}`}>
          {peerOnline ? `Joueur 2 connecté${hud.ping > 0 ? ` · ${hud.ping} ms` : ''}` : 'Joueur 2 déconnecté : il peut se reconnecter'}
        </div>
      )}
      {mode === 'client' && hud.ping > 0 && <div className={`chip net-status ${hud.ping < 120 ? 'on' : 'off'}`}>Latence {hud.ping} ms</div>}

      <div className="hud-bottom">
        {mode === 'local' ? (
          Array.from({ length: playerCount }, (_, i) => (
            <BuildBar key={i} index={i} keyIndex={i} selected={hud.selected[i] ?? 0} gold={hud.golds[i] ?? 0} color={hud.colors[i] ?? DEFAULT_COLORS[i]} abilities={hud.abilities[i] ?? []} />
          ))
        ) : (
          <BuildBar index={myIndex} keyIndex={0} selected={hud.selected[myIndex] ?? 0} gold={hud.golds[myIndex] ?? 0} color={hud.colors[myIndex] ?? DEFAULT_COLORS[myIndex]} abilities={hud.abilities[myIndex] ?? []} />
        )}
      </div>
    </div>
  )
}

/** `index` : quel joueur (couleur, sélection) · `keyIndex` : quelles touches afficher. */
function BuildBar({
  index,
  keyIndex,
  selected,
  gold,
  color,
  abilities
}: {
  index: number
  keyIndex: number
  selected: number
  gold: number
  color: string
  abilities: AbilityHud[]
}): React.JSX.Element {
  const label = useKeyLabels()
  const c = CONTROLS[keyIndex]

  return (
    <div className="buildbar" style={{ '--pc': color } as CSSProperties}>
      <div className="who">J{index + 1}</div>
      <div className="slots">
        {BUILD_ORDER.map((kind, i) => {
          const def = BUILDS[kind]
          const cls = ['slot', i === selected ? 'on' : '', gold < def.cost ? 'poor' : ''].join(' ')
          return (
            <div key={kind} className={cls}>
              <span className="num">{i + 1}</span>
              <span className={`glyph ${kind}`}>{GLYPHS[kind]}</span>
              <span className="name">{def.name}</span>
              <span className="cost">{def.cost}</span>
            </div>
          )
        })}
      </div>
      {abilities.length > 0 && (
        <div className="abilities">
          {abilities.map((a, i) => {
            const Icon = PERK_ICONS[a.id]
            const active = a.on > 0
            const ready = !active && a.cd <= 0
            // Pendant l'effet la jauge se vide (durée restante) ; ensuite elle se remplit jusqu'à la recharge complète.
            const fill = active ? a.on / a.onMax : a.cdMax > 0 ? 1 - a.cd / a.cdMax : 1
            return (
              <div key={a.id} className={`ability${active ? ' active' : ready ? ' ready' : ''}`} title={ABILITY_NAMES[a.id]}>
                <span className="num">
                  <kbd>{label(c.abilities[i])}</kbd>
                </span>
                <Icon className="ability-ico" />
                <span className="ability-bar">
                  <i style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
                </span>
                <span className="ability-time">{active ? `${Math.ceil(a.on)} s` : ready ? 'Prête' : `${Math.ceil(a.cd)} s`}</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="keys">
        <kbd>{label(c.prev)}</kbd>
        <kbd>{label(c.next)}</kbd> objet · <kbd>{label(c.place)}</kbd> construire / réparer · <kbd>{label(c.upgrade)}</kbd>{' '}
        améliorer · <kbd>{label(c.remove)}</kbd> démolir · <kbd>{label(c.target)}</kbd> cible tourelle
      </div>
    </div>
  )
}
