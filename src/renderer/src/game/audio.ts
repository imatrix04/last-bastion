import { sounds } from './fx'
import turretShot from '../assets/audio/tourelle/tourelle-shoot.wav?url'
import turretMinigunShot from '../assets/audio/tourelle/tourelle-minigun-shoot.wav?url'
import turretHeavyShot from '../assets/audio/tourelle/tourelle-heavy-shoot.wav?url'

/** Nombre maximal de sons de tir joués en même temps : au-delà, les tirs en trop restent muets. */
const MAX_VOICES = 14

export type Sound = 'turret' | 'turretHeavy' | 'turretMinigun'

const SOUNDS: Record<Sound, { url: string; volume: number }> = {
  turret: { url: turretShot, volume: 0.25 },
  turretHeavy: { url: turretHeavyShot, volume: 0.5 },
  turretMinigun: { url: turretMinigunShot, volume: 0.5 }
}

let ctx: AudioContext | null = null
const buffers: Partial<Record<Sound, AudioBuffer>> = {}
const loading = new Set<Sound>()
let voices = 0

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

function load(c: AudioContext, sound: Sound): void {
  if (loading.has(sound)) return
  loading.add(sound)
  fetch(SOUNDS[sound].url)
    .then((r) => r.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
    .then((b) => {
      buffers[sound] = b
    })
    .catch(() => {
      loading.delete(sound)
    })
}

/** Joue un son. Le premier appel de chaque son ne fait que le charger (il reste muet). */
export function play(sound: Sound): void {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const buffer = buffers[sound]
  if (!buffer) {
    load(c, sound)
    return
  }
  if (voices >= MAX_VOICES) return
  const src = c.createBufferSource()
  src.buffer = buffer
  // Légère variation de hauteur pour que les rafales ne sonnent pas « mécaniques »
  src.playbackRate.value = 0.95 + Math.random() * 0.1
  const gain = c.createGain()
  gain.gain.value = SOUNDS[sound].volume
  src.connect(gain).connect(c.destination)
  voices++
  src.onended = () => {
    voices--
  }
  src.start()
}

// ------------------------------------------------------------ minigun : rafale en boucle

/** Coups par seconde de l'enregistrement du minigun (≈ 6 coups en 0,336 s) : à cette cadence il se joue à vitesse normale. */
const MINIGUN_SAMPLE_RATE = 18
/** Au-delà de ce nombre de miniguns qui tirent en même temps, les autres restent muets. */
const MAX_MINIGUN_LOOPS = 6

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
  const buffer = buffers.turretMinigun
  if (!buffer) {
    load(c, 'turretMinigun')
    return
  }
  const now = c.currentTime
  let l = loops.get(key)
  if (!l) {
    if (loops.size >= MAX_MINIGUN_LOOPS) return
    const src = c.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = c.createGain()
    gain.gain.value = SOUNDS.turretMinigun.volume
    src.connect(gain).connect(c.destination)
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

// Branche les sons sur les effets du moteur
sounds.play = play
sounds.minigun = minigunShot
