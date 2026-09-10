import { UserRole } from '@prisma/client';

/**
 * Gestor de roles - equivalente a 'gestor de roles.js' y 'autenticador de roles.js' del ejemplo
 * Ejemplo original:
 *   const roleGuard = (allowedRoles) => (req,res,next) => { ... }
 *   const isAdmin = roleGuard(['administrador'])
 *   module.exports = { roleGuard, isAdmin, isWaiter, ... }
 *
 * Adaptado a clínica: ADMIN, DOCTOR, PATIENT (en lugar de administrador/mesero/cocina/despachador)
 * Se mantiene compatibilidad con el patrón original pero integrado con NestJS RolesGuard
 */
export const roleGuard = (allowedRoles: UserRole[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de estos roles: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};

// Middlewares específicos por rol - autenticador de roles
export const isAdmin = roleGuard([UserRole.ADMIN]);
export const isDoctor = roleGuard([UserRole.ADMIN, UserRole.DOCTOR]);
export const isPatient = roleGuard([UserRole.PATIENT, UserRole.ADMIN, UserRole.DOCTOR]);
export const isAdminOrDoctor = roleGuard([UserRole.ADMIN, UserRole.DOCTOR]);

// Legacy aliases para compatibilidad con ejemplo restaurante (mapeo)
export const isWaiter = isDoctor; // mesero -> doctor
export const isKitchen = isDoctor; // cocina -> doctor
export const isDispatcher = isAdmin; // despachador -> admin
