export const supabaseEnv = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.publishableKey);
