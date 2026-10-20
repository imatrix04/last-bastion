import { TILE } from './config/constants'
import type { Building } from './types'

/** Aléa déterministe propre à une case : l'aspect des pieux ne change pas d'une image à l'autre. */
function seeded(col: number, row: number, salt: number): () => number {
  let s = ((Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663) ^ Math.imul(salt + 1, 83492791)) >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Pieux : rondins taillés liés par une corde (1), éclats de roche sur dalle (2), lames d'acier sur plaque (3).
 * Les pointes sont décalées, inégales et penchées (par case) ; elles se cassent avec l'usure et tremblent
 * quand un ennemi marche dessus (active), avec une lueur rouge.
 */
export function drawSpikes(ctx: CanvasRenderingContext2D, b: Building, active: boolean, time: number): void {
  const x = b.col * TILE
  const y = b.row * TILE
  const rnd = seeded(b.col, b.row, 1)
  const level = b.level >= 3 ? 3 : b.level === 2 ? 2 : 1
  const ratio = b.maxHp > 0 ? b.hp / b.maxHp : 1

  drawBed(ctx, x, y, level, rnd)

  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      // Tirages dans un ordre fixe, quoi qu'il arrive ensuite
      const jx = (rnd() - 0.5) * 6
      const jy = (rnd() - 0.5) * 4
      const hRand = rnd()
      const lean = (rnd() - 0.5) * (level === 1 ? 0.5 : level === 2 ? 0.25 : 0.1)
      const shade = rnd()
      const stain = rnd()
      const breakAt = rnd()
      const broken = ratio < 0.85 && breakAt > ratio + 0.1
      const px = x + 8 + i * 12 + jx + (active ? Math.sin(time * 55 + i * 2 + j * 3) * 0.9 : 0)
      const py = y + 13 + j * 12 + jy
      let h = (level === 1 ? 8 : level === 2 ? 7 : 9) + hRand * 4
      if (active && !broken) h *= 1.15
      if (broken) h *= 0.35
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(lean)
      if (level === 1) woodStake(ctx, h, shade)
      else if (level === 2) stoneShard(ctx, h, shade, broken)
      else steelBlade(ctx, h, broken)
      if (level >= 2 && !broken && stain > 0.62) {
        ctx.fillStyle = 'rgba(120, 20, 16, 0.55)'
        ctx.beginPath()
        ctx.ellipse(0.5, -h + 2.5, 1.5, 2.2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  if (level === 1) drawRope(ctx, x, y, rnd)
  if (active) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 14)
    const glow = ctx.createRadialGradient(x + TILE / 2, y + TILE / 2, 2, x + TILE / 2, y + TILE / 2, TILE * 0.7)
    glow.addColorStop(0, `rgba(255, 70, 50, ${0.22 + 0.18 * pulse})`)
    glow.addColorStop(1, 'rgba(255, 70, 50, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(x, y, TILE, TILE)
  }
}

function drawBed(ctx: CanvasRenderingContext2D, x: number, y: number, level: number, rnd: () => number): void {
  if (level === 1) {
    ctx.fillStyle = 'rgba(38, 26, 16, 0.75)'
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
    ctx.strokeStyle = 'rgba(214, 180, 110, 0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let n = 0; n < 9; n++) {
      const sx = x + 4 + rnd() * 30
      const sy = y + 4 + rnd() * 32
      const a = rnd() * Math.PI
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + Math.cos(a) * 4, sy + Math.sin(a) * 2)
    }
    ctx.stroke()
  } else if (level === 2) {
    ctx.fillStyle = '#4f545f'
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(x + 2, y + 2, TILE - 4, 3)
    ctx.strokeStyle = '#30343d'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4)
    ctx.lineWidth = 1
    ctx.beginPath()
    const cx = x + 8 + rnd() * 24
    ctx.moveTo(cx, y + 3)
    ctx.lineTo(cx + (rnd() - 0.5) * 8, y + 20)
    ctx.lineTo(cx + (rnd() - 0.5) * 10, y + TILE - 3)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#1c232b'
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
    ctx.strokeStyle = '#cfd8dc'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4)
    ctx.fillStyle = '#eceff1'
    for (const [px, py] of [
      [5, 5],
      [TILE - 5, 5],
      [5, TILE - 5],
      [TILE - 5, TILE - 5]
    ]) {
      ctx.beginPath()
      ctx.arc(x + px, y + py, 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Pieu de bois : fût à bout taillé en biseau. */
function woodStake(ctx: CanvasRenderingContext2D, h: number, shade: number): void {
  const w = 2.6
  ctx.fillStyle = shade < 0.33 ? '#a07840' : shade < 0.66 ? '#8d6a38' : '#b08a52'
  ctx.strokeStyle = '#3a2812'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-w, 4)
  ctx.lineTo(-w, -h * 0.55)
  ctx.lineTo(0, -h)
  ctx.lineTo(w, -h * 0.55)
  ctx.lineTo(w, 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.fillRect(0.4, -h * 0.55, w - 0.4, h * 0.55 + 4)
  ctx.fillStyle = '#ecd6a4'
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(w * 0.7, -h * 0.68)
  ctx.lineTo(-w * 0.7, -h * 0.68)
  ctx.closePath()
  ctx.fill()
}

/** Éclat de roche : silhouette irrégulière, une face claire et une face sombre. */
function stoneShard(ctx: CanvasRenderingContext2D, h: number, shade: number, broken: boolean): void {
  const w = 4.2
  ctx.fillStyle = shade < 0.5 ? '#8d93a0' : '#7d8390'
  ctx.strokeStyle = '#3d424d'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-w, 4)
  ctx.lineTo(-w * 0.7, -h * 0.45)
  ctx.lineTo(-w * 0.2, -h * 0.6)
  ctx.lineTo(broken ? 0.5 : 0, -h)
  ctx.lineTo(w * 0.4, -h * 0.55)
  ctx.lineTo(w * 0.85, -h * 0.25)
  ctx.lineTo(w, 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(-w * 0.2, -h * 0.6)
  ctx.lineTo(-w * 0.7, -h * 0.45)
  ctx.lineTo(-w, 4)
  ctx.lineTo(-w * 0.1, 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#d3d8e2'
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(1.4, -h * 0.78)
  ctx.lineTo(-1.4, -h * 0.78)
  ctx.closePath()
  ctx.fill()
}

/** Lame d'acier : deux faces (claire / sombre) et une pointe brillante. */
function steelBlade(ctx: CanvasRenderingContext2D, h: number, broken: boolean): void {
  const w = 3.4
  ctx.strokeStyle = '#2b323f'
  ctx.lineWidth = 1
  ctx.fillStyle = '#d5dde6'
  ctx.beginPath()
  ctx.moveTo(-w, 4)
  ctx.lineTo(0, -h)
  ctx.lineTo(0, 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#7d8996'
  ctx.beginPath()
  ctx.moveTo(0, 4)
  ctx.lineTo(0, -h)
  ctx.lineTo(w, 4)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-w, 4)
  ctx.lineTo(0, -h)
  ctx.lineTo(w, 4)
  ctx.closePath()
  ctx.stroke()
  if (!broken) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, -h + 1.2, 1, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Corde qui lie les pieux de bois, avec un nœud sur chaque rangée. */
function drawRope(ctx: CanvasRenderingContext2D, x: number, y: number, rnd: () => number): void {
  const sag = 1 + rnd() * 2
  ctx.strokeStyle = '#d2b484'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x + 3, y + 22)
  ctx.quadraticCurveTo(x + TILE / 2, y + 22 + sag, x + TILE - 3, y + 22)
  ctx.stroke()
  ctx.fillStyle = '#b89a68'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(x + 8 + i * 12, y + 22 + sag * (1 - Math.pow((8 + i * 12 - TILE / 2) / (TILE / 2), 2)), 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
}
