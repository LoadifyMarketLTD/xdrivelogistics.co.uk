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
    // SECURITY NOTE: localStorage is vulnerable to XSS attacks
    // TODO: Replace with httpOnly cookies when backend is implemented
    const storedUser = localStorage.getItem('xdrive_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('xdrive_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // TEMPORARY: Simple client-side authentication for development
      // TODO: Replace with secure backend API authentication
      // SECURITY NOTE: These credentials are for development only
      const validCredentials = [
        // ⭐ MAIN ACCOUNT - Owner with full access
        { 
          email: 'dannycourierltd@gmail.com', 
          password: 'Johnny2000$$', 
          role: 'desktop' as const 
        },
        { 
          email: process.env.NEXT_PUBLIC_MOBILE_USER || 'mobile@xdrivelogistics.com', 
          password: process.env.NEXT_PUBLIC_MOBILE_PASS || 'mobile123', 
          role: 'mobile' as const 
        },
        { 
          email: process.env.NEXT_PUBLIC_ADMIN_USER || 'admin@xdrivelogistics.com', 
          password: process.env.NEXT_PUBLIC_ADMIN_PASS || 'admin123', 
          role: 'desktop' as const 
        },
      ];

      // Validate credentials
      const credential = validCredentials.find(
        (cred) => cred.email === email && cred.password === password
      );

      if (!credential) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Login directly without 2FA
      const userData: User = {
        email: credential.email,
        role: credential.role,
      };

      localStorage.setItem('xdrive_user', JSON.stringify(userData));
      setUser(userData);

      // Redirect based on role and viewport
      if (credential.role === 'mobile' || window.innerWidth < 768) {
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
    localStorage.removeItem('xdrive_user');
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
