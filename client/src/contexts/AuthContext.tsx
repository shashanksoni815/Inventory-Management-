import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi } from '@/services/api';
import type { User } from '@/types';
import jwtDecode from 'jwt-decode';

interface AuthContextType {
  // State
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

interface DecodedToken {
  id: string;
  role: string;
  franchise?: string;
  exp?: number;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore user from token on app load
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          // Verify token is not expired
          try {
            const decoded = jwtDecode<DecodedToken>(storedToken);
            const currentTime = Date.now() / 1000;

            if (decoded.exp && decoded.exp < currentTime) {
              // Token expired, clear storage
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setToken(null);
              setUser(null);
              setIsLoading(false);
              return;
            }

            // Token is valid, restore user and token
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } catch (error) {
            // Invalid token, clear storage
            console.error('Invalid token:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error restoring auth:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreAuth();
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      const { token: newToken, user: userData } = response as { token: string; user: User };

      // Store token and user in localStorage
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));

      // Update state
      setToken(newToken);
      setUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Clear state
    setToken(null);
    setUser(null);

    // Call logout API (optional, for server-side session cleanup)
    authApi.logout().catch(() => {
      // Ignore errors on logout
    });
  }, []);

  // Update user function
  const updateUser = useCallback((userData: User) => {
    // Update localStorage
    localStorage.setItem('user', JSON.stringify(userData));

    // Update state
    setUser(userData);
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    updateUser,
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
