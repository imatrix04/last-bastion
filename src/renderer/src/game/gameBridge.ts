import type { Game } from './engine'

/** Passerelle vers la partie en cours, pour les composants React qui doivent lui parler (pop-up de choix). */
export const gameBridge: { current: Game | null } = { current: null }
