export const supabaseEnv = {
  url: normalizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_URL),
  publishableKey: normalizeEnvValue(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.publishableKey);

function normalizeEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue || undefined;
}
