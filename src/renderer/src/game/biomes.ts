import { BIOMES, type BiomeDef } from './config/config'

/** Indice du biome pour une vague (0 avant la première vague et pendant la vague 1 à `every`). */
export const biomeIndex = (wave: number): number => Math.min(BIOMES.list.length - 1, Math.max(0, Math.floor((Math.max(1, wave) - 1) / BIOMES.every)))

export const biomeOf = (wave: number): BiomeDef => BIOMES.list[biomeIndex(wave)]
