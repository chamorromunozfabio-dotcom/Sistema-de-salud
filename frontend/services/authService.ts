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
    // Sanitizar antes de enviar (defensa en profundidad contra JS injection)
    const clean = sanitizeObject(data);
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al registrar usuario');
    }

    const authResponse: AuthResponse = await response.json();
    this.setToken(authResponse.accessToken);
    return authResponse;
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const clean = sanitizeObject(data);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clean),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Credenciales inválidas');
    }

    const authResponse: AuthResponse = await response.json();
    this.setToken(authResponse.accessToken);
    return authResponse;
  }

  async getProfile(): Promise<User> {
    const response = await fetch(`${API_URL}/auth/profile`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Error al obtener perfil');
    }

    return response.json();
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

  logout(): void {
    this.removeToken();
  }

  isAuthenticated(): boolean {
    return tokenService.isAuthenticated();
  }
}

export const authService = new AuthService();
