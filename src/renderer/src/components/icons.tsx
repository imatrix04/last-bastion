import type { SVGProps } from 'react'
import type { PerkId, UnlockId } from '../game/config/progress'

/** Pictogrammes en SVG (24 × 24, couleur = currentColor) : traits francs, pas d'emoji. */

type P = SVGProps<SVGSVGElement>

const base = (p: P): P => ({
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  'aria-hidden': true,
  ...p
})

export const IconStone = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" />
    <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20" />
  </svg>
)

export const IconReinforced = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" />
    <path d="M3 4l18 16M21 4L3 20" />
    <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none" />
  </svg>
)

export const IconBronze = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" />
    <path d="M12 4v16M3 12h18" />
    <circle cx="7.5" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="7.5" cy="16" r="1" fill="currentColor" stroke="none" />
    <circle cx="16.5" cy="16" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSpikes = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M3 20h18M4 20l3-12 3 12M10 20l3-12 3 12M15 20l2.5-9 2.5 9" />
  </svg>
)

export const IconSpikesReinforced = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <rect x="2.5" y="3.5" width="19" height="17" />
    <path d="M5 20l3-11 3 11M11 20l3-11 3 11" />
    <path d="M2.5 20.5h19" />
  </svg>
)

export const IconDouble = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="4.2" />
    <path d="M12.2 11.6l9-4.6M13.6 15.8l8.6-4.4" />
    <path d="M3 21h10" />
  </svg>
)

export const IconHeavy = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="4.2" />
    <path d="M12 10.5l7.5-3.8 2.2 4.4-7.5 3.8z" fill="currentColor" fillOpacity="0.25" />
    <path d="M18.6 5.6l3.6 7M3 21h10" />
  </svg>
)

export const IconMinigun = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <circle cx="7" cy="12" r="3.6" />
    <path d="M11 9h10M11 12h11M11 15h10" />
    <path d="M3 20h8" />
  </svg>
)

export const IconExplosive = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="3.6" />
    <path d="M11.5 12.5l4-4" />
    <path d="M18 3l1.2 3 3 .8-2.6 1.8.2 3.2L17.5 10l-3 1.1.8-3.1L13 5.7l3.2-.2z" fill="currentColor" fillOpacity="0.25" />
    <path d="M3 21h10" />
  </svg>
)

export const IconBolt = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M13.5 2L5 13.5h6L9.5 22 19 9.8h-6.2z" fill="currentColor" fillOpacity="0.2" />
  </svg>
)

export const IconSpeed = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M4 5l7 7-7 7M12 5l7 7-7 7" />
  </svg>
)

export const IconFireRate = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M5 4v16M12 4v16M19 4v16" />
    <path d="M3 8h4M10 11h4M17 8h4M3 15h4M10 18h4M17 15h4" />
  </svg>
)

export const IconRange = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconDamage = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M12 2l2.4 6.3L21 9l-5 4.4L17.4 21 12 17.4 6.6 21 8 13.4 3 9l6.6-.7z" fill="currentColor" fillOpacity="0.2" />
  </svg>
)

export const IconBulletSpeed = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M14 7l7 5-7 5z" fill="currentColor" fillOpacity="0.25" />
    <path d="M3 8h8M2 12h9M3 16h8" />
  </svg>
)

export const IconPrecision = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <circle cx="14" cy="10" r="6" />
    <circle cx="14" cy="10" r="1.6" fill="currentColor" stroke="none" />
    <path d="M2 18h6M4 21h8" />
  </svg>
)

export const IconEars = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M4 19V5l6 5M20 19V5l-6 5" />
    <path d="M4 19c0-3 3-5 8-5s8 2 8 5z" />
  </svg>
)

export const IconBack = (p: P): React.JSX.Element => (
  <svg {...base(p)}>
    <path d="M14 5l-7 7 7 7M7 12h13" />
  </svg>
)

export const UNLOCK_ICONS: Record<UnlockId, (p: P) => React.JSX.Element> = {
  stone: IconStone,
  bronze: IconBronze,
  reinforced: IconReinforced,
  spikeStone: IconSpikes,
  spikeReinforced: IconSpikesReinforced,
  double: IconDouble,
  heavy: IconHeavy,
  minigun: IconMinigun,
  explosive: IconExplosive
}

export const PERK_ICONS: Record<PerkId, (p: P) => React.JSX.Element> = {
  speed: IconSpeed,
  fireRate: IconFireRate,
  range: IconRange,
  damage: IconDamage,
  bulletSpeed: IconBulletSpeed,
  overclock: IconBolt,
  precision: IconPrecision
}
