import { sounds } from './fx'
import { HEARING } from './config/hearing'
import { COLS, TILE } from './config/constants'
import turretShot from '../assets/audio/tourelle/tourelle-shoot.wav?url'
import turretMinigunShot from '../assets/audio/tourelle/tourelle-minigun-shoot.wav?url'
import turretHeavyShot from '../assets/audio/tourelle/tourelle-heavy-shoot.wav?url'
import playerShotUrl from '../assets/audio/player/Player-shoot.wav?url'
import upgradeUrl from '../assets/audio/general/Upgrade-game.wav?url'
import repairUrl from '../assets/audio/general/repair-sound.wav?url'
import wallBuilt from '../assets/audio/wall/Wall-create.wav?url'
import turretBuiltUrl from '../assets/audio/tourelle/Turret-create.wav?url'
import spikesBuiltUrl from '../assets/audio/pieux/Pieux-create.wav?url'
import footstepUrl from '../assets/audio/player/Footstep.wav?url'
import footstep2Url from '../assets/audio/player/Footstep-2.wav?url'
import creatureStep1Url from '../assets/audio/creature/footstep/creature-footstep.wav?url'
import creatureStep2Url from '../assets/audio/creature/footstep/creature-footstep-2.wav?url'
import creatureStep3Url from '../assets/audio/creature/footstep/creature-footstep-3.wav?url'
import creatureStep4Url from '../assets/audio/creature/footstep/creature-footstep-4.wav?url'
import creatureDie1Url from '../assets/audio/creature/died/Small_creature_burst.wav?url'
import creatureDie2Url from '../assets/audio/creature/died/Small_creature_burst_2.wav?url'
import creatureDie3Url from '../assets/audio/creature/died/Small_creature_burst_3.wav?url'
import creatureDie4Url from '../assets/audio/creature/died/Small_creature_burst_4.wav?url'
import menuHoverUrl from '../assets/audio/menu/Button_sound_menu.wav?url'
import menuClickUrl from '../assets/audio/menu/Button_sound_click.wav?url'
import heavyExplosion from '../assets/audio/tourelle/tourelle-heavy-explosion.wav?url'

/** Nombre maximal de sons de tir joués en même temps : au-delà, les tirs en trop restent muets. */
const MAX_VOICES = 14

export type Sound = 'repair' | 'upgrade' | 'wallBuilt' | 'player' | 'turret' | 'turretHeavy' | 'turretExplosive' | 'heavyImpact' | 'turretMinigun' | 'turretBuilt' | 'spikesBuilt' | 'footstep' | 'menuHover' | 'menuClick' | 'footstep2' | 'creatureStep1' | 'creatureStep2' | 'creatureStep3' | 'creatureStep4' | 'creatureDie1' | 'creatureDie2' | 'creatureDie3' | 'creatureDie4'

const SOUNDS: Record<Sound, { url: string; volume: number }> = {
  repair: { url: repairUrl, volume: 0.6 },
  upgrade: { url: upgradeUrl, volume: 0.6 },
  wallBuilt: { url: wallBuilt, volume: 0.6 },
  player: { url: playerShotUrl, volume: 0.25 },
  turret: { url: turretShot, volume: 0.2 },
  turretHeavy: { url: turretHeavyShot, volume: 0.5 },
  // Canon explosif : même son que le canon lourd, un peu plus fort
  turretExplosive: { url: turretHeavyShot, volume: 0.7 },
  heavyImpact: { url: heavyExplosion, volume: 0.5 },
  turretMinigun: { url: turretMinigunShot, volume: 0.5 },
  turretBuilt: { url: turretBuiltUrl, volume: 0.6 },
  spikesBuilt: { url: spikesBuiltUrl, volume: 0.6 },
  footstep: { url: footstepUrl, volume: 0.3 },
  footstep2: { url: footstep2Url, volume: 0.3 },
  menuHover: { url: menuHoverUrl, volume: 0.4 },
  menuClick: { url: menuClickUrl, volume: 0.5 },
  creatureStep1: { url: creatureStep1Url, volume: 0.25 },
  creatureStep2: { url: creatureStep2Url, volume: 0.25 },
  creatureStep3: { url: creatureStep3Url, volume: 0.25 },
  creatureStep4: { url: creatureStep4Url, volume: 0.25 },
  creatureDie1: { url: creatureDie1Url, volume: 0.4 },
  creatureDie2: { url: creatureDie2Url, volume: 0.4 },
  creatureDie3: { url: creatureDie3Url, volume: 0.4 },
  creatureDie4: { url: creatureDie4Url, volume: 0.4 }
}

let ctx: AudioContext | null = null
/** Sons décodés, par fichier (deux sons peuvent partager le même). */
const buffers = new Map<string, AudioBuffer>()
const loading = new Set<string>()
let voices = 0

// ------------------------------------------------------------ volume général

const VOLUME_KEY = 'last-bastion:volume'

function loadVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY) ?? '1')
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
  } catch {
    return 1
  }
}

let volume = loadVolume()
let master: GainNode | null = null

/** Sortie commune de tous les sons : c'est elle qui porte le volume général. */
function output(c: AudioContext): GainNode {
  if (!master) {
    master = c.createGain()
    master.gain.value = volume
    master.connect(c.destination)
  }
  return master
}

/** Volume général du jeu, de 0 (muet) à 1. */
export const getVolume = (): number => volume

export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v))
  if (master) master.gain.value = volume
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    /* ignore */
  }
}

function context(): AudioContext | null {
  if (ctx) return ctx
  if (typeof AudioContext === 'undefined') return null
  try {
    ctx = new AudioContext()
  } catch {
    return null
  }
  return ctx
}

/** Charge tous les sons d'un coup : le premier tir de chaque type n'est plus muet. */
function load(c: AudioContext): void {
  for (const { url } of Object.values(SOUNDS)) {
    if (loading.has(url)) continue
    loading.add(url)
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => c.decodeAudioData(data))
      .then((b) => {
        buffers.set(url, b)
      })
      .catch(() => {
        loading.delete(url)
      })
  }
}

/** Joue un son. Le premier appel de chaque son ne fait que le charger (il reste muet). */
// ------------------------------------------------------------ distance et panoramique

/** Positions des joueurs de cette machine (le son est entendu depuis la plus proche de la source). */
const listeners = new Map<number, { x: number; y: number }>()

function listen(id: number, x: number, y: number): void {
  const l = listeners.get(id)
  if (l) {
    l.x = x
    l.y = y
  } else listeners.set(id, { x, y })
}

/** Réglage de mixage de chaque son (voir HEARING.mix). */
const MIX: Record<Sound, number> = {
  repair: HEARING.mix.repair,
  upgrade: HEARING.mix.upgrade,
  wallBuilt: HEARING.mix.build,
  turretBuilt: HEARING.mix.build,
  spikesBuilt: HEARING.mix.build,
  player: HEARING.mix.player,
  turret: HEARING.mix.turret,
  turretHeavy: HEARING.mix.turretHeavy,
  turretExplosive: HEARING.mix.turretHeavy,
  heavyImpact: HEARING.mix.heavyImpact,
  turretMinigun: HEARING.mix.turretMinigun,
  footstep: HEARING.mix.footstep,
  footstep2: HEARING.mix.footstep,
  menuHover: HEARING.mix.menu,
  menuClick: HEARING.mix.menu,
  creatureStep1: HEARING.mix.creatureStep,
  creatureStep2: HEARING.mix.creatureStep,
  creatureStep3: HEARING.mix.creatureStep,
  creatureStep4: HEARING.mix.creatureStep,
  creatureDie1: HEARING.mix.creatureDie,
  creatureDie2: HEARING.mix.creatureDie,
  creatureDie3: HEARING.mix.creatureDie,
  creatureDie4: HEARING.mix.creatureDie
}

/** Volume (0 à 1) et panoramique (-1 à 1) d'un son émis en (x, y), selon le joueur le plus proche. */
function spatial(x?: number, y?: number): { gain: number; pan: number } {
  // Sans position (sons de menu) : même volume partout
  if (x === undefined || y === undefined) return { gain: 1, pan: 0 }
  let best: { x: number; y: number } | null = null
  let dist = Infinity
  for (const l of listeners.values()) {
    const d = Math.hypot(l.x - x, l.y - y)
    if (d < dist) {
      dist = d
      best = l
    }
  }
  if (!best) return { gain: 1, pan: 0 }
  const t = Math.min(1, Math.max(0, (dist - HEARING.near) / (HEARING.far - HEARING.near)))
  const gain = HEARING.floor + (1 - HEARING.floor) * Math.pow(1 - t, HEARING.curve)
  const pan = Math.min(1, Math.max(-1, (x - best.x) / HEARING.panRange)) * HEARING.pan
  return { gain, pan }
}

/** Branche une source sur la sortie, avec son volume de base `volume` modulé par la distance. Renvoie le gain, ou null si inaudible. */
function route(c: AudioContext, src: AudioBufferSourceNode, volume: number, x?: number, y?: number): GainNode | null {
  const s = spatial(x, y)
  if (s.gain < 0.01) return null
  const gain = c.createGain()
  gain.gain.value = volume * s.gain
  if (HEARING.pan > 0 && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner()
    p.pan.value = s.pan
    src.connect(gain).connect(p).connect(output(c))
  } else {
    src.connect(gain).connect(output(c))
  }
  return gain
}

export function play(sound: Sound, x?: number, y?: number): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const buffer = buffers.get(SOUNDS[sound].url)
  if (!buffer) {
    load(c)
    return
  }
  if (voices >= MAX_VOICES) return
  const src = c.createBufferSource()
  src.buffer = buffer
  // Légère variation de hauteur pour que les rafales ne sonnent pas « mécaniques »
  src.playbackRate.value = 0.95 + Math.random() * 0.1
  if (!route(c, src, SOUNDS[sound].volume * MIX[sound], x, y)) return
  voices++
  src.onended = () => {
    voices--
  }
  src.start()
}

// ------------------------------------------------------------ pas du joueur

/** Distance parcourue (px) entre deux pas : plus le joueur est rapide, plus les pas sont rapprochés. */
const STRIDE = 60
/** Vitesse de référence (px/s) à laquelle le pas est joué à hauteur normale. */
const STEP_REF_SPEED = 150
const stride = new Map<number, number>()

const PLAYER_STEPS: readonly Sound[] = ['footstep', 'footstep2']
const CREATURE_STEPS: readonly Sound[] = ['creatureStep1', 'creatureStep2', 'creatureStep3', 'creatureStep4']
const CREATURE_DEATHS: readonly Sound[] = ['creatureDie1', 'creatureDie2', 'creatureDie3', 'creatureDie4']
const lastVariant = new Map<readonly Sound[], Sound>()

/** Variante au hasard parmi `family`, jamais deux fois la même d'affilée. */
function variant(family: readonly Sound[]): Sound {
  const last = lastVariant.get(family)
  let s = family[Math.floor(Math.random() * family.length)]
  if (s === last) s = family[(family.indexOf(s) + 1 + Math.floor(Math.random() * (family.length - 1))) % family.length]
  lastVariant.set(family, s)
  return s
}

/** Joue une fois un son déjà chargé (le premier appel ne fait que le charger), à la vitesse `rate`. */
function oneShot(sound: Sound, x: number, y: number, rate: number): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const buffer = buffers.get(SOUNDS[sound].url)
  if (!buffer) {
    load(c)
    return
  }
  if (voices >= MAX_VOICES) return
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  if (!route(c, src, SOUNDS[sound].volume * MIX[sound], x, y)) return
  voices++
  src.onended = () => {
    voices--
  }
  src.start()
}

/** Accumule `dist` dans `acc` ; renvoie le nouveau cumul et si une foulée de `len` px vient d'être franchie. */
function advance(acc: number, dist: number, len: number): { acc: number; step: boolean } {
  acc += dist
  return acc < len ? { acc, step: false } : { acc: acc - len, step: true }
}

/**
 * Le joueur `id` vient de parcourir `dist` px à la vitesse `speed`. Le son ne contient qu'un pas : on en joue un
 * à chaque foulée (deux enregistrements en alternance aléatoire), avec ±10 % de hauteur et une vitesse de lecture
 * qui suit la vitesse de déplacement.
 */
export function footstep(id: number, dist: number, speed: number, x: number, y: number): void {
  if (dist <= 0) return
  const r = advance(stride.get(id) ?? STRIDE * 0.5, dist, STRIDE)
  stride.set(id, r.acc)
  if (!r.step) return
  const pace = Math.min(1.25, Math.max(0.8, speed / STEP_REF_SPEED))
  oneShot(variant(PLAYER_STEPS), x, y, pace * (0.9 + Math.random() * 0.2))
}

// ------------------------------------------------------------ créatures

/**
 * Une créature vient de se déplacer de `dist` px. Sa foulée est proportionnelle à sa taille ; les grosses créatures
 * ont des pas plus graves. `e.step` garde le cumul de distance de chaque créature.
 */
export function creatureStep(e: { x: number; y: number; radius: number; step: number }, dist: number): void {
  if (dist <= 0) return
  const r = advance(e.step, dist, 22 + e.radius * 3)
  e.step = r.acc
  if (!r.step) return
  const size = Math.min(1.3, Math.max(0.6, Math.pow(11 / e.radius, 0.4)))
  oneShot(variant(CREATURE_STEPS), e.x, e.y, size * (0.9 + Math.random() * 0.2))
}

/** Une créature vient de mourir en (x, y) : une des 4 variantes au hasard. */
export function creatureDied(x: number, y: number): void {
  oneShot(variant(CREATURE_DEATHS), x, y, 0.92 + Math.random() * 0.16)
}

// ------------------------------------------------------------ tir du joueur

/** Durée de l'enregistrement du tir du joueur (s) : il ne contient qu'un seul coup. */
const PLAYER_SHOT_SECONDS = 0.6

interface PlayerVoice {
  /** Dernière position du tir (px), instant du dernier tir (s) et son écart avec le précédent (0 = inconnu). */
  x: number
  y: number
  last: number
  interval: number
  gain: GainNode | null
  src: AudioBufferSourceNode | null
}

/** Un suivi par joueur (deux au maximum) : le tir est attribué à celui dont la dernière position est la plus proche. */
const shooters: PlayerVoice[] = []

/**
 * Le joueur vient de tirer en (x, y). Le son ne contient qu'un coup : si le joueur tire plus vite qu'il ne dure,
 * le coup précédent est coupé en fondu et le nouveau est un peu accéléré, pour que la cadence reste audible
 * sans que les queues de son s'empilent.
 */
export function playerShot(x: number, y: number): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const buffer = buffers.get(SOUNDS.player.url)
  if (!buffer) {
    load(c)
    return
  }
  const now = c.currentTime
  let v = shooters.length < 2 ? undefined : shooters.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b))
  if (!v) {
    v = { x, y, last: 0, interval: 0, gain: null, src: null }
    shooters.push(v)
  }
  const gap = v.last > 0 ? now - v.last : 0
  if (gap > 0.01 && gap < 2) v.interval = v.interval === 0 ? gap : v.interval * 0.5 + gap * 0.5
  else if (gap >= 2) v.interval = 0
  v.x = x
  v.y = y
  v.last = now

  // Coup précédent encore audible : fondu rapide
  if (v.gain && v.src) {
    v.gain.gain.cancelScheduledValues(now)
    v.gain.gain.setValueAtTime(v.gain.gain.value, now)
    v.gain.gain.linearRampToValueAtTime(0, now + 0.04)
    v.src.stop(now + 0.05)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const speed = v.interval > 0 ? Math.min(1.3, Math.max(1, PLAYER_SHOT_SECONDS / v.interval)) : 1
  src.playbackRate.value = speed * (0.95 + Math.random() * 0.1)
  const gain = route(c, src, SOUNDS.player.volume * MIX.player, x, y)
  if (!gain) return
  src.start()
  v.src = src
  v.gain = gain
}

// ------------------------------------------------------------ minigun : rafale en boucle

/** Coups par seconde de l'enregistrement du minigun (≈ 6 coups en 0,336 s) : à cette cadence il se joue à vitesse normale. */
const MINIGUN_SAMPLE_RATE = 18
/** Au-delà de ce nombre de miniguns qui tirent en même temps, les autres restent muets. */
const MAX_MINIGUN_LOOPS = 4

interface MinigunLoop {
  src: AudioBufferSourceNode
  gain: GainNode
  /** Instant (s, horloge audio) du dernier tir et durée lissée entre deux tirs (0 = inconnue). */
  last: number
  interval: number
  stop: ReturnType<typeof setTimeout>
}

const loops = new Map<number, MinigunLoop>()

function endLoop(key: number): void {
  const l = loops.get(key)
  if (!l || !ctx) return
  loops.delete(key)
  // Fondu rapide pour éviter un claquement à l'arrêt
  const t = ctx.currentTime
  l.gain.gain.setValueAtTime(l.gain.gain.value, t)
  l.gain.gain.linearRampToValueAtTime(0, t + 0.06)
  l.src.stop(t + 0.07)
}

/**
 * Un minigun vient de tirer. Tant qu'il enchaîne les tirs, sa rafale tourne en boucle ; la vitesse de lecture suit
 * l'écart mesuré entre ses tirs (donc sa cadence, bonus compris). Elle s'arrête peu après son dernier tir.
 * `key` identifie la tourelle (sa case).
 */
export function minigunShot(key: number): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const buffer = buffers.get(SOUNDS.turretMinigun.url)
  if (!buffer) {
    load(c)
    return
  }
  const now = c.currentTime
  const x = ((key % COLS) + 0.5) * TILE
  const y = (Math.floor(key / COLS) + 0.5) * TILE
  let l = loops.get(key)
  if (!l) {
    if (loops.size >= MAX_MINIGUN_LOOPS) return
    const src = c.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = route(c, src, SOUNDS.turretMinigun.volume * MIX.turretMinigun, x, y)
    if (!gain) return
    src.start()
    l = { src, gain, last: now, interval: 0, stop: setTimeout(() => endLoop(key), 250) }
    loops.set(key, l)
    return
  }
  const gap = now - l.last
  l.last = now
  if (gap > 0.001 && gap < 0.5) l.interval = l.interval === 0 ? gap : l.interval * 0.6 + gap * 0.4
  if (l.interval > 0) l.src.playbackRate.setTargetAtTime(Math.min(3, Math.max(0.4, 1 / l.interval / MINIGUN_SAMPLE_RATE)), now, 0.05)
  clearTimeout(l.stop)
  l.stop = setTimeout(() => endLoop(key), Math.max(200, l.interval * 2500))
}

// ------------------------------------------------------------ boutons de l'interface

/** Son au survol et au clic de n'importe quel bouton de l'interface (menus, paramètres, boutique...). */
function enableButtonSounds(): void {
  const button = (t: EventTarget | null): HTMLButtonElement | null => {
    const b = t instanceof Element ? t.closest('button') : null
    return b && !b.disabled ? b : null
  }
  document.addEventListener('mouseover', (e) => {
    const b = button(e.target)
    // Pas de son quand la souris passe d'un élément à un autre du même bouton
    if (b && !(e.relatedTarget instanceof Node && b.contains(e.relatedTarget))) play('menuHover')
  })
  document.addEventListener('click', (e) => {
    if (button(e.target)) play('menuClick')
  })
}

if (typeof document !== 'undefined') enableButtonSounds()

// Branche les sons sur les effets du moteur
sounds.play = play
sounds.minigun = minigunShot
sounds.player = playerShot
sounds.step = footstep
sounds.listen = listen
sounds.creature = creatureStep
sounds.died = creatureDied
