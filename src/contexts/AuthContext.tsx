import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface PaymentInfo {
  displayName?: string;
  venmoUsername?: string;
  zelleIdentifier?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, paymentInfo?: PaymentInfo) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const syncProfileDisplayNameFromAuth = async (authUser: User) => {
    try {
      const meta = authUser.user_metadata as Record<string, unknown> | undefined;
      const nameFromMeta =
        (typeof meta?.display_name === 'string' ? meta.display_name : undefined) ||
        (typeof meta?.full_name === 'string' ? meta.full_name : undefined) ||
        (typeof meta?.name === 'string' ? meta.name : undefined);
      const safeName = (nameFromMeta ?? '').trim();
      if (!safeName) return;

      // Ensure a profile row exists (and keep display_name in sync) so downstream UI can rely on it.
      await supabase
        .from('user_profiles')
        .upsert({ user_id: authUser.id, display_name: safeName }, { onConflict: 'user_id' });
    } catch (err) {
      // Non-fatal: auth should still work even if profile sync fails.
      console.error('Error syncing user profile display name:', err);
    }
  };

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
    } catch (err) {
      console.error('Error checking admin role:', err);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Defer admin role check with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
            // Defer profile sync to avoid blocking auth state updates.
            syncProfileDisplayNameFromAuth(session.user);
          }, 0);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (session?.user) {
        checkAdminRole(session.user.id);
        syncProfileDisplayNameFromAuth(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, paymentInfo?: PaymentInfo) => {
    const redirectUrl = `${window.location.origin}/`;

    const signUpOptions: { emailRedirectTo: string; data?: Record<string, unknown> } = {
      emailRedirectTo: redirectUrl,
    };

    if (paymentInfo?.displayName) {
      const safeName = paymentInfo.displayName.trim();
      // Store name in account metadata so booking can auto-fill even if profile creation is delayed.
      // Use multiple keys for compatibility across different clients/fields.
      signUpOptions.data = { display_name: safeName, full_name: safeName, name: safeName };
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...signUpOptions,
      },
    });
    
    if (error) {
      return { error: error as Error | null };
    }

    // Create user profile only if we have an authenticated session (RLS requires auth.uid()).
    if (data.user && data.session && paymentInfo) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          display_name: paymentInfo.displayName || null,
          venmo_username: paymentInfo.venmoUsername || null,
          zelle_identifier: paymentInfo.zelleIdentifier || null,
        });
      
      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't fail signup if profile creation fails - user can update later
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
