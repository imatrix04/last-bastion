import { floatingText, t } from '../i18n'
import { biomeOf } from './biomes'
import { buildTarget, placementStatus } from './build'
import type { BiomeDecor, BiomeDef } from './config/config'
import { GFX } from './config/graphics'
import { BASE, BUILD_ORDER, BULLET_STYLES, COLS, HEIGHT, ROWS, TILE, WIDTH } from './config/constants'
import { drawPlayer } from './player'
import { EVENTS } from './config/config'
import { enemyHidden, lightSources } from './events'
import { buildingAt, idx } from './grid'
import { drawBar, drawEnemy, drawEnemyTrail, drawGlow, drawTurret } from './sprites'
import { levelName, maxLevelOf, nextUpgrade } from './stats'
import { TURRET_PLAIN } from './config/turrets'
import type { Building, GameState } from './types'
import { drawFortress } from './fortress'
import { drawSpikes } from './spikes'
import { drawWall, wallLinks } from './walls'

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

/** Fond pré-rendu d'un biome : damier, taches, décor propre au biome, couloirs d'apparition sur les bords. */
export function createBackground(scale: number, biome: BiomeDef): HTMLCanvasElement {
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
      g.fillStyle = (row + col) % 2 === 0 ? biome.tileA : biome.tileB
      g.fillRect(col * TILE, row * TILE, TILE, TILE)
    }
  }
  // Grandes taches de teinte pour casser l'uniformité du damier
  for (let i = 0; i < 46; i++) {
    g.fillStyle = rnd() < 0.5 ? biome.patchLight : biome.patchDark
    g.beginPath()
    g.arc(rnd() * WIDTH, rnd() * HEIGHT, 30 + rnd() * 70, 0, Math.PI * 2)
    g.fill()
  }
  for (let i = 0; i < 320; i++) {
    g.fillStyle = rnd() < 0.5 ? biome.speckA : biome.speckB
    g.fillRect(rnd() * WIDTH, rnd() * HEIGHT, 2, 3)
  }
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rnd() < 0.5 ? biome.pebbleA : biome.pebbleB
    g.beginPath()
    g.ellipse(rnd() * WIDTH, rnd() * HEIGHT, 1.5 + rnd() * 2.5, 1 + rnd() * 1.5, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }

  drawBiomeDecor(g, biome.decor, rnd)

  // Bord de carte : c'est par là que viennent les monstres
  g.fillStyle = biome.edge
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

  // Vignettage : plus le biome est dur, plus il se referme sur les bords
  const vignette = g.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.45, WIDTH / 2, HEIGHT / 2, WIDTH * 0.62)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, `rgba(0, 0, 0, ${biome.vignette})`)
  g.fillStyle = vignette
  g.fillRect(0, 0, WIDTH, HEIGHT)
  if (biome.tint) {
    g.fillStyle = biome.tint
    g.fillRect(0, 0, WIDTH, HEIGHT)
  }
  return canvas
}

/** Éléments de décor qui donnent son identité à chaque biome. */
function drawBiomeDecor(g: CanvasRenderingContext2D, decor: BiomeDecor, rnd: () => number): void {
  const crack = (x: number, y: number, len: number, angle: number, color: string, width: number): void => {
    g.strokeStyle = color
    g.lineWidth = width
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < len; s++) {
      angle += (rnd() - 0.5) * 1.1
      x += Math.cos(angle) * (8 + rnd() * 10)
      y += Math.sin(angle) * (8 + rnd() * 10)
      g.lineTo(x, y)
    }
    g.stroke()
  }

  if (decor === 'meadow') {
    for (let i = 0; i < 60; i++) {
      g.fillStyle = ['#f8bbd0', '#fff59d', '#b3e5fc'][Math.floor(rnd() * 3)]
      g.globalAlpha = 0.5
      g.fillRect(rnd() * WIDTH, rnd() * HEIGHT, 2, 2)
    }
    g.globalAlpha = 1
  } else if (decor === 'forest') {
    // Ombres de grands arbres et champignons luisants
    for (let i = 0; i < 16; i++) {
      g.fillStyle = 'rgba(0, 8, 5, 0.32)'
      g.beginPath()
      g.arc(rnd() * WIDTH, rnd() * HEIGHT, 26 + rnd() * 26, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 26; i++) {
      const x = rnd() * WIDTH
      const y = rnd() * HEIGHT
      const glow = g.createRadialGradient(x, y, 0, x, y, 9)
      glow.addColorStop(0, 'rgba(156, 204, 101, 0.35)')
      glow.addColorStop(1, 'rgba(156, 204, 101, 0)')
      g.fillStyle = glow
      g.fillRect(x - 9, y - 9, 18, 18)
      g.fillStyle = '#c5e1a5'
      g.fillRect(x - 1, y - 1, 2, 2)
    }
  } else if (decor === 'desert') {
    // Rides de dunes et sol craquelé
    g.lineWidth = 1.4
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = 'rgba(235, 205, 145, 0.11)'
      g.beginPath()
      const x = rnd() * WIDTH
      const y = rnd() * HEIGHT
      g.arc(x, y, 18 + rnd() * 40, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
    }
    for (let i = 0; i < 14; i++) crack(rnd() * WIDTH, rnd() * HEIGHT, 5 + Math.floor(rnd() * 5), rnd() * Math.PI * 2, 'rgba(20, 10, 0, 0.3)', 1.3)
  } else if (decor === 'volcano') {
    // Roches sombres et fissures de lave incandescentes
    for (let i = 0; i < 22; i++) {
      g.fillStyle = 'rgba(0, 0, 0, 0.28)'
      g.beginPath()
      g.ellipse(rnd() * WIDTH, rnd() * HEIGHT, 10 + rnd() * 24, 7 + rnd() * 14, rnd() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.save()
    g.shadowColor = '#ff5722'
    g.shadowBlur = 8
    for (let i = 0; i < 16; i++) {
      const x = rnd() * WIDTH
      const y = rnd() * HEIGHT
      const a = rnd() * Math.PI * 2
      crack(x, y, 6 + Math.floor(rnd() * 6), a, 'rgba(255, 87, 34, 0.75)', 2.2)
    }
    g.restore()
  } else {
    // Éclats de cristal violet et étoiles du vide
    for (let i = 0; i < 70; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(209, 196, 233, 0.5)' : 'rgba(149, 117, 205, 0.45)'
      g.fillRect(rnd() * WIDTH, rnd() * HEIGHT, 1.5, 1.5)
    }
    for (let i = 0; i < 22; i++) {
      const x = rnd() * WIDTH
      const y = rnd() * HEIGHT
      const h = 10 + rnd() * 22
      const w = 4 + rnd() * 7
      g.fillStyle = 'rgba(179, 136, 255, 0.3)'
      g.beginPath()
      g.moveTo(x, y - h)
      g.lineTo(x + w, y)
      g.lineTo(x, y + h * 0.3)
      g.lineTo(x - w, y)
      g.closePath()
      g.fill()
      g.strokeStyle = 'rgba(225, 200, 255, 0.45)'
      g.lineWidth = 1
      g.stroke()
    }
  }
}

/** Particules d'ambiance (pollen, spores, poussière, braises, lueurs du vide) : positions calculées à partir du temps, rien n'est stocké. */
function drawAmbient(ctx: CanvasRenderingContext2D, biome: BiomeDef, time: number): void {
  const a = biome.ambient
  ctx.save()
  ctx.fillStyle = a.color
  for (let i = 0; i < a.count; i++) {
    const h1 = Math.abs(Math.sin(i * 127.1 + 1.7) * 43758.5453) % 1
    const h2 = Math.abs(Math.sin(i * 311.7 + 9.3) * 12543.321) % 1
    const dir = a.rise ? -1 : 1
    const y = (((h2 * HEIGHT + dir * a.speed * time * (0.6 + h1 * 0.8)) % HEIGHT) + HEIGHT) % HEIGHT
    const x = h1 * WIDTH + Math.sin(time * 0.6 + i) * a.drift
    ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time * 2 + i * 1.9))
    ctx.beginPath()
    ctx.arc(x, y, a.size * (0.7 + h2 * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Annonce de l'arrivée dans un nouveau biome (en haut de l'écran, apparaît puis s'efface). */
export interface BiomeBanner {
  /** Numéro du biome (à partir de 1). */
  index: number
  biome: BiomeDef
  /** 0 → 1 sur la durée de l'annonce. */
  progress: number
}

/** Fondu entre l'ancien et le nouveau fond. */
export interface RenderExtra {
  prevBg?: CanvasImageSource | null
  /** 0 = ancien fond, 1 = nouveau fond. */
  fade?: number
  banner?: BiomeBanner | null
}

function drawBanner(ctx: CanvasRenderingContext2D, banner: BiomeBanner): void {
  // Entrée rapide, maintien, sortie douce
  const p = banner.progress
  const alpha = Math.min(1, p / 0.12, (1 - p) / 0.25)
  if (alpha <= 0) return
  const y = 118 + (1 - Math.min(1, p / 0.12)) * -14
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const band = ctx.createLinearGradient(0, y - 46, 0, y + 46)
  band.addColorStop(0, 'rgba(0, 0, 0, 0)')
  band.addColorStop(0.5, 'rgba(0, 0, 0, 0.62)')
  band.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = band
  ctx.fillRect(0, y - 46, WIDTH, 92)
  ctx.font = `600 13px ${FONT}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillText(t('biome.label', { n: banner.index }), WIDTH / 2, y - 24)
  ctx.font = `800 32px ${FONT}`
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.strokeText(t(banner.biome.nameKey), WIDTH / 2, y + 2)
  ctx.fillStyle = banner.biome.accent
  ctx.fillText(t(banner.biome.nameKey), WIDTH / 2, y + 2)
  ctx.font = `italic 600 14px ${FONT}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.fillText(t(banner.biome.taglineKey), WIDTH / 2, y + 28)
  ctx.restore()
}

export function render(ctx: CanvasRenderingContext2D, state: GameState, bg: CanvasImageSource, extra: RenderExtra = {}): void {
  ctx.save()
  ctx.fillStyle = '#0b130e'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  if (state.shake > 0) {
    const s = state.shake * 7
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }
  const fade = extra.fade ?? 1
  if (fade < 1 && extra.prevBg) {
    ctx.drawImage(extra.prevBg, 0, 0, WIDTH, HEIGHT)
    ctx.globalAlpha = fade
    ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT)
    ctx.globalAlpha = 1
  } else {
    ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT)
  }

  drawDecals(ctx, state)
  drawGates(ctx, state)
  const trampled = new Set<number>()
  for (const e of state.enemies) trampled.add(idx(Math.floor(e.x / TILE), Math.floor(e.y / TILE)))
  for (const b of state.grid) if (b && b.kind === 'spikes') drawBuilding(ctx, b, state.time, 0, trampled.has(idx(b.col, b.row)))
  drawBase(ctx, state)
  for (const b of state.grid) if (b && b.kind !== 'spikes') drawBuilding(ctx, b, state.time, b.kind === 'barricade' ? wallLinks(state, b.col, b.row) : 0)
  drawGhosts(ctx, state)
  if (GFX.trails) for (const e of state.enemies) if (!enemyHidden(state, e)) drawEnemyTrail(ctx, e)
  for (const e of state.enemies) if (!enemyHidden(state, e)) drawEnemy(ctx, e, state.time)
  for (const p of state.players) drawPlayer(ctx, p, state.time)
  drawGhostLabels(ctx, state)
  drawBullets(ctx, state)
  drawWebShots(ctx, state)
  drawFx(ctx, state)
  drawEvent(ctx, state)
  if (GFX.ambient) drawAmbient(ctx, biomeOf(state.wave), state.time)
  if (extra.banner) drawBanner(ctx, extra.banner)
  drawEventBanner(ctx, state)
  ctx.restore()
}

// ------------------------------------------------------------ événements aléatoires

/** Calque de brume, à demi-résolution (la brume est floue : inutile de la dessiner en pleine taille). */
let fogLayer: HTMLCanvasElement | null = null
const FOG_SCALE = 0.5

/** Effets visuels de l'événement en cours : voile de couleur, brume qui ne laisse voir que les zones éclairées, volutes qui dérivent. */
function drawEvent(ctx: CanvasRenderingContext2D, state: GameState): void {
  const kind = state.eventShown
  const level = state.eventLevel
  if (!kind || level <= 0.01) return
  const def = EVENTS.list[kind]

  ctx.fillStyle = def.tint
  ctx.globalAlpha = level
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.globalAlpha = 1

  if (kind !== 'fog') return
  if (!fogLayer) {
    fogLayer = document.createElement('canvas')
    fogLayer.width = Math.round(WIDTH * FOG_SCALE)
    fogLayer.height = Math.round(HEIGHT * FOG_SCALE)
  }
  const g = fogLayer.getContext('2d')
  if (!g) return
  g.setTransform(FOG_SCALE, 0, 0, FOG_SCALE, 0, 0)
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, WIDTH, HEIGHT)
  g.fillStyle = `rgba(${def.fogRgb}, 0.9)`
  g.fillRect(0, 0, WIDTH, HEIGHT)
  // Zones éclairées : on perce la brume autour des joueurs, des tourelles et de la forteresse
  g.globalCompositeOperation = 'destination-out'
  for (const l of lightSources(state)) {
    const flicker = 1 + 0.03 * Math.sin(state.time * 3 + l.x * 0.05)
    const r = l.r * flicker
    const hole = g.createRadialGradient(l.x, l.y, r * 0.25, l.x, l.y, r)
    hole.addColorStop(0, 'rgba(0, 0, 0, 1)')
    hole.addColorStop(0.6, 'rgba(0, 0, 0, 0.85)')
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = hole
    g.beginPath()
    g.arc(l.x, l.y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = level
  ctx.drawImage(fogLayer, 0, 0, WIDTH, HEIGHT)

  // Volutes de brume qui dérivent, par-dessus tout (y compris les zones éclairées, très légèrement)
  for (let i = 0; i < 7; i++) {
    const x = ((i * 263 + state.time * (7 + i * 2.5)) % (WIDTH + 400)) - 200
    const y = 90 + i * 95 + Math.sin(state.time * 0.3 + i * 1.7) * 30
    const wisp = ctx.createRadialGradient(x, y, 0, x, y, 170)
    wisp.addColorStop(0, `rgba(${def.fogRgb}, 0.16)`)
    wisp.addColorStop(1, `rgba(${def.fogRgb}, 0)`)
    ctx.fillStyle = wisp
    ctx.fillRect(x - 170, y - 170, 340, 340)
  }
  ctx.globalAlpha = 1
}

/** Annonce de l'événement (sous celle du biome) : apparaît puis s'efface. */
function drawEventBanner(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.event) return
  const p = state.eventAge / EVENTS.bannerSeconds
  const alpha = Math.min(1, p / 0.12, (1 - p) / 0.25)
  if (alpha <= 0) return
  const def = EVENTS.list[state.event]
  const y = 200
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const band = ctx.createLinearGradient(0, y - 40, 0, y + 40)
  band.addColorStop(0, 'rgba(0, 0, 0, 0)')
  band.addColorStop(0.5, 'rgba(0, 0, 0, 0.62)')
  band.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = band
  ctx.fillRect(0, y - 40, WIDTH, 80)
  ctx.font = `600 13px ${FONT}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillText(t('event.label'), WIDTH / 2, y - 22)
  ctx.font = `800 28px ${FONT}`
  ctx.lineWidth = 5
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.strokeText(t(def.nameKey), WIDTH / 2, y + 2)
  ctx.fillStyle = def.accent
  ctx.fillText(t(def.nameKey), WIDTH / 2, y + 2)
  ctx.font = `italic 600 13px ${FONT}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.fillText(t(def.taglineKey), WIDTH / 2, y + 26)
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
  const ratio = state.baseHp / BASE.maxHp
  drawFortress(ctx, state)
  drawBar(ctx, x + 8, y - 16, w - 16, 7, ratio, ratio > 0.5 ? '#66bb6a' : ratio > 0.25 ? '#ffa726' : '#ef5350')
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, time: number, links = 0, active = false): void {
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
      drawWall(ctx, b, links, time)
      if (b.targeting === 1) {
        // Porte : battant en bois arrondi serti de fer, avec poignée
        const dx = x + 8
        const dw = TILE - 16
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.beginPath()
        ctx.moveTo(dx - 2, y + TILE - 3)
        ctx.lineTo(dx - 2, y + 17)
        ctx.arc(x + TILE / 2, y + 17, dw / 2 + 2, Math.PI, 0)
        ctx.lineTo(dx + dw + 2, y + TILE - 3)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#6d4520'
        ctx.beginPath()
        ctx.moveTo(dx, y + TILE - 4)
        ctx.lineTo(dx, y + 17)
        ctx.arc(x + TILE / 2, y + 17, dw / 2, Math.PI, 0)
        ctx.lineTo(dx + dw, y + TILE - 4)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#2e1c0e'
        ctx.lineWidth = 1.2
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + TILE / 2, y + 7)
        ctx.lineTo(x + TILE / 2, y + TILE - 4)
        for (const ry of [18, 29]) {
          ctx.moveTo(dx, y + ry)
          ctx.lineTo(dx + dw, y + ry)
        }
        ctx.stroke()
        ctx.fillStyle = '#ffd54a'
        ctx.beginPath()
        ctx.arc(x + TILE / 2 + 4, y + 24, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'turret': {
      drawTurret(ctx, x + TILE / 2, y + TILE / 2, b, time)
      break
    }
    case 'spikes': {
      drawSpikes(ctx, b, active, time)
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
  // Mode de ciblage « proche de la forteresse » : petit losange orange en haut à droite de la tourelle
  if (b.kind === 'turret' && b.targeting === 1) {
    ctx.fillStyle = '#ff9800'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x + TILE - 6, y + 1)
    ctx.lineTo(x + TILE - 1, y + 6)
    ctx.lineTo(x + TILE - 6, y + 11)
    ctx.lineTo(x + TILE - 11, y + 6)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
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
    if (target.repairCd > 0) text += `  🔧 ${Math.ceil(target.repairCd)} s`
    let color = '#e0e0e0'
    if (target.owner !== p.id) {
      // Le bâtiment d'un autre joueur : on peut le réparer, pas l'améliorer ni le démolir.
      text += `  · ${t('player.n', { n: target.owner + 1 })}`
      color = '#b0bec5'
    } else if (next && next.locked) {
      text += `  🔒 ${next.label}`
      color = '#ce93d8'
    } else if (next) {
      text += `  ▲ ${next.label} · ${next.cost}${next.mode === 'choice' ? '+' : ''}`
      color = p.gold >= next.cost ? '#ffe082' : '#ffab91'
    } else {
      text += `  · ${t('level.max')}`
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
    if (w.acid) {
      // Goutte d'acide : boule verte avec un reflet et un halo.
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(ctx, px, py, 16, '#b2ff59', 0.6)
      ctx.restore()
      ctx.fillStyle = '#76ff03'
      ctx.beginPath()
      ctx.arc(px, py, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.beginPath()
      ctx.arc(px - 1.5, py - 1.5, 1.8, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
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
    ctx.strokeText(floatingText(t.text), t.x, t.y)
    ctx.fillStyle = t.color
    ctx.fillText(floatingText(t.text), t.x, t.y)
  }
  ctx.globalAlpha = 1
}
