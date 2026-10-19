import { ENEMIES, JUMP, isBossKind, type EnemyKind } from './config/constants'
import { TURRET_BASE_MAX_LEVEL, TURRET_BRANCHES, TURRET_SPEC_LEVEL, turretForm, type Branch, type TurretForm } from './config/turrets'
import type { Enemy } from './types'

/** Dessin des ennemis et des tourelles. Les corps sont pré-rendus une fois (canvas hors écran), seules les parties animées sont tracées à chaque image. */

const TAU = Math.PI * 2
/** Sur-échantillonnage des sprites pré-rendus (net sur écrans HiDPI). */
const SC = 2

export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, color: string): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
  ctx.fillStyle = color
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), Math.max(1, h * 0.35))
}

// ------------------------------------------------------------------- lueurs

const glowCache = new Map<string, HTMLCanvasElement>()

function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = color
    g.fillRect(0, 0, 64, 64)
    g.globalCompositeOperation = 'destination-in'
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)')
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.5)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  glowCache.set(color, c)
  return c
}

/** Halo doux. À utiliser avec `globalCompositeOperation = 'lighter'` pour un effet lumineux. */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * alpha
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = prev
}

// ------------------------------------------------------------ corps d'ennemis

type Painter = (g: CanvasRenderingContext2D, r: number, white: boolean) => void

const ink = (white: boolean): string => (white ? '#e0e0e0' : '#1b1b1b')
const tint = (color: string, white: boolean): string => (white ? '#ffffff' : color)

/** Ellipse ombrée (dégradé radial éclairé en haut à gauche) avec contour. */
function shaded(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  light: string,
  base: string,
  dark: string,
  white: boolean,
  line = 2.2
): void {
  const R = Math.max(rx, ry)
  if (white) {
    g.fillStyle = '#ffffff'
  } else {
    const grad = g.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R * 1.05)
    grad.addColorStop(0, light)
    grad.addColorStop(0.55, base)
    grad.addColorStop(1, dark)
    g.fillStyle = grad
  }
  g.strokeStyle = ink(white)
  g.lineWidth = line
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, TAU)
  g.fill()
  g.stroke()
}

function triangle(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  g.beginPath()
  g.moveTo(ax, ay)
  g.lineTo(bx, by)
  g.lineTo(cx, cy)
  g.closePath()
}

const paintGrunt: Painter = (g, r, white) => {
  shaded(g, -0.1 * r, 0, 0.95 * r, 0.85 * r, '#c5e86c', '#8bc34a', '#4e7a22', white)
  g.fillStyle = tint('rgba(74, 106, 36, 0.65)', white)
  g.beginPath()
  g.ellipse(-0.45 * r, 0.1 * r, 0.38 * r, 0.45 * r, 0.3, 0, TAU)
  g.fill()
  shaded(g, 0.62 * r, 0, 0.46 * r, 0.44 * r, '#d4f08a', '#9ccc65', '#5f8f2e', white)
  g.fillStyle = tint('#ff5252', white)
  for (const s of [-1, 1]) {
    g.beginPath()
    g.arc(0.82 * r, s * 0.2 * r, 0.13 * r, 0, TAU)
    g.fill()
  }
}

const paintRunner: Painter = (g, r, white) => {
  g.fillStyle = tint('#c76a10', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 1.6
  for (const s of [-1, 1]) {
    for (const x of [-0.1, -0.7]) {
      triangle(g, x * r, s * 0.5 * r, (x - 0.25) * r, s * 1.0 * r, (x - 0.55) * r, s * 0.5 * r)
      g.fill()
      g.stroke()
    }
  }
  shaded(g, -0.15 * r, 0, 1.3 * r, 0.62 * r, '#ffe0a3', '#ffb74d', '#d9791a', white)
  shaded(g, 0.95 * r, 0, 0.4 * r, 0.38 * r, '#ffe9bd', '#ffc56a', '#d9791a', white)
  g.fillStyle = tint('#fffde7', white)
  for (const s of [-1, 1]) {
    g.beginPath()
    g.arc(1.12 * r, s * 0.16 * r, 0.12 * r, 0, TAU)
    g.fill()
  }
}

const paintBrute: Painter = (g, r, white) => {
  shaded(g, 0, 0, 1.0 * r, 1.1 * r, '#dca0ea', '#ba68c8', '#6d2f80', white)
  g.fillStyle = tint('rgba(255, 255, 255, 0.12)', white)
  g.beginPath()
  g.ellipse(0.15 * r, 0, 0.5 * r, 0.55 * r, 0, 0, TAU)
  g.fill()
  for (const s of [-1, 1]) {
    shaded(g, 0.05 * r, s * 1.0 * r, 0.42 * r, 0.4 * r, '#eceff1', '#90a4ae', '#546e7a', white)
    g.fillStyle = tint('#37474f', white)
    g.beginPath()
    g.arc(0.05 * r, s * 1.0 * r, 0.09 * r, 0, TAU)
    g.fill()
  }
  shaded(g, 0.72 * r, 0, 0.42 * r, 0.4 * r, '#d596e2', '#c47ad3', '#7a3b8e', white)
  g.fillStyle = tint('#eceff1', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 1.6
  for (const s of [-1, 1]) {
    triangle(g, 0.55 * r, s * 0.35 * r, 1.25 * r, s * 0.95 * r, 0.95 * r, s * 0.3 * r)
    g.fill()
    g.stroke()
  }
  g.fillStyle = tint('#ff1744', white)
  for (const s of [-1, 1]) {
    g.beginPath()
    g.arc(0.95 * r, s * 0.14 * r, 0.09 * r, 0, TAU)
    g.fill()
  }
}

const paintSplitter: Painter = (g, r, white) => {
  shaded(g, 0, 0, r, r, '#c9fff2', '#26c6a2', '#0f8a6c', white, 2.4)
  g.strokeStyle = tint('rgba(255, 255, 255, 0.4)', white)
  g.lineWidth = 1.6
  g.beginPath()
  g.arc(-0.12 * r, -0.18 * r, 0.72 * r, Math.PI * 1.05, Math.PI * 1.65)
  g.stroke()
}

const paintBoss: Painter = (g, r, white) => {
  const n = 10
  g.fillStyle = tint('#eceff1', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 2.4
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    triangle(
      g,
      Math.cos(a - 0.2) * 0.95 * r,
      Math.sin(a - 0.2) * 0.95 * r,
      Math.cos(a) * 1.4 * r,
      Math.sin(a) * 1.4 * r,
      Math.cos(a + 0.2) * 0.95 * r,
      Math.sin(a + 0.2) * 0.95 * r
    )
    g.fill()
    g.stroke()
  }
  shaded(g, 0, 0, r, r, '#ff7a6b', '#e53935', '#7f0000', white, 4)
  g.strokeStyle = tint('rgba(0, 0, 0, 0.35)', white)
  g.lineWidth = 3
  g.beginPath()
  g.arc(0, 0, r * 0.68, 0, TAU)
  g.stroke()
  g.fillStyle = tint('#eceff1', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 2
  for (const s of [-1, 1]) {
    triangle(g, 0.55 * r, s * 0.45 * r, 1.2 * r, s * 0.95 * r, 0.95 * r, s * 0.3 * r)
    g.fill()
    g.stroke()
  }
}

const paintSpider: Painter = (g, r, white) => {
  // Abdomen : gros, sombre, marqué d'un sablier rouge
  shaded(g, -0.6 * r, 0, 0.95 * r, 0.82 * r, '#6b4770', '#2d1a35', '#0d0613', white, 2.4)
  if (!white) {
    g.fillStyle = '#e53935'
    g.beginPath()
    g.moveTo(-0.95 * r, -0.28 * r)
    g.lineTo(-0.35 * r, -0.05 * r)
    g.lineTo(-0.95 * r, 0.28 * r)
    g.closePath()
    g.moveTo(-0.15 * r, -0.28 * r)
    g.lineTo(-0.55 * r, 0)
    g.lineTo(-0.15 * r, 0.28 * r)
    g.closePath()
    g.fill()
    g.fillStyle = 'rgba(255, 255, 255, 0.12)'
    g.beginPath()
    g.ellipse(-0.75 * r, -0.4 * r, 0.3 * r, 0.14 * r, -0.4, 0, TAU)
    g.fill()
  }
  // Céphalothorax
  shaded(g, 0.45 * r, 0, 0.62 * r, 0.55 * r, '#5b3c62', '#2a1833', '#0d0613', white, 2.4)
  // Crochets
  g.fillStyle = tint('#f1e4d0', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 1.4
  for (const s of [-1, 1]) {
    g.beginPath()
    g.moveTo(0.85 * r, s * 0.12 * r)
    g.quadraticCurveTo(1.35 * r, s * 0.15 * r, 1.25 * r, s * 0.5 * r)
    g.quadraticCurveTo(1.05 * r, s * 0.28 * r, 0.85 * r, s * 0.3 * r)
    g.closePath()
    g.fill()
    g.stroke()
  }
}

/** Cracheur : corps vert acide renflé, grosse poche de venin à l'arrière et gueule ouverte à l'avant. */
const paintSpitter: Painter = (g, r, white) => {
  shaded(g, -0.35 * r, 0, 0.95 * r, 0.9 * r, '#e6ff9e', '#9ccc3a', '#4a6b10', white, 2.4)
  shaded(g, 0.5 * r, 0, 0.62 * r, 0.55 * r, '#d4f58a', '#7cb342', '#33521a', white, 2.2)
  g.fillStyle = tint('#33691e', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 1.4
  g.beginPath()
  g.ellipse(0.98 * r, 0, 0.26 * r, 0.3 * r, 0, 0, TAU)
  g.fill()
  g.stroke()
  if (!white) {
    g.fillStyle = 'rgba(178, 255, 89, 0.55)'
    for (const [x, y, s] of [[-0.6, -0.3, 0.2], [-0.3, 0.32, 0.16], [-0.8, 0.2, 0.12]]) {
      g.beginPath()
      g.arc(x * r, y * r, s * r, 0, TAU)
      g.fill()
    }
  }
}

/** Sauteur : corps rose ramassé, gros yeux, les pattes arrière sont dessinées à part (drawLimbs). */
const paintJumper: Painter = (g, r, white) => {
  shaded(g, -0.1 * r, 0, 1.0 * r, 0.8 * r, '#ffd1e0', '#f48fb1', '#a3446a', white, 2.2)
  shaded(g, 0.55 * r, 0, 0.5 * r, 0.45 * r, '#ffc1d6', '#ec6f9f', '#8a2f57', white, 2)
}

/** Colosse enragé : plus sombre, plus de pointes, cornes recourbées et pointes orange incandescentes. */
const paintRageBoss: Painter = (g, r, white) => {
  const n = 14
  g.strokeStyle = ink(white)
  g.lineWidth = 2.4
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    g.fillStyle = tint(i % 2 === 0 ? '#ffab91' : '#cfd8dc', white)
    triangle(
      g,
      Math.cos(a - 0.15) * 0.95 * r,
      Math.sin(a - 0.15) * 0.95 * r,
      Math.cos(a) * (i % 2 === 0 ? 1.65 : 1.35) * r,
      Math.sin(a) * (i % 2 === 0 ? 1.65 : 1.35) * r,
      Math.cos(a + 0.15) * 0.95 * r,
      Math.sin(a + 0.15) * 0.95 * r
    )
    g.fill()
    g.stroke()
  }
  shaded(g, 0, 0, r, r, '#d84315', '#8e0000', '#2b0000', white, 4)
  g.strokeStyle = tint('rgba(0, 0, 0, 0.5)', white)
  g.lineWidth = 3.5
  g.beginPath()
  g.arc(0, 0, r * 0.68, 0, TAU)
  g.stroke()
  g.fillStyle = tint('#eceff1', white)
  g.strokeStyle = ink(white)
  g.lineWidth = 2
  for (const s of [-1, 1]) {
    triangle(g, 0.5 * r, s * 0.4 * r, 1.45 * r, s * 1.05 * r, 0.9 * r, s * 0.2 * r)
    g.fill()
    g.stroke()
  }
}

const PAINTERS: Record<EnemyKind, Painter> = {
  spider: paintSpider,
  spitter: paintSpitter,
  jumper: paintJumper,
  grunt: paintGrunt,
  runner: paintRunner,
  brute: paintBrute,
  splitter: paintSplitter,
  boss: paintBoss,
  rageboss: paintRageBoss
}

const spriteCache = new Map<string, HTMLCanvasElement>()

const visualRadius = (e: Enemy): number => (isBossKind(e.kind) ? e.radius * 1.5 : e.radius)
const spriteHalf = (r: number): number => Math.ceil(r * 1.7)

function enemySprite(kind: EnemyKind, r: number, white: boolean): HTMLCanvasElement {
  const key = `${kind}:${white ? 'w' : 'n'}`
  let c = spriteCache.get(key)
  if (c) return c
  const half = spriteHalf(r)
  c = document.createElement('canvas')
  c.width = half * 2 * SC
  c.height = half * 2 * SC
  const g = c.getContext('2d')
  if (g) {
    g.scale(SC, SC)
    g.translate(half, half)
    g.lineJoin = 'round'
    PAINTERS[kind](g, r, white)
  }
  spriteCache.set(key, c)
  return c
}

// ------------------------------------------------------ parties animées

/** Membre : contour sombre + couleur, extrémités rondes. */
function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string, white: boolean): void {
  ctx.lineCap = 'round'
  ctx.strokeStyle = ink(white)
  ctx.lineWidth = w + 2.4
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.strokeStyle = tint(color, white)
  ctx.lineWidth = w
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function fist(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, white: boolean): void {
  ctx.fillStyle = tint(color, white)
  ctx.strokeStyle = ink(white)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.stroke()
}

/** Bras et jambes, dessinés sous le corps (repère de l'ennemi : x vers l'avant). */
function drawLimbs(ctx: CanvasRenderingContext2D, e: Enemy, r: number, ph: number, white: boolean): void {
  const atk = e.attacking
  switch (e.kind) {
    case 'spider': {
      // 8 pattes à deux segments, en marche alternée ; quand elle crache, les pattes avant se dressent.
      const casting = e.cast > 0
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const baseX = (0.7 - i * 0.42) * r
          const phase = ph * 1.3 + i * 1.6 + (s > 0 ? Math.PI : 0)
          const step = Math.sin(phase) * 0.28 * r
          const lift = Math.max(0, Math.cos(phase)) * 0.15 * r
          let kneeX = baseX + (i < 2 ? 0.55 : -0.25 - (i - 2) * 0.2) * r + step * 0.4
          let kneeY = s * (0.95 + i * 0.08) * r - lift * s
          let footX = baseX + (i < 2 ? 1.05 - i * 0.2 : -0.9 - (i - 3) * 0.2) * r + step
          let footY = s * (1.95 + (i === 1 || i === 2 ? 0.15 : 0)) * r
          if (casting && i === 0) {
            kneeX += 0.35 * r
            kneeY = s * 0.65 * r
            footX += 0.45 * r
            footY = s * 0.5 * r
          }
          limb(ctx, baseX, s * 0.35 * r, kneeX, kneeY, 0.22 * r, '#2a1836', white)
          limb(ctx, kneeX, kneeY, footX, footY, 0.15 * r, '#3a2248', white)
        }
      }
      break
    }
    case 'jumper': {
      // Pattes arrière repliées au sol, détendues pendant le bond
      const air = e.jump > 0
      for (const s of [-1, 1]) {
        const kneeX = air ? -0.9 * r : -0.2 * r
        const footX = air ? -1.5 * r : -0.7 * r
        limb(ctx, -0.3 * r, s * 0.5 * r, kneeX, s * 0.95 * r, 0.3 * r, '#c2467a', white)
        limb(ctx, kneeX, s * 0.95 * r, footX, s * (air ? 0.55 : 1.0) * r, 0.2 * r, '#e0608f', white)
        limb(ctx, 0.5 * r, s * 0.35 * r, 0.95 * r, s * 0.6 * r, 0.16 * r, '#e0608f', white)
      }
      break
    }
    case 'grunt': {
      const sw = Math.sin(ph)
      ctx.fillStyle = tint('#3e5a1c', white)
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(sw * s * 0.4 * r, s * 0.8 * r, 0.26 * r, 0.17 * r, 0, 0, TAU)
        ctx.fill()
      }
      const reach = atk ? 0.25 + 0.2 * Math.abs(Math.sin(ph * 1.6)) : 0
      for (const s of [-1, 1]) {
        const hx = (1.0 + reach + 0.2 * Math.sin(ph + (s > 0 ? Math.PI : 0))) * r
        const hy = s * 0.55 * r
        limb(ctx, 0.3 * r, s * 0.7 * r, hx, hy, 0.34 * r, '#6f9a35', white)
        fist(ctx, hx, hy, 0.22 * r, '#9ccc65', white)
      }
      break
    }
    case 'runner': {
      for (const s of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const a = Math.sin(ph * 1.6 + k * Math.PI + (s > 0 ? 0.8 : 0))
          const bx = (0.45 - k * 0.8) * r
          limb(ctx, bx, s * 0.45 * r, bx + a * 0.75 * r, s * 1.1 * r, 0.22 * r, '#b85d0e', white)
        }
      }
      break
    }
    case 'brute': {
      const reach = atk ? 0.3 * Math.abs(Math.sin(ph * 1.3)) : 0
      for (const s of [-1, 1]) {
        const hx = (1.0 + reach + 0.14 * Math.sin(ph + (s > 0 ? Math.PI : 0))) * r
        const hy = s * 1.0 * r
        limb(ctx, 0.05 * r, s * 0.95 * r, hx, hy, 0.5 * r, '#8e44a5', white)
        fist(ctx, hx, hy, 0.38 * r, '#a755bb', white)
      }
      break
    }
    case 'boss':
    case 'rageboss': {
      const rage = e.kind === 'rageboss'
      const reach = atk ? (rage ? 0.45 : 0.3) * Math.abs(Math.sin(ph * (rage ? 1.9 : 1.3))) : 0
      for (const s of [-1, 1]) {
        const hx = (1.05 + reach + 0.1 * Math.sin(ph + (s > 0 ? Math.PI : 0))) * r
        const hy = s * 0.95 * r
        limb(ctx, 0.1 * r, s * 0.85 * r, hx, hy, 0.4 * r, rage ? '#5d0000' : '#9b1c1c', white)
        fist(ctx, hx, hy, rage ? 0.38 * r : 0.3 * r, rage ? '#b71c1c' : '#c62828', white)
      }
      break
    }
    default:
      break
  }
}

/** Yeux qui brillent, noyaux de l'Éclateur, fissures du Colosse : dessinés par-dessus le corps. */
function drawFront(ctx: CanvasRenderingContext2D, e: Enemy, r: number, ph: number, t: number, white: boolean): void {
  switch (e.kind) {
    case 'spider': {
      if (white) break
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const pulse = 0.65 + 0.35 * Math.sin(t * 6 + e.id)
      const eyes: Array<[number, number, number]> = [
        [0.78, -0.2, 0.1],
        [0.78, 0.2, 0.1],
        [0.62, -0.34, 0.07],
        [0.62, 0.34, 0.07],
        [0.88, -0.07, 0.05],
        [0.88, 0.07, 0.05]
      ]
      for (const [ex, ey, er] of eyes) drawGlow(ctx, ex * r, ey * r, er * r * 6, '#ff1744', 0.55 * pulse)
      if (e.cast > 0) drawGlow(ctx, 1.25 * r, 0, r * 1.3, '#e8eaf6', 0.8)
      ctx.restore()
      ctx.fillStyle = '#ff5252'
      for (const [ex, ey, er] of eyes) {
        ctx.beginPath()
        ctx.arc(ex * r, ey * r, er * r, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = '#fff'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(0.8 * r, s * 0.2 * r, 0.035 * r, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'jumper': {
      if (white) break
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const s of [-1, 1]) drawGlow(ctx, 0.72 * r, s * 0.2 * r, 0.5 * r, '#ffee58', 0.6)
      ctx.restore()
      break
    }
    case 'spitter': {
      if (white) break
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const s of [-1, 1]) drawGlow(ctx, 0.62 * r, s * 0.22 * r, 0.5 * r, '#ff1744', 0.55)
      // Poche de venin qui gonfle pendant la préparation du tir
      drawGlow(ctx, 1.0 * r, 0, r * (e.cast > 0 ? 1.7 : 0.9), '#b2ff59', e.cast > 0 ? 0.9 : 0.4)
      ctx.restore()
      break
    }
    case 'splitter': {
      const spin = t * 0.5 + e.id
      for (let i = 0; i < 4; i++) {
        const a = spin + (i * Math.PI) / 2 + Math.PI / 4
        const nx = Math.cos(a) * 0.4 * r
        const ny = Math.sin(a) * 0.4 * r
        const nr = 0.25 * r * (1 + 0.18 * Math.sin(ph * 2 + i * 1.5))
        ctx.fillStyle = white ? '#e0f2f1' : 'rgba(10, 92, 73, 0.88)'
        ctx.beginPath()
        ctx.arc(nx, ny, nr, 0, TAU)
        ctx.fill()
        if (!white) {
          ctx.fillStyle = 'rgba(127, 255, 212, 0.6)'
          ctx.beginPath()
          ctx.arc(nx - nr * 0.3, ny - nr * 0.3, nr * 0.35, 0, TAU)
          ctx.fill()
        }
      }
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(0.72 * r, s * 0.3 * r, 0.16 * r, 0, TAU)
        ctx.fill()
        ctx.fillStyle = white ? '#9e9e9e' : '#06352a'
        ctx.beginPath()
        ctx.arc(0.77 * r, s * 0.3 * r, 0.08 * r, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'boss':
    case 'rageboss': {
      if (white) break
      const rage = e.kind === 'rageboss'
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 0; i < (rage ? 8 : 5); i++) {
        const a = 0.9 + i * (rage ? 0.8 : 1.25)
        const pulse = 0.5 + 0.4 * Math.sin(t * (rage ? 6 : 3) + i * 1.3)
        ctx.strokeStyle = rage ? `rgba(255, 82, 82, ${pulse})` : `rgba(255, 171, 64, ${pulse})`
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 0.1 * r, Math.sin(a) * 0.1 * r)
        ctx.lineTo(Math.cos(a + 0.2) * 0.4 * r, Math.sin(a + 0.2) * 0.4 * r)
        ctx.lineTo(Math.cos(a - 0.15) * 0.6 * r, Math.sin(a - 0.15) * 0.6 * r)
        ctx.lineTo(Math.cos(a + 0.05) * 0.85 * r, Math.sin(a + 0.05) * 0.85 * r)
        ctx.stroke()
      }
      for (const s of [-1, 1]) drawGlow(ctx, 0.62 * r, s * 0.28 * r, 0.5 * r, rage ? '#ff1744' : '#ffeb3b', 0.8)
      ctx.restore()
      ctx.fillStyle = rage ? '#ffffff' : '#ffeb3b'
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(0.62 * r, s * 0.28 * r, 0.12 * r, 0.07 * r, s * 0.4, 0, TAU)
        ctx.fill()
      }
      break
    }
    case 'grunt':
    case 'runner':
    case 'brute': {
      if (white) break
      const spec = e.kind === 'grunt' ? [0.82, 0.2, '#ff5252'] : e.kind === 'runner' ? [1.12, 0.16, '#ffee58'] : [0.95, 0.14, '#ff1744']
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const s of [-1, 1]) drawGlow(ctx, (spec[0] as number) * r, s * (spec[1] as number) * r, 0.55 * r, spec[2] as string, 0.55)
      ctx.restore()
      break
    }
  }
}

const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** Ennemis affichés derrière eux : images rémanentes du Coureur. */
export function drawEnemyTrail(ctx: CanvasRenderingContext2D, e: Enemy): void {
  if (e.kind !== 'runner' || e.age < 0.5 || e.attacking) return
  const r = visualRadius(e)
  const half = spriteHalf(r)
  const sprite = enemySprite(e.kind, r, false)
  const dx = Math.cos(e.face)
  const dy = Math.sin(e.face)
  for (let i = 1; i <= 3; i++) {
    ctx.save()
    ctx.globalAlpha = 0.24 / i
    ctx.translate(e.x - dx * 7 * i, e.y - dy * 7 * i)
    ctx.rotate(e.face)
    ctx.drawImage(sprite, -half, -half, half * 2, half * 2)
    ctx.restore()
  }
}

/** Flammes qui lèchent un monstre en feu (trois langues qui vacillent, en lumière additive). */
function drawFlames(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawGlow(ctx, x, y - r * 0.2, r * 1.7, '#ff6d00', 0.3 + 0.08 * Math.sin(t * 12 + seed))
  for (let k = 0; k < 3; k++) {
    const phase = t * 9 + k * 2.1 + seed * 1.3
    const h = r * (1.0 + 0.45 * Math.sin(phase))
    const fx = x + (k - 1) * r * 0.55 + Math.sin(phase * 0.7) * r * 0.12
    const base = y + r * 0.1
    ctx.fillStyle = k === 1 ? '#ffd180' : '#ff9100'
    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.moveTo(fx - r * 0.28, base)
    ctx.quadraticCurveTo(fx - r * 0.2, base - h * 0.6, fx + Math.sin(phase * 1.4) * r * 0.1, base - h)
    ctx.quadraticCurveTo(fx + r * 0.2, base - h * 0.6, fx + r * 0.28, base)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number): void {
  const def = ENEMIES[e.kind]
  const r = visualRadius(e)
  const half = spriteHalf(r)
  const white = e.flash > 0
  const appear = Math.min(1, e.age / 0.45)
  const grow = appear < 1 ? Math.max(0.05, easeOutBack(appear)) : 1
  const alpha = Math.min(1, e.age / 0.25)
  const ph = t * def.speed * 0.11 + e.id * 1.7

  // Ombre
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(e.x + 2, e.y + r - 2, r * 0.9 * grow, r * 0.4 * grow, 0, 0, TAU)
  ctx.fill()

  // Aura du Colosse (plus large, plus vive et plus rapide chez le Colosse enragé)
  if (isBossKind(e.kind)) {
    const rage = e.kind === 'rageboss'
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, e.x, e.y, r * (rage ? 2.9 : 2.3) * grow, rage ? '#ff1744' : '#e53935', (rage ? 0.4 : 0.3) + 0.12 * Math.sin(t * (rage ? 6 : 3)))
    ctx.restore()
  }

  // Bond du Sauteur : le corps monte en arc au-dessus de son ombre
  const lift = e.jump > 0 && e.jumpDur > 0 ? Math.sin(Math.PI * (1 - e.jump / e.jumpDur)) * JUMP.height : 0
  ctx.save()
  ctx.translate(e.x, e.y - lift)
  ctx.scale(grow * (1 + lift / 70), grow * (1 + lift / 70))
  // Éclateur sur le point d'éclater : il tremble
  if (e.kind === 'splitter' && e.hp / e.maxHp < 0.35) ctx.translate((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6)
  ctx.rotate(e.face + Math.sin(ph) * (e.kind === 'splitter' ? 0 : 0.07))

  // Piétinement du Brute / respiration de l'Éclateur / coup reçu
  let sx = 1
  let sy = 1
  if (e.kind === 'brute') {
    sx = 1 + 0.05 * Math.sin(ph * 2)
    sy = 1 - 0.05 * Math.sin(ph * 2)
  } else if (e.kind === 'splitter') {
    sx = 1 + 0.07 * Math.sin(ph * 1.3)
    sy = 1 - 0.07 * Math.sin(ph * 1.3)
  }
  if (white) {
    sx *= 1.1
    sy *= 0.92
  }
  ctx.scale(sx, sy)

  drawLimbs(ctx, e, r, ph, false)
  ctx.drawImage(enemySprite(e.kind, r, false), -half, -half, half * 2, half * 2)
  drawFront(ctx, e, r, ph, t, false)
  if (white) {
    // Flash d'impact : voile blanc par-dessus, pour garder les contours et les détails visibles.
    ctx.globalAlpha = alpha * 0.7
    ctx.drawImage(enemySprite(e.kind, r, true), -half, -half, half * 2, half * 2)
  }
  ctx.restore()
  ctx.globalAlpha = 1

  if (e.burnT > 0) drawFlames(ctx, e.x, e.y, r, t, e.id)

  // Cible prioritaire du tir du joueur : réticule vert qui pulse autour du Cracheur
  if (e.kind === 'spitter') {
    ctx.strokeStyle = `rgba(178, 255, 89, ${0.55 + 0.3 * Math.sin(t * 8)})`
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(e.x, e.y, r + 6 + Math.sin(t * 8) * 1.5, 0, TAU)
    ctx.stroke()
  }

  if (e.hp < e.maxHp || isBossKind(e.kind)) {
    const w = Math.max(18, r * 2)
    const ratio = e.hp / e.maxHp
    drawBar(ctx, e.x - w / 2, e.y - r - 11, w, 4, ratio, ratio > 0.5 ? '#ef5350' : ratio > 0.25 ? '#ff7043' : '#ffb300')
  }
}

// ------------------------------------------------------------------ tourelles

export interface TurretLook {
  level: number
  branch: Branch
  /** Angle du canon (radians). */
  angle: number
  /** Recul du canon (1 → 0). */
  recoil: number
  /** Canon qui a tiré en dernier (double canon). */
  side: number
  /** Rebond d'amélioration (1 → 0). */
  pop: number
  /** Rang d'Overclocking (0 = aucun) : halo orange et éclairs. */
  boost?: number
  /** Secondes restantes sous une toile d'araignée. */
  web?: number
}

// ---- Tourelles : socle pré-rendu + parties animées dessinées à chaque image ----

const turretBaseCache = new Map<string, HTMLCanvasElement>()

/** Hasard déterministe à partir d'un entier (éclairs, scintillements) : pas d'état, pas de Math.random à chaque image. */
const hash01 = (n: number): number => {
  const v = Math.sin(n * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

/** Carré à coins coupés (plaque blindée) de demi-côté h, chanfrein c. */
function chamfer(g: CanvasRenderingContext2D, h: number, c: number): void {
  g.beginPath()
  g.moveTo(-h + c, -h)
  g.lineTo(h - c, -h)
  g.lineTo(h, -h + c)
  g.lineTo(h, h - c)
  g.lineTo(h - c, h)
  g.lineTo(-h + c, h)
  g.lineTo(-h, h - c)
  g.lineTo(-h, -h + c)
  g.closePath()
}

function hexBolt(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  g.fillStyle = 'rgba(0, 0, 0, 0.55)'
  g.beginPath()
  for (let i = 0; i < 6; i++) g.lineTo(x + Math.cos((i * TAU) / 6) * (r + 0.7), y + 0.5 + Math.sin((i * TAU) / 6) * (r + 0.7))
  g.fill()
  g.fillStyle = color
  g.beginPath()
  for (let i = 0; i < 6; i++) g.lineTo(x + Math.cos((i * TAU) / 6) * r, y + Math.sin((i * TAU) / 6) * r)
  g.fill()
  g.fillStyle = 'rgba(255, 255, 255, 0.5)'
  g.fillRect(x - r * 0.3, y - r * 0.55, r * 0.6, r * 0.3)
}

/**
 * Socle d'une tourelle (statique, donc dessiné une seule fois par apparence) : plaque blindée à coins coupés,
 * biseau, évents, boulons, liserés. Chaque niveau ajoute du blindage ; les évolutions ont leur marquage.
 */
function turretBase(form: TurretForm, level: number, tier: number, accent: string): HTMLCanvasElement {
  const key = `${form}:${Math.min(level, 3)}:${tier}:${accent}`
  const cached = turretBaseCache.get(key)
  if (cached) return cached
  const size = 48
  const c = document.createElement('canvas')
  c.width = size * SC
  c.height = size * SC
  const g = c.getContext('2d')
  if (!g) return c
  g.scale(SC, SC)
  g.translate(size / 2, size / 2)
  g.lineJoin = 'round'
  const branch = form !== 'basic'
  const trim = branch ? accent : level >= 3 ? '#ffca28' : '#90a4ae'

  // Ombre portée
  g.save()
  g.translate(2, 3.5)
  g.fillStyle = 'rgba(0, 0, 0, 0.38)'
  chamfer(g, 17.5, 4.5)
  g.fill()
  g.restore()

  // Cadre extérieur des niveaux de branche
  if (tier >= 1) {
    g.fillStyle = '#1c262b'
    chamfer(g, 20, 5.5)
    g.fill()
    g.strokeStyle = accent
    g.lineWidth = 1.3
    g.globalAlpha = 0.85
    chamfer(g, 19.4, 5.2)
    g.stroke()
    g.globalAlpha = 1
  }

  // Plaque principale : dégradé métallique
  const plate = g.createLinearGradient(-17, -17, 17, 17)
  plate.addColorStop(0, '#6b7c85')
  plate.addColorStop(0.45, '#40525b')
  plate.addColorStop(1, '#202c32')
  g.fillStyle = plate
  chamfer(g, 17, 4.5)
  g.fill()

  // Biseau : lumière en haut à gauche, ombre en bas à droite
  g.lineWidth = 1.4
  g.strokeStyle = 'rgba(255, 255, 255, 0.28)'
  g.beginPath()
  g.moveTo(-17, 12.5)
  g.lineTo(-17, -12.5)
  g.lineTo(-12.5, -17)
  g.lineTo(12.5, -17)
  g.stroke()
  g.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  g.beginPath()
  g.moveTo(17, -12.5)
  g.lineTo(17, 12.5)
  g.lineTo(12.5, 17)
  g.lineTo(-12.5, 17)
  g.stroke()

  // Panneau intérieur creusé
  g.fillStyle = 'rgba(0, 0, 0, 0.24)'
  chamfer(g, 13.2, 3.4)
  g.fill()
  g.strokeStyle = 'rgba(255, 255, 255, 0.07)'
  g.lineWidth = 1
  chamfer(g, 13.2, 3.4)
  g.stroke()

  // Évents sur les flancs
  g.fillStyle = 'rgba(0, 0, 0, 0.55)'
  for (let i = 0; i < 3; i++) {
    g.fillRect(-15.4, -5 + i * 3.6, 2.6, 1.5)
    g.fillRect(12.8, -5 + i * 3.6, 2.6, 1.5)
  }

  // Liseré : argent au niveau 2, or au niveau 3, couleur de la branche ensuite
  if (level >= 2 || branch) {
    g.strokeStyle = trim
    g.lineWidth = 1.2
    g.globalAlpha = 0.9
    chamfer(g, 15.4, 3.8)
    g.stroke()
    g.globalAlpha = 1
  }

  // Boulons d'angle
  if (level >= 2) {
    const boltColor = level >= 3 || branch ? '#ffe082' : '#cfd8dc'
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) hexBolt(g, sx * 12.4, sy * 12.4, 1.9, boltColor)
  }

  // Plaques d'angle (niveau 6 et plus de branche)
  if (tier >= 2) {
    g.fillStyle = accent
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        g.beginPath()
        g.moveTo(sx * 18.5, sy * 18.5)
        g.lineTo(sx * 18.5, sy * 10.5)
        g.lineTo(sx * 10.5, sy * 18.5)
        g.closePath()
        g.fill()
        g.fillStyle = 'rgba(0, 0, 0, 0.3)'
        g.beginPath()
        g.moveTo(sx * 18.5, sy * 18.5)
        g.lineTo(sx * 18.5, sy * 14.5)
        g.lineTo(sx * 14.5, sy * 18.5)
        g.closePath()
        g.fill()
        g.fillStyle = accent
      }
    }
  }

  // Marquages des évolutions : chevrons jaunes (minigun), bandes de danger (explosif)
  if (form === 'minigun') {
    g.strokeStyle = '#ffee58'
    g.lineWidth = 1.6
    for (let i = 0; i < 3; i++) {
      g.beginPath()
      g.moveTo(-7 + i * 5, 14.8)
      g.lineTo(-4.5 + i * 5, 12.4)
      g.lineTo(-2 + i * 5, 14.8)
      g.stroke()
    }
  } else if (form === 'explosive') {
    g.save()
    chamfer(g, 17, 4.5)
    g.clip()
    for (let i = -6; i < 6; i++) {
      g.fillStyle = i % 2 === 0 ? '#ff5722' : '#1b1b1b'
      g.beginPath()
      g.moveTo(-10 + i * 4, 17)
      g.lineTo(-6 + i * 4, 17)
      g.lineTo(-2 + i * 4, 13.6)
      g.lineTo(-6 + i * 4, 13.6)
      g.closePath()
      g.fill()
    }
    g.restore()
  }

  turretBaseCache.set(key, c)
  return c
}

/** Tube de canon : métal éclairé par le dessus, avec reflet et ombre. */
function barrelTube(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, h: number): void {
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2)
  g.addColorStop(0, '#f5f7f8')
  g.addColorStop(0.3, '#b9c4c9')
  g.addColorStop(0.7, '#6f828b')
  g.addColorStop(1, '#2d3b42')
  ctx.fillStyle = g
  ctx.fillRect(x, y - h / 2, len, h)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.fillRect(x, y - h / 2 + 0.5, len, Math.max(0.6, h * 0.12))
}

/** Lueur de bouche après un tir (le canon chauffe). */
function muzzleHeat(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, heat: number, color: string): void {
  if (heat <= 0.02) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawGlow(ctx, x, y, r, color, Math.min(1, heat) * 0.9)
  ctx.restore()
}

/** Éclairs d'Overclocking : de petits arcs qui crépitent autour du socle, plus nombreux aux rangs 3 et 5. */
function overclockArcs(ctx: CanvasRenderingContext2D, boost: number, time: number): void {
  const arcs = 1 + (boost >= 3 ? 1 : 0) + (boost >= 5 ? 1 : 0)
  const frame = Math.floor(time * 14)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < arcs; i++) {
    const seed = frame * 7 + i * 31
    const a0 = hash01(seed) * TAU
    const span = 0.45 + hash01(seed + 1) * 0.4
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? 'rgba(255, 145, 0, 0.55)' : boost >= 5 ? '#fff3b0' : '#ffe082'
      ctx.lineWidth = pass === 0 ? 3 : 1.1
      ctx.beginPath()
      for (let s = 0; s <= 5; s++) {
        const a = a0 + (span * s) / 5
        const edge = 17.6 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
        const r = Math.min(edge, 23) + 0.8 + hash01(seed + s * 3 + 5) * 2.6
        const px = Math.cos(a) * r
        const py = Math.sin(a) * r
        if (s === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** Tourelle centrée en (cx, cy), tuile de 40 px. Sert à la partie et aux aperçus du pop-up de choix. */
export function drawTurret(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: TurretLook, time: number): void {
  const form = turretForm(t.level, t.branch)
  const accent = form === 'minigun' ? '#ffee58' : form === 'explosive' ? '#ff5722' : t.branch !== 0 ? TURRET_BRANCHES[t.branch].accent : '#80deea'
  // Niveaux de branche : 0 au niveau 4, jusqu'à 3 au niveau 7. Chaque niveau ajoute du blindage et de la lumière.
  const tier = t.branch !== 0 ? Math.min(3, Math.max(0, t.level - TURRET_SPEC_LEVEL)) : 0
  // Évolution : 0 avant le niveau 8, puis 1 à 3 (niveaux 8 à 10).
  const evo = Math.max(0, t.level - TURRET_BASE_MAX_LEVEL)
  const boost = t.boost ?? 0
  const heat = t.recoil
  ctx.save()
  ctx.translate(cx, cy)
  const pop = 1 + 0.3 * t.pop
  ctx.scale(pop, pop)

  // Halo d'Overclocking et lueur de branche (additifs, sous le socle)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  if (boost > 0) drawGlow(ctx, 0, 0, 36 + boost * 1.5, '#ff9100', 0.22 + boost * 0.03 + 0.12 * Math.sin(time * (6 + boost)))
  if (t.branch !== 0) drawGlow(ctx, 0, 0, 30 + tier * 5, accent, 0.26 + tier * 0.05 + 0.1 * Math.sin(time * (3 + tier)))
  ctx.restore()

  // Socle pré-rendu
  ctx.drawImage(turretBase(form, t.level, tier, accent), -24, -24, 48, 48)

  // Cadre lumineux des niveaux 7+ et des évolutions : il respire
  if (tier >= 3 || evo > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.14 + 0.16 * (0.5 + 0.5 * Math.sin(time * 3.2)) + evo * 0.04
    chamfer(ctx, 19.6, 5.6)
    ctx.stroke()
    ctx.lineWidth = 3.4
    ctx.globalAlpha *= 0.4
    ctx.stroke()
    ctx.restore()
  }

  // Voyants d'état : une chenille de LED le long du bord bas, plus vive juste après un tir
  for (let i = 0; i < 5; i++) {
    const on = Math.max(0, Math.sin(time * 4.2 - i * 0.9)) * 0.6 + heat * 0.7
    ctx.fillStyle = t.level >= 2 || t.branch !== 0 ? accent : '#80deea'
    ctx.globalAlpha = 0.18 + Math.min(0.82, on)
    ctx.fillRect(-9 + i * 4.5, 14.2, 2.4, 1.6)
  }
  ctx.globalAlpha = 1

  // Couronne tournante : anneau sombre, graduations qui suivent le canon, balayage de radar
  const ring = ctx.createRadialGradient(-3, -3, 2, 0, 0, 13.5)
  ring.addColorStop(0, '#78909c')
  ring.addColorStop(1, '#263238')
  ctx.fillStyle = ring
  ctx.beginPath()
  ctx.arc(0, 0, 13.4, 0, TAU)
  ctx.fill()
  ctx.save()
  ctx.rotate(t.angle)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU
    const r0 = i % 3 === 0 ? 10.4 : 11.6
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    ctx.lineTo(Math.cos(a) * 12.8, Math.sin(a) * 12.8)
  }
  ctx.stroke()
  ctx.restore()
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  const sweep = time * 1.7
  for (let k = 0; k < 4; k++) {
    ctx.globalAlpha = 0.5 * (1 - k / 4)
    ctx.beginPath()
    ctx.arc(0, 0, 11.4, sweep - k * 0.16, sweep - k * 0.16 + 0.4)
    ctx.stroke()
  }
  ctx.restore()

  // Canons
  ctx.rotate(t.angle)
  if (form === 'minigun') {
    // Bloc moteur, tambour de six tubes qui tourne (plus vite juste après un tir) et bande de munitions
    const kick = t.recoil * 3
    const len = 21 + evo * 1.5
    const spin = time * 7 + t.recoil * 2.2
    ctx.fillStyle = '#2d3b42'
    ctx.fillRect(-4 - kick, -9, 10, 18)
    const motor = ctx.createLinearGradient(0, -9, 0, 9)
    motor.addColorStop(0, '#78909c')
    motor.addColorStop(1, '#263238')
    ctx.fillStyle = motor
    ctx.fillRect(-3 - kick, -8, 8, 16)
    // Bande de munitions : petites douilles dorées
    ctx.fillStyle = '#5d4a1f'
    ctx.fillRect(-8 - kick, 4, 6, 6)
    ctx.fillStyle = '#ffd54f'
    for (let i = 0; i < 3; i++) ctx.fillRect(-7.2 - kick + i * 1.8, 4.8, 1.2, 4.4)
    const tubes: Array<{ y: number; d: number }> = []
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * TAU) / 6
      tubes.push({ y: Math.sin(a) * 5.6, d: Math.cos(a) })
    }
    tubes.sort((a, b) => a.d - b.d)
    for (const tube of tubes) {
      const h = 2.2 + 0.9 * (tube.d + 1) * 0.5
      barrelTube(ctx, 5 - kick, tube.y, len, h)
      ctx.fillStyle = accent
      ctx.globalAlpha = 0.55 + 0.45 * ((tube.d + 1) / 2)
      ctx.fillRect(5 + len - 3 - kick, tube.y - h / 2, 3, h)
      ctx.globalAlpha = 1
    }
    // Flou de rotation après un tir
    if (heat > 0.15) {
      ctx.globalAlpha = heat * 0.3
      ctx.fillStyle = '#eceff1'
      ctx.fillRect(5 - kick, -6.5, len, 13)
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = '#37474f'
    ctx.fillRect(len - 5 - kick, -7.4, 3, 14.8)
    ctx.fillRect(5 - kick, -7.4, 2, 14.8)
    muzzleHeat(ctx, 5 + len + 2 - kick, 0, 14, heat, '#ffee58')
  } else if (form === 'explosive') {
    // Mortier massif : chambre orange incandescente, bandes de danger, gueule évasée
    const kick = t.recoil * 7
    const ext = evo * 1.4
    const glowPulse = 0.5 + 0.5 * Math.sin(time * 4)
    ctx.fillStyle = '#2b1d18'
    ctx.fillRect(-4 - kick, -8.5 - evo * 0.3, 26 + ext, 17 + evo * 0.6)
    const body = ctx.createLinearGradient(0, -7, 0, 7)
    body.addColorStop(0, '#8d6e63')
    body.addColorStop(0.5, '#5d4037')
    body.addColorStop(1, '#2b1d18')
    ctx.fillStyle = body
    ctx.fillRect(-3 - kick, -7.5 - evo * 0.3, 24 + ext, 15 + evo * 0.6)
    // Chambre incandescente
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, 6 - kick, 0, 11, '#ff6d00', 0.35 + 0.3 * glowPulse + heat * 0.4)
    ctx.restore()
    ctx.fillStyle = '#ff7043'
    ctx.fillRect(3 - kick, -3.2, 7, 6.4)
    ctx.fillStyle = '#ffd180'
    ctx.fillRect(4 - kick, -1.4, 5, 2.8)
    // Bandes de danger
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ff5722' : '#1b1b1b'
      ctx.fillRect(11 + i * 2.6 - kick, -8.5 - evo * 0.3, 1.8, 17 + evo * 0.6)
    }
    barrelTube(ctx, 12 - kick, 0, 12 + ext, 9)
    // Gueule évasée
    ctx.fillStyle = '#37474f'
    ctx.beginPath()
    ctx.moveTo(22 + ext - kick, -5.4)
    ctx.lineTo(29 + ext - kick, -10)
    ctx.lineTo(29 + ext - kick, 10)
    ctx.lineTo(22 + ext - kick, 5.4)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#10171a'
    ctx.fillRect(27 + ext - kick, -8.4, 2.4, 16.8)
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(26 + ext - kick, 0, 4.2, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#ffd180'
    ctx.beginPath()
    ctx.arc(26 + ext - kick, 0, 2, 0, TAU)
    ctx.fill()
    muzzleHeat(ctx, 29 + ext - kick, 0, 18, heat, '#ff6d00')
  } else if (t.branch === 1) {
    // Double canons : carénage commun, deux tubes ajourés qui reculent à tour de rôle
    ctx.fillStyle = '#2d3b42'
    ctx.beginPath()
    ctx.moveTo(-3, -9)
    ctx.lineTo(7, -8)
    ctx.lineTo(9, 0)
    ctx.lineTo(7, 8)
    ctx.lineTo(-3, 9)
    ctx.closePath()
    ctx.fill()
    const hull = ctx.createLinearGradient(0, -8, 0, 8)
    hull.addColorStop(0, '#90a4ae')
    hull.addColorStop(1, '#37474f')
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(-2, -7.8)
    ctx.lineTo(6, -7)
    ctx.lineTo(7.6, 0)
    ctx.lineTo(6, 7)
    ctx.lineTo(-2, 7.8)
    ctx.closePath()
    ctx.fill()
    for (const s of [-1, 1]) {
      const kick = (s === t.side ? t.recoil : t.recoil * 0.25) * 4
      const len = 19 + tier * 1.5
      barrelTube(ctx, 4 - kick, s * 4.6, len, 4.2)
      // Manchon ajouré
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      for (let i = 0; i < 3; i++) ctx.fillRect(9 - kick + i * 3.2, s * 4.6 - 1, 1.4, 2)
      ctx.fillStyle = '#263238'
      ctx.fillRect(4 - kick + len - 5, s * 4.6 - 3, 4, 6)
      ctx.fillStyle = accent
      ctx.fillRect(4 - kick + len - 1, s * 4.6 - 2.2, 2.6, 4.4)
      muzzleHeat(ctx, 4 - kick + len + 2, s * 4.6, 11, s === t.side ? heat : heat * 0.25, accent)
    }
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.7
    ctx.fillRect(1, -0.8, 5, 1.6)
    ctx.globalAlpha = 1
  } else if (t.branch === 2) {
    // Canon lourd : tube épais, manchon de recul à vérins hydrauliques, frein de bouche à fentes
    const kick = t.recoil * 7
    const ext = tier * 1.6
    // Vérins hydrauliques : la tige coulisse avec le recul
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#263238'
      ctx.fillRect(-2, s * 7.2 - 1.6, 12, 3.2)
      ctx.fillStyle = '#cfd8dc'
      ctx.fillRect(8 - kick * 0.6, s * 7.2 - 0.8, 9 + ext * 0.5, 1.6)
    }
    ctx.fillStyle = '#263238'
    ctx.fillRect(-3 - kick, -6.5 - tier * 0.3, 27 + ext, 13 + tier * 0.6)
    barrelTube(ctx, -2 - kick, 0, 25 + ext, 11 + tier * 0.6)
    ctx.fillStyle = accent
    ctx.fillRect(6 - kick, -6.3 - tier * 0.3, 2.6, 12.6 + tier * 0.6)
    if (tier >= 2) ctx.fillRect(12 - kick, -6.3, 2, 12.6)
    if (tier >= 3) ctx.fillRect(16 - kick, -6.3, 1.6, 12.6)
    // Frein de bouche à fentes
    ctx.fillStyle = '#37474f'
    ctx.fillRect(19 + ext - kick, -8, 7, 16)
    ctx.fillStyle = '#10171a'
    for (let i = 0; i < 3; i++) ctx.fillRect(20.2 + ext - kick + i * 2, -8, 1, 16)
    ctx.fillStyle = accent
    ctx.fillRect(25.4 + ext - kick, -3, 2, 6)
    muzzleHeat(ctx, 27 + ext - kick, 0, 16, heat, '#ffb74d')
  } else {
    // Tourelle de base : tube fuselé, bloc de culasse, capteur
    const kick = t.recoil * 4
    ctx.fillStyle = '#2d3b42'
    ctx.fillRect(-4 - kick, -4.5, 9, 9)
    barrelTube(ctx, 0 - kick, 0, 19, 5.6)
    if (t.level >= 2) {
      ctx.fillStyle = '#37474f'
      ctx.fillRect(4 - kick, -4.7, 4.4, 9.4)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fillRect(4.4 - kick, -4.2, 3.6, 1)
    }
    if (t.level >= 3) {
      ctx.fillStyle = '#ffca28'
      ctx.fillRect(10 - kick, -3.1, 1.4, 6.2)
    }
    ctx.fillStyle = accent
    ctx.fillRect(15 - kick, -2.2, 3.6, 4.4)
    muzzleHeat(ctx, 19.5 - kick, 0, 11, heat, '#fff59d')
  }
  ctx.rotate(-t.angle)

  // Dôme : sphère éclairée avec cœur lumineux qui pulse
  const dome = ctx.createRadialGradient(-2.4, -2.6, 0.8, 0, 0, 7.4)
  dome.addColorStop(0, t.branch !== 0 ? '#eceff1' : '#cfd8dc')
  dome.addColorStop(0.55, '#78909c')
  dome.addColorStop(1, '#263238')
  ctx.fillStyle = dome
  ctx.beginPath()
  ctx.arc(0, 0, 7, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  const coreAlpha = 0.65 + 0.35 * Math.sin(time * 3.4)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawGlow(ctx, 0, 0, 9, accent, 0.35 + 0.25 * coreAlpha + heat * 0.3)
  ctx.restore()
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.7 + 0.3 * coreAlpha
  ctx.beginPath()
  ctx.arc(0, 0, t.branch !== 0 ? 3 : 2.2, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-2.4, -3, 1.8, 1, -0.6, 0, TAU)
  ctx.fill()

  if (boost > 0) overclockArcs(ctx, boost, time)
  if (t.web && t.web > 0) drawWeb(ctx, Math.min(1, t.web))
  ctx.restore()
}

/** Toile d'araignée posée sur une arme (repère centré sur la tuile). */
function drawWeb(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.save()
  ctx.globalAlpha = 0.25 + 0.65 * alpha
  ctx.fillStyle = 'rgba(210, 215, 235, 0.22)'
  ctx.fillRect(-18, -18, 36, 36)
  ctx.strokeStyle = '#f1f3ff'
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21)
  }
  for (const rad of [6, 12, 18]) {
    for (let i = 0; i < 8; i++) {
      const a1 = (i * Math.PI) / 4 + Math.PI / 8
      const a2 = a1 + Math.PI / 4
      const m = rad * (1 - 0.1 * Math.sin(i * 2.3))
      ctx.moveTo(Math.cos(a1) * m, Math.sin(a1) * m)
      ctx.quadraticCurveTo(Math.cos((a1 + a2) / 2) * m * 0.88, Math.sin((a1 + a2) / 2) * m * 0.88, Math.cos(a2) * m, Math.sin(a2) * m)
    }
  }
  ctx.stroke()
  ctx.restore()
}
