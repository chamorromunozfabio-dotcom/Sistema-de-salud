import { AuthResponse, RegisterData, LoginData, User } from '../types/auth';
import { tokenService } from './tokenService';
import { sanitizeObject } from '../utils/sanitize';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class AuthService {
  private getAuthHeaders(): HeadersInit {
    const token = tokenService.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const clean = sanitizeObject(data);
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // para recibir cookie refreshToken httpOnly
      body: JSON.stringify(clean),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al registrar usuario');
    }

    const authResponse: AuthResponse = await response.json();
    // authResponse puede incluir refreshToken en body además de cookie httpOnly
    this.setToken(authResponse.accessToken);
    return authResponse;
  }

  async login(data: LoginData): Promise<any> {
    const clean = sanitizeObject(data);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(clean),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Credenciales inválidas');
    }

    const result = await response.json();
    // Soporta 2FA: backend responde { require2FA: true, tempToken, user }
    if (result.require2FA) {
      // Guardar tempToken como accessToken temporal para verify-2fa flujo
      if (result.tempToken) this.setToken(result.tempToken);
      return result; // dejar que UI maneje verify-2fa
    }

    const authResponse: AuthResponse = result;
    this.setToken(authResponse.accessToken);
    return authResponse;
  }

  async verifyTwoFactor(email: string, code: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Código 2FA inválido');
    }
    const authResponse: AuthResponse = await response.json();
    this.setToken(authResponse.accessToken);
    return authResponse;
  }

  async refresh(): Promise<string | null> {
    return tokenService.tryRefresh();
  }

  async getProfile(): Promise<User> {
    let response = await fetch(`${API_URL}/auth/profile`, {
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    // Auto-refresh si 401 (accessToken expirado, intentar con cookie refresh)
    if (response.status === 401) {
      const newToken = await this.refresh();
      if (newToken) {
        response = await fetch(`${API_URL}/auth/profile`, {
          headers: this.getAuthHeaders(),
          credentials: 'include',
        });
      }
    }

    if (!response.ok) {
      throw new Error('Error al obtener perfil');
    }

    return response.json();
  }

  async logout(): Promise<void> {
    try {
      const token = tokenService.getToken();
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        credentials: 'include',
      });
    } catch {}
    this.removeToken();
  }

  async enable2FA(): Promise<any> {
    const res = await fetch(`${API_URL}/auth/enable-2fa`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error habilitando 2FA');
    return res.json();
  }

  async confirm2FA(code: string): Promise<any> {
    const res = await fetch(`${API_URL}/auth/confirm-2fa`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.message || 'Código inválido');
    }
    return res.json();
  }

  async disable2FA(): Promise<any> {
    const res = await fetch(`${API_URL}/auth/disable-2fa`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error deshabilitando 2FA');
    return res.json();
  }

  setToken(token: string): void {
    tokenService.setToken(token);
  }

  getToken(): string | null {
    return tokenService.getToken();
  }

  removeToken(): void {
    tokenService.removeToken();
  }

  isAuthenticated(): boolean {
    return tokenService.isAuthenticated();
  }
}

export const authService = new AuthService();
