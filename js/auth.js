import { CONFIG } from './config.js';
import { apiFetch } from './api.js';

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(CONFIG.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  localStorage.removeItem(CONFIG.USER_KEY);
}

export async function login(username, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { username, password }
  });

  if (data?.accessToken) {
    localStorage.setItem(CONFIG.TOKEN_KEY, data.accessToken);
  }
  return await fetchCurrentUser();
}

export async function registerClient(payload) {
  return await apiFetch('/api/auth/register', {
    method: 'POST',
    body: payload
  });
}

export async function fetchCurrentUser() {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  if (!token) return null;

  try {
    const user = await apiFetch('/api/auth/me', { method: 'GET' });
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    if (err.status === 401) {
      clearSession();
    }
    throw err;
  }
}

export function logout() {
  clearSession();
  window.location.hash = '#/login';
}