import { useCallback, useEffect, useState } from 'react'

interface LayoutMap {
  get(code: string): string | undefined
}

interface KeyboardApi {
  getLayoutMap?: () => Promise<LayoutMap>
}

const FIXED: Record<string, string> = {
  Space: 'Espace',
  Enter: 'Entrée',
  ShiftRight: 'Maj droite',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Échap'
}

/** Libellés de repli quand la disposition du clavier n'est pas disponible. */
const FALLBACK: Record<string, string> = { Comma: ',', Period: '.' }

function labelFor(code: string, map: LayoutMap | null): string {
  if (FIXED[code]) return FIXED[code]
  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]
  const pad = /^Numpad(\d)$/.exec(code)
  if (pad) return `Pavé ${pad[1]}`
  const mapped = map?.get(code)
  if (mapped) return mapped.length === 1 ? mapped.toUpperCase() : mapped
  return FALLBACK[code] ?? code.replace(/^Key/, '')
}

/**
 * Les commandes sont liées à la position des touches (`event.code`).
 * Ce hook retrouve le caractère réellement gravé dessus selon la disposition
 * du clavier (AZERTY, QWERTY...) pour afficher les bons labels.
 */
export function useKeyLabels(): (code: string) => string {
  const [map, setMap] = useState<LayoutMap | null>(null)

  useEffect(() => {
    const kb = (navigator as unknown as { keyboard?: KeyboardApi }).keyboard
    kb?.getLayoutMap?.()
      .then(setMap)
      .catch(() => undefined)
  }, [])

  return useCallback((code: string) => labelFor(code, map), [map])
}
