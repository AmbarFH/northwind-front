import { fetchCurrentUser, clearSession } from './auth.js';

export const ROUTE_PERMISSIONS = {
  '/login': { publicOnly: true },
  '/registro': { publicOnly: true },
  '/catalogo': { roles: ['Visitante', 'Cliente', 'Empleado', 'Admin'] },
  '/catalogo/gestion': { roles: ['Empleado', 'Admin'] },
  '/ventas': { roles: ['Cliente', 'Empleado', 'Admin'] },
  '/perfil': { roles: ['Cliente', 'Admin'] },
  '/clientes': { roles: ['Empleado', 'Admin'] },
  '/empleados': { roles: ['Admin'] },
  '/usuarios': { roles: ['Admin'] }
};

export async function checkRouteAccess(route) {
  const rule = ROUTE_PERMISSIONS[route] || ROUTE_PERMISSIONS['/catalogo'];
  let user = null;

  try {
    user = await fetchCurrentUser();
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      return { allowed: false, redirect: '/login', reason: 'Tu sesión expiró. Inicia sesión nuevamente.' };
    }
  }

  const currentRole = user?.role || 'Visitante';

  if (rule.publicOnly) {
    if (user) {
      return { allowed: false, redirect: '/catalogo' };
    }
    return { allowed: true, user: null, role: 'Visitante' };
  }

  if (!rule.roles.includes(currentRole)) {
    if (!user) {
      return { allowed: false, redirect: '/login', reason: 'Debes iniciar sesión para acceder a esta vista.' };
    }
    return { allowed: false, redirect: '/catalogo', reason: 'Acceso denegado: no tienes permisos para esta sección.' };
  }

  return { allowed: true, user, role: currentRole };
}