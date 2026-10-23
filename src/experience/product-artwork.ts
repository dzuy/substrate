// Generic photographic fallbacks. Catalog photography always takes precedence.
export function productArtwork(category: string) {
  if (category === 'cleanser') return require('@/assets/images/products/cleanser-v1.png');
  if (category === 'moisturizer' || category === 'spf' || category === 'mask') return require('@/assets/images/products/moisturizer-v1.png');
  if (category === 'treatment' || category === 'retinoid' || category === 'device') return require('@/assets/images/products/treatment-v1.png');
  return require('@/assets/images/products/serum-v1.png');
}
