import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, RegisterData, LoginData } from '../types/auth';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginData) => Promise<any>;
  register: (data: RegisterData) => Promise<void>;
  verify2FA: (email: string, code: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  needs2FA: { email: string; tempToken?: string } | null;
  setNeeds2FA: (v: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needs2FA, setNeeds2FA] = useState<{ email: string; tempToken?: string } | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // Intentar refresh silencioso con cookie httpOnly antes de decidir que no hay sesión
        if (!tokenService.isAuthenticated()) {
          const refreshed = await tokenService.tryRefresh();
          if (refreshed) {
            const profile = await authService.getProfile();
            setUser(profile);
            setLoading(false);
            return;
          }
        }
        if (tokenService.isAuthenticated()) {
          const profile = await authService.getProfile();
          setUser(profile);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        // No borrar token si fue refresh falló; solo limpiar
        tokenService.removeToken();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
    const unsub = tokenService.subscribe((t) => {
      if (!t) setUser(null);
    });
    return unsub;
  }, []);

  const login = async (data: LoginData) => {
    const result: any = await authService.login(data);
    if (result.require2FA) {
      setNeeds2FA({ email: data.email, tempToken: result.tempToken });
      return result; // UI debe mostrar verify 2FA
    }
    setUser(result.user);
    setNeeds2FA(null);
    return result;
  };

  const verify2FA = async (email: string, code: string) => {
    const response = await authService.verifyTwoFactor(email, code);
    setUser(response.user);
    setNeeds2FA(null);
  };

  const register = async (data: RegisterData) => {
    const response = await authService.register(data);
    setUser(response.user);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setNeeds2FA(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    verify2FA,
    logout,
    isAuthenticated: !!user,
    needs2FA,
    setNeeds2FA,
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
