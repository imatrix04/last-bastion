import { playerLabel, rgba, shade, type Look } from './config/appearance'
import { PLAYER } from './config/constants'
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
/** Historique gardé pour les traînées à longue durée (cœurs). */
const HISTORY_LIFE = 1
/** Un cœur naît à chaque tranche de HEART_EVERY secondes de déplacement, et vit HEART_LIFE secondes. */
const HEART_EVERY = 0.16
const HEART_LIFE = 0.95

function updateTrail(p: Player, t: number): { pts: Pt[]; moving: boolean } {
  let h = trails.get(p.id) ?? []
  if (h.length > 0 && t < h[h.length - 1].t) h = [] // nouvelle partie : le temps repart de zéro
  const last = h[h.length - 1]
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 2.4) h.push({ x: p.x, y: p.y, t })
  while (h.length > 0 && t - h[0].t > HISTORY_LIFE) h.shift()
  trails.set(p.id, h)
  const moving = h.some((q) => t - q.t < 0.12 && Math.hypot(p.x - q.x, p.y - q.y) > 3)
  return { pts: h, moving }
}

// -------------------------------------------------------------------- accessoires

// -------------------------------------------------------------------- traînées

const HEART_COLORS = ['#ff8fb8', '#f06292', '#a0173f', '#6e0f2a']
const TECH = '#5fd6ee'

/** Cœur centré en (x, y), s = demi-largeur. */
function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.35)
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.25, x - s * 0.55, y - s * 1.0, x, y - s * 0.45)
  ctx.bezierCurveTo(x + s * 0.55, y - s * 1.0, x + s * 1.1, y - s * 0.25, x, y + s * 0.35)
  ctx.closePath()
}

/** Cœurs qui s'évaporent derrière le personnage : ils montent, ondulent, grossissent puis s'effacent. */
function drawHeartTrail(ctx: CanvasRenderingContext2D, pts: Pt[], r: number, t: number): void {
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i]
    const slot = Math.floor(q.t / HEART_EVERY)
    if (slot === Math.floor(pts[i - 1].t / HEART_EVERY)) continue // une seule naissance par tranche de temps
    const age = t - q.t
    if (age < 0 || age > HEART_LIFE) continue
    const k = age / HEART_LIFE
    const sway = Math.sin(age * 7 + slot * 1.7) * r * 0.28
    const x = q.x + sway
    const y = q.y - r * 0.2 - k * r * 2.4
    const s = r * 0.24 * (0.55 + 0.45 * Math.min(1, age * 6)) * (1 - 0.35 * k)
    ctx.save()
    ctx.globalAlpha = Math.pow(1 - k, 1.3)
    ctx.translate(x, y)
    ctx.rotate(Math.sin(age * 5 + slot) * 0.35)
    heart(ctx, 0, 0, s)
    ctx.fillStyle = HEART_COLORS[slot % HEART_COLORS.length]
    ctx.fill()
    // Reflet sur le lobe gauche
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.beginPath()
    ctx.ellipse(-s * 0.5, -s * 0.6, s * 0.16, s * 0.1, -0.5, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

/** Traînée de données : trois lignes qui défilent, des pixels qui clignotent de part et d'autre, un curseur en tête. */
function drawTechTrail(ctx: CanvasRenderingContext2D, pts: Pt[], r: number, t: number): void {
  const live = pts.filter((q) => t - q.t < 0.4)
  if (live.length < 2) return
  const head = live[live.length - 1]
  const back = live[Math.max(0, live.length - 5)]
  const len = Math.hypot(head.x - back.x, head.y - back.y) || 1
  const dx = (head.x - back.x) / len
  const dy = (head.y - back.y) / len
  const nx = -dy
  const ny = dx
  const tail = live[0]

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const lanes: Array<[number, number, number]> = [
    [0, 1.6, 0.9],
    [-0.55, 1, 0.5],
    [0.55, 1, 0.5]
  ]
  for (const [off, w, a] of lanes) {
    const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
    g.addColorStop(0, 'rgba(95, 214, 238, 0)')
    g.addColorStop(1, 'rgba(95, 214, 238, ' + a + ')')
    ctx.strokeStyle = g
    ctx.lineWidth = w
    ctx.setLineDash([r * 0.3, r * 0.18])
    ctx.lineDashOffset = -t * r * 10
    ctx.beginPath()
    live.forEach((q, i) => {
      const x = q.x + nx * off * r
      const y = q.y + ny * off * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }
  ctx.setLineDash([])

  // Pixels qui clignotent de part et d'autre de la trace
  for (const q of live) {
    const seed = Math.floor(q.t * 60)
    if (seed % 5 !== 0) continue
    const side = (seed % 2 === 0 ? 1 : -1) * r * (0.7 + ((seed * 7) % 5) * 0.12)
    const s = r * 0.12
    ctx.globalAlpha = (1 - (t - q.t) / 0.4) * (0.5 + 0.5 * Math.sin(t * 25 + seed))
    ctx.fillStyle = seed % 3 === 0 ? '#e6fbff' : TECH
    ctx.fillRect(q.x + nx * side - s / 2, q.y + ny * side - s / 2, s, s)
  }
  ctx.globalAlpha = 1

  // Curseur en tête : un chevron qui pointe dans le sens du mouvement
  const wing = r * 0.38
  const behind = r * 0.15
  ctx.strokeStyle = TECH
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(head.x - dx * behind + nx * wing, head.y - dy * behind + ny * wing)
  ctx.lineTo(head.x + dx * r * 0.55, head.y + dy * r * 0.55)
  ctx.lineTo(head.x - dx * behind - nx * wing, head.y - dy * behind - ny * wing)
  ctx.stroke()
  ctx.fillStyle = '#e6fbff'
  ctx.beginPath()
  ctx.arc(head.x, head.y, r * 0.09, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** Dessine la traînée équipée (ou la lueur de la couleur du joueur, par défaut). */
function drawTrail(ctx: CanvasRenderingContext2D, trail: Look['trail'], pts: Pt[], r: number, t: number, color: string): void {
  if (trail === 'hearts') return drawHeartTrail(ctx, pts, r, t)
  if (trail === 'tech') return drawTechTrail(ctx, pts, r, t)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const q of pts) {
    const life = 1 - (t - q.t) / TRAIL_LIFE
    if (life <= 0) continue
    drawGlow(ctx, q.x, q.y, r * (0.7 + 0.9 * life), color, 0.32 * life * life)
  }
  ctx.restore()
}

/** Trajet fictif pour l'aperçu de la boutique et du menu : le personnage avance vers la gauche à vitesse constante. */
function previewPath(r: number, t: number): Pt[] {
  const pts: Pt[] = []
  for (let k = 50; k >= 0; k--) {
    const time = t - k * 0.02
    pts.push({ x: -k * 0.02 * r * 1.2, y: Math.sin(time * 4) * r * 0.2, t: time })
  }
  return pts
}

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

/** Canon en or : tube doré, reflet qui glisse le long du canon, étincelles qui scintillent à la bouche (dans le repère de l'arme). */
function drawGoldBarrel(ctx: CanvasRenderingContext2D, r: number, t: number): void {
  const x0 = r * 0.4
  const x1 = r * 1.75
  const bodyY = -r * 0.27
  const h = r * 0.54

  // Tube doré : clair en haut, sombre en bas
  const metal = ctx.createLinearGradient(0, bodyY, 0, bodyY + h)
  metal.addColorStop(0, '#fff0a8')
  metal.addColorStop(0.35, '#f2b134')
  metal.addColorStop(0.7, '#9a6a14')
  metal.addColorStop(1, '#5a3a08')
  ctx.fillStyle = metal
  ctx.strokeStyle = '#3d2804'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.roundRect(x0, bodyY, x1 - x0, h, r * 0.12)
  ctx.fill()
  ctx.stroke()

  // Reflet qui glisse d'un bout à l'autre, découpé dans le tube
  const sweep = ((t * 0.55) % 1.6) - 0.3
  const cx = x0 + (x1 - x0) * sweep
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x0, bodyY, x1 - x0, h, r * 0.12)
  ctx.clip()
  const shine = ctx.createLinearGradient(cx - r * 0.3, 0, cx + r * 0.3, 0)
  shine.addColorStop(0, 'rgba(255, 255, 255, 0)')
  shine.addColorStop(0.5, 'rgba(255, 255, 240, 0.85)')
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = shine
  ctx.fillRect(cx - r * 0.3, bodyY, r * 0.6, h)
  ctx.restore()

  // Bague de la bouche
  ctx.fillStyle = '#ffe38a'
  ctx.fillRect(r * 0.72, bodyY, r * 0.16, h)
  ctx.fillStyle = '#ffd24a'
  ctx.fillRect(r * 1.62, -r * 0.2, r * 0.18, r * 0.4)

  // Étincelles : quatre branches fines qui apparaissent à tour de rôle
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let k = 0; k < 3; k++) {
    const twinkle = Math.pow(Math.max(0, Math.sin(t * 2.6 + k * 2.1)), 10)
    if (twinkle < 0.02) continue
    const sx = r * (1.9 + k * 0.28)
    const sy = (k - 1) * r * 0.42
    const size = r * (0.12 + 0.2 * twinkle)
    drawGlow(ctx, sx, sy, r * 0.5, '#ffd24a', 0.35 * twinkle)
    ctx.strokeStyle = `rgba(255, 250, 220, ${0.9 * twinkle})`
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(sx - size, sy)
    ctx.lineTo(sx + size, sy)
    ctx.moveTo(sx, sy - size)
    ctx.lineTo(sx, sy + size)
    ctx.stroke()
  }
  ctx.restore()
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

  // Arme : tube sombre rayé de la couleur du joueur, bouche lumineuse (ou canon en or animé)
  ctx.save()
  ctx.rotate(aim)
  if (look.weapon === 'gold') {
    drawGoldBarrel(ctx, r, t)
  } else {
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
  }
  ctx.restore()

  // Accessoire (derrière la tête, pour qu'il paraisse attaché)
  if (look.hat === 'cat') drawCatEars(ctx, r, t)

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

  drawTrail(ctx, p.look.trail, pts, r, t, p.look.color)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.beginPath()
  ctx.ellipse(p.x + 2, p.y + r - 1, r * 0.9, r * 0.38, 0, 0, TAU)
  ctx.fill()

  // Capacité active en cours (pour l'instant la seule : Balles enflammées) : halo de feu qui vacille.
  if (p.abilityOn.some((on) => on > 0)) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    drawGlow(ctx, p.x, p.y, r * (2.4 + 0.25 * Math.sin(t * 14)), '#ff6d00', 0.42)
    drawGlow(ctx, p.x, p.y, r * 1.4, '#ffd180', 0.3)
    ctx.restore()
  }

  ctx.save()
  ctx.translate(p.x, p.y)
  paintAvatar(ctx, p.look, r, { aim: p.aim, t: t + p.id * 1.3, moving })
  ctx.restore()

  ctx.font = `700 9px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(5, 12, 10, 0.85)'
  const label = playerLabel(p.look, p.id)
  ctx.strokeText(label, p.x, p.y + r + 9)
  ctx.fillStyle = '#eef3ee'
  ctx.fillText(label, p.x, p.y + r + 9)
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
  if (look.trail !== 'none') drawTrail(ctx, look.trail, previewPath(PLAYER.radius, t), PLAYER.radius, t, look.color)
  paintAvatar(ctx, look, PLAYER.radius, { aim, t, moving: false })
  ctx.restore()
}
