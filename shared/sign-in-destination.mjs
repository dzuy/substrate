/** Only route from reconciled progress. Do not mistake an unavailable account for new onboarding. */
export function signInDestination(loaded) {
  if (!loaded?.available) throw Error('Saved progress unavailable');
  if (loaded.conflict) return '/onboarding';
  return loaded.state?.stage === 'complete' ? '/your-day' : '/onboarding';
}
