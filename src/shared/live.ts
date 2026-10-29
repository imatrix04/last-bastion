/** Événements du live TikTok, normalisés par le process main (dev uniquement) pour le renderer. */
export interface LiveUser {
  /** @pseudo unique */
  id: string
  /** Nom affiché */
  name: string
}

export type LiveEvent =
  | { type: 'status'; status: 'connecting' | 'connected' | 'disconnected'; detail?: string }
  /** Cadeau terminé : `count` est le total de la série (une série de 10 roses = un seul event). */
  | { type: 'gift'; user: LiveUser; giftId: number; name: string; diamonds: number; count: number }
  | { type: 'like'; user: LiveUser; count: number; total: number }
  | { type: 'chat'; user: LiveUser; comment: string }
  | { type: 'follow'; user: LiveUser }
  | { type: 'share'; user: LiveUser }
  | { type: 'join'; user: LiveUser }

export type LiveConnectResult = { ok: true } | { ok: false; error: string }
