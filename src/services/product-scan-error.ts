/** Only expose actionable copy, never raw provider or Edge Function errors. */
export class ProductScanError extends Error {}

export function productScanErrorMessage(status?: number): string {
  if (status === 401 || status === 403)
    return 'Your session may have expired. Please sign in again, then retry the photo.';
  if (status === 413)
    return 'This photo is too large to scan. Try a smaller image or take another photo.';
  if (status === 400 || status === 415 || status === 422)
    return 'We couldn’t read this photo. Try another clear photo with the product labels visible.';
  if (status === 429)
    return 'Product scanning is busy right now. Wait a moment, then try again.';
  if (!status)
    return 'We couldn’t connect to the photo scanner. Check your connection and try again.';
  return 'We couldn’t scan your photo right now. Please try again in a moment, or add your products manually.';
}
