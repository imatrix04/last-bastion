import { useCallback, useEffect, useState } from 'react'
import { t, useLang } from './i18n'

interface LayoutMap {
  get(code: string): string | undefined
}

interface KeyboardApi {
  getLayoutMap?: () => Promise<LayoutMap>
}

/** Libellés fixes : clé de traduction, ou symbole identique dans toutes les langues. */
const FIXED: Record<string, string> = {
  Space: 'key.space',
  Enter: 'key.enter',
  ShiftRight: 'key.shiftRight',
  Backspace: 'key.backspace',
  Delete: 'key.delete',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'key.escape'
}

/** Libellés de repli quand la disposition du clavier n'est pas disponible. */
const FALLBACK: Record<string, string> = { Comma: ',', Period: '.' }

function labelFor(code: string, map: LayoutMap | null): string {
  if (FIXED[code]) return t(FIXED[code])
  const digit = /^Digit(\d)$/.exec(code)
  if (digit) return digit[1]
  const pad = /^Numpad(\d)$/.exec(code)
  if (pad) return t('key.pad', { n: pad[1] })
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
  const lang = useLang()
  const [map, setMap] = useState<LayoutMap | null>(null)

  useEffect(() => {
    const kb = (navigator as unknown as { keyboard?: KeyboardApi }).keyboard
    kb?.getLayoutMap?.()
      .then(setMap)
      .catch(() => undefined)
  }, [])

  // `lang` : les libellés traduits (Espace, Entrée…) doivent être recalculés quand la langue change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((code: string) => labelFor(code, map), [map, lang])
}
