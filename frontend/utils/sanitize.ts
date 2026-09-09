/**
 * Utilidad de saneamiento frontend contra XSS / JS injection.
 * - Escapa HTML y elimina tags script
 * - Usar siempre antes de renderizar contenido de usuario o enviar al backend
 */

// Escapa caracteres HTML peligrosos
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;
  // Eliminar tags script/style y luego escapar HTML restante
  let clean = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remover event handlers on*= y javascript: URLs
  clean = clean.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  clean = clean.replace(/on\w+\s*=\s*[^\s>]+/gi, '');
  clean = clean.replace(/javascript\s*:/gi, '');
  return clean.trim();
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj as unknown as string) as unknown as T;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeObject(v)) as unknown as T;
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj as any)) {
      out[k] = sanitizeObject(v);
    }
    return out;
  }
  return obj;
}
