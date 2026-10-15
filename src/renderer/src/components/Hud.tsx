import type { CSSProperties } from 'react'
import { DEFAULT_COLORS } from '../game/appearance'
import { BUILD_ORDER, BUILDS } from '../game/constants'
import { CONTROLS, SKIP_WAVE } from '../game/controls'
import { useStore } from '../store'
import { useKeyLabels } from '../useKeyLabels'

const GLYPHS = { barricade: '▤', turret: '◉', spikes: '▲' } as const

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
        <div className="chip gold">
          <span className="coin" />
          <b>{hud.gold}</b>
          <span className="muted">or</span>
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
            <BuildBar key={i} index={i} keyIndex={i} selected={hud.selected[i] ?? 0} gold={hud.gold} color={hud.colors[i] ?? DEFAULT_COLORS[i]} />
          ))
        ) : (
          <BuildBar index={myIndex} keyIndex={0} selected={hud.selected[myIndex] ?? 0} gold={hud.gold} color={hud.colors[myIndex] ?? DEFAULT_COLORS[myIndex]} />
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
  color
}: {
  index: number
  keyIndex: number
  selected: number
  gold: number
  color: string
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
      <div className="keys">
        <kbd>{label(c.prev)}</kbd>
        <kbd>{label(c.next)}</kbd> objet · <kbd>{label(c.place)}</kbd> construire / réparer · <kbd>{label(c.upgrade)}</kbd>{' '}
        améliorer · <kbd>{label(c.remove)}</kbd> démolir
      </div>
    </div>
  )
}
