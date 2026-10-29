import { GFX } from './config/graphics'
import { COLS, SPIT, TILE, WEB } from './config/constants'
import type { FxEvent, GameState, Particle, ParticleShape } from './types'

/**
 * Sons des tirs. Vides par défaut (script de simulation sous Node) : l'interface les branche au démarrage (voir audio.ts),
 * pour que le moteur ne dépende pas de l'audio du navigateur.
 */
export const sounds: { play: (sound: 'turret' | 'turretHeavy' | 'turretExplosive' | 'heavyImpact' | 'wallBuilt' | 'turretBuilt' | 'spikesBuilt' | 'upgrade' | 'repair', x: number, y: number) => void; minigun: (key: number) => void; player: (x: number, y: number) => void; step: (id: number, dist: number, speed: number, x: number, y: number) => void; listen: (id: number, x: number, y: number) => void } = {
  play: () => undefined,
  minigun: () => undefined,
  player: () => undefined,
  step: () => undefined,
  listen: () => undefined
}

const MAX_TEXTS = 40
const MAX_RINGS = 40
const MAX_LOGGED = 200

export const SHAPE_SQUARE: ParticleShape = 0
export const SHAPE_SPARK: ParticleShape = 1
export const SHAPE_SMOKE: ParticleShape = 2
export const SHAPE_GLOW: ParticleShape = 3

function log(state: GameState, ev: FxEvent): void {
  if (state.fxLog && state.fxLog.length < MAX_LOGGED) state.fxLog.push(ev)
}

function spawn(state: GameState, p: Particle): void {
  if (state.particles.length < GFX.particles) state.particles.push(p)
}

/**
 * Gerbe de particules. `style` : 0 éclats carrés, 1 étincelles, 2 fumée / poussière, 3 lueurs.
 * Les effets sont rejoués à l'identique chez l'invité en ligne (voir fxLog).
 */
export function burst(state: GameState, x: number, y: number, color: string, count: number, speed = 120, style: ParticleShape = 0): void {
  log(state, ['b', Math.round(x), Math.round(y), color, count, speed, style])
  for (let i = 0; i < count && state.particles.length < GFX.particles; i++) {
    const a = Math.random() * Math.PI * 2
    let s: number
    let life: number
    let size: number
    switch (style) {
      case 1:
        s = speed * (0.5 + Math.random() * 0.8)
        life = 0.2 + Math.random() * 0.3
        size = 1.2 + Math.random() * 1.2
        break
      case 2:
        s = speed * (0.15 + Math.random() * 0.35)
        life = 0.5 + Math.random() * 0.5
        size = 5 + Math.random() * 5
        break
      case 3:
        s = 0
        life = 0.12 + Math.random() * 0.13
        size = 8 + Math.random() * 6
        break
      default:
        s = speed * (0.3 + Math.random() * 0.7)
        life = 0.3 + Math.random() * 0.4
        size = 2 + Math.random() * 2.5
    }
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life, size, color, shape: style })
  }
}

export const sparks = (state: GameState, x: number, y: number, color: string, count: number, speed = 170): void =>
  burst(state, x, y, color, count, speed, SHAPE_SPARK)

export const smoke = (state: GameState, x: number, y: number, color: string, count: number, speed = 60): void =>
  burst(state, x, y, color, count, speed, SHAPE_SMOKE)

/** Onde de choc circulaire. */
export function ring(state: GameState, x: number, y: number, color: string, maxR: number): void {
  log(state, ['r', Math.round(x), Math.round(y), color, Math.round(maxR)])
  if (state.rings.length >= MAX_RINGS) state.rings.shift()
  state.rings.push({ x, y, maxR, life: 0.45, maxLife: 0.45, color })
}

/** Tache au sol (sang, gelée...). */
export function decal(state: GameState, x: number, y: number, color: string, size: number): void {
  log(state, ['d', Math.round(x), Math.round(y), color, Math.round(size)])
  if (state.decals.length >= GFX.decals) state.decals.shift()
  const life = 7 + Math.random() * 2
  state.decals.push({ x, y, size, life, maxLife: life, color, seed: Math.random() * 1000 })
}

/** Impact d'un obus de canon lourd ou explosif : son d'explosion (rejoué chez l'invité). */
export function heavyImpact(state: GameState, x: number, y: number): void {
  log(state, ['s', 1, Math.round(x), Math.round(y)])
  sounds.play('heavyImpact', x, y)
}

/** Un mur vient d'être posé : son de construction (rejoué chez l'invité). */
export function wallBuilt(state: GameState, x: number, y: number): void {
  log(state, ['s', 2, Math.round(x), Math.round(y)])
  sounds.play('wallBuilt', x, y)
}

/** Une tourelle vient d'être posée : son de construction (rejoué chez l'invité). */
export function turretBuilt(state: GameState, x: number, y: number): void {
  log(state, ['s', 5, Math.round(x), Math.round(y)])
  sounds.play('turretBuilt', x, y)
}

/** Des pieux viennent d'être posés : son de construction (rejoué chez l'invité). */
export function spikesBuilt(state: GameState, x: number, y: number): void {
  log(state, ['s', 6, Math.round(x), Math.round(y)])
  sounds.play('spikesBuilt', x, y)
}

/** Un bâtiment vient d'être amélioré : son d'amélioration (rejoué chez l'invité). */
export function upgraded(state: GameState, x: number, y: number): void {
  log(state, ['s', 3, Math.round(x), Math.round(y)])
  sounds.play('upgrade', x, y)
}

/** Un bâtiment vient d'être réparé : son de réparation (rejoué chez l'invité). */
export function repaired(state: GameState, x: number, y: number): void {
  log(state, ['s', 4, Math.round(x), Math.round(y)])
  sounds.play('repair', x, y)
}

/** Flash de bouche. `style` : 0 joueur, 1 tourelle, 2 double canon, 3 canon lourd, 4 minigun, 5 canon explosif. */
export function muzzle(state: GameState, x: number, y: number, angle: number, rawStyle: number): void {
  const a = Math.round(angle * 100) / 100
  log(state, ['m', Math.round(x), Math.round(y), a, rawStyle])
  if (rawStyle === 0) sounds.player(x, y)
  else if (rawStyle === 1 || rawStyle === 2) sounds.play('turret', x, y)
  else if (rawStyle === 3) sounds.play('turretHeavy', x, y)
  else if (rawStyle === 5) sounds.play('turretExplosive', x, y)
  else if (rawStyle === 4) sounds.minigun(Math.floor(y / TILE) * COLS + Math.floor(x / TILE))
  // 4 : minigun (dessiné comme le double canon) · 5 : canon explosif (dessiné comme le canon lourd)
  const style = rawStyle === 4 ? 2 : rawStyle === 5 ? 3 : rawStyle
  const heavy = style === 3
  const color = style === 0 ? '#fff59d' : heavy ? '#ffb74d' : '#80deea'
  const glow = heavy ? 26 : style === 2 ? 17 : 15
  const life = heavy ? 0.1 : 0.07
  spawn(state, { x, y, vx: 0, vy: 0, life, maxLife: life, size: glow, color, shape: SHAPE_GLOW })
  const n = heavy ? 6 : 3
  for (let i = 0; i < n; i++) {
    const d = a + (Math.random() - 0.5) * (heavy ? 0.7 : 0.45)
    const s = (heavy ? 240 : 190) * (0.5 + Math.random() * 0.8)
    const l = 0.1 + Math.random() * 0.18
    spawn(state, { x, y, vx: Math.cos(d) * s, vy: Math.sin(d) * s, life: l, maxLife: l, size: 1.4 + Math.random(), color, shape: SHAPE_SPARK })
  }
  if (heavy) {
    const l = 0.5
    spawn(state, { x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: l, maxLife: l, size: 7, color: '#b0bec5', shape: SHAPE_SMOKE })
  }
}

/**
 * Toile d'araignée en vol. Sur l'hôte (col/row ≥ 0) elle englue l'arme visée à l'arrivée ;
 * chez le joueur distant elle ne sert qu'à l'affichage.
 */
export function webShot(state: GameState, x: number, y: number, tx: number, ty: number, col = -1, row = -1, acid = false): void {
  log(state, ['w', Math.round(x), Math.round(y), Math.round(tx), Math.round(ty), acid ? 1 : 0])
  if (state.webs.length >= 40) state.webs.shift()
  state.webs.push({ x, y, tx, ty, t: 0, dur: acid ? SPIT.flight : WEB.flight, col, row, acid })
}

export function addText(state: GameState, x: number, y: number, text: string, color: string): void {
  log(state, ['t', Math.round(x), Math.round(y), text, color])
  if (state.texts.length >= MAX_TEXTS) return
  state.texts.push({ x, y, text, color, life: 0.9 })
}

export function updateFx(state: GameState, dt: number): void {
  let w = 0
  for (const p of state.particles) {
    p.life -= dt
    if (p.life <= 0) continue
    p.x += p.vx * dt
    p.y += p.vy * dt
    const drag = p.shape === SHAPE_SPARK ? 0.9 : p.shape === SHAPE_SMOKE ? 0.93 : 0.94
    p.vx *= drag
    p.vy *= drag
    if (p.shape === SHAPE_SMOKE) p.vy -= 14 * dt
    state.particles[w++] = p
  }
  state.particles.length = w

  w = 0
  for (const r of state.rings) {
    r.life -= dt
    if (r.life <= 0) continue
    state.rings[w++] = r
  }
  state.rings.length = w

  w = 0
  for (const d of state.decals) {
    d.life -= dt
    if (d.life <= 0) continue
    state.decals[w++] = d
  }
  state.decals.length = w

  w = 0
  for (const t of state.texts) {
    t.life -= dt
    if (t.life <= 0) continue
    t.y -= 32 * dt
    state.texts[w++] = t
  }
  state.texts.length = w

  state.shake = Math.max(0, state.shake - dt * 2.5)
}
