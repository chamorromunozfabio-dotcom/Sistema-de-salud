/**
 * TokenService en memoria - NO persiste en localStorage / sessionStorage / cookies
 * 
 * Por requisito de seguridad del proyecto ("no almacenar nada en storage y cookies"),
 * el JWT se mantiene únicamente en memoria RAM del navegador (variable de cierre).
 * 
 * Implicaciones:
 * - Al recargar la página (F5) el usuario deberá volver a iniciar sesión.
 * - El token no es accesible desde XSS persistido via storage, solo en memoria.
 * - No se usan cookies httpOnly (también prohibidas por requisito).
 * 
 * Si necesitas persistencia temporal (ej. recarga), considera migrar a httpOnly cookie
 * seteada por el backend + CSRF token, pero esto violaría el requisito actual.
 */

// Variable en cierre de módulo - vive mientras el tab esté abierto
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
  /** Para sincronizar UI si múltiples componentes observan */
  subscribe(cb: (token: string | null) => void): () => void {
    _listeners.push(cb);
    return () => {
      _listeners = _listeners.filter((f) => f !== cb);
    };
  },
};
