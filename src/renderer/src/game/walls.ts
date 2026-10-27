import { COLS, TILE } from './config/constants'
import { GFX } from './config/graphics'
import { buildingAt, isBaseCell } from './grid'
import type { Building, GameState } from './types'

/** Côtés d'un mur reliés à un autre mur (ou à la forteresse) : le dessin se prolonge de l'un à l'autre. */
export const LINK_N = 1
export const LINK_E = 2
export const LINK_S = 4
export const LINK_W = 8

export function wallLinks(state: GameState, col: number, row: number): number {
  const joined = (c: number, r: number): boolean => buildingAt(state, c, r)?.kind === 'barricade' || isBaseCell(c, r)
  return (joined(col, row - 1) ? LINK_N : 0) | (joined(col + 1, row) ? LINK_E : 0) | (joined(col, row + 1) ? LINK_S : 0) | (joined(col - 1, row) ? LINK_W : 0)
}

/** Aléa déterministe propre à une case : l'aspect d'un mur ne change pas d'une image à l'autre. */
function seeded(col: number, row: number, salt: number): () => number {
  let s = ((Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663) ^ Math.imul(salt + 1, 83492791)) >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Mur d'un palier donné (1 bois · 2 pierre · 3 bronze · 4 renforcé), usure et raccords compris. */
export function drawWall(ctx: CanvasRenderingContext2D, b: Building, links: number, time: number): void {
  const x = b.col * TILE
  const y = b.row * TILE
  const rnd = seeded(b.col, b.row, 0)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(x + 3, y + 6, TILE, TILE)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, TILE, TILE)
  ctx.clip()
  if (b.level >= 4) drawSteel(ctx, x, y, links, rnd, time, b)
  else if (b.level === 3) drawBronze(ctx, x, y, links, rnd, time, b)
  else if (b.level === 2) drawStone(ctx, x, y, links, rnd)
  else drawPalisade(ctx, x, y, links, rnd)
  drawWear(ctx, x, y, b)
  ctx.restore()
}

/** Contour sombre, biseau clair en haut / à gauche et ombre en bas / à droite, seulement sur les côtés libres. */
function drawEdges(ctx: CanvasRenderingContext2D, x: number, y: number, links: number, light: string, skipTopLight = false): void {
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  if (!(links & LINK_N)) {
    ctx.moveTo(x, y)
    ctx.lineTo(x + TILE, y)
  }
  if (!(links & LINK_S)) {
    ctx.moveTo(x, y + TILE)
    ctx.lineTo(x + TILE, y + TILE)
  }
  if (!(links & LINK_W)) {
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + TILE)
  }
  if (!(links & LINK_E)) {
    ctx.moveTo(x + TILE, y)
    ctx.lineTo(x + TILE, y + TILE)
  }
  ctx.stroke()
  ctx.fillStyle = light
  if (!(links & LINK_N) && !skipTopLight) ctx.fillRect(x, y + 1, TILE, 2)
  if (!(links & LINK_W)) ctx.fillRect(x + 1, y, 2, TILE)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  if (!(links & LINK_S)) ctx.fillRect(x, y + TILE - 4, TILE, 3)
  if (!(links & LINK_E)) ctx.fillRect(x + TILE - 4, y, 3, TILE)
}

/** Reflet qui balaie la carte de gauche à droite (métal), décalé d'une rangée à l'autre. */
function drawGlint(ctx: CanvasRenderingContext2D, x: number, y: number, row: number, time: number, color: string): void {
  if (!GFX.glints) return
  const sweep = COLS * TILE + 300
  const local = ((time * 90 + row * 70) % sweep) - 150 - x
  if (local < -20 || local > TILE + 20) return
  const g = ctx.createLinearGradient(x + local - 14, y, x + local + 14, y)
  g.addColorStop(0, 'rgba(255, 255, 255, 0)')
  g.addColorStop(0.5, color)
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, TILE, TILE)
}

/** Palissade : rondins verticaux taillés en pointe, tenus par deux traverses clouées. */
function drawPalisade(ctx: CanvasRenderingContext2D, x: number, y: number, links: number, rnd: () => number): void {
  const colors = ['#9c6a35', '#8b5a2b', '#a8753c', '#7f5226']
  const w = TILE / 4
  for (let i = 0; i < 4; i++) {
    const pick = rnd()
    const stagger = rnd()
    const knot = rnd()
    const lx = x + i * w
    const tip = links & LINK_N ? y : y + 1 + Math.floor(stagger * 4)
    const body = links & LINK_N ? y : tip + 5
    ctx.fillStyle = colors[Math.floor(pick * colors.length)]
    ctx.fillRect(lx, body, w, y + TILE - body)
    if (!(links & LINK_N)) {
      ctx.beginPath()
      ctx.moveTo(lx, body)
      ctx.lineTo(lx + w / 2, tip)
      ctx.lineTo(lx + w, body)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
      ctx.beginPath()
      ctx.moveTo(lx + w / 2, tip)
      ctx.lineTo(lx + w, body)
      ctx.lineTo(lx + w / 2, body)
      ctx.closePath()
      ctx.fill()
    }
    const top = links & LINK_N ? y : tip + 3
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.fillRect(lx + 1, top, 2, y + TILE - top)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
    ctx.fillRect(lx + w - 2, body, 2, y + TILE - body)
    ctx.fillStyle = '#2e1c0e'
    ctx.fillRect(lx, top, 1, y + TILE - top)
    if (knot > 0.55) {
      ctx.fillStyle = 'rgba(40, 22, 8, 0.7)'
      ctx.beginPath()
      ctx.arc(lx + w / 2, y + 17 + knot * 8, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  for (const ry of [10, 27]) {
    const rx = links & LINK_W ? x : x + 1
    const rw = x + TILE - (links & LINK_E ? 0 : 1) - rx
    ctx.fillStyle = '#4e3218'
    ctx.fillRect(rx, y + ry, rw, 5)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
    ctx.fillRect(rx, y + ry, rw, 1)
    ctx.fillStyle = '#cfd8dc'
    for (let i = 0; i < 4; i++) ctx.fillRect(x + i * w + w / 2 - 1, y + ry + 2, 2, 2)
  }
  drawEdges(ctx, x, y, links & ~LINK_N, 'rgba(255, 235, 200, 0.2)')
}

/** Muraille de pierre : blocs de teintes variées, créneaux en haut, mousse au pied. */
function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, links: number, rnd: () => number): void {
  const crenel = !(links & LINK_N)
  ctx.fillStyle = '#7d8390'
  ctx.fillRect(x, y, TILE, TILE)
  const courses: Array<[number, number, number[]]> = [
    [0, 13, [0, 20, 40]],
    [13, 26, [0, 10, 30, 40]],
    [26, 40, [0, 20, 40]]
  ]
  for (const [y0, y1, cuts] of courses) {
    for (let i = 0; i < cuts.length - 1; i++) {
      const tint = rnd() - 0.5
      ctx.fillStyle = tint > 0 ? `rgba(255, 255, 255, ${tint * 0.2})` : `rgba(0, 0, 0, ${-tint * 0.22})`
      ctx.fillRect(x + cuts[i], y + y0, cuts[i + 1] - cuts[i], y1 - y0)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(x + cuts[i], y + y0, cuts[i + 1] - cuts[i], 2)
    }
  }
  ctx.strokeStyle = '#4a4f5c'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x, y + 13)
  ctx.lineTo(x + TILE, y + 13)
  ctx.moveTo(x, y + 26)
  ctx.lineTo(x + TILE, y + 26)
  for (const [y0, y1, cuts] of courses) {
    for (let i = 1; i < cuts.length - 1; i++) {
      ctx.moveTo(x + cuts[i], y + y0)
      ctx.lineTo(x + cuts[i], y + y1)
    }
  }
  ctx.stroke()
  if (crenel) {
    ctx.fillStyle = '#2c313b'
    ctx.fillRect(x + 15, y, 10, 7)
    ctx.fillStyle = '#9aa1b0'
    ctx.fillRect(x + 15, y + 7, 10, 1.5)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(x + 15, y, 1.5, 7)
    ctx.fillRect(x + 23.5, y, 1.5, 7)
  }
  for (let i = 0; i < 2; i++) {
    const on = rnd()
    const mx = rnd()
    if (on < 0.6) {
      ctx.fillStyle = 'rgba(95, 125, 74, 0.5)'
      ctx.beginPath()
      ctx.ellipse(x + 6 + mx * 28, y + TILE - 3, 6, 3, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawEdges(ctx, x, y, links, 'rgba(210, 216, 230, 0.4)', crenel)
}

/** Bronze : plaques rivetées qui se prolongent d'une case à l'autre, patine et reflet mobile. */
function drawBronze(ctx: CanvasRenderingContext2D, x: number, y: number, links: number, rnd: () => number, time: number, b: Building): void {
  ctx.fillStyle = '#5b3513'
  ctx.fillRect(x, y, TILE, TILE)
  const plate = ctx.createLinearGradient(x, y, x + TILE, y + TILE)
  plate.addColorStop(0, '#e0a05a')
  plate.addColorStop(0.5, '#b87333')
  plate.addColorStop(1, '#7d4a1d')
  const l = x + (links & LINK_W ? 1 : 2)
  const r = x + TILE - (links & LINK_E ? 1 : 2)
  const t = y + (links & LINK_N ? 1 : 2)
  const bt = y + TILE - (links & LINK_S ? 1 : 2)
  const xs: Array<[number, number]> = [
    [l, x + 19],
    [x + 21, r]
  ]
  const ys: Array<[number, number]> = [
    [t, y + 19],
    [y + 21, bt]
  ]
  for (const [py0, py1] of ys) {
    for (const [px0, px1] of xs) {
      ctx.fillStyle = plate
      ctx.fillRect(px0, py0, px1 - px0, py1 - py0)
      ctx.fillStyle = 'rgba(255, 240, 200, 0.35)'
      ctx.fillRect(px0, py0, px1 - px0, 2)
      ctx.fillRect(px0, py0, 2, py1 - py0)
      ctx.fillStyle = '#3e2410'
      for (const [rx, ry] of [
        [px0 + 3.5, py0 + 3.5],
        [px1 - 3.5, py0 + 3.5],
        [px0 + 3.5, py1 - 3.5],
        [px1 - 3.5, py1 - 3.5]
      ]) {
        ctx.beginPath()
        ctx.arc(rx, ry, 1.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  for (let i = 0; i < 2; i++) {
    const px = rnd()
    const on = rnd()
    if (on < 0.65) {
      ctx.fillStyle = 'rgba(79, 163, 138, 0.25)'
      ctx.beginPath()
      ctx.ellipse(x + 4 + px * 32, y + TILE - 4, 7, 3.5, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawGlint(ctx, x, y, b.row, time, 'rgba(255, 240, 200, 0.3)')
  drawEdges(ctx, x, y, links, 'rgba(240, 194, 122, 0.55)')
}

/** Acier renforcé : cadre sombre, croix de renfort et noyau lumineux qui pulse. */
function drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number, links: number, rnd: () => number, time: number, b: Building): void {
  const steel = ctx.createLinearGradient(x, y, x + TILE, y + TILE)
  steel.addColorStop(0, '#6b778a')
  steel.addColorStop(0.5, '#475161')
  steel.addColorStop(1, '#2f3744')
  ctx.fillStyle = steel
  ctx.fillRect(x, y, TILE, TILE)
  const l = x + (links & LINK_W ? 0 : 5)
  const r = x + TILE - (links & LINK_E ? 0 : 5)
  const t = y + (links & LINK_N ? 0 : 5)
  const bt = y + TILE - (links & LINK_S ? 0 : 5)
  ctx.fillStyle = '#1f2630'
  ctx.fillRect(l, t, r - l, bt - t)
  ctx.fillStyle = steel
  ctx.fillRect(l + 1.5, t + 1.5, r - l - 3, bt - t - 3)
  ctx.strokeStyle = '#2b323f'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x + 5, y + 5)
  ctx.lineTo(x + TILE - 5, y + TILE - 5)
  ctx.moveTo(x + TILE - 5, y + 5)
  ctx.lineTo(x + 5, y + TILE - 5)
  ctx.stroke()
  const pulse = 0.55 + 0.35 * Math.sin(time * 3 + b.col * 0.9 + b.row * 0.6 + rnd() * 6)
  const core = ctx.createRadialGradient(x + 20, y + 20, 0, x + 20, y + 20, 9)
  core.addColorStop(0, `rgba(160, 245, 255, ${pulse})`)
  core.addColorStop(1, 'rgba(80, 200, 230, 0)')
  ctx.fillStyle = core
  ctx.fillRect(x + 8, y + 8, 24, 24)
  ctx.fillStyle = '#eceff1'
  for (const [px, py] of [
    [5, 5],
    [TILE - 5, 5],
    [5, TILE - 5],
    [TILE - 5, TILE - 5]
  ]) {
    ctx.beginPath()
    ctx.arc(x + px, y + py, 1.7, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = `rgba(128, 222, 234, ${0.35 + pulse * 0.4})`
  if (!(links & LINK_N)) ctx.fillRect(l, y + 3, r - l, 1)
  if (!(links & LINK_S)) ctx.fillRect(l, y + TILE - 4, r - l, 1)
  if (!(links & LINK_W)) ctx.fillRect(x + 3, t, 1, bt - t)
  if (!(links & LINK_E)) ctx.fillRect(x + TILE - 4, t, 1, bt - t)
  drawGlint(ctx, x, y, b.row, time, 'rgba(210, 245, 255, 0.28)')
  drawEdges(ctx, x, y, links, 'rgba(220, 230, 240, 0.5)')
}

/** Usure : assombrissement, fissures qui s'ajoutent à mesure que le mur perd des PV, rouille sur le métal. */
function drawWear(ctx: CanvasRenderingContext2D, x: number, y: number, b: Building): void {
  const ratio = b.maxHp > 0 ? b.hp / b.maxHp : 1
  if (ratio >= 0.9) return
  const wear = 1 - ratio
  ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * wear})`
  ctx.fillRect(x, y, TILE, TILE)
  const metal = b.level >= 3
  if (metal && ratio < 0.6) {
    const rnd = seeded(b.col, b.row, 3)
    ctx.fillStyle = `rgba(138, 63, 26, ${0.45 * wear})`
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.ellipse(x + rnd() * TILE, y + rnd() * TILE, 3 + rnd() * 5, 2 + rnd() * 4, rnd() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const count = ratio < 0.2 ? 5 : ratio < 0.35 ? 4 : ratio < 0.55 ? 3 : ratio < 0.75 ? 2 : 1
  const rnd = seeded(b.col, b.row, 7)
  for (let i = 0; i < 5; i++) {
    // Les cinq fissures sont toujours tirées dans le même ordre : seule la quantité affichée varie
    const side = Math.floor(rnd() * 4)
    const along = 6 + rnd() * 28
    let px = side === 0 ? x + along : side === 1 ? x + TILE : side === 2 ? x + along : x
    let py = side === 0 ? y : side === 1 ? y + along : side === 2 ? y + TILE : y + along
    const pts: Array<[number, number]> = [[px, py]]
    for (let s = 0; s < 4; s++) {
      px += (x + TILE / 2 - px) * 0.28 + (rnd() - 0.5) * 9
      py += (y + TILE / 2 - py) * 0.28 + (rnd() - 0.5) * 9
      pts.push([px, py])
    }
    if (i >= count) continue
    for (const [dx, color, w] of [
      [1, 'rgba(255, 255, 255, 0.14)', 1],
      [0, 'rgba(10, 6, 4, 0.8)', 1.6]
    ] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(pts[0][0] + dx, pts[0][1])
      for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s][0] + dx, pts[s][1])
      ctx.stroke()
    }
  }
}
