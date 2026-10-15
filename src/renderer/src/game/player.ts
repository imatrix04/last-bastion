import { rgba, shade, type Look } from './appearance'
import { PLAYER } from './constants'
import { drawGlow } from './sprites'
import type { Player } from './types'

/** Dessin du personnage : corps ombré, visière, arme, halo, traînée, et les accessoires de la boutique (skins). */

const TAU = Math.PI * 2
const FONT = 'Bahnschrift, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'

interface Pt {
  x: number
  y: number
  t: number
}

/** Positions récentes de chaque joueur (affichage seulement) : sert à la traînée et à détecter qu'il court. */
const trails = new Map<number, Pt[]>()
const TRAIL_LIFE = 0.32

function updateTrail(p: Player, t: number): { pts: Pt[]; moving: boolean } {
  let h = trails.get(p.id) ?? []
  if (h.length > 0 && t < h[h.length - 1].t) h = [] // nouvelle partie : le temps repart de zéro
  const last = h[h.length - 1]
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2.4) h.push({ x: p.x, y: p.y, t })
  while (h.length > 0 && t - h[0].t > TRAIL_LIFE) h.shift()
  trails.set(p.id, h)
  const moving = h.some((q) => t - q.t < 0.12 && Math.hypot(p.x - q.x, p.y - q.y) > 3)
  return { pts: h, moving }
}

// -------------------------------------------------------------------- accessoires

/** Oreilles de chat : rose unique, dégradé bordeaux de la base vers la pointe, oreille intérieure plus claire, frémissement. */
function drawCatEars(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  for (const s of [-1, 1]) {
    // Frémissement : une oreille puis l'autre, par à-coups
    const flick = Math.pow(Math.max(0, Math.sin(t * 1.7 + (s > 0 ? 0 : 2.1))), 16)
    const a0 = -Math.PI / 2
    const point = (deg: number, rad: number): [number, number] => {
      const a = a0 + s * ((deg * Math.PI) / 180)
      return [Math.cos(a) * rad, Math.sin(a) * rad]
    }
    const tipDeg = 40 + flick * 14
    const [b1x, b1y] = point(12, r * 0.95)
    const [b2x, b2y] = point(64, r * 0.95)
    const [tx, ty] = point(tipDeg, r * (1.98 - flick * 0.12))
    const [mx, my] = [(b1x + b2x) / 2, (b1y + b2y) / 2]

    const grad = ctx.createLinearGradient(mx, my, tx, ty)
    grad.addColorStop(0, '#520824')
    grad.addColorStop(0.35, '#a8174d')
    grad.addColorStop(0.7, '#f0508f')
    grad.addColorStop(1, '#ff9cc8')
    ctx.beginPath()
    ctx.moveTo(b1x, b1y)
    ctx.quadraticCurveTo(b1x + (tx - b1x) * 0.35 - s * r * 0.12, b1y + (ty - b1y) * 0.6, tx, ty)
    ctx.quadraticCurveTo(b2x + (tx - b2x) * 0.4 + s * r * 0.18, b2y + (ty - b2y) * 0.55, b2x, b2y)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#2d0414'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Oreille intérieure : même forme, plus petite, vers la base
    const k = 0.52
    const ix1 = mx + (b1x - mx) * k
    const iy1 = my + (b1y - my) * k
    const ix2 = mx + (b2x - mx) * k
    const iy2 = my + (b2y - my) * k
    const itx = mx + (tx - mx) * 0.7
    const ity = my + (ty - my) * 0.7
    const g2 = ctx.createLinearGradient(mx, my, itx, ity)
    g2.addColorStop(0, '#7d1033')
    g2.addColorStop(1, '#ffd3e6')
    ctx.beginPath()
    ctx.moveTo(ix1, iy1)
    ctx.lineTo(itx, ity)
    ctx.lineTo(ix2, iy2)
    ctx.closePath()
    ctx.fillStyle = g2
    ctx.fill()

    // Reflet sur le bord extérieur
    ctx.beginPath()
    ctx.moveTo(b2x, b2y)
    ctx.quadraticCurveTo(b2x + (tx - b2x) * 0.4 + s * r * 0.18, b2y + (ty - b2y) * 0.55, tx, ty)
    ctx.strokeStyle = 'rgba(255, 220, 236, 0.55)'
    ctx.lineWidth = 0.9
    ctx.stroke()
  }
}

// ------------------------------------------------------------------------ corps

interface Pose {
  aim: number
  t: number
  moving: boolean
}

/** Personnage centré à l'origine, rayon `r`. */
function paintAvatar(ctx: CanvasRenderingContext2D, look: Look, r: number, pose: Pose): void {
  const { color } = look
  const { aim, t, moving } = pose
  const bob = moving ? 1 + 0.045 * Math.sin(t * 15) : 1 + 0.012 * Math.sin(t * 2.4)

  // Halo
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawGlow(ctx, 0, 0, r * (moving ? 3.1 : 2.6), color, 0.2 + 0.07 * Math.sin(t * 3))
  ctx.restore()

  // Anneau segmenté qui tourne
  ctx.save()
  ctx.rotate(t * (moving ? 2.4 : 0.9))
  ctx.strokeStyle = rgba(color, 0.55)
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3
    ctx.beginPath()
    ctx.arc(0, 0, r * 1.5, a, a + 0.9)
    ctx.stroke()
  }
  ctx.restore()

  // Arme : tube sombre rayé de la couleur du joueur, bouche lumineuse
  ctx.save()
  ctx.rotate(aim)
  ctx.fillStyle = '#18242b'
  ctx.strokeStyle = '#091218'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.roundRect(r * 0.4, -r * 0.27, r * 1.35, r * 0.54, r * 0.12)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillRect(r * 0.72, -r * 0.27, r * 0.16, r * 0.54)
  ctx.fillStyle = shade(color, 0.7)
  ctx.fillRect(r * 1.62, -r * 0.2, r * 0.18, r * 0.4)
  ctx.restore()

  // Accessoire (derrière la tête, pour qu'il paraisse attaché)
  if (look.skin === 'cat') drawCatEars(ctx, r, t)

  // Corps
  ctx.save()
  ctx.scale(1, bob)
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.08)
  body.addColorStop(0, shade(color, 0.6))
  body.addColorStop(0.45, color)
  body.addColorStop(1, shade(color, -0.5))
  ctx.fillStyle = body
  ctx.strokeStyle = '#0a141b'
  ctx.lineWidth = 2.6
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.fill()
  ctx.stroke()
  // Liseré de lumière en haut à gauche, ombre propre en bas à droite
  ctx.lineWidth = 1.5
  ctx.strokeStyle = rgba(shade(color, 0.8), 0.85)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.86, Math.PI * 1.02, Math.PI * 1.62)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.86, Math.PI * 0.05, Math.PI * 0.6)
  ctx.stroke()

  // Visière : elle indique où il regarde
  ctx.save()
  ctx.rotate(aim)
  ctx.fillStyle = '#0b1920'
  ctx.beginPath()
  ctx.roundRect(r * 0.12, -r * 0.36, r * 0.78, r * 0.72, r * 0.3)
  ctx.fill()
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  drawGlow(ctx, r * 0.52, 0, r * 0.9, shade(color, 0.5), 0.55)
  ctx.restore()
  ctx.fillStyle = shade(color, 0.75)
  ctx.beginPath()
  ctx.roundRect(r * 0.3, -r * 0.14, r * 0.5, r * 0.28, r * 0.14)
  ctx.fill()
  ctx.restore()
  ctx.restore()
}

/** Personnage dans la partie : ombre, traînée quand il court, étiquette J1 / J2. */
export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, t: number): void {
  const r = PLAYER.radius
  const { pts, moving } = updateTrail(p, t)

  // Traînée
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const q of pts) {
    const life = 1 - (t - q.t) / TRAIL_LIFE
    if (life <= 0) continue
    drawGlow(ctx, q.x, q.y, r * (0.7 + 0.9 * life), p.look.color, 0.32 * life * life)
  }
  ctx.restore()

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.beginPath()
  ctx.ellipse(p.x + 2, p.y + r - 1, r * 0.9, r * 0.38, 0, 0, TAU)
  ctx.fill()

  ctx.save()
  ctx.translate(p.x, p.y)
  paintAvatar(ctx, p.look, r, { aim: p.aim, t: t + p.id * 1.3, moving })
  ctx.restore()

  ctx.font = `700 9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(5, 12, 10, 0.85)'
  ctx.strokeText(`J${p.id + 1}`, p.x, p.y + r + 9)
  ctx.fillStyle = '#eef3ee'
  ctx.fillText(`J${p.id + 1}`, p.x, p.y + r + 9)
}

/** Aperçu animé (boutique, menu) : le personnage au centre (cx, cy), `scale` fois sa taille normale. */
export function drawAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, look: Look, t: number, aim: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(2, PLAYER.radius - 1, PLAYER.radius * 0.95, PLAYER.radius * 0.4, 0, 0, TAU)
  ctx.fill()
  paintAvatar(ctx, look, PLAYER.radius, { aim, t, moving: false })
  ctx.restore()
}
