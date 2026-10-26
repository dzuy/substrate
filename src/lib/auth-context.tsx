import { type Session, type User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  pendingOnboarding: boolean;
  completeSignIn: () => void;
  clearOnboardingRedirect: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // This provider survives the navigator remount triggered by a new session.
  const [pendingOnboarding, setPendingOnboarding] = useState(false);
  const completeSignIn = useCallback(() => setPendingOnboarding(true), []);
  const clearOnboardingRedirect = useCallback(() => setPendingOnboarding(false), []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') setPendingOnboarding(false);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setIsPasswordRecovery(false);
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isPasswordRecovery,
      pendingOnboarding,
      completeSignIn,
      clearOnboardingRedirect,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [isLoading, isPasswordRecovery, session, pendingOnboarding, completeSignIn, clearOnboardingRedirect]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}
