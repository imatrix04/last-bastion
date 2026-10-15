import { ENEMIES, type Branch, type EnemyKind } from './constants'
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

const PAINTERS: Record<EnemyKind, Painter> = {
  spider: paintSpider,
  grunt: paintGrunt,
  runner: paintRunner,
  brute: paintBrute,
  splitter: paintSplitter,
  boss: paintBoss
}

const spriteCache = new Map<string, HTMLCanvasElement>()

const visualRadius = (e: Enemy): number => (e.kind === 'boss' ? e.radius * 1.5 : e.radius)
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
    case 'boss': {
      const reach = atk ? 0.3 * Math.abs(Math.sin(ph * 1.3)) : 0
      for (const s of [-1, 1]) {
        const hx = (1.05 + reach + 0.1 * Math.sin(ph + (s > 0 ? Math.PI : 0))) * r
        const hy = s * 0.95 * r
        limb(ctx, 0.1 * r, s * 0.85 * r, hx, hy, 0.4 * r, '#9b1c1c', white)
        fist(ctx, hx, hy, 0.3 * r, '#c62828', white)
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
    case 'boss': {
      if (white) break
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 0; i < 5; i++) {
        const a = 0.9 + i * 1.25
        const pulse = 0.5 + 0.4 * Math.sin(t * 3 + i * 1.3)
        ctx.strokeStyle = `rgba(255, 171, 64, ${pulse})`
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 0.1 * r, Math.sin(a) * 0.1 * r)
        ctx.lineTo(Math.cos(a + 0.2) * 0.4 * r, Math.sin(a + 0.2) * 0.4 * r)
        ctx.lineTo(Math.cos(a - 0.15) * 0.6 * r, Math.sin(a - 0.15) * 0.6 * r)
        ctx.lineTo(Math.cos(a + 0.05) * 0.85 * r, Math.sin(a + 0.05) * 0.85 * r)
        ctx.stroke()
      }
      for (const s of [-1, 1]) drawGlow(ctx, 0.62 * r, s * 0.28 * r, 0.5 * r, '#ffeb3b', 0.8)
      ctx.restore()
      ctx.fillStyle = '#ffeb3b'
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

  // Aura du Colosse
  if (e.kind === 'boss') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, e.x, e.y, r * 2.3 * grow, '#e53935', 0.3 + 0.12 * Math.sin(t * 3))
    ctx.restore()
  }

  ctx.save()
  ctx.translate(e.x, e.y)
  ctx.scale(grow, grow)
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

  if (e.hp < e.maxHp || e.kind === 'boss') {
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
  /** Overclocking : liseré et éclair orange. */
  boost?: boolean
  /** Secondes restantes sous une toile d'araignée. */
  web?: number
}

/** Tourelle centrée en (cx, cy), tuile de 40 px. Sert à la partie et aux aperçus du pop-up de choix. */
export function drawTurret(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: TurretLook, time: number): void {
  const accent = t.branch === 1 ? '#4dd0e1' : t.branch === 2 ? '#ff9800' : '#80deea'
  ctx.save()
  ctx.translate(cx, cy)
  const pop = 1 + 0.3 * t.pop
  ctx.scale(pop, pop)

  // Socle
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(-16, -13, 34, 34)
  if (t.boost) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, 0, 0, 34, '#ff9100', 0.3 + 0.12 * Math.sin(time * 7))
    ctx.restore()
  }
  if (t.branch !== 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, 0, 0, 30, accent, 0.28 + 0.1 * Math.sin(time * 4))
    ctx.restore()
  }
  ctx.fillStyle = '#37474f'
  ctx.fillRect(-17, -17, 34, 34)
  if (t.level >= 2) {
    ctx.strokeStyle = t.level >= 3 ? '#ffca28' : '#90a4ae'
    ctx.lineWidth = 2
    ctx.strokeRect(-16, -16, 32, 32)
    ctx.fillStyle = t.level >= 3 ? '#ffe082' : '#b0bec5'
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(sx * 13, sy * 13, 1.8, 0, TAU)
        ctx.fill()
      }
    }
  }

  // Couronne tournante
  ctx.fillStyle = t.level >= 2 ? '#607d8b' : '#546e7a'
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, TAU)
  ctx.fill()
  if (t.level >= 2) {
    ctx.strokeStyle = t.branch !== 0 ? accent : '#ffd54a'
    ctx.globalAlpha = 0.8
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(0, 0, 11, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Canons
  ctx.rotate(t.angle)
  if (t.branch === 1) {
    for (const s of [-1, 1]) {
      const kick = (s === t.side ? t.recoil : t.recoil * 0.25) * 4
      ctx.fillStyle = '#b0bec5'
      ctx.fillRect(2 - kick, s * 4.5 - 2.5, 18, 5)
      ctx.fillStyle = '#37474f'
      ctx.fillRect(2 - kick, s * 4.5 - 2.5, 4, 5)
      ctx.fillStyle = accent
      ctx.fillRect(16 - kick, s * 4.5 - 2, 4, 4)
    }
    ctx.fillStyle = '#546e7a'
    ctx.fillRect(0, -7.5, 5, 15)
  } else if (t.branch === 2) {
    const kick = t.recoil * 7
    ctx.fillStyle = '#455a64'
    ctx.fillRect(-1 - kick, -5.5, 24, 11)
    ctx.fillStyle = '#cfd8dc'
    ctx.fillRect(1 - kick, -4, 20, 8)
    ctx.fillStyle = '#ff9800'
    ctx.fillRect(7 - kick, -5.5, 3, 11)
    ctx.fillStyle = '#37474f'
    ctx.fillRect(18 - kick, -7.5, 6, 15)
    ctx.fillStyle = '#10171a'
    ctx.fillRect(20 - kick, -7.5, 1.5, 15)
    ctx.fillStyle = accent
    ctx.fillRect(23 - kick, -3, 2, 6)
  } else {
    const kick = t.recoil * 4
    ctx.fillStyle = '#cfd8dc'
    ctx.fillRect(0 - kick, -3.5, 19, 7)
    if (t.level >= 2) {
      ctx.fillStyle = '#90a4ae'
      ctx.fillRect(4 - kick, -4.5, 4, 9)
    }
    ctx.fillStyle = accent
    ctx.fillRect(15 - kick, -2.5, 4, 5)
  }
  ctx.rotate(-t.angle)

  // Dôme
  ctx.fillStyle = t.branch !== 0 ? '#90a4ae' : '#78909c'
  ctx.beginPath()
  ctx.arc(0, 0, 7, 0, TAU)
  ctx.fill()
  if (t.branch !== 0) {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(0, 0, 3, 0, TAU)
    ctx.fill()
  }
  if (t.boost) {
    // Éclair d'Overclocking dans le coin du socle
    ctx.fillStyle = '#ffca28'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(15, -17)
    ctx.lineTo(10, -9)
    ctx.lineTo(13.5, -9)
    ctx.lineTo(11, -2)
    ctx.lineTo(18, -11)
    ctx.lineTo(14, -11)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
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
