import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { DEFAULT_COLORS } from '../game/config/appearance'
import { useT } from '../i18n'
import { rich } from '../i18n/rich'
import { BUILD_ORDER, BUILDS } from '../game/config/constants'
import { CONTROLS, FOLD_HUD, SKIP_WAVE } from '../game/config/controls'
import type { AbilityHud } from '../game/types'
import { PERK_ICONS } from './icons'
import { useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'

const ABILITY_NAMES = { fireBullets: 'perk.fireBullets.name' } as const
const GLYPHS = { barricade: '▤', turret: '◉', spikes: '▲' } as const

/** Or affiché : le nombre glisse vers sa nouvelle valeur, la pièce brille à chaque gain, un « +N » s'envole (rouge « −N » à la dépense). */
function GoldChip({ gold, tag, color }: { gold: number; tag?: string; color?: string }): React.JSX.Element {
  const t = useT()
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
    const timer = window.setTimeout(() => setFlash(''), 260)
    return () => window.clearTimeout(timer)
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
      <span className="muted">{t('hud.gold')}</span>
      {pops.map((p) => (
        <span key={p.id} className={`gold-pop ${p.amount > 0 ? 'up' : 'down'}`}>
          {p.amount > 0 ? '+' : '−'}
          {Math.abs(p.amount)}
        </span>
      ))}
    </div>
  )
}

const FOLD_KEY = 'lb.hudFolded'

/** Barre de construction repliée ou non, retenue d'une partie à l'autre ; la touche H la bascule. */
function useFolded(): [boolean, () => void] {
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(FOLD_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggle = (): void =>
    setFolded((f) => {
      try {
        localStorage.setItem(FOLD_KEY, f ? '0' : '1')
      } catch {
        /* stockage indisponible : le repli ne sera pas retenu */
      }
      return !f
    })
  const toggleRef = useRef(toggle)
  toggleRef.current = toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === FOLD_HUD && !e.repeat) toggleRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return [folded, toggle]
}

export function Hud(): React.JSX.Element {
  const t = useT()
  const [folded, toggleFold] = useFolded()
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
              tag={playerCount > 1 ? t('player.short', { n: i + 1 }) : undefined}
              color={playerCount > 1 ? (hud.colors[i] ?? DEFAULT_COLORS[i]) : undefined}
            />
          ))}
          <div className="chip kills">
            <span className="skull" aria-hidden>
              ☠
            </span>
            <b>{hud.kills}</b>
            <span className="muted">{t('hud.kills')}</span>
          </div>
          {hud.dev && <div className="chip dev">{t('hud.dev')}</div>}
        </div>

        <div className="chip wave">
          {hud.phase === 'prep' ? (
            <>
              {rich('hud.waveIn', { wave: <b>{hud.wave + 1}</b>, time: <b>{hud.countdown}s</b> })}
              <span className="muted">{rich('hud.skip', { key: <kbd>{label(SKIP_WAVE)}</kbd> })}</span>
            </>
          ) : (
            <>
              {rich('hud.wave', { wave: <b>{hud.wave}</b> })}
              <span className="muted">{t('hud.enemies', { n: hud.enemies })}</span>
            </>
          )}
        </div>

        <div className="chip base">
          <span className="muted">{t('hud.base')}</span>
          <div className="bar">
            <div className="fill" style={{ width: `${ratio * 100}%`, background: barColor }} />
          </div>
          <b>{hud.baseHp}</b>
        </div>
      </div>

      {mode === 'host' && (
        <div className={`chip net-status ${peerOnline ? 'on' : 'off'}`}>
          {peerOnline ? `${t('hud.p2On')}${hud.ping > 0 ? ` · ${hud.ping} ms` : ''}` : t('hud.p2Off')}
        </div>
      )}
      {mode === 'client' && hud.ping > 0 && <div className={`chip net-status ${hud.ping < 120 ? 'on' : 'off'}`}>{t('hud.latency', { n: hud.ping })}</div>}

      <div className="hud-bottom">
        {mode === 'local' ? (
          Array.from({ length: playerCount }, (_, i) => (
            <BuildBar key={i} index={i} keyIndex={i} selected={hud.selected[i] ?? 0} gold={hud.golds[i] ?? 0} color={hud.colors[i] ?? DEFAULT_COLORS[i]} abilities={hud.abilities[i] ?? []} folded={folded} onFold={toggleFold} />
          ))
        ) : (
          <BuildBar index={myIndex} keyIndex={0} selected={hud.selected[myIndex] ?? 0} gold={hud.golds[myIndex] ?? 0} color={hud.colors[myIndex] ?? DEFAULT_COLORS[myIndex]} abilities={hud.abilities[myIndex] ?? []} folded={folded} onFold={toggleFold} />
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
  abilities,
  folded,
  onFold
}: {
  index: number
  keyIndex: number
  selected: number
  gold: number
  color: string
  abilities: AbilityHud[]
  folded: boolean
  onFold: () => void
}): React.JSX.Element {
  const t = useT()
  const label = useKeyLabels()
  const c = CONTROLS[keyIndex]

  return (
    <div className={`buildbar${folded ? ' folded' : ''}`} style={{ '--pc': color } as CSSProperties}>
      <div className="head">
        <div className="who">{t('player.short', { n: index + 1 })}</div>
        {folded && (
          <span className="current">
            <span className={`glyph ${BUILD_ORDER[selected]}`}>{GLYPHS[BUILD_ORDER[selected]]}</span>
            {t(BUILDS[BUILD_ORDER[selected]].nameKey)}
          </span>
        )}
        <button
          className="fold"
          title={t(folded ? 'hud.unfold' : 'hud.fold')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onFold}
        >
          {folded ? '▲' : '▼'} <kbd>{label(FOLD_HUD)}</kbd>
        </button>
      </div>
      {!folded && <div className="slots">
        {BUILD_ORDER.map((kind, i) => {
          const def = BUILDS[kind]
          const cls = ['slot', i === selected ? 'on' : '', gold < def.cost ? 'poor' : ''].join(' ')
          return (
            <div key={kind} className={cls}>
              <span className="num">{i + 1}</span>
              <span className={`glyph ${kind}`}>{GLYPHS[kind]}</span>
              <span className="name">{t(def.nameKey)}</span>
              <span className="cost">{def.cost}</span>
            </div>
          )
        })}
      </div>}
      {!folded && abilities.length > 0 && (
        <div className="abilities">
          {abilities.map((a, i) => {
            const Icon = PERK_ICONS[a.id]
            const active = a.on > 0
            const ready = !active && a.cd <= 0
            // Pendant l'effet la jauge se vide (durée restante) ; ensuite elle se remplit jusqu'à la recharge complète.
            const fill = active ? a.on / a.onMax : a.cdMax > 0 ? 1 - a.cd / a.cdMax : 1
            return (
              <div key={a.id} className={`ability${active ? ' active' : ready ? ' ready' : ''}`} title={t(ABILITY_NAMES[a.id])}>
                <span className="num">
                  <kbd>{label(c.abilities[i])}</kbd>
                </span>
                <Icon className="ability-ico" />
                <span className="ability-bar">
                  <i style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }} />
                </span>
                <span className="ability-time">{active ? `${Math.ceil(a.on)} s` : ready ? t('hud.ready') : `${Math.ceil(a.cd)} s`}</span>
              </div>
            )
          })}
        </div>
      )}
      {!folded && <div className="keys">
        {rich('hud.keys', {
          prev: <kbd>{label(c.prev)}</kbd>,
          next: <kbd>{label(c.next)}</kbd>,
          place: <kbd>{label(c.place)}</kbd>,
          upgrade: <kbd>{label(c.upgrade)}</kbd>,
          remove: <kbd>{label(c.remove)}</kbd>,
          target: <kbd>{label(c.target)}</kbd>
        })}
      </div>}
    </div>
  )
}
