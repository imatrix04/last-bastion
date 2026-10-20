import { BASE, TILE } from './config/constants'
import type { GameState } from './types'

/** Style de la forteresse selon la vague : bois (1 à 10), pierre (11 à 20), pierre renforcée (21 et plus). */
export type FortressTier = 0 | 1 | 2

export const fortressTier = (wave: number): FortressTier => (wave <= 10 ? 0 : wave <= 20 ? 1 : 2)

/** Taille du dessin : la forteresse est composée dans un carré de 120 px puis mise à l'échelle de la vraie taille. */
const S = 120
const C = S / 2

const WOOD = ['#9c6a35', '#8b5a2b', '#a8753c', '#7f5226']

function seeded(salt: number): () => number {
  let s = (Math.imul(salt + 1, 83492791) >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): string => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`

export function drawFortress(ctx: CanvasRenderingContext2D, state: GameState): void {
  const x = BASE.col * TILE
  const y = BASE.row * TILE
  const w = BASE.cols * TILE
  const h = BASE.rows * TILE
  const ratio = Math.max(0, Math.min(1, state.baseHp / BASE.maxHp))
  const tier = fortressTier(state.wave)
  const time = state.time

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(x + 6, y + 9, w, h)

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w / S, h / S)

  drawCourtyard(ctx, tier, time)
  drawCrystal(ctx, tier, time, ratio)
  for (let i = 0; i < 4; i++) {
    ctx.save()
    ctx.translate(C, C)
    ctx.rotate((i * Math.PI) / 2)
    ctx.translate(-C, -C)
    drawCurtain(ctx, tier, time)
    drawGate(ctx, tier, time)
    drawTower(ctx, tier, time)
    ctx.restore()
  }
  drawFortressWear(ctx, ratio, time)
  ctx.restore()
}

// ───────────────────────────────────────────────────────────── cour intérieure

function drawCourtyard(ctx: CanvasRenderingContext2D, tier: FortressTier, time: number): void {
  const rnd = seeded(5)
  if (tier === 0) {
    ctx.fillStyle = '#6a5238'
    ctx.fillRect(14, 14, 92, 92)
    for (let i = 0; i < 46; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0, 0, 0, 0.16)' : 'rgba(214, 180, 110, 0.4)'
      ctx.fillRect(16 + rnd() * 86, 16 + rnd() * 86, 2 + rnd() * 4, 1)
    }
  } else if (tier === 1) {
    ctx.fillStyle = '#5c6170'
    ctx.fillRect(14, 14, 92, 92)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const t = rnd() - 0.5
        ctx.fillStyle = t > 0 ? `rgba(255, 255, 255, ${t * 0.12})` : `rgba(0, 0, 0, ${-t * 0.16})`
        ctx.fillRect(14 + c * 11.5, 14 + r * 11.5, 11.5, 11.5)
      }
    }
    ctx.strokeStyle = '#464a56'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 8; i++) {
      ctx.moveTo(14 + i * 11.5, 14)
      ctx.lineTo(14 + i * 11.5, 106)
      ctx.moveTo(14, 14 + i * 11.5)
      ctx.lineTo(106, 14 + i * 11.5)
    }
    ctx.stroke()
  } else {
    ctx.fillStyle = '#1b222c'
    ctx.fillRect(14, 14, 92, 92)
    ctx.strokeStyle = '#2f3744'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(14 + i * 23, 14)
      ctx.lineTo(14 + i * 23, 106)
      ctx.moveTo(14, 14 + i * 23)
      ctx.lineTo(106, 14 + i * 23)
    }
    ctx.stroke()
    // Veines d'énergie des portes vers le cristal
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4)
    ctx.strokeStyle = `rgba(100, 220, 240, ${0.25 + 0.2 * pulse})`
    ctx.lineWidth = 2
    ctx.beginPath()
    for (const [vx, vy] of [
      [C, 14],
      [106, C],
      [C, 106],
      [14, C]
    ]) {
      ctx.moveTo(vx, vy)
      ctx.lineTo(C, C)
    }
    ctx.stroke()
    ctx.fillStyle = '#c8f6ff'
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2
      const p = (time * 0.6 + k * 0.25) % 1
      const d = 46 * (1 - p)
      ctx.beginPath()
      ctx.arc(C + Math.sin(a) * d, C - Math.cos(a) * d, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ───────────────────────────────────────────────────────────── cristal

function drawCrystal(ctx: CanvasRenderingContext2D, tier: FortressTier, time: number, ratio: number): void {
  // Plus la forteresse est blessée, plus le cristal vire au rouge et vacille
  const hot = Math.max(0, Math.min(1, (0.5 - ratio) / 0.3))
  const speed = 3 + hot * 6
  const pulse = 0.5 + 0.5 * Math.sin(time * speed)
  const flicker = hot > 0 ? 0.82 + 0.18 * Math.sin(time * 31) : 1
  const glowRgb = hot > 0 ? `${Math.round(120 + 135 * hot)}, ${Math.round(230 - 120 * hot)}, ${Math.round(255 - 175 * hot)}` : '120, 230, 255'

  // Socle
  if (tier === 0) {
    ctx.fillStyle = '#4a3320'
    ctx.strokeStyle = '#2e1c0e'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(C, C, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#8b5a2b'
    for (const [px, py] of [
      [-12, -12],
      [12, -12],
      [-12, 12],
      [12, 12]
    ]) {
      ctx.fillRect(C + px - 2.5, C + py - 2.5, 5, 5)
    }
  } else if (tier === 1) {
    ctx.fillStyle = '#9aa1b0'
    ctx.strokeStyle = '#3d424d'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8
      ctx.lineTo(C + Math.cos(a) * 20, C + Math.sin(a) * 20)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#6b7080'
    ctx.beginPath()
    ctx.arc(C, C, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(${glowRgb}, ${(0.4 + 0.5 * pulse) * flicker})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      ctx.moveTo(C + Math.cos(a) * 12, C + Math.sin(a) * 12)
      ctx.lineTo(C + Math.cos(a) * 17, C + Math.sin(a) * 17)
    }
    ctx.stroke()
  } else {
    ctx.fillStyle = '#2b323f'
    ctx.strokeStyle = '#0f141a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(C, C, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = `rgba(${glowRgb}, ${0.85 * flicker})`
    ctx.lineWidth = 2.2
    for (let k = 0; k < 2; k++) {
      const a = time * 0.9 + k * Math.PI
      ctx.beginPath()
      ctx.arc(C, C, 18.5, a, a + 1.3)
      ctx.stroke()
    }
  }

  const glow = ctx.createRadialGradient(C, C, 2, C, C, 52)
  glow.addColorStop(0, `rgba(${glowRgb}, ${(0.5 + 0.25 * pulse) * flicker})`)
  glow.addColorStop(1, `rgba(${glowRgb}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(C, C, 52, 0, Math.PI * 2)
  ctx.fill()

  // Cristal à facettes, qui flotte
  const cs = tier === 0 ? 1 : tier === 1 ? 1.1 : 1.25
  const hw = 12.75 * cs
  const hh = 21 * cs
  const cy = C + Math.sin(time * 2) * 1.5
  const lit: RGB = [168, 240, 255]
  const dark: RGB = [79, 195, 224]
  const litHot: RGB = [255, 190, 150]
  const darkHot: RGB = [215, 70, 50]
  const facet = (pts: Array<[number, number]>, color: string): void => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(C + pts[0][0], cy + pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(C + pts[i][0], cy + pts[i][1])
    ctx.closePath()
    ctx.fill()
  }
  facet([[0, -hh], [-hw, 0], [0, 0]], mix(lit, litHot, hot))
  facet([[0, -hh], [hw, 0], [0, 0]], mix([120, 220, 245], [240, 130, 100], hot))
  facet([[0, hh], [-hw, 0], [0, 0]], mix([100, 205, 235], [230, 100, 75], hot))
  facet([[0, hh], [hw, 0], [0, 0]], mix(dark, darkHot, hot))
  ctx.strokeStyle = hot > 0 ? 'rgba(255, 235, 225, 0.9)' : 'rgba(224, 251, 255, 0.9)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(C, cy - hh)
  ctx.lineTo(C + hw, cy)
  ctx.lineTo(C, cy + hh)
  ctx.lineTo(C - hw, cy)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.beginPath()
  ctx.arc(C - hw * 0.25, cy - hh * 0.45, 1.6, 0, Math.PI * 2)
  ctx.fill()

  if (tier === 2) {
    ctx.fillStyle = hot > 0 ? 'rgba(255, 190, 150, 0.9)' : 'rgba(180, 245, 255, 0.9)'
    for (let k = 0; k < 3; k++) {
      const a = time * 1.2 + (k * Math.PI * 2) / 3
      const ox = C + Math.cos(a) * 29
      const oy = cy + Math.sin(a) * 9
      ctx.beginPath()
      ctx.moveTo(ox, oy - 3.5)
      ctx.lineTo(ox + 2.2, oy)
      ctx.lineTo(ox, oy + 3.5)
      ctx.lineTo(ox - 2.2, oy)
      ctx.closePath()
      ctx.fill()
    }
  }
}

// ───────────────────────────────────────────────────────────── murs d'enceinte (face du haut)

function drawCurtain(ctx: CanvasRenderingContext2D, tier: FortressTier, time: number): void {
  if (tier === 0) {
    ctx.fillStyle = '#3a2812'
    ctx.fillRect(28, 0, 64, 16)
    for (let n = 0; n < 16; n++) {
      const lx = 28 + n * 4
      const tip = -4 + ((n * 7) % 3)
      ctx.fillStyle = WOOD[(n * 5) % 4]
      ctx.fillRect(lx, tip + 5, 4, 16 - tip - 5)
      ctx.beginPath()
      ctx.moveTo(lx, tip + 5)
      ctx.lineTo(lx + 2, tip)
      ctx.lineTo(lx + 4, tip + 5)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.fillRect(lx + 0.5, tip + 5, 1, 11 - tip)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
      ctx.fillRect(lx + 3, tip + 5, 1, 11 - tip)
    }
    ctx.fillStyle = '#4e3218'
    ctx.fillRect(28, 6, 64, 4)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.fillRect(28, 6, 64, 1)
    ctx.fillStyle = '#cfd8dc'
    for (let n = 0; n < 8; n++) ctx.fillRect(30 + n * 8, 7.5, 1.6, 1.6)
  } else if (tier === 1) {
    const rnd = seeded(11)
    ctx.fillStyle = '#8a90a0'
    ctx.fillRect(28, 0, 64, 16)
    for (let r = 0; r < 3; r++) {
      const off = r % 2 === 0 ? 0 : 5
      for (let bx = 28 - off; bx < 92; bx += 10) {
        const t = rnd() - 0.5
        ctx.fillStyle = t > 0 ? `rgba(255, 255, 255, ${t * 0.2})` : `rgba(0, 0, 0, ${-t * 0.22})`
        ctx.fillRect(Math.max(28, bx), r * 5.33, Math.min(92, bx + 10) - Math.max(28, bx), 5.33)
      }
    }
    ctx.strokeStyle = '#4a4f5c'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(28, 5.33)
    ctx.lineTo(92, 5.33)
    ctx.moveTo(28, 10.66)
    ctx.lineTo(92, 10.66)
    for (let r = 0; r < 3; r++) {
      const off = r % 2 === 0 ? 0 : 5
      for (let bx = 28 - off + 10; bx < 92; bx += 10) {
        ctx.moveTo(bx, r * 5.33)
        ctx.lineTo(bx, (r + 1) * 5.33)
      }
    }
    ctx.stroke()
    // Créneaux (sautés devant la porte)
    for (const mx of [30, 78]) {
      ctx.fillStyle = '#a3a9b8'
      ctx.fillRect(mx, -5, 12, 6)
      ctx.fillStyle = '#c3c9d6'
      ctx.fillRect(mx, -5, 12, 1.6)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.fillRect(mx + 10.5, -5, 1.5, 6)
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.fillRect(28, 12, 64, 4)
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, 16)
    grad.addColorStop(0, '#59647a')
    grad.addColorStop(1, '#2f3744')
    ctx.fillStyle = grad
    ctx.fillRect(28, 0, 64, 16)
    ctx.strokeStyle = '#1f2630'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let n = 1; n < 4; n++) {
      ctx.moveTo(28 + n * 16, 0)
      ctx.lineTo(28 + n * 16, 16)
    }
    ctx.stroke()
    ctx.fillStyle = '#d9e1e8'
    for (let n = 0; n < 4; n++) {
      ctx.fillRect(31 + n * 16, 3, 1.5, 1.5)
      ctx.fillRect(41 + n * 16, 3, 1.5, 1.5)
      ctx.fillRect(31 + n * 16, 11.5, 1.5, 1.5)
      ctx.fillRect(41 + n * 16, 11.5, 1.5, 1.5)
    }
    ctx.fillStyle = '#6f7c92'
    ctx.fillRect(28, -3, 64, 3)
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4)
    ctx.fillStyle = `rgba(128, 222, 234, ${0.5 + 0.4 * pulse})`
    ctx.fillRect(28, -1, 64, 1.2)
  }
}

// ───────────────────────────────────────────────────────────── porte (face du haut)

function torch(ctx: CanvasRenderingContext2D, px: number, py: number, time: number, phase: number): void {
  const f = Math.sin(time * 17 + phase) * 0.8
  const glow = ctx.createRadialGradient(px, py, 0, px, py, 10)
  glow.addColorStop(0, 'rgba(255, 170, 60, 0.4)')
  glow.addColorStop(1, 'rgba(255, 170, 60, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(px - 10, py - 10, 20, 20)
  ctx.fillStyle = '#ff9a3c'
  ctx.beginPath()
  ctx.ellipse(px, py, 2.6 + f * 0.3, 3.4 + f, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffe082'
  ctx.beginPath()
  ctx.ellipse(px, py + 0.6, 1.2, 1.9 + f * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawGate(ctx: CanvasRenderingContext2D, tier: FortressTier, time: number): void {
  if (tier === 0) {
    ctx.fillStyle = '#1a120a'
    ctx.fillRect(49, -2, 22, 18)
    for (const [lx, c] of [
      [50, '#7a4e28'],
      [60, '#6e4522']
    ] as const) {
      ctx.fillStyle = c
      ctx.fillRect(lx, 0, 10, 16)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.fillRect(lx + 3.3, 0, 0.8, 16)
      ctx.fillRect(lx + 6.6, 0, 0.8, 16)
      ctx.fillStyle = '#2b2b2b'
      ctx.fillRect(lx, 4, 10, 2)
      ctx.fillRect(lx, 11, 10, 2)
    }
    ctx.fillStyle = '#0d0a06'
    ctx.fillRect(59.5, 0, 1, 16)
    for (const px of [46, 70]) {
      ctx.fillStyle = '#5a3a1c'
      ctx.fillRect(px, -3, 4, 19)
      ctx.beginPath()
      ctx.moveTo(px, -3)
      ctx.lineTo(px + 2, -8)
      ctx.lineTo(px + 4, -3)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(px + 0.5, -3, 1, 19)
    }
    ctx.fillStyle = '#4a2f18'
    ctx.fillRect(46, -6, 28, 3)
    torch(ctx, 48, -10, time, 0)
    torch(ctx, 72, -10, time, 2)
  } else if (tier === 1) {
    ctx.fillStyle = '#14161b'
    ctx.fillRect(50, -1, 20, 17)
    ctx.fillStyle = '#3a3e48'
    for (let n = 0; n < 5; n++) ctx.fillRect(52 + n * 4, -1, 1.8, 17)
    ctx.fillRect(50, 4, 20, 1.8)
    ctx.fillRect(50, 11, 20, 1.8)
    for (const px of [44, 70]) {
      ctx.fillStyle = '#9aa1b0'
      ctx.fillRect(px, -6, 6, 22)
      ctx.strokeStyle = '#4a4f5c'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (const by of [0, 5, 10]) {
        ctx.moveTo(px, by)
        ctx.lineTo(px + 6, by)
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
      ctx.fillRect(px, -6, 6, 1.5)
    }
    ctx.fillStyle = '#a3a9b8'
    ctx.fillRect(44, -8, 32, 5)
    ctx.fillStyle = '#c3c9d6'
    ctx.fillRect(57, -8, 6, 7)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.fillRect(44, -8, 32, 1.4)
    torch(ctx, 47, -11, time, 1)
    torch(ctx, 73, -11, time, 3)
  } else {
    ctx.fillStyle = '#0e1218'
    ctx.fillRect(49, -1, 22, 17)
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4)
    for (const lx of [50, 60]) {
      const g = ctx.createLinearGradient(lx, 0, lx + 10, 0)
      g.addColorStop(0, '#5a667a')
      g.addColorStop(1, '#3b4252')
      ctx.fillStyle = g
      ctx.fillRect(lx, 0, 10, 16)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(lx, 7.5, 10, 1)
    }
    ctx.fillStyle = `rgba(128, 222, 234, ${0.55 + 0.4 * pulse})`
    ctx.fillRect(59.4, 0, 1.2, 16)
    for (const px of [44, 70]) {
      ctx.fillStyle = '#2b323f'
      ctx.fillRect(px, -5, 6, 21)
      ctx.fillStyle = '#6f7c92'
      ctx.fillRect(px, -5, 6, 1.5)
      ctx.fillStyle = `rgba(128, 222, 234, ${0.6 + 0.4 * pulse})`
      ctx.beginPath()
      ctx.arc(px + 3, 2, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#3b4252'
    ctx.fillRect(44, -8, 32, 4)
    ctx.fillStyle = `rgba(128, 222, 234, ${0.5 + 0.4 * pulse})`
    ctx.fillRect(46, -6.5, 28, 1)
  }
}

// ───────────────────────────────────────────────────────────── tour d'angle (coin haut-gauche)

function drawTower(ctx: CanvasRenderingContext2D, tier: FortressTier, time: number): void {
  if (tier === 0) {
    // Toit de planches en pyramide, sur des rondins d'angle
    ctx.fillStyle = '#3a2812'
    ctx.fillRect(-3, -3, 34, 34)
    const roof = (pts: Array<[number, number]>, color: string): void => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.closePath()
      ctx.fill()
    }
    roof([[-3, -3], [31, -3], [14, 14]], '#a0703a')
    roof([[-3, -3], [-3, 31], [14, 14]], '#8b5a2b')
    roof([[31, -3], [31, 31], [14, 14]], '#74481f')
    roof([[-3, 31], [31, 31], [14, 14]], '#62401d')
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    for (let n = 1; n < 4; n++) {
      ctx.moveTo(-3 + n * 8.5, -3)
      ctx.lineTo(14, 14)
      ctx.moveTo(-3, -3 + n * 8.5)
      ctx.lineTo(14, 14)
    }
    ctx.stroke()
    ctx.fillStyle = '#b08a52'
    for (const [px, py] of [
      [-1, -1],
      [29, -1],
      [-1, 29],
      [29, 29]
    ]) {
      ctx.beginPath()
      ctx.arc(px, py, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#3a2812'
    ctx.beginPath()
    ctx.arc(14, 14, 2.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (tier === 1) {
    ctx.fillStyle = '#a3a9b8'
    ctx.fillRect(-3, -3, 34, 34)
    ctx.strokeStyle = '#6b7080'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let n = 1; n < 4; n++) {
      ctx.moveTo(-3, -3 + n * 8.5)
      ctx.lineTo(31, -3 + n * 8.5)
    }
    ctx.stroke()
    ctx.fillStyle = '#5e6372'
    ctx.fillRect(3, 3, 22, 22)
    ctx.fillStyle = '#3d424d'
    ctx.fillRect(3, 3, 22, 2)
    // Créneaux : brèches au milieu de chaque face
    ctx.fillStyle = '#5e6372'
    ctx.fillRect(11, -3, 6, 6)
    ctx.fillRect(-3, 11, 6, 6)
    ctx.fillRect(25, 11, 6, 6)
    ctx.fillRect(11, 25, 6, 6)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.fillRect(-3, -3, 34, 1.5)
    ctx.fillRect(-3, -3, 1.5, 34)
    torch(ctx, 14, 14, time, 5)
  } else {
    const g = ctx.createLinearGradient(-3, -3, 31, 31)
    g.addColorStop(0, '#6b778a')
    g.addColorStop(1, '#2f3744')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-3, 8)
    ctx.lineTo(8, -3)
    ctx.lineTo(31, -3)
    ctx.lineTo(31, 31)
    ctx.lineTo(-3, 31)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#1f2630'
    ctx.fillRect(4, 4, 20, 20)
    ctx.strokeStyle = '#0f141a'
    ctx.lineWidth = 1
    ctx.strokeRect(-2.5, -2.5, 33, 33)
    const pulse = 0.5 + 0.5 * Math.sin(time * 3)
    const dome = ctx.createRadialGradient(12, 12, 1, 14, 14, 10)
    dome.addColorStop(0, '#a7b6cc')
    dome.addColorStop(1, '#3b4252')
    ctx.fillStyle = dome
    ctx.beginPath()
    ctx.arc(14, 14, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = `rgba(128, 222, 234, ${0.5 + 0.45 * pulse})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(14, 14, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#eceff1'
    for (const [px, py] of [
      [1, 1],
      [27, 1],
      [1, 27],
      [27, 27]
    ]) {
      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ───────────────────────────────────────────────────────────── usure de la forteresse

function drawFortressWear(ctx: CanvasRenderingContext2D, ratio: number, time: number): void {
  if (ratio >= 0.9) return
  const wear = 1 - ratio
  ctx.fillStyle = `rgba(0, 0, 0, ${0.28 * wear})`
  ctx.fillRect(-3, -3, S + 6, S + 6)

  const count = ratio < 0.2 ? 9 : ratio < 0.35 ? 7 : ratio < 0.5 ? 5 : ratio < 0.7 ? 3 : 1
  const rnd = seeded(23)
  for (let i = 0; i < 9; i++) {
    // Neuf fissures tirées dans le même ordre : seule la quantité affichée varie
    const side = Math.floor(rnd() * 4)
    const along = 8 + rnd() * 104
    let px = side === 0 ? along : side === 1 ? S : side === 2 ? along : 0
    let py = side === 0 ? 0 : side === 1 ? along : side === 2 ? S : along
    const pts: Array<[number, number]> = [[px, py]]
    for (let s = 0; s < 5; s++) {
      px += (C - px) * 0.14 + (rnd() - 0.5) * 12
      py += (C - py) * 0.14 + (rnd() - 0.5) * 12
      pts.push([px, py])
    }
    if (i >= count) continue
    for (const [dx, color, lw] of [
      [1, 'rgba(255, 255, 255, 0.14)', 1],
      [0, 'rgba(10, 6, 4, 0.8)', 1.8]
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      ctx.beginPath()
      ctx.moveTo(pts[0][0] + dx, pts[0][1])
      for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s][0] + dx, pts[s][1])
      ctx.stroke()
    }
  }

  if (ratio < 0.45) {
    for (const [cx, cy] of [
      [14, 14],
      [106, 14],
      [14, 106],
      [106, 106]
    ]) {
      for (let n = 0; n < 3; n++) {
        const p = (time * 0.45 + n / 3 + cx * 0.003 + cy * 0.002) % 1
        ctx.fillStyle = `rgba(70, 70, 76, ${0.4 * (1 - p)})`
        ctx.beginPath()
        ctx.arc(cx + Math.sin(p * 6 + n) * 3, cy - p * 24, 3 + p * 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
