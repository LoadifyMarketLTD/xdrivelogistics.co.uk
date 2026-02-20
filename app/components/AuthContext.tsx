'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

interface User {
  id: string;
  email: string;
  role: 'mobile' | 'desktop';
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Legacy credentials for fallback when Supabase is not configured
const LEGACY_CREDENTIALS = [
  { email: 'dannycourierltd@gmail.com', password: 'Johnny2000$$', role: 'desktop' as const },
  { email: process.env.NEXT_PUBLIC_MOBILE_USER || 'mobile@xdrivelogistics.com', password: process.env.NEXT_PUBLIC_MOBILE_PASS || 'mobile123', role: 'mobile' as const },
  { email: process.env.NEXT_PUBLIC_ADMIN_USER || 'admin@xdrivelogistics.com', password: process.env.NEXT_PUBLIC_ADMIN_PASS || 'admin123', role: 'desktop' as const },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isSupabaseConfigured) {
      // Use Supabase auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            role: 'desktop',
          });
        }
        setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            role: 'desktop',
          });
        } else {
          setUser(null);
        }
        setIsLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      // Legacy localStorage auth
      const storedUser = localStorage.getItem('xdrive_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          // In legacy mode, use email as ID (no real UUID available without Supabase)
          setUser({ id: parsed.email, email: parsed.email, role: parsed.role });
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          localStorage.removeItem('xdrive_user');
        }
      }
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Fall back to legacy credentials check
          const cred = LEGACY_CREDENTIALS.find(c => c.email === email && c.password === password);
          if (!cred) return { success: false, error: error.message };
          // In legacy fallback mode, use email as a stand-in ID (no real UUID without Supabase)
          const userData: User = { id: email, email: cred.email, role: cred.role };
          setUser(userData);
          if (cred.role === 'mobile' || (typeof window !== 'undefined' && window.innerWidth < 768)) {
            router.push('/m');
          } else {
            router.push('/admin');
          }
          return { success: true };
        }
        if (data.user) {
          const userData: User = { id: data.user.id, email: data.user.email ?? '', role: 'desktop' };
          setUser(userData);
          router.push('/admin');
          return { success: true };
        }
        return { success: false, error: 'Login failed' };
      } else {
        // Legacy auth (no Supabase configured)
        const cred = LEGACY_CREDENTIALS.find(c => c.email === email && c.password === password);
        if (!cred) return { success: false, error: 'Invalid email or password' };
        // In legacy mode, use email as a stand-in ID (no real UUID without Supabase)
        const userData: User = { id: email, email: cred.email, role: cred.role };
        localStorage.setItem('xdrive_user', JSON.stringify({ email: cred.email, role: cred.role }));
        setUser(userData);
        if (cred.role === 'mobile' || (typeof window !== 'undefined' && window.innerWidth < 768)) {
          router.push('/m');
        } else {
          router.push('/admin');
        }
        return { success: true };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('xdrive_user');
    }
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
