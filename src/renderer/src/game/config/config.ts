/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ÉQUILIBRAGE : tous les chiffres modifiables du jeu sont ici.            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Sommaire
 *   1. Partie            or de départ, compte à rebours, forteresse, carte
 *   2. Joueur            statistiques de base, visée
 *   3. Vagues            composition, difficulté, entrées, récompenses
 *   4. Ennemis           PV, vitesse, dégâts, récompense
 *   5. Constructions     murs, pieux, tourelle (prix de pose)
 *   6. Tourelles         niveaux 1 à 10, branches, évolutions
 *   7. Technologies      Overclocking, toile d'araignée
 *   8. Compétences       prix de l'arbre de compétences et des améliorations du joueur
 *   9. Points de fin de partie
 *  10. Mode développeur
 *  11. Biomes           décor de la carte, qui change toutes les 5 vagues
 *
 * Ce fichier ne contient que des données (aucune logique) : le reste du code les lit.
 * Les noms, descriptions et textes affichés restent dans les fichiers d'origine
 * (progress.ts pour l'arbre de compétences, constants.ts pour les noms d'ennemis...).
 */
import type { EnemyDef, EnemyKind, SpikeLevel, WallTier } from './constants'
import type { TurretBranchDef, TurretLevel } from './turrets'

// ───────────────────────────────────────────────────────────── 1. PARTIE

/** Carte : grille de COLS × ROWS cases de TILE px (32 × 18 × 40 = 1280 × 720). Ne change pas l'équilibrage, mais la taille du monde. */
export const WORLD = { tile: 40, cols: 32, rows: 18 }

/** La forteresse à défendre (3 × 3 cases, au centre de la carte). */
export const BASE_CONFIG = { col: 15, row: 7, cols: 3, rows: 3, maxHp: 1200 }

export const GAME = {
  /** Or au début d'une partie. */
  startGold: 120,
  /** Secondes avant la première vague. */
  firstPrep: 30,
  /** Secondes entre deux vagues. */
  prepTime: 20,
  /** Secondes entre deux constructions quand on maintient la touche. */
  buildRepeat: 0.14,
  /** Distance (en cases) à laquelle un joueur en ligne peut choisir la branche d'une tourelle. */
  pickReach: 3,
  /**
   * Réparation : chaque réparation rend `fraction` des PV max du bâtiment (0,5 = 50 %), pour le même prix proportionnel,
   * puis la case est en recharge `cooldown` secondes (on ne peut pas répéter la même case en boucle).
   */
  repair: { fraction: 0.5, cooldown: 3 }
}

// ───────────────────────────────────────────────────────────── 2. JOUEUR

/** Statistiques de base du soldat (avant les améliorations de l'arbre de compétences). */
export const PLAYER_CONFIG = {
  radius: 13,
  /** px/s */
  speed: 150,
  /** Tirs par seconde. */
  fireRate: 2.5,
  damage: 12,
  /** px */
  range: 250,
  /** px/s */
  bulletSpeed: 620
}

export const PLAYER_AIM = {
  /** Dispersion des tirs sans amélioration « Précision » (radians, total : ±moitié). */
  spread: 0.08,
  /** Part de dispersion retirée par la Précision au rang maximum (0,5 = −50 %). */
  spreadReductionAtMax: 0.5
}

export const PLAYER_COLORS = ['#4fc3f7', '#f06292']

// ───────────────────────────────────────────────────────────── 3. VAGUES

export const WAVES = {
  /** Multiplicateur du nombre de monstres à deux joueurs. */
  twoPlayerMult: 1.6,
  /** Rôdeurs : base + vague × perWave. */
  grunts: { base: 5, perWave: 2.4 },
  /** Autres monstres : apparaissent à partir de `from`, `base` au début puis `perWave` de plus par vague. */
  runners: { from: 3, base: 1, perWave: 1.7 },
  splitters: { from: 6, base: 1, perWave: 1.5 },
  brutes: { from: 8, base: 1, perWave: 0.8 },
  spiders: { from: 11, base: 1, perWave: 0.7 },
  /** Un Colosse toutes les `every` vagues, et `vague / per` Colosses (arrondi au-dessus). */
  boss: { every: 5, per: 10 },
  /** PV des monstres : ×(1 + (vague − 1) × hpGrowth). */
  hpGrowth: 0.1,
  /** Intervalle d'apparition PAR ENTRÉE : max(min, base − vague × perWave) secondes. */
  spawn: { base: 1.0, perWave: 0.05, min: 0.1 },
  /** Nombre d'entrées selon la vague : { jusqu'à la vague (incluse), nombre d'entrées }. Au-delà : `maxGates`. */
  gates: [
    { upToWave: 2, count: 1 },
    { upToWave: 5, count: 2 },
    { upToWave: 8, count: 3 },
    { upToWave: 12, count: 4 },
    { upToWave: 15, count: 6 }
  ],
  maxGates: 8,
  /** Fin de vague : or = goldBase + vague × goldPerWave ; la forteresse récupère `baseHeal` de ses PV max. */
  reward: { goldBase: 30, goldPerWave: 12, baseHeal: 0.08 },
  /** Lancer la vague avant la fin du compte à rebours : or par seconde restante. */
  skipBonusPerSecond: 2
}

// ───────────────────────────────────────────────────────────── 4. ENNEMIS

/** hp : PV (avant la hausse par vague) · speed : px/s · damage : par coup · interval : secondes entre deux coups · reward : or. */
export const ENEMY_STATS: Record<EnemyKind, EnemyDef> = {
  grunt: { name: 'Rôdeur', hp: 50, speed: 62, radius: 11, damage: 10, interval: 0.9, reward: 8, color: '#8bc34a' },
  runner: { name: 'Coureur', hp: 35, speed: 115, radius: 9, damage: 8, interval: 0.7, reward: 10, color: '#ffb74d' },
  brute: { name: 'Brute', hp: 370, speed: 40, radius: 15, damage: 38, interval: 1.3, reward: 36, color: '#ba68c8' },
  splitter: { name: 'Éclateur', hp: 230, speed: 46, radius: 14, damage: 25, interval: 1.2, reward: 16, color: '#26c6a2' },
  spider: { name: 'Araignée', hp: 190, speed: 72, radius: 15, damage: 14, interval: 0.9, reward: 24, color: '#9c2a4a' },
  boss: { name: 'Colosse', hp: 1300, speed: 32, radius: 18, damage: 90, interval: 1.6, reward: 220, color: '#e53935' }
}

// ───────────────────────────────────────────────────────────── 5. CONSTRUCTIONS

/** Mur en bois (niveau 1 de la barricade). */
export const WALL_BASE = { cost: 15, hp: 150, breakCost: 5 }

/** Niveaux de mur à partir du niveau 2 (débloqués par l'arbre de compétences). cost : prix pour atteindre ce niveau. */
export const WALL_TIERS: readonly WallTier[] = [
  { name: 'Mur en pierre', cost: 45, hp: 320, breakCost: 14, unlock: 'stone', debris: '#a9afbd' },
  { name: 'Mur en bronze', cost: 60, hp: 600, breakCost: 19, unlock: 'bronze', debris: '#c47a3a' },
  { name: 'Mur en pierre renforcé', cost: 80, hp: 910, breakCost: 26, unlock: 'reinforced', debris: '#cfd8dc' }
]

/** Pieux. dps : dégâts/s aux ennemis dessus · wearPerSec : usure · slow : multiplicateur de vitesse (0,65 = −35 %). */
export const SPIKE_TIERS: readonly SpikeLevel[] = [
  { name: 'Pieux en bois', cost: 45, hp: 220, dps: 30, wearPerSec: 14, slow: 0.65, debris: '#b08a55' },
  { name: 'Pieux en pierre', cost: 60, hp: 380, dps: 44, wearPerSec: 12, slow: 0.55, unlock: 'spikeStone', debris: '#a9afbd' },
  { name: 'Pieux en pierre renforcé', cost: 90, hp: 550, dps: 62, wearPerSec: 9, slow: 0.45, unlock: 'spikeReinforced', debris: '#cfd8dc' }
]

// ───────────────────────────────────────────────────────────── 6. TOURELLES
//
//   niveaux 1 → 3   communs à toutes les tourelles
//   niveau 4        choix d'une branche : double canons ou canon lourd
//   niveaux 5 → 7   la branche évolue
//   niveaux 8 → 10  évolution (compétence à débloquer) : Minigun / Canon explosif
//
// cost : prix pour atteindre ce niveau depuis le précédent (niveau 1 : prix de pose).
// Stats : damage (par tir) · fireRate (tirs/s) · range (px) · hp · bulletSpeed (px/s) · splash (rayon d'explosion en px, optionnel).

export const TURRET_COSTS = {
  /** Prix de pose (niveau 1). */
  place: 120,
  /** Coût de franchissement pour les ennemis (ils cassent ce qui bloque). */
  breakCost: 12
}

/** Premier niveau d'évolution (Minigun / Canon explosif) : il demande une compétence de plus. */
export const TURRET_EVOLVE_AT = 8

/** Tourelles posables par joueur : `base`, plus `perRank` par rang de l'amélioration « Tourelles » (arbre de compétences). */
export const TURRET_LIMIT = { base: 3, perRank: 1 }

/** Niveaux 1 à 3. */
export const TURRET_LEVELS_PLAIN: readonly TurretLevel[] = [
  { cost: TURRET_COSTS.place, stats: { damage: 13, fireRate: 2.2, range: 220, hp: 180, bulletSpeed: 560 } },
  { cost: 150, stats: { damage: 19, fireRate: 2.2, range: 220, hp: 250, bulletSpeed: 560 } },
  { cost: 250, stats: { damage: 26, fireRate: 2.4, range: 220, hp: 350, bulletSpeed: 560 } }
]

/** Branches : name / blurb / accent (texte et couleur) + `levels` = niveaux 4 à 10. */
export const TURRET_BRANCH_CONFIG: Record<1 | 2, TurretBranchDef> = {
  1: {
    name: 'Double canons',
    blurb: 'Deux canons en alternance : la cadence explose à chaque niveau.',
    accent: '#4dd0e1',
    levels: [
      // Niveaux 4 à 7 : double canons
      { cost: 370, stats: { damage: 26, fireRate: 4.8, range: 220, hp: 410, bulletSpeed: 560 } },
      { cost: 480, stats: { damage: 30, fireRate: 5.4, range: 230, hp: 480, bulletSpeed: 580 } },
      { cost: 600, stats: { damage: 36, fireRate: 6.0, range: 240, hp: 560, bulletSpeed: 590 } },
      { cost: 780, stats: { damage: 44, fireRate: 7.0, range: 250, hp: 660, bulletSpeed: 600 } },
      // Niveaux 8 à 10 : Minigun
      { cost: 1100, stats: { damage: 55, fireRate: 12, range: 255, hp: 780, bulletSpeed: 640 } },
      { cost: 1500, stats: { damage: 62, fireRate: 14, range: 262, hp: 890, bulletSpeed: 650 } },
      { cost: 1900, stats: { damage: 75, fireRate: 16, range: 270, hp: 1020, bulletSpeed: 660 } }
    ]
  },
  2: {
    name: 'Canon lourd',
    blurb: 'Un obus massif : des dégâts énormes, de plus en plus loin.',
    accent: '#ff9800',
    levels: [
      // Niveaux 4 à 7 : canon lourd
      { cost: 420, stats: { damage: 78, fireRate: 2.4, range: 250, hp: 460, bulletSpeed: 640 } },
      { cost: 540, stats: { damage: 92, fireRate: 2.4, range: 262, hp: 540, bulletSpeed: 660 } },
      { cost: 680, stats: { damage: 112, fireRate: 2.5, range: 275, hp: 630, bulletSpeed: 680 } },
      { cost: 850, stats: { damage: 136, fireRate: 2.6, range: 290, hp: 760, bulletSpeed: 700 } },
      // Niveaux 8 à 10 : Canon explosif (l'obus explose à l'impact et touche tout autour)
      { cost: 1200, stats: { damage: 175, fireRate: 2.8, range: 295, hp: 880, bulletSpeed: 550, splash: 70 } },
      { cost: 1700, stats: { damage: 204, fireRate: 2.8, range: 300, hp: 1050, bulletSpeed: 600, splash: 82 } },
      { cost: 2300, stats: { damage: 247, fireRate: 3.5, range: 310, hp: 1250, bulletSpeed: 650, splash: 95 } }
    ]
  }
}

/** Explosion du Canon explosif : dégâts au bord de la zone, en fraction des dégâts au centre (0,5 = 50 %). */
export const EXPLOSION = { edgeDamage: 0.5 }

/** Minigun : écart aléatoire de chaque balle (radians). */
export const MINIGUN = { spread: 0.1 }

// ───────────────────────────────────────────────────────────── 7. TECHNOLOGIES

/** Overclocking : multiplicateur de cadence de tir de TOUTES les tourelles, selon le rang (1 à 5). */
export const OVERCLOCK_LEVELS: readonly number[] = [1.2, 1.4, 1.6, 1.8, 2]

/** Toile de l'araignée : posée sur une arme de défense, elle réduit sa cadence de tir. */
export const WEB_CONFIG = {
  /** Portée de crachat (px). */
  range: 180,
  /** Secondes entre deux toiles. */
  cooldown: 4.5,
  /** Préparation avant le tir : l'araignée se dresse, le joueur peut réagir. */
  windup: 0.75,
  /** Vol de la toile (s). */
  flight: 0.4,
  /** Durée du ralentissement (s). */
  duration: 5,
  /** Multiplicateur de cadence sous la toile. */
  slow: 0.3
}

// ───────────────────────────────────────────────────────────── 8. COMPÉTENCES

/** Prix (en points de compétence) de chaque déblocage de l'arbre. */
export const UNLOCK_COST = {
  stone: 120,
  bronze: 220,
  reinforced: 350,
  spikeStone: 150,
  spikeReinforced: 320,
  double: 250,
  heavy: 250,
  minigun: 450,
  explosive: 450
}

/**
 * Améliorations du joueur : costs = prix de chaque rang (la longueur = rang maximum) ·
 * perRank = bonus par rang en fraction de la valeur de base (0,1 = +10 %).
 * Précision : perRank = part d'anticipation par rang (0,2 × 5 rangs = 100 %). Overclocking : voir OVERCLOCK_LEVELS.
 */
export const PERK_BALANCE = {
  speed: { costs: [50, 90, 140, 200, 280], perRank: 0.05 },
  fireRate: { costs: [60, 100, 160, 230, 320], perRank: 0.2 },
  range: { costs: [50, 90, 140, 200, 280], perRank: 0.05 },
  damage: { costs: [60, 100, 160, 230, 320], perRank: 0.2 },
  bulletSpeed: { costs: [40, 70, 110, 160, 220], perRank: 0.1 },
  overclock: { costs: [450, 650, 900, 1200, 1600], perRank: 0 },
  precision: { costs: [50, 90, 140, 200, 280], perRank: 0.2 },
 turrets: { costs: [180, 350, 500, 800, 1200], perRank: 0 },
  // Capacité active « Balles enflammées » : le rang 1 la débloque, les suivants l'améliorent (voir ABILITY_CONFIG).
  fireBullets: { costs: [350, 180, 320, 450, 720], perRank: 0 }
}

/** Capacités actives : touches 1 à 3 du joueur, jusqu'à ABILITY_SLOTS équipées par partie. */
export const ABILITY_SLOTS = 3

/**
 * Balles enflammées : pendant `duration` secondes les balles du joueur enflamment les monstres touchés,
 * qui brûlent `burnSeconds` secondes (la brûlure se relance à chaque nouvelle balle, elle ne s'additionne pas).
 * Une ligne par rang (1 à 5) : duration = durée de l'effet (s) · cooldown = recharge depuis l'activation (s) · burnDps = dégâts de brûlure par seconde.
 */
export const ABILITY_CONFIG = {
  fireBullets: {
    burnSeconds: 3,
    ranks: [
      { duration: 10, cooldown: 45, burnDps: 12 },
      { duration: 11, cooldown: 42, burnDps: 14 },
      { duration: 12, cooldown: 38, burnDps: 18 },
      { duration: 13, cooldown: 34, burnDps: 24 },
      { duration: 15, cooldown: 30, burnDps: 32 }
    ]
  }
}

// ───────────────────────────────────────────────────────────── 9. POINTS DE FIN DE PARTIE

/**
 * Points = (Σ monstres tués × valeur + vagues × wavePoints) × (1 + vague × waveBonus).
 * `minion` : petits issus de la division d'un Éclateur.
 */
export const SCORE = {
  killPoints: { grunt: 1, runner: 1, brute: 3, splitter: 3, boss: 15, minion: 0.5, spider: 4 },
  /** Points par vague atteinte. */
  wavePoints: 10,
  /** Chaque vague atteinte augmente le total de 10 % : tenir longtemps est récompensé. */
  waveBonus: 0.1
}

// ───────────────────────────────────────────────────────────── 10. MODE DÉVELOPPEUR

/** Actif seulement avec `npm run dev` (touche F9, voir controls.ts). */
export const DEV_CONFIG = {
  /** Or gagné par seconde. */
  goldPerSecond: 150,
  /** Multiplicateur des récompenses de monstres. */
  rewardMult: 10
}

// ───────────────────────────────────────────────────────────── 11. BIOMES

/** Décor de fond propre à un biome (voir render.ts). */
export type BiomeDecor = 'meadow' | 'forest' | 'desert' | 'volcano' | 'void'

export interface BiomeDef {
  name: string
  /** Phrase affichée à l'arrivée dans le biome. */
  tagline: string
  /** Couleur de l'annonce. */
  accent: string
  /** Deux teintes du damier. */
  tileA: string
  tileB: string
  /** Grandes taches claires / sombres qui cassent le damier. */
  patchLight: string
  patchDark: string
  /** Petits traits et cailloux. */
  speckA: string
  speckB: string
  pebbleA: string
  pebbleB: string
  /** Couloirs d'apparition sur les bords. */
  edge: string
  /** Assombrissement des coins (0 à 1) : plus le biome est dur, plus la carte se referme. */
  vignette: number
  /** Voile de couleur posé sur toute la scène ('' = aucun). */
  tint: string
  decor: BiomeDecor
  /** Particules d'ambiance : count · speed (px/s, vers le haut si rise) · size (px) · drift (dérive latérale en px). */
  ambient: { color: string; count: number; speed: number; size: number; drift: number; rise: boolean }
}

/**
 * Le biome change toutes les `every` vagues (vagues 1 à 5 : le premier, 6 à 10 : le deuxième...).
 * Après le dernier, la carte reste dans le dernier biome. Passage d'un biome à l'autre : fondu de `fadeSeconds`.
 * Visuel seulement : la difficulté vient de WAVES ; le décor se durcit pour la montrer.
 */
export const BIOMES: { every: number; fadeSeconds: number; list: readonly BiomeDef[] } = {
  every: 5,
  fadeSeconds: 2.5,
  list: [
    {
      name: 'Plaine',
      tagline: 'Le calme avant la tempête',
      accent: '#a5d6a7',
      tileA: '#1f3324',
      tileB: '#1c2f21',
      patchLight: 'rgba(60, 100, 60, 0.07)',
      patchDark: 'rgba(8, 20, 12, 0.1)',
      speckA: '#27412b',
      speckB: '#162419',
      pebbleA: 'rgba(160, 170, 160, 0.16)',
      pebbleB: 'rgba(110, 120, 110, 0.14)',
      edge: 'rgba(70, 40, 30, 0.45)',
      vignette: 0.45,
      tint: '',
      decor: 'meadow',
      ambient: { color: '#fff59d', count: 14, speed: 6, size: 1.4, drift: 10, rise: false }
    },
    {
      name: 'Forêt maudite',
      tagline: 'Les arbres se referment, les monstres se multiplient',
      accent: '#9ccc65',
      tileA: '#16261d',
      tileB: '#13211a',
      patchLight: 'rgba(40, 90, 70, 0.08)',
      patchDark: 'rgba(2, 10, 8, 0.18)',
      speckA: '#1d3a2c',
      speckB: '#0c1812',
      pebbleA: 'rgba(120, 150, 130, 0.14)',
      pebbleB: 'rgba(70, 100, 85, 0.14)',
      edge: 'rgba(40, 30, 35, 0.5)',
      vignette: 0.55,
      tint: 'rgba(10, 30, 40, 0.1)',
      decor: 'forest',
      ambient: { color: '#9ccc65', count: 22, speed: 10, size: 1.7, drift: 18, rise: true }
    },
    {
      name: 'Terres brûlées',
      tagline: 'Le sol craque sous la chaleur : la horde s’épaissit',
      accent: '#ffcc80',
      tileA: '#4a3a22',
      tileB: '#43341f',
      patchLight: 'rgba(190, 150, 80, 0.09)',
      patchDark: 'rgba(30, 18, 6, 0.14)',
      speckA: '#5a4528',
      speckB: '#2e2214',
      pebbleA: 'rgba(215, 195, 155, 0.2)',
      pebbleB: 'rgba(150, 120, 80, 0.18)',
      edge: 'rgba(90, 40, 20, 0.5)',
      vignette: 0.6,
      tint: 'rgba(120, 70, 10, 0.08)',
      decor: 'desert',
      ambient: { color: '#d7b377', count: 28, speed: 4, size: 1.5, drift: 55, rise: false }
    },
    {
      name: 'Cendres du volcan',
      tagline: 'La roche fond : plus aucun répit',
      accent: '#ff8a65',
      tileA: '#2a2524',
      tileB: '#262120',
      patchLight: 'rgba(120, 100, 95, 0.07)',
      patchDark: 'rgba(0, 0, 0, 0.2)',
      speckA: '#3a3230',
      speckB: '#161212',
      pebbleA: 'rgba(160, 140, 130, 0.16)',
      pebbleB: 'rgba(90, 70, 65, 0.16)',
      edge: 'rgba(120, 30, 10, 0.55)',
      vignette: 0.68,
      tint: 'rgba(110, 20, 0, 0.12)',
      decor: 'volcano',
      ambient: { color: '#ff7043', count: 36, speed: 30, size: 1.8, drift: 14, rise: true }
    },
    {
      name: 'Néant',
      tagline: 'Au bord de l’abîme, tout est perdu d’avance',
      accent: '#b388ff',
      tileA: '#1c1530',
      tileB: '#181229',
      patchLight: 'rgba(120, 80, 200, 0.08)',
      patchDark: 'rgba(0, 0, 10, 0.25)',
      speckA: '#2b2050',
      speckB: '#0e0a1c',
      pebbleA: 'rgba(170, 140, 230, 0.16)',
      pebbleB: 'rgba(100, 70, 160, 0.16)',
      edge: 'rgba(120, 30, 90, 0.55)',
      vignette: 0.78,
      tint: 'rgba(60, 0, 90, 0.14)',
      decor: 'void',
      ambient: { color: '#b388ff', count: 40, speed: 14, size: 1.9, drift: 22, rise: true }
    }
  ]
}
