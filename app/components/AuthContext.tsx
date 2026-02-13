'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('dannycourier_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('dannycourier_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Simple client-side authentication (to be replaced with backend)
      // For now, check against hardcoded credentials
      const validCredentials = [
        { email: 'mobile@dannycourier.co.uk', password: 'mobile123', role: 'mobile' as const },
        { email: 'admin@dannycourier.co.uk', password: 'admin123', role: 'desktop' as const },
      ];

      const credential = validCredentials.find(
        (cred) => cred.email === email && cred.password === password
      );

      if (!credential) {
        return { success: false, error: 'Invalid email or password' };
      }

      const userData: User = {
        email: credential.email,
        role: credential.role,
      };

      localStorage.setItem('dannycourier_user', JSON.stringify(userData));
      setUser(userData);

      // Redirect based on role
      if (credential.role === 'mobile') {
        router.push('/m');
      } else {
        router.push('/admin');
      }

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  };

  const logout = () => {
    localStorage.removeItem('dannycourier_user');
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
