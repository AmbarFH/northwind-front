import { CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(status, message, fieldErrors = null) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);

  const headers = {
    ...(options.headers || {})
  };

  if (CONFIG.API_BASE_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body !== 'string') {
      options.body = JSON.stringify(options.body);
    }
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json') || contentType.includes('application/problem+json');
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw parseProblemDetails(response.status, data);
  }

  return data;
}

function parseProblemDetails(status, problem) {
  let fieldErrors = null;
  let message = '';

  if (problem) {
    if (problem.errors && typeof problem.errors === 'object') {
      fieldErrors = problem.errors;
      message = Object.entries(problem.errors)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join(' | ');
    }
    if (!message && problem.detail) {
      message = problem.detail;
    }
    if (!message && problem.title) {
      message = problem.title;
    }
  }

  if (!message) {
    const fallbacks = {
      400: 'Solicitud inválida. Verifica los datos ingresados.',
      401: 'No autorizado o credenciales incorrectas.',
      403: 'No tienes permisos para realizar esta acción.',
      404: 'El recurso solicitado no existe.',
      409: 'Conflicto de datos (registro duplicado, stock insuficiente o relación activa).',
      423: 'Cuenta bloqueada por múltiples intentos fallidos. Contacta a un administrador.',
      429: 'Demasiados intentos seguidos. Por favor espera 1 minuto antes de reintentar.',
      500: 'Error interno en el servidor.'
    };
    message = fallbacks[status] || `Error inesperado (HTTP ${status}).`;
  }

  return new ApiError(status, message, fieldErrors);
}