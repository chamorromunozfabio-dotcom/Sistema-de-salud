import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, RegisterData, LoginData } from '../types/auth';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Token en memoria: al refrescar la página se pierde (seguridad máxima, sin localStorage/cookies).
    // El usuario deberá volver a loguearse tras F5 - comportamiento esperado por requisito.
    const loadUser = async () => {
      try {
        if (tokenService.isAuthenticated()) {
          const profile = await authService.getProfile();
          setUser(profile);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        tokenService.removeToken();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
    // Suscribirse a cambios de token (logout/login en otra pestaña logica opcional)
    const unsub = tokenService.subscribe((t) => {
      if (!t) setUser(null);
    });
    return unsub;
  }, []);

  const login = async (data: LoginData) => {
    const response = await authService.login(data);
    setUser(response.user);
  };

  const register = async (data: RegisterData) => {
    const response = await authService.register(data);
    setUser(response.user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
