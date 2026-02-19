import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '@/services/api';
import type { User } from '@/types/user';

interface AuthContextType {
  // State
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

interface DecodedToken {
  id?: string;
  role?: string;
  franchise?: string;
  exp?: number;
}

/** Safely decode JWT payload - returns null if invalid (no external dependency) */
function safeDecodeToken<T>(token: string): T | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** Safely parse JSON from localStorage */
function safeParseUser(raw: string): User | null {
  try {
    if (!raw || typeof raw !== 'string') return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.id && !parsed.email) return null;
    return parsed as User;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearAuthStorage = useCallback(() => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) {
      console.warn('Failed to clear auth storage:', e);
    }
    setToken(null);
    setUser(null);
  }, []);

  // Restore user from token on app load
  useEffect(() => {
    const restoreAuth = () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (!storedToken || typeof storedToken !== 'string') {
          setIsLoading(false);
          return;
        }

        const decoded = safeDecodeToken<DecodedToken>(storedToken);
        if (!decoded) {
          clearAuthStorage();
          setIsLoading(false);
          return;
        }

        const currentTime = Date.now() / 1000;
        if (decoded.exp != null && decoded.exp < currentTime) {
          clearAuthStorage();
          setIsLoading(false);
          return;
        }

        const parsedUser = storedUser ? safeParseUser(storedUser) : null;
        if (!parsedUser) {
          clearAuthStorage();
          setIsLoading(false);
          return;
        }

        setToken(storedToken);
        setUser(parsedUser);
      } catch (e) {
        console.error('Error restoring auth:', e);
        clearAuthStorage();
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, [clearAuthStorage]);

  const clearError = useCallback(() => setError(null), []);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!email?.trim() || !password) {
      const msg = 'Email and password are required';
      setError(msg);
      throw new Error(msg);
    }
    try {
      const response = await authApi.login(email.trim(), password);
      if (!response || typeof response !== 'object') {
        const msg = 'Invalid login response';
        setError(msg);
        throw new Error(msg);
      }
      const { token: newToken, user: userData } = response as { token: string; user: User };
      if (!newToken || typeof newToken !== 'string') {
        const msg = 'No token received';
        setError(msg);
        throw new Error(msg);
      }
      if (!userData || typeof userData !== 'object') {
        const msg = 'No user data received';
        setError(msg);
        throw new Error(msg);
      }

      try {
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (e) {
        console.warn('Failed to persist auth:', e);
      }

      setToken(newToken);
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      const apiMessage = (err as { message?: string })?.message;
      const finalMessage = apiMessage || message;
      setError(finalMessage);
      throw err;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    setError(null);
    clearAuthStorage();
    authApi.logout().catch(() => {});
  }, [clearAuthStorage]);

  // Update user function
  const updateUser = useCallback((userData: User) => {
    if (!userData || typeof userData !== 'object') return;
    try {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (e) {
      console.warn('Failed to persist user update:', e);
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    error,
    login,
    logout,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
