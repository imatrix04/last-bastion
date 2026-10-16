import { WEB } from './config/constants'
import type { FxEvent, GameState, Particle, ParticleShape } from './types'

const MAX_PARTICLES = 700
const MAX_TEXTS = 40
const MAX_RINGS = 40
const MAX_DECALS = 80
const MAX_LOGGED = 200

export const SHAPE_SQUARE: ParticleShape = 0
export const SHAPE_SPARK: ParticleShape = 1
export const SHAPE_SMOKE: ParticleShape = 2
export const SHAPE_GLOW: ParticleShape = 3

function log(state: GameState, ev: FxEvent): void {
  if (state.fxLog && state.fxLog.length < MAX_LOGGED) state.fxLog.push(ev)
}

function spawn(state: GameState, p: Particle): void {
  if (state.particles.length < MAX_PARTICLES) state.particles.push(p)
}

/**
 * Gerbe de particules. `style` : 0 éclats carrés, 1 étincelles, 2 fumée / poussière, 3 lueurs.
 * Les effets sont rejoués à l'identique chez l'invité en ligne (voir fxLog).
 */
export function burst(state: GameState, x: number, y: number, color: string, count: number, speed = 120, style: ParticleShape = 0): void {
  log(state, ['b', Math.round(x), Math.round(y), color, count, speed, style])
  for (let i = 0; i < count && state.particles.length < MAX_PARTICLES; i++) {
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
  if (state.decals.length >= MAX_DECALS) state.decals.shift()
  const life = 7 + Math.random() * 2
  state.decals.push({ x, y, size, life, maxLife: life, color, seed: Math.random() * 1000 })
}

/** Flash de bouche. `style` : 0 joueur, 1 tourelle, 2 double canon, 3 canon lourd. */
export function muzzle(state: GameState, x: number, y: number, angle: number, style: number): void {
  const a = Math.round(angle * 100) / 100
  log(state, ['m', Math.round(x), Math.round(y), a, style])
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
export function webShot(state: GameState, x: number, y: number, tx: number, ty: number, col = -1, row = -1): void {
  log(state, ['w', Math.round(x), Math.round(y), Math.round(tx), Math.round(ty)])
  if (state.webs.length >= 40) state.webs.shift()
  state.webs.push({ x, y, tx, ty, t: 0, dur: WEB.flight, col, row })
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
