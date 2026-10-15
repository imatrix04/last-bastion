import { buildTarget, placementStatus } from './build'
import { BASE, BUILD_ORDER, BULLET_STYLES, COLS, HEIGHT, ROWS, TILE, WIDTH } from './constants'
import { drawPlayer } from './player'
import { buildingAt } from './grid'
import { drawBar, drawEnemy, drawEnemyTrail, drawGlow, drawTurret } from './sprites'
import { levelName, maxLevelOf, nextUpgrade } from './stats'
import { TURRET_PLAIN } from './turrets'
import type { Building, GameState } from './types'

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
  // Grandes taches de teinte pour casser l'uniformité du damier
  for (let i = 0; i < 46; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(60, 100, 60, 0.07)' : 'rgba(8, 20, 12, 0.1)'
    g.beginPath()
    g.arc(rnd() * WIDTH, rnd() * HEIGHT, 30 + rnd() * 70, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 320; i++) {
    g.fillStyle = rnd() < 0.5 ? '#27412b' : '#162419'
    g.fillRect(rnd() * WIDTH, rnd() * HEIGHT, 2, 3)
  }
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(160, 170, 160, 0.16)' : 'rgba(110, 120, 110, 0.14)'
    g.beginPath()
    g.ellipse(rnd() * WIDTH, rnd() * HEIGHT, 1.5 + rnd() * 2.5, 1 + rnd() * 1.5, rnd() * 3, 0, Math.PI * 2)
    g.fill()
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

  // Vignettage
  const vignette = g.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.45, WIDTH / 2, HEIGHT / 2, WIDTH * 0.62)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)')
  g.fillStyle = vignette
  g.fillRect(0, 0, WIDTH, HEIGHT)
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

  drawDecals(ctx, state)
  drawGates(ctx, state)
  for (const b of state.grid) if (b && b.kind === 'spikes') drawBuilding(ctx, b, state.time)
  drawBase(ctx, state)
  for (const b of state.grid) if (b && b.kind !== 'spikes') drawBuilding(ctx, b, state.time)
  drawGhosts(ctx, state)
  for (const e of state.enemies) drawEnemyTrail(ctx, e)
  for (const e of state.enemies) drawEnemy(ctx, e, state.time)
  for (const p of state.players) drawPlayer(ctx, p, state.time)
  drawGhostLabels(ctx, state)
  drawBullets(ctx, state)
  drawWebShots(ctx, state)
  drawFx(ctx, state)
  ctx.restore()
}

// --------------------------------------------------------------------- éléments

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
  // Le cristal est dessiné pour une forteresse de 160 px de côté : on le met à l'échelle de la taille réelle.
  const k = Math.min(w, h) / 160
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 64 * k)
  glow.addColorStop(0, `rgba(120, 230, 255, ${0.5 + 0.25 * pulse})`)
  glow.addColorStop(1, 'rgba(120, 230, 255, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, 64 * k, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7fe7ff'
  ctx.strokeStyle = '#e0fbff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx, cy - 28 * k)
  ctx.lineTo(cx + 17 * k, cy)
  ctx.lineTo(cx, cy + 28 * k)
  ctx.lineTo(cx - 17 * k, cy)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  if (ratio < 1) {
    ctx.fillStyle = `rgba(255, 40, 30, ${0.3 * (1 - ratio)})`
    ctx.fillRect(x, y, w, h)
  }
  drawBar(ctx, x + 8, y - 16, w - 16, 7, ratio, ratio > 0.5 ? '#66bb6a' : ratio > 0.25 ? '#ffa726' : '#ef5350')
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, time: number): void {
  const x = b.col * TILE
  const y = b.row * TILE
  const popped = b.kind !== 'turret' && b.pop > 0
  if (popped) {
    const sc = 1 + 0.3 * b.pop
    ctx.save()
    ctx.translate(x + TILE / 2, y + TILE / 2)
    ctx.scale(sc, sc)
    ctx.translate(-(x + TILE / 2), -(y + TILE / 2))
  }
  switch (b.kind) {
    case 'barricade': {
      if (b.level >= 4) drawReinforcedWall(ctx, x, y)
      else if (b.level === 3) drawBronzeWall(ctx, x, y)
      else if (b.level === 2) drawStoneWall(ctx, x, y)
      else drawWoodBarricade(ctx, x, y)
      break
    }
    case 'turret': {
      drawTurret(ctx, x + TILE / 2, y + TILE / 2, b, time)
      break
    }
    case 'spikes': {
      drawSpikes(ctx, x, y, b.level)
      break
    }
  }
  if (popped) ctx.restore()

  // Pastilles de niveau (le pas se resserre pour que 7 niveaux tiennent dans la case)
  if (b.level >= 2) {
    const step = Math.min(6, 30 / b.level)
    const max = maxLevelOf(b.kind)
    for (let i = 0; i < b.level; i++) {
      ctx.fillStyle = b.level >= max ? '#ffffff' : '#ffd54a'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x + 6 + i * step, y + TILE - 5, 2.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  if (b.hp < b.maxHp) {
    const ratio = b.hp / b.maxHp
    drawBar(ctx, x + 4, y - 5, TILE - 8, 4, ratio, ratio > 0.5 ? '#9ccc65' : ratio > 0.25 ? '#ffb74d' : '#e57373')
  }
}

/** Mur en bronze : plaques de métal chaud rivetées, reflets cuivrés. */
function drawBronzeWall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.fillRect(x + 3, y + 6, TILE, TILE)
  ctx.fillStyle = '#5b3513'
  ctx.fillRect(x, y, TILE, TILE)
  const plate = ctx.createLinearGradient(x, y, x + TILE, y + TILE)
  plate.addColorStop(0, '#e0a05a')
  plate.addColorStop(0.5, '#b87333')
  plate.addColorStop(1, '#7d4a1d')
  ctx.fillStyle = plate
  for (const [px, py] of [
    [2, 2],
    [21, 2],
    [2, 21],
    [21, 21]
  ]) {
    ctx.fillRect(x + px, y + py, 17, 17)
  }
  ctx.fillStyle = 'rgba(255, 240, 200, 0.35)'
  for (const [px, py] of [
    [2, 2],
    [21, 2],
    [2, 21],
    [21, 21]
  ]) {
    ctx.fillRect(x + px, y + py, 17, 2)
    ctx.fillRect(x + px, y + py, 2, 17)
  }
  ctx.fillStyle = '#3e2410'
  for (const [px, py] of [
    [5, 5],
    [16, 5],
    [24, 5],
    [35, 5],
    [5, 16],
    [16, 16],
    [24, 16],
    [35, 16],
    [5, 24],
    [16, 24],
    [24, 24],
    [35, 24],
    [5, 35],
    [16, 35],
    [24, 35],
    [35, 35]
  ]) {
    ctx.beginPath()
    ctx.arc(x + px, y + py, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#f0c27a'
  ctx.lineWidth = 1.2
  ctx.strokeRect(x + 0.6, y + 0.6, TILE - 1.2, TILE - 1.2)
}

/** Pieux : bois taillé (1), pierre (2), acier renforcé (3). */
function drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number, level: number): void {
  const style =
    level >= 3
      ? { bed: 'rgba(24, 30, 38, 0.8)', body: '#aab6c2', tip: '#f1f5f9', edge: '#4b5563', frame: '#cfd8dc' }
      : level === 2
        ? { bed: 'rgba(40, 40, 46, 0.7)', body: '#8d93a0', tip: '#d3d8e2', edge: '#4a4f5c', frame: null }
        : { bed: 'rgba(30, 20, 15, 0.6)', body: '#a07840', tip: '#e6c88e', edge: '#4a3118', frame: null }
  ctx.fillStyle = style.bed
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const px = x + 7 + i * 13
      const py = y + 7 + j * 13
      ctx.fillStyle = style.body
      ctx.strokeStyle = style.edge
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.moveTo(px, py - 6)
      ctx.lineTo(px + 5, py + 5)
      ctx.lineTo(px - 5, py + 5)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = style.tip
      ctx.beginPath()
      ctx.moveTo(px, py - 6)
      ctx.lineTo(px + 1.8, py - 1)
      ctx.lineTo(px - 1.8, py - 1)
      ctx.closePath()
      ctx.fill()
      if (level >= 2) {
        // Base maçonnée
        ctx.fillStyle = style.edge
        ctx.fillRect(px - 5.5, py + 5, 11, 2)
      }
    }
  }
  if (style.frame) {
    ctx.strokeStyle = style.frame
    ctx.lineWidth = 2
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4)
  }
}

function drawWoodBarricade(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(x + 5, y + 7, TILE - 6, TILE - 6)
  ctx.fillStyle = '#4a2f18'
  ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6)
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#9c6a35' : '#8b5a2b'
    ctx.fillRect(x + 5, y + 5 + i * 10, TILE - 10, 8)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(x + 5, y + 5 + i * 10, TILE - 10, 2)
  }
  ctx.fillStyle = '#cfd8dc'
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 8, y + 8 + i * 10, 2, 2)
    ctx.fillRect(x + TILE - 10, y + 8 + i * 10, 2, 2)
  }
}

function drawReinforcedWall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  drawStoneWall(ctx, x, y)
  // Cadre d'acier, renforts en croix et rivets
  ctx.fillStyle = 'rgba(38, 44, 56, 0.55)'
  ctx.fillRect(x, y, TILE, 5)
  ctx.fillRect(x, y + TILE - 5, TILE, 5)
  ctx.fillRect(x, y, 5, TILE)
  ctx.fillRect(x + TILE - 5, y, 5, TILE)
  ctx.strokeStyle = '#3b4252'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + 5, y + 5)
  ctx.lineTo(x + TILE - 5, y + TILE - 5)
  ctx.moveTo(x + TILE - 5, y + 5)
  ctx.lineTo(x + 5, y + TILE - 5)
  ctx.stroke()
  ctx.strokeStyle = '#cfd8dc'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x + 0.75, y + 0.75, TILE - 1.5, TILE - 1.5)
  ctx.fillStyle = '#eceff1'
  for (const [px, py] of [
    [3, 3],
    [TILE - 3, 3],
    [3, TILE - 3],
    [TILE - 3, TILE - 3],
    [TILE / 2, TILE / 2]
  ]) {
    ctx.beginPath()
    ctx.arc(x + px, y + py, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawStoneWall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
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
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.fillRect(x + 2, y + 2, TILE - 4, 3)
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
          : status === 'upgrade'
            ? '255, 213, 74'
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
    ctx.fillStyle = p.look.color
    ctx.fillRect(x + 1, y + 1, 9, 4)

    if (BUILD_ORDER[p.selected] === 'turret' && status === 'ok') {
      ctx.strokeStyle = 'rgba(128, 222, 234, 0.45)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x + TILE / 2, y + TILE / 2, TURRET_PLAIN[0].stats.range, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

/** Étiquette du bâtiment visé (nom, amélioration possible), dessinée par-dessus les joueurs. */
function drawGhostLabels(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.font = `bold 12px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)'
  for (const p of state.players) {
    const { col, row } = buildTarget(p)
    const target = buildingAt(state, col, row)
    if (!target) continue
    const next = nextUpgrade(target, p.unlocks)
    let text = levelName(target)
    let color = '#e0e0e0'
    if (next && next.locked) {
      text += `  🔒 ${next.label}`
      color = '#ce93d8'
    } else if (next) {
      text += `  ▲ ${next.label} · ${next.cost}${next.mode === 'choice' ? '+' : ''}`
      color = state.gold >= next.cost ? '#ffe082' : '#ffab91'
    } else {
      text += '  · niveau max'
    }
    const lx = col * TILE + TILE / 2
    const ly = Math.max(10, row * TILE - 14)
    ctx.strokeText(text, lx, ly)
    ctx.fillStyle = color
    ctx.fillText(text, lx, ly)
  }
}

function drawDecals(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const d of state.decals) {
    const a = Math.min(1, d.life / 2.5) * 0.5
    ctx.globalAlpha = a
    ctx.fillStyle = d.color
    const rr = (i: number): number => {
      const v = Math.sin(d.seed + i * 12.9898) * 43758.5453
      return v - Math.floor(v)
    }
    ctx.beginPath()
    ctx.ellipse(d.x, d.y, d.size * 0.8, d.size * 0.65, rr(0) * 3, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 1; i <= 5; i++) {
      const ang = rr(i) * Math.PI * 2
      const dist = d.size * (0.7 + rr(i + 7) * 0.9)
      ctx.beginPath()
      ctx.arc(d.x + Math.cos(ang) * dist, d.y + Math.sin(ang) * dist, d.size * (0.12 + rr(i + 3) * 0.2), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = a * 0.5
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.ellipse(d.x, d.y, d.size * 0.4, d.size * 0.3, rr(0) * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** Toiles d'araignée en vol : un fil tendu depuis l'araignée et un flocon blanc qui tourne. */
function drawWebShots(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const w of state.webs) {
    const k = Math.min(1, w.t / w.dur)
    const px = w.x + (w.tx - w.x) * k
    const py = w.y + (w.ty - w.y) * k - Math.sin(k * Math.PI) * 14
    ctx.strokeStyle = 'rgba(240, 242, 255, 0.7)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.moveTo(w.x, w.y)
    ctx.lineTo(px, py)
    ctx.stroke()
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(w.t * 14)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8)
      ctx.lineTo(-Math.cos(a) * 8, -Math.sin(a) * 8)
    }
    ctx.stroke()
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, px, py, 14, '#e8eaf6', 0.55)
    ctx.restore()
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Passe additive : halo et traînée
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (const b of state.bullets) {
    const st = BULLET_STYLES[b.style] ?? BULLET_STYLES[0]
    ctx.strokeStyle = st.color
    ctx.globalAlpha = 0.55
    ctx.lineWidth = st.radius * 0.9
    ctx.beginPath()
    ctx.moveTo(b.x - b.vx * 0.045, b.y - b.vy * 0.045)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.globalAlpha = 1
    drawGlow(ctx, b.x, b.y, st.radius * 3.4, st.color, 0.55)
  }
  ctx.restore()
  // Passe normale : le projectile lui-même
  for (const b of state.bullets) {
    const st = BULLET_STYLES[b.style] ?? BULLET_STYLES[0]
    ctx.fillStyle = st.color
    ctx.beginPath()
    ctx.arc(b.x, b.y, st.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.beginPath()
    ctx.arc(b.x, b.y, st.radius * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFx(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Ondes de choc
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const r of state.rings) {
    const k = 1 - r.life / r.maxLife
    const radius = r.maxR * (1 - Math.pow(1 - k, 3))
    ctx.globalAlpha = (1 - k) * 0.8
    ctx.strokeStyle = r.color
    ctx.lineWidth = 1 + 4 * (1 - k)
    ctx.beginPath()
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  // Éclats et fumées
  for (const p of state.particles) {
    if (p.shape === 1 || p.shape === 3) continue
    const k = Math.max(0, p.life / p.maxLife)
    if (p.shape === 2) {
      ctx.globalAlpha = 0.35 * k
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, (p.size / 2) * (1 + (1 - k) * 1.2), 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.globalAlpha = k
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
  }

  // Étincelles et lueurs (additif)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (const p of state.particles) {
    if (p.shape !== 1 && p.shape !== 3) continue
    const k = Math.max(0, p.life / p.maxLife)
    if (p.shape === 3) {
      drawGlow(ctx, p.x, p.y, p.size * (0.6 + 0.6 * k), p.color, k)
    } else {
      ctx.globalAlpha = k
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.size
      ctx.beginPath()
      ctx.moveTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  }
  ctx.restore()
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
