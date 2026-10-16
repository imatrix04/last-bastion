import { useEffect, useRef } from 'react'
import type { Look } from '../game/config/appearance'
import { drawAvatar } from '../game/player'

/** Aperçu animé du personnage (menu, boutique) : il suit lentement le curseur de la souris s'il est dessus, sinon il balaie du regard. */
export function AvatarCanvas({
  look,
  scale = 4,
  className
}: {
  look: Look
  /** Taille du personnage : 1 = taille en jeu (26 px de diamètre). */
  scale?: number
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  const lookRef = useRef(look)
  lookRef.current = look
  const pointer = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let aim = -0.5
    const t0 = performance.now()
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame)
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const t = (now - t0) / 1000
      let target = -0.55 + Math.sin(t * 0.5) * 0.55
      const ptr = pointer.current
      if (ptr) target = Math.atan2(ptr.y - rect.height / 2, ptr.x - rect.width / 2)
      aim += Math.atan2(Math.sin(target - aim), Math.cos(target - aim)) * 0.12
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      // Taille de référence : le personnage occupe `scale` × sa taille ; on adapte à la case réellement disponible.
      const px = Math.min(rect.width, rect.height) / (26 * 3.4)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawAvatar(ctx, rect.width / 2, rect.height / 2, Math.min(scale, px), lookRef.current, t, aim)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [scale])

  return (
    <canvas
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top }
      }}
      onPointerLeave={() => {
        pointer.current = null
      }}
    />
  )
}
