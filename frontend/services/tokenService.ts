/**
 * TokenService híbrido - manejo de tokens con cookies httpOnly + hash + tiempo de trabajo
 * 
 * Backend ahora guarda refreshToken en cookie httpOnly httpOnly secure sameSite=strict maxAge 7d
 * - accessToken: 15m en memoria (variable _token) + opcional en cookie httpOnly si backend lo envía
 * - refreshToken: httpOnly cookie (no accesible por JS) + tiempo de trabajo 7d + hash bcrypt en DB/Redis
 * 
 * Frontend:
 * - accessToken en memoria (cierre de módulo) para Authorization Bearer
 * - refreshToken se envía automáticamente por navegador con credentials:'include' en cada request a /auth/refresh-token
 * - Al recargar (F5), se intenta silent refresh usando cookie httpOnly antes de pedir login
 * 
 * Esto cumple requisito: manejo de tokens y guardar en cookies - tiempo de trabajo - hash
 */

let _token: string | null = null;
let _listeners: Array<(token: string | null) => void> = [];

function notify() {
  _listeners.forEach((cb) => cb(_token));
}

export const tokenService = {
  setToken(token: string) {
    _token = token;
    notify();
  },
  getToken(): string | null {
    return _token;
  },
  removeToken() {
    _token = null;
    notify();
  },
  isAuthenticated(): boolean {
    return !!_token;
  },
  subscribe(cb: (token: string | null) => void): () => void {
    _listeners.push(cb);
    return () => {
      _listeners = _listeners.filter((f) => f !== cb);
    };
  },
  // Intentar refresh silencioso usando cookie httpOnly
  async tryRefresh(): Promise<string | null> {
    try {
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include', // envía cookie httpOnly refreshToken
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.accessToken) {
        _token = data.accessToken;
        notify();
        return data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  },
};
