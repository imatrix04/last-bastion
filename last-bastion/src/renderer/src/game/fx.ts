import type { GameState } from './types'

const MAX_PARTICLES = 500
const MAX_TEXTS = 40
const MAX_LOGGED = 200

export function burst(state: GameState, x: number, y: number, color: string, count: number, speed = 120): void {
  if (state.fxLog && state.fxLog.length < MAX_LOGGED) state.fxLog.push(['b', Math.round(x), Math.round(y), color, count, speed])
  for (let i = 0; i < count && state.particles.length < MAX_PARTICLES; i++) {
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.3 + Math.random() * 0.7)
    const life = 0.3 + Math.random() * 0.4
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      size: 2 + Math.random() * 2.5,
      color
    })
  }
}

export function addText(state: GameState, x: number, y: number, text: string, color: string): void {
  if (state.fxLog && state.fxLog.length < MAX_LOGGED) state.fxLog.push(['t', Math.round(x), Math.round(y), text, color])
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
    p.vx *= 0.94
    p.vy *= 0.94
    state.particles[w++] = p
  }
  state.particles.length = w

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
