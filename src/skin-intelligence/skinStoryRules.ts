import type { SkinStoryState } from '@/skin-intelligence/skinStoryTypes';

export const stateLabels: Record<SkinStoryState, string> = {
  barrier: 'Barrier',
  inflammation: 'Inflammation',
  hydration: 'Hydration',
  breakout: 'Breakout / Oil',
};

export const stateIngredientsToFavor: Record<SkinStoryState, string[]> = {
  barrier: ['Ceramides', 'Panthenol', 'Ectoin', 'Beta-glucan'],
  inflammation: ['Centella', 'Green tea', 'Ectoin', 'Colloidal oat'],
  hydration: ['Hyaluronic acid', 'Glycerin', 'Panthenol', 'Ceramides'],
  breakout: ['Niacinamide', 'Salicylic acid', 'Zinc PCA'],
};

export const statePriorities: Record<SkinStoryState, string[]> = {
  barrier: ['Support your skin barrier', 'Keep friction low', 'Avoid adding strong new actives'],
  inflammation: ['Keep irritation low', 'Use calming products', 'Protect from heat and UV'],
  hydration: ['Increase hydration', 'Seal in water with moisturizer', 'Keep cleanser gentle'],
  breakout: ['Keep pores clear', 'Avoid heavy layers', 'Use targeted treatment only where needed'],
};

export const stateAvoids: Partial<Record<SkinStoryState, string[]>> = {
  barrier: ['Strong exfoliating acids', 'Retinoids tonight', 'Potentially irritating actives'],
  inflammation: ['Strong exfoliating acids', 'Retinoids tonight', 'High-heat treatments'],
  breakout: ['Heavy facial oils', 'Occlusive layering'],
};
