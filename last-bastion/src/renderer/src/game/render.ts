import { buildTarget, placementStatus } from './build'
import {
  BASE,
  BUILD_ORDER,
  COLS,
  ENEMIES,
  HEIGHT,
  PLAYER,
  PLAYER_COLORS,
  ROWS,
  TILE,
  TURRET,
  WIDTH
} from './constants'
import type { Building, Enemy, GameState, Player } from './types'

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

/** Fond pré-rendu : damier d'herbe, brins, couloirs d'apparition sur les bords. */
export function createBackground(scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(WIDTH * scale)
  canvas.height = Math.round(HEIGHT * scale)
  const g = canvas.getContext('2d')
  if (!g) return canvas
  g.scale(scale, scale)

  let seed = 1337
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      g.fillStyle = (row + col) % 2 === 0 ? '#1f3324' : '#1c2f21'
      g.fillRect(col * TILE, row * TILE, TILE, TILE)
    }
  }
  for (let i = 0; i < 320; i++) {
    g.fillStyle = rnd() < 0.5 ? '#27412b' : '#162419'
    g.fillRect(rnd() * WIDTH, rnd() * HEIGHT, 2, 3)
  }

  // Bord de carte : terre battue, c'est par là que viennent les monstres
  g.fillStyle = 'rgba(70, 40, 30, 0.45)'
  g.fillRect(0, 0, WIDTH, TILE)
  g.fillRect(0, HEIGHT - TILE, WIDTH, TILE)
  g.fillRect(0, TILE, TILE, HEIGHT - 2 * TILE)
  g.fillRect(WIDTH - TILE, TILE, TILE, HEIGHT - 2 * TILE)

  g.strokeStyle = 'rgba(255, 255, 255, 0.03)'
  g.lineWidth = 1
  g.beginPath()
  for (let c = 0; c <= COLS; c++) {
    g.moveTo(c * TILE + 0.5, 0)
    g.lineTo(c * TILE + 0.5, HEIGHT)
  }
  for (let r = 0; r <= ROWS; r++) {
    g.moveTo(0, r * TILE + 0.5)
    g.lineTo(WIDTH, r * TILE + 0.5)
  }
  g.stroke()
  return canvas
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, bg: CanvasImageSource): void {
  ctx.save()
  ctx.fillStyle = '#0b130e'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  if (state.shake > 0) {
    const s = state.shake * 7
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }
  ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT)

  drawGates(ctx, state)
  for (const b of state.grid) if (b && b.kind === 'spikes') drawBuilding(ctx, b)
  drawBase(ctx, state)
  for (const b of state.grid) if (b && b.kind !== 'spikes') drawBuilding(ctx, b)
  drawGhosts(ctx, state)
  for (const e of state.enemies) drawEnemy(ctx, e)
  for (const p of state.players) drawPlayer(ctx, p)
  drawBullets(ctx, state)
  drawFx(ctx, state)
  ctx.restore()
}

// --------------------------------------------------------------------- éléments

function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, color: string): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2)
  ctx.fillStyle = color
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h)
}

function drawGates(ctx: CanvasRenderingContext2D, state: GameState): void {
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 5)
  const alpha = state.phase === 'prep' ? 0.55 + 0.35 * pulse : 0.25
  for (const g of state.gates) {
    let dx = 1
    let dy = 0
    if (g.y < TILE) {
      dx = 0
      dy = 1
    } else if (g.y > HEIGHT - TILE) {
      dx = 0
      dy = -1
    } else if (g.x > WIDTH - TILE) {
      dx = -1
    }
    ctx.save()
    ctx.translate(g.x, g.y)
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 80)
    glow.addColorStop(0, `rgba(255, 80, 60, ${alpha * 0.6})`)
    glow.addColorStop(1, 'rgba(255, 80, 60, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, 80, 0, Math.PI * 2)
    ctx.fill()
    ctx.rotate(Math.atan2(dy, dx))
    ctx.strokeStyle = `rgba(255, 130, 110, ${alpha})`
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const slide = (state.time * 28) % 16
    for (let i = 0; i < 3; i++) {
      const ox = 6 + i * 16 + slide
      ctx.beginPath()
      ctx.moveTo(ox - 6, -9)
      ctx.lineTo(ox, 0)
      ctx.lineTo(ox - 6, 9)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawBase(ctx: CanvasRenderingContext2D, state: GameState): void {
  const x = BASE.col * TILE
  const y = BASE.row * TILE
  const w = BASE.cols * TILE
  const h = BASE.rows * TILE
  const ratio = state.baseHp / BASE.maxHp

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.fillRect(x + 6, y + 9, w, h)
  ctx.fillStyle = '#5d6270'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#8a90a0'
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12)
  ctx.fillStyle = '#464a56'
  ctx.fillRect(x + 18, y + 18, w - 36, h - 36)

  // Créneaux
  ctx.fillStyle = '#a3a9b8'
  for (let i = 0; i < BASE.cols * 2; i++) {
    const mx = x + 3 + i * (TILE / 2)
    ctx.fillRect(mx, y - 4, 14, 8)
    ctx.fillRect(mx, y + h - 4, 14, 8)
  }
  for (let i = 0; i < BASE.rows * 2; i++) {
    const my = y + 3 + i * (TILE / 2)
    ctx.fillRect(x - 4, my, 8, 14)
    ctx.fillRect(x + w - 4, my, 8, 14)
  }

  // Cristal central
  const pulse = 0.5 + 0.5 * Math.sin(state.time * 3)
  const cx = x + w / 2
  const cy = y + h / 2
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 64)
  glow.addColorStop(0, `rgba(120, 230, 255, ${0.5 + 0.25 * pulse})`)
  glow.addColorStop(1, 'rgba(120, 230, 255, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, 64, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7fe7ff'
  ctx.strokeStyle = '#e0fbff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx, cy - 28)
  ctx.lineTo(cx + 17, cy)
  ctx.lineTo(cx, cy + 28)
  ctx.lineTo(cx - 17, cy)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  if (ratio < 1) {
    ctx.fillStyle = `rgba(255, 40, 30, ${0.3 * (1 - ratio)})`
    ctx.fillRect(x, y, w, h)
  }
  drawBar(ctx, x + 8, y - 16, w - 16, 7, ratio, ratio > 0.5 ? '#66bb6a' : ratio > 0.25 ? '#ffa726' : '#ef5350')
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building): void {
  const x = b.col * TILE
  const y = b.row * TILE
  switch (b.kind) {
    case 'barricade': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(x + 5, y + 7, TILE - 6, TILE - 6)
      ctx.fillStyle = '#4a2f18'
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6)
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#9c6a35' : '#8b5a2b'
        ctx.fillRect(x + 5, y + 5 + i * 10, TILE - 10, 8)
      }
      ctx.fillStyle = '#cfd8dc'
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 8, y + 8 + i * 10, 2, 2)
        ctx.fillRect(x + TILE - 10, y + 8 + i * 10, 2, 2)
      }
      break
    }
    case 'wall': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(x + 3, y + 6, TILE, TILE)
      ctx.fillStyle = '#8d93a0'
      ctx.fillRect(x, y, TILE, TILE)
      ctx.strokeStyle = '#575c68'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y + 13)
      ctx.lineTo(x + TILE, y + 13)
      ctx.moveTo(x, y + 26)
      ctx.lineTo(x + TILE, y + 26)
      ctx.moveTo(x + 20, y)
      ctx.lineTo(x + 20, y + 13)
      ctx.moveTo(x + 10, y + 13)
      ctx.lineTo(x + 10, y + 26)
      ctx.moveTo(x + 30, y + 13)
      ctx.lineTo(x + 30, y + 26)
      ctx.moveTo(x + 20, y + 26)
      ctx.lineTo(x + 20, y + TILE)
      ctx.stroke()
      ctx.strokeStyle = '#b4bac6'
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2)
      break
    }
    case 'turret': {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(x + 4, y + 7, TILE - 6, TILE - 6)
      ctx.fillStyle = '#37474f'
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6)
      ctx.fillStyle = '#546e7a'
      ctx.beginPath()
      ctx.arc(x + TILE / 2, y + TILE / 2, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.translate(x + TILE / 2, y + TILE / 2)
      ctx.rotate(b.angle)
      ctx.fillStyle = '#cfd8dc'
      ctx.fillRect(0, -3.5, 19, 7)
      ctx.fillStyle = '#80deea'
      ctx.fillRect(15, -2.5, 4, 5)
      ctx.restore()
      ctx.fillStyle = '#78909c'
      ctx.beginPath()
      ctx.arc(x + TILE / 2, y + TILE / 2, 7, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'spikes': {
      ctx.fillStyle = 'rgba(30, 20, 15, 0.55)'
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const px = x + 7 + i * 13
          const py = y + 7 + j * 13
          ctx.fillStyle = '#b0bec5'
          ctx.beginPath()
          ctx.moveTo(px, py - 5)
          ctx.lineTo(px + 5, py + 5)
          ctx.lineTo(px - 5, py + 5)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#eceff1'
          ctx.fillRect(px - 0.5, py - 4, 1.5, 4)
        }
      }
      break
    }
  }
  if (b.hp < b.maxHp) {
    const ratio = b.hp / b.maxHp
    drawBar(ctx, x + 4, y - 5, TILE - 8, 4, ratio, ratio > 0.5 ? '#9ccc65' : ratio > 0.25 ? '#ffb74d' : '#e57373')
  }
}

function drawGhosts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.players) {
    const { col, row } = buildTarget(p)
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) continue
    const status = placementStatus(state, p, col, row)
    const rgb =
      status === 'ok'
        ? '90, 220, 130'
        : status === 'repair'
          ? '100, 180, 255'
          : status === 'poor'
            ? '255, 175, 70'
            : status === 'occupied'
              ? '220, 220, 220'
              : '255, 90, 90'
    const x = col * TILE
    const y = row * TILE
    ctx.fillStyle = `rgba(${rgb}, 0.25)`
    ctx.fillRect(x, y, TILE, TILE)
    ctx.strokeStyle = `rgba(${rgb}, 0.95)`
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2)
    ctx.setLineDash([])
    ctx.fillStyle = PLAYER_COLORS[p.id]
    ctx.fillRect(x + 1, y + 1, 9, 4)

    if (BUILD_ORDER[p.selected] === 'turret' && status === 'ok') {
      ctx.strokeStyle = 'rgba(128, 222, 234, 0.45)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + TILE / 2, y + TILE / 2, TURRET.range, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const def = ENEMIES[e.kind]
  const r = e.kind === 'boss' ? e.radius * 1.5 : e.radius
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(e.x + 2, e.y + r - 2, r * 0.9, r * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color
  ctx.strokeStyle = '#1b1b1b'
  ctx.lineWidth = e.kind === 'boss' ? 4 : 2.5
  ctx.beginPath()
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  if (e.kind === 'boss' || e.kind === 'brute') {
    // Petites cornes
    ctx.fillStyle = '#eceff1'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(e.x + s * r * 0.55, e.y - r * 0.7)
      ctx.lineTo(e.x + s * r * 0.95, e.y - r * 1.25)
      ctx.lineTo(e.x + s * r * 0.2, e.y - r * 0.95)
      ctx.closePath()
      ctx.fill()
    }
  }

  const eye = r * 0.22
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(e.x - r * 0.35, e.y - r * 0.15, eye, 0, Math.PI * 2)
  ctx.arc(e.x + r * 0.35, e.y - r * 0.15, eye, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b71c1c'
  ctx.beginPath()
  ctx.arc(e.x - r * 0.35, e.y - r * 0.1, eye * 0.5, 0, Math.PI * 2)
  ctx.arc(e.x + r * 0.35, e.y - r * 0.1, eye * 0.5, 0, Math.PI * 2)
  ctx.fill()

  if (e.hp < e.maxHp || e.kind === 'boss') {
    const w = Math.max(18, r * 2)
    drawBar(ctx, e.x - w / 2, e.y - r - 10, w, 4, e.hp / e.maxHp, '#ef5350')
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
  const color = PLAYER_COLORS[p.id]
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.beginPath()
  ctx.ellipse(p.x + 2, p.y + PLAYER.radius - 2, 11, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.aim)
  ctx.fillStyle = '#37474f'
  ctx.fillRect(6, -3.5, 17, 7)
  ctx.fillStyle = '#90a4ae'
  ctx.fillRect(19, -2.5, 4, 5)
  ctx.restore()

  ctx.fillStyle = color
  ctx.strokeStyle = '#10202a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.beginPath()
  ctx.arc(p.x - 4, p.y - 4, 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = `bold 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#10202a'
  ctx.fillText(`J${p.id + 1}`, p.x + 1, p.y + 2)
}

function drawBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (const b of state.bullets) {
    ctx.strokeStyle = b.color
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = b.color
    ctx.beginPath()
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFx(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  ctx.font = `bold 15px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
  for (const t of state.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2)
    ctx.strokeText(t.text, t.x, t.y)
    ctx.fillStyle = t.color
    ctx.fillText(t.text, t.x, t.y)
  }
  ctx.globalAlpha = 1
}
