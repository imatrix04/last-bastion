import { useState, type MouseEvent } from 'react'
import { gameBridge } from '../game/gameBridge'
import { fortressTier } from '../game/fortress'
import { useStore } from '../store'

const STYLES = ['bois', 'pierre', 'pierre renforcée']

/** Menu de développement (`npm run dev` seulement) : saute de vague en vague, lance ou termine la vague. */
export function DevMenu(): React.JSX.Element | null {
  const hud = useStore((s) => s.hud)
  const mode = useStore((s) => s.mode)
  const [open, setOpen] = useState(true)
  if (mode === 'client') return null

  // Pas de focus sur les boutons : la barre d'espace ou Entrée ne doit pas les déclencher en jouant.
  const noFocus = (e: MouseEvent): void => e.preventDefault()
  const jump = (wave: number): void => gameBridge.current?.dev('jump', Math.max(0, wave))
  const go = (label: string, wave: number): React.JSX.Element => (
    <button key={label} onMouseDown={noFocus} onClick={() => jump(wave)}>
      {label}
    </button>
  )

  return (
    <div className="devmenu" onMouseDown={noFocus}>
      <div className="title">
        <span>DEV</span>
        <button onClick={() => setOpen(!open)}>{open ? '–' : '+'}</button>
      </div>
      {open && (
        <>
          <div>
            Vague {hud.wave} · {hud.phase === 'prep' ? 'préparation' : 'combat'} · forteresse en {STYLES[fortressTier(hud.wave)]}
          </div>
          <div className="row">
            {[-10, -5, -1, 1, 5, 10].map((d) => go(d > 0 ? `+${d}` : `${d}`, hud.wave + d))}
          </div>
          <div className="row">
            {[1, 10, 11, 20, 21, 30].map((w) => go(`→ ${w}`, w))}
          </div>
          <div className="row">
            <button onClick={() => gameBridge.current?.dev('launch')}>Lancer la vague</button>
            <button onClick={() => gameBridge.current?.dev('clear')}>Terminer la vague</button>
          </div>
        </>
      )}
    </div>
  )
}
