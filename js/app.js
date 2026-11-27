import { checkRouteAccess } from './guards.js';
import { login, registerClient, logout } from './auth.js';
import { renderCatalogView, renderCatalogManageView } from './catalog.js';
import { renderOrdersView } from './orders.js';
import { renderCustomerProfileView, renderCustomersManageView } from './customers.js';
import { renderEmployeesView, renderUsersView } from './admin.js';

const appView = document.getElementById('app-view');
const mainNav = document.getElementById('main-nav');
const sessionInfo = document.getElementById('session-info');
const toastContainer = document.getElementById('toast-container');

export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function hasHtmlTags(value) {
  return /[<>]/.test(value);
}

function renderNavigation(role, user) {
  mainNav.replaceChildren();
  sessionInfo.replaceChildren();

  const links = [
    { path: '/catalogo', label: 'Catálogo', roles: ['Visitante', 'Cliente', 'Empleado', 'Admin'] },
    { path: '/catalogo/gestion', label: 'Gestión Catálogo', roles: ['Empleado', 'Admin'] },
    { path: '/ventas', label: 'Ventas / Órdenes', roles: ['Cliente', 'Empleado', 'Admin'] },
    { path: '/clientes', label: 'Clientes', roles: ['Empleado', 'Admin'] },
    { path: '/empleados', label: 'Empleados', roles: ['Admin'] },
    { path: '/usuarios', label: 'Usuarios', roles: ['Admin'] },
    { path: '/perfil', label: 'Mi Perfil', roles: ['Cliente'] }
  ];

  links
    .filter(item => item.roles.includes(role))
    .forEach(item => {
      const a = document.createElement('a');
      a.href = `#${item.path}`;
      a.textContent = item.label;
      mainNav.appendChild(a);
    });

  if (user) {
    const span = document.createElement('span');
    span.textContent = `${user.username} (${role}) `;
    const btnLogout = document.createElement('button');
    btnLogout.textContent = 'Cerrar sesión';
    btnLogout.className = 'btn-secondary';
    btnLogout.addEventListener('click', logout);
    sessionInfo.append(span, btnLogout);
  } else {
    const aLogin = document.createElement('a');
    aLogin.href = '#/login';
    aLogin.textContent = 'Iniciar sesión';
    const aReg = document.createElement('a');
    aReg.href = '#/registro';
    aReg.textContent = 'Registrarse';
    sessionInfo.append(aLogin, aReg);
  }
}

function renderLoginView() {
  appView.innerHTML = `
    <section class="card auth-card">
      <h2>Iniciar Sesión</h2>
      <form id="login-form">
        <label>Usuario
          <input type="text" name="username" required autocomplete="username" />
        </label>
        <label>Contraseña
          <input type="password" name="password" required autocomplete="current-password" />
        </label>
        <button type="submit" id="btn-login">Entrar</button>
      </form>
      <p class="hint">¿Eres cliente nuevo? <a href="#/registro">Crea tu cuenta aquí</a></p>
    </section>
  `;

  const form = document.getElementById('login-form');
  const btn = document.getElementById('btn-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    try {
      await login(form.username.value.trim(), form.password.value);
      showToast('Bienvenido al sistema Northwind.', 'success');
      window.location.hash = '#/catalogo';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });
}

function renderRegisterView() {
  appView.innerHTML = `
    <section class="card auth-card">
      <h2>Registro de Cliente</h2>
      <form id="register-form">
        <label>Usuario * <input type="text" name="username" required maxlength="50" /></label>
        <label>Contraseña * <input type="password" name="password" required minlength="8" /></label>
        <label>Empresa (máx. 40) * <input type="text" name="companyName" required maxlength="40" /></label>
        <label>Contacto (máx. 30) * <input type="text" name="contactName" required maxlength="30" /></label>
        <label>Teléfono (máx. 24) <input type="text" name="phone" maxlength="24" /></label>
        <label>Dirección <input type="text" name="address" maxlength="60" /></label>
        <label>Ciudad (máx. 15) <input type="text" name="city" maxlength="15" /></label>
        <label>País (máx. 15) <input type="text" name="country" maxlength="15" /></label>
        <button type="submit" id="btn-register">Registrarme</button>
      </form>
    </section>
  `;

  const form = document.getElementById('register-form');
  const btn = document.getElementById('btn-register');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    for (const [key, val] of Object.entries(payload)) {
      if (hasHtmlTags(val)) {
        showToast(`El campo ${key} no puede contener caracteres '<' o '>'.`, 'error');
        return;
      }
      payload[key] = val.trim();
    }

    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
      await registerClient(payload);
      showToast('Registro exitoso. Ahora puedes iniciar sesión.', 'success');
      window.location.hash = '#/login';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Registrarme';
    }
  });
}

async function router() {
  const hash = window.location.hash.replace('#', '') || '/catalogo';
  const access = await checkRouteAccess(hash);

  if (!access.allowed) {
    if (access.reason) showToast(access.reason, 'error');
    window.location.hash = `#${access.redirect}`;
    return;
  }

  renderNavigation(access.role, access.user);

  switch (hash) {
    case '/login':
      renderLoginView();
      break;
    case '/registro':
      renderRegisterView();
      break;
    case '/catalogo':
      await renderCatalogView(appView, access.role, showToast);
      break;
    case '/catalogo/gestion':
      await renderCatalogManageView(appView, showToast);
      break;
    case '/ventas':
      await renderOrdersView(appView, access.role, showToast);
      break;
    case '/clientes':
      await renderCustomersManageView(appView, access.role, showToast);
      break;
    case '/empleados':
      await renderEmployeesView(appView, showToast);
      break;
    case '/usuarios':
      await renderUsersView(appView, access.user, showToast);
      break;
    case '/perfil':
      await renderCustomerProfileView(appView, access.user, showToast);
      break;
    default:
      window.location.hash = '#/catalogo';
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);