import * as xss from 'xss';

/**
 * Sanitiza strings contra XSS / JS injection.
 * - Elimina tags HTML / scripts
 * - Opciones estrictas: no permite tags, solo texto plano
 */
const xssOptions: xss.IFilterXSSOptions = {
  whiteList: {}, // No permitir ninguna etiqueta HTML
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;
  // Trim + xss filter + limitar longitud implícitamente via DTO MaxLength
  return xss.filterXSS(value.trim(), xssOptions);
}

export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, val] of Object.entries(obj)) {
      // No sanitizar campos técnicos como password en hash comparision? sí, pero password se hashea, no se renderiza
      sanitized[key] = sanitizeObject(val);
    }
    return sanitized;
  }
  return obj;
}
