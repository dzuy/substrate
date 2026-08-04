import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { isSupabaseConfigured, supabaseEnv } from '@/lib/env';
import type { Database } from '@/types/database';

const fallbackUrl = 'http://127.0.0.1:54321';
const fallbackKey = 'supabase-not-configured';

export const supabase = createClient<Database>(
  supabaseEnv.url ?? fallbackUrl,
  supabaseEnv.publishableKey ?? fallbackKey,
  {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  }
);

if (!isSupabaseConfigured) {
  console.warn('Supabase is not configured. Copy .env.example to .env.local and set the public project values.');
}

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
