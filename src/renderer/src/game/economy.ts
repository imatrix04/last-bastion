import type { GameState } from './types'

/** Arrondi à un chiffre après la virgule (pour l'affichage des parts d'or). */
export const fmtGold = (n: number): string => String(Math.round(n * 10) / 10)

/** Gain partagé : chaque joueur reçoit sa part à parts égales. Renvoie la part de chacun. */
export function shareGold(state: GameState, amount: number): number {
  const share = amount / state.players.length
  for (const p of state.players) p.gold += share
  return share
}
