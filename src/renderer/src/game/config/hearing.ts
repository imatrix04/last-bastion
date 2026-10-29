/**
 * Portée des sons : plus une source est loin du joueur, moins on l'entend. Tous les réglages sont ici.
 * Distances en pixels (une case = TILE px).
 */
export const HEARING = {
  /** Jusqu'à cette distance, le son est à plein volume. */
  near: 250,
  /** À partir de cette distance, le son est ramené à `floor`. */
  far: 1400,
  /** Volume minimal (0 à 1) d'un son très lointain : 0 = totalement inaudible, 0.15 = reste faiblement audible. */
  floor: 0.1,
  /** Forme de la baisse entre `near` et `far` : 1 = linéaire, 2 = chute rapide puis douce. */
  curve: 1.6,
  /** Panoramique gauche/droite (0 = sons toujours au centre, 1 = très marqué). */
  pan: 0.6,
  /** Distance (px) de la source, à gauche ou à droite du joueur, à partir de laquelle le panoramique est maximal. */
  panRange: 700,
  /** Multiplicateurs par type de son (1 = inchangé) pour équilibrer ce qui est trop ou pas assez fort. */
  mix: {
    footstep: 1,
    menu: 1,
    creatureStep: 1,
    creatureDie: 1,
    player: 1,
    turret: 1,
    turretMinigun: 1,
    turretHeavy: 1,
    heavyImpact: 1,
    build: 1,
    upgrade: 1,
    repair: 1
  }
} as const
