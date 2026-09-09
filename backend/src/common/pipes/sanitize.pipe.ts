import { Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeObject } from '../utils/sanitize';

/**
 * Pipe global que sanitiza todo el body/query contra XSS / JS injection.
 * Se ejecuta antes de ValidationPipe.
 * Compatible con Prisma: no permite inyección SQL porque Prisma usa parámetros preparados,
 * pero sanitiza igualmente strings para prevenir almacenamiento XSS persistido.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any) {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return sanitizeObject(value);
    }
    if (typeof value === 'string') {
      // Solo strings sueltos (query params)
      const { sanitizeString } = require('../utils/sanitize');
      return sanitizeString(value);
    }
    return value;
  }
}
