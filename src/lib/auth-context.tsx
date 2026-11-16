import { type Session, type User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';
import { loadJourney } from '@/services/journey';
import { signInDestination } from '../../shared/sign-in-destination.mjs';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  signInRouting: boolean;
  signInRoute: '/your-day' | '/onboarding' | null;
  signInRouteError: string;
  beginSignIn: () => void;
  cancelSignIn: () => void;
  completeSignIn: (userId: string) => Promise<void>;
  clearSignInRedirect: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Gate the navigator before auth changes, so completed users never flash onboarding.
  const [signInRouting, setSignInRouting] = useState(false);
  const [signInRoute, setSignInRoute] = useState<'/your-day' | '/onboarding' | null>(null);
  const [signInRouteError, setSignInRouteError] = useState('');
  const routeRun = useRef(0);
  const cancelSignIn = useCallback(() => {
    routeRun.current++; setSignInRouting(false); setSignInRoute(null); setSignInRouteError('');
  }, []);
  const beginSignIn = useCallback(() => {
    routeRun.current++; setSignInRouting(true); setSignInRoute(null); setSignInRouteError('');
  }, []);
  const completeSignIn = useCallback(async (userId: string) => {
    const run = ++routeRun.current;
    setSignInRouting(true); setSignInRoute(null); setSignInRouteError('');
    try {
      const destination = signInDestination(await loadJourney(userId));
      if (run === routeRun.current) setSignInRoute(destination);
    } catch {
      if (run === routeRun.current) setSignInRouteError('Could not check your saved progress. Retry to continue; nothing has been changed.');
    } finally {
      if (run === routeRun.current) setSignInRouting(false);
    }
  }, []);
  const clearSignInRedirect = useCallback(() => setSignInRoute(null), []);

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
      if (event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY') cancelSignIn();
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setIsPasswordRecovery(false);
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [cancelSignIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isPasswordRecovery,
      signInRouting, signInRoute, signInRouteError, beginSignIn, cancelSignIn,
      completeSignIn, clearSignInRedirect,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [isLoading, isPasswordRecovery, session, signInRouting, signInRoute, signInRouteError, beginSignIn, cancelSignIn, completeSignIn, clearSignInRedirect]
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
