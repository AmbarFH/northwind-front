import { apiFetch } from './api.js';

function formatDate(isoDate) {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

function toInputDate(isoDate) {
  if (!isoDate) return '';
  return isoDate.split('T')[0];
}

function hasHtmlTags(value) {
  return typeof value === 'string' && /[<>]/.test(value);
}

/**
 * Vista 1: Gestión de Empleados (#/empleados) - Exclusiva Admin
 */
export async function renderEmployeesView(container, showToast) {
  container.replaceChildren();

  const wrapper = document.createElement('section');
  wrapper.className = 'card';
  wrapper.innerHTML = `
    <div class="section-header">
      <h2>Gestión de Empleados</h2>
      <button type="button" id="btn-new-employee">+ Nuevo Empleado</button>
    </div>

    <form id="employee-form" class="crud-form hidden">
      <h3 id="employee-form-title">Nuevo Empleado y Cuenta</h3>
      <input type="hidden" name="employeeId" />
      <div class="form-grid">
        <label>Nombre (máx. 10) *
          <input type="text" name="firstName" required maxlength="10" />
        </label>
        <label>Apellidos (máx. 20) *
          <input type="text" name="lastName" required maxlength="20" />
        </label>
        <label>Puesto / Título (máx. 30)
          <input type="text" name="title" maxlength="30" />
        </label>
        <label>Fecha de Nacimiento
          <input type="date" name="birthDate" />
        </label>
        <label>Fecha de Contratación
          <input type="date" name="hireDate" />
        </label>
        <label>Reporta a (ID Supervisor)
          <input type="number" name="reportsTo" min="1" />
        </label>
        <label>Dirección (máx. 60)
          <input type="text" name="address" maxlength="60" />
        </label>
        <label>Ciudad (máx. 15)
          <input type="text" name="city" maxlength="15" />
        </label>
        <label>País (máx. 15)
          <input type="text" name="country" maxlength="15" />
        </label>
        <label>Teléfono (máx. 24)
          <input type="text" name="homePhone" maxlength="24" />
        </label>
      </div>

      <div id="employee-account-fields" class="order-items-box">
        <h4>Cuenta de Acceso Vinculada</h4>
        <div class="form-grid">
          <label>Usuario (3-50 caracteres) *
            <input type="text" name="username" maxlength="50" pattern="^[a-zA-Z0-9_.-]{3,50}$" />
          </label>
          <label>Contraseña (mín. 8: Mayús, minús y número) *
            <input type="password" name="password" minlength="8" maxlength="128" />
          </label>
          <label>Rol del Sistema *
            <select name="role">
              <option value="Empleado">Empleado</option>
              <option value="Admin">Admin</option>
            </select>
          </label>
        </div>
      </div>

      <div class="form-actions" style="margin-top: 1rem;">
        <button type="submit" id="btn-save-employee">Guardar Empleado</button>
        <button type="button" id="btn-cancel-employee" class="btn-secondary">Cancelar</button>
      </div>
    </form>

    <div class="toolbar-form">
      <label class="checkbox-inline" style="margin: 0;">
        <input type="checkbox" id="emp-include-inactive" /> Incluir empleados inactivos
      </label>
      <button type="button" id="btn-refresh-employees" class="btn-secondary">Actualizar lista</button>
    </div>

    <p class="hint" id="employees-status"></p>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Puesto</th>
            <th>Ubicación</th>
            <th>Usuario / Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="employees-tbody"></tbody>
      </table>
    </div>

    <div class="pagination-bar" id="employees-pagination"></div>
  `;

  container.appendChild(wrapper);

  const form = document.getElementById('employee-form');
  const formTitle = document.getElementById('employee-form-title');
  const accountFields = document.getElementById('employee-account-fields');
  const tbody = document.getElementById('employees-tbody');
  const statusEl = document.getElementById('employees-status');
  const paginationEl = document.getElementById('employees-pagination');

  let currentOffset = 0;
  const pageSize = 15;

  function openCreateForm() {
    form.reset();
    form.employeeId.value = '';
    formTitle.textContent = 'Nuevo Empleado y Cuenta';
    accountFields.classList.remove('hidden');
    form.username.required = true;
    form.password.required = true;
    form.role.required = true;
    form.classList.remove('hidden');
  }

  async function openEditForm(id) {
    try {
      const detail = await apiFetch(`/api/empleados/${id}`);
      form.employeeId.value = detail.employeeId;
      form.firstName.value = detail.firstName || '';
      form.lastName.value = detail.lastName || '';
      form.title.value = detail.title || '';
      form.birthDate.value = toInputDate(detail.birthDate);
      form.hireDate.value = toInputDate(detail.hireDate);
      form.reportsTo.value = detail.reportsTo ?? '';
      form.address.value = detail.address || '';
      form.city.value = detail.city || '';
      form.country.value = detail.country || '';
      form.homePhone.value = detail.homePhone || '';

      accountFields.classList.add('hidden');
      form.username.required = false;
      form.password.required = false;
      form.role.required = false;

      formTitle.textContent = `Editar Empleado #${detail.employeeId}`;
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showToast(err.message || 'No se pudo cargar el detalle del empleado.', 'error');
    }
  }

  async function handleDeactivate(emp) {
    if (!confirm(`¿Dar de baja lógica a "${emp.firstName} ${emp.lastName}"? También desactivará su usuario vinculado.`)) {
      return;
    }
    try {
      await apiFetch(`/api/empleados/${emp.employeeId}`, { method: 'DELETE' });
      showToast('Empleado desactivado correctamente.', 'success');
      await loadEmployees(currentOffset);
    } catch (err) {
      showToast(err.message || 'No se pudo desactivar el empleado.', 'error');
    }
  }

  async function loadEmployees(offset = 0) {
    currentOffset = offset;
    statusEl.textContent = 'Cargando empleados...';
    tbody.replaceChildren();
    paginationEl.replaceChildren();

    try {
      const includeInactive = document.getElementById('emp-include-inactive').checked;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(currentOffset),
        includeInactive: String(includeInactive)
      });

      const data = await apiFetch(`/api/empleados?${params.toString()}`);

      if (!data.items || data.items.length === 0) {
        statusEl.textContent = 'No se encontraron empleados registrados.';
        return;
      }

      const currentPage = Math.floor(data.offset / data.limit) + 1;
      const totalPages = Math.max(1, Math.ceil(data.totalCount / data.limit));
      statusEl.textContent = `Mostrando ${data.items.length} de ${data.totalCount} empleados.`;

      data.items.forEach((emp) => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = emp.employeeId;

        const tdName = document.createElement('td');
        tdName.textContent = `${emp.firstName} ${emp.lastName}`;

        const tdTitle = document.createElement('td');
        tdTitle.textContent = emp.title || '-';

        const tdLoc = document.createElement('td');
        tdLoc.textContent = [emp.city, emp.country].filter(Boolean).join(', ') || '-';

        const tdAcc = document.createElement('td');
        tdAcc.textContent = emp.hasUserAccount ? `${emp.username} (${emp.userRole})` : 'Sin cuenta';

        const tdStatus = document.createElement('td');
        tdStatus.textContent = emp.isActive ? 'Activo' : 'Inactivo';
        tdStatus.className = emp.isActive ? 'stock-ok' : 'stock-out';

        const tdActions = document.createElement('td');
        tdActions.className = 'table-actions';

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn-small';
        btnEdit.textContent = 'Editar';
        btnEdit.addEventListener('click', () => openEditForm(emp.employeeId));
        tdActions.appendChild(btnEdit);

        if (emp.isActive) {
          const btnDel = document.createElement('button');
          btnDel.type = 'button';
          btnDel.className = 'btn-small btn-danger';
          btnDel.textContent = 'Desactivar';
          btnDel.addEventListener('click', () => handleDeactivate(emp));
          tdActions.appendChild(btnDel);
        }

        tr.append(tdId, tdName, tdTitle, tdLoc, tdAcc, tdStatus, tdActions);
        tbody.appendChild(tr);
      });

      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.textContent = '← Anterior';
      btnPrev.disabled = currentOffset <= 0;
      btnPrev.addEventListener('click', () => loadEmployees(Math.max(0, currentOffset - pageSize)));

      const pageSpan = document.createElement('span');
      pageSpan.textContent = `Página ${currentPage} de ${totalPages}`;

      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.textContent = 'Siguiente →';
      btnNext.disabled = currentOffset + data.items.length >= data.totalCount;
      btnNext.addEventListener('click', () => loadEmployees(currentOffset + pageSize));

      paginationEl.append(btnPrev, pageSpan, btnNext);
    } catch (err) {
      statusEl.textContent = '';
      showToast(err.message || 'Error al cargar empleados.', 'error');
    }
  }

  document.getElementById('btn-new-employee').addEventListener('click', openCreateForm);
  document.getElementById('btn-cancel-employee').addEventListener('click', () => {
    form.classList.add('hidden');
    form.reset();
  });
  document.getElementById('emp-include-inactive').addEventListener('change', () => loadEmployees(0));
  document.getElementById('btn-refresh-employees').addEventListener('click', () => loadEmployees(currentOffset));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.employeeId.value;
    const textFields = ['firstName', 'lastName', 'title', 'address', 'city', 'country', 'homePhone'];

    const payload = {};
    for (const f of textFields) {
      const val = form[f].value.trim();
      if (hasHtmlTags(val)) {
        showToast(`El campo ${f} no puede contener '<' o '>'.`, 'error');
        return;
      }
      payload[f] = val || null;
    }

    payload.birthDate = form.birthDate.value || null;
    payload.hireDate = form.hireDate.value || null;
    payload.reportsTo = form.reportsTo.value ? Number(form.reportsTo.value) : null;

    const btnSave = document.getElementById('btn-save-employee');
    btnSave.disabled = true;

    try {
      if (id) {
        await apiFetch(`/api/empleados/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Empleado actualizado correctamente.', 'success');
      } else {
        const username = form.username.value.trim();
        const password = form.password.value;
        if (hasHtmlTags(username) || hasHtmlTags(password)) {
          showToast("Las credenciales no pueden contener '<' o '>'.", 'error');
          btnSave.disabled = false;
          return;
        }
        payload.username = username;
        payload.password = password;
        payload.role = form.role.value;

        await apiFetch('/api/empleados', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Empleado y cuenta creados correctamente.', 'success');
      }

      form.classList.add('hidden');
      form.reset();
      await loadEmployees(0);
    } catch (err) {
      showToast(err.message || 'Error al guardar empleado.', 'error');
    } finally {
      btnSave.disabled = false;
    }
  });

  await loadEmployees(0);
}

/**
 * Vista 2: Gestión y Desbloqueo de Usuarios (#/usuarios) - Exclusiva Admin
 */
export async function renderUsersView(container, currentUser, showToast) {
  container.replaceChildren();

  const wrapper = document.createElement('section');
  wrapper.className = 'card';
  wrapper.innerHTML = `
    <div class="section-header">
      <h2>Administración y Desbloqueo de Usuarios</h2>
      <button type="button" id="btn-new-user">+ Nuevo Usuario</button>
    </div>

    <form id="user-form" class="crud-form hidden">
      <h3 id="user-form-title">Nuevo Usuario</h3>
      <input type="hidden" name="userId" />
      <div class="form-grid">
        <label>Usuario (3-50 caracteres) *
          <input type="text" name="username" required maxlength="50" pattern="^[a-zA-Z0-9_.-]{3,50}$" />
        </label>
        <label id="wrap-user-password">Contraseña (mín. 12 caracteres) *
          <input type="password" name="password" minlength="12" maxlength="128" />
        </label>
        <label>Rol *
          <select name="role" required>
            <option value="Cliente">Cliente</option>
            <option value="Empleado">Empleado</option>
            <option value="Admin">Admin</option>
          </select>
        </label>
      </div>
      <label class="checkbox-inline" id="wrap-user-active">
        <input type="checkbox" name="isActive" checked /> Cuenta activa
      </label>
      <div class="form-actions">
        <button type="submit" id="btn-save-user">Guardar Usuario</button>
        <button type="button" id="btn-cancel-user" class="btn-secondary">Cancelar</button>
      </div>
    </form>

    <p class="hint" id="users-status"></p>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Vínculo</th>
            <th>Estado</th>
            <th>Bloqueo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="users-tbody"></tbody>
      </table>
    </div>
  `;

  container.appendChild(wrapper);

  const form = document.getElementById('user-form');
  const formTitle = document.getElementById('user-form-title');
  const wrapPassword = document.getElementById('wrap-user-password');
  const wrapActive = document.getElementById('wrap-user-active');
  const tbody = document.getElementById('users-tbody');
  const statusEl = document.getElementById('users-status');

  function openCreateForm() {
    form.reset();
    form.userId.value = '';
    formTitle.textContent = 'Nuevo Usuario';
    wrapPassword.classList.remove('hidden');
    form.password.required = true;
    wrapActive.classList.add('hidden');
    form.classList.remove('hidden');
  }

  function openEditForm(u) {
    form.userId.value = u.id;
    form.username.value = u.username;
    form.role.value = u.role;
    form.isActive.checked = Boolean(u.isActive);
    formTitle.textContent = `Editar Usuario #${u.id}`;
    wrapPassword.classList.add('hidden');
    form.password.required = false;
    wrapActive.classList.remove('hidden');
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function handleUnlock(u) {
    try {
      await apiFetch(`/api/usuarios/${u.id}/desbloquear`, { method: 'PUT' });
      showToast(`Usuario "${u.username}" desbloqueado correctamente.`, 'success');
      await loadUsers();
    } catch (err) {
      showToast(err.message || 'No se pudo desbloquear el usuario.', 'error');
    }
  }

  async function handleResetPassword(u) {
    const newPassword = prompt(`Nueva contraseña para "${u.username}" (mínimo 12 caracteres):`);
    if (!newPassword) return;
    if (newPassword.length < 12) {
      showToast('La nueva contraseña debe tener al menos 12 caracteres.', 'error');
      return;
    }
    try {
      await apiFetch(`/api/usuarios/${u.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword })
      });
      showToast(`Contraseña de "${u.username}" restablecida.`, 'success');
    } catch (err) {
      showToast(err.message || 'No se pudo restablecer la contraseña.', 'error');
    }
  }

  async function handleDeactivateUser(u) {
    if (!confirm(`¿Desactivar la cuenta de usuario "${u.username}"?`)) return;
    try {
      await apiFetch(`/api/usuarios/${u.id}`, { method: 'DELETE' });
      showToast(`Usuario "${u.username}" desactivado.`, 'success');
      await loadUsers();
    } catch (err) {
      showToast(err.message || 'No se pudo desactivar el usuario.', 'error');
    }
  }

  async function loadUsers() {
    statusEl.textContent = 'Cargando usuarios...';
    tbody.replaceChildren();

    try {
      const users = await apiFetch('/api/usuarios?limit=100&offset=0');
      statusEl.textContent = `Total de cuentas registradas: ${users.length}.`;

      users.forEach((u) => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = u.id;

        const tdUser = document.createElement('td');
        tdUser.textContent = u.username;

        const tdRole = document.createElement('td');
        tdRole.textContent = u.role;

        const tdLink = document.createElement('td');
        if (u.customerId) tdLink.textContent = `Cliente (${u.customerId})`;
        else if (u.employeeId) tdLink.textContent = `Empleado (#${u.employeeId})`;
        else tdLink.textContent = 'Sin vínculo';

        const tdActive = document.createElement('td');
        tdActive.textContent = u.isActive ? 'Activo' : 'Inactivo';
        tdActive.className = u.isActive ? 'stock-ok' : 'stock-out';

        const tdLock = document.createElement('td');
        if (u.isLockedOut || u.failedLoginAttempts > 0) {
          tdLock.textContent = u.isLockedOut
            ? `Bloqueado (${u.failedLoginAttempts} fallos)`
            : `${u.failedLoginAttempts} intentos fallidos`;
          tdLock.className = 'stock-out';
        } else {
          tdLock.textContent = 'Normal';
          tdLock.className = 'stock-ok';
        }

        const tdActions = document.createElement('td');
        tdActions.className = 'table-actions';

        if (u.isLockedOut || u.failedLoginAttempts > 0) {
          const btnUnlock = document.createElement('button');
          btnUnlock.type = 'button';
          btnUnlock.className = 'btn-small';
          btnUnlock.textContent = 'Desbloquear';
          btnUnlock.addEventListener('click', () => handleUnlock(u));
          tdActions.appendChild(btnUnlock);
        }

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn-small btn-secondary';
        btnEdit.textContent = 'Editar';
        btnEdit.addEventListener('click', () => openEditForm(u));
        tdActions.appendChild(btnEdit);

        const btnPwd = document.createElement('button');
        btnPwd.type = 'button';
        btnPwd.className = 'btn-small btn-secondary';
        btnPwd.textContent = 'Clave';
        btnPwd.addEventListener('click', () => handleResetPassword(u));
        tdActions.appendChild(btnPwd);

        if (u.isActive && currentUser?.id !== u.id) {
          const btnDeact = document.createElement('button');
          btnDeact.type = 'button';
          btnDeact.className = 'btn-small btn-danger';
          btnDeact.textContent = 'Baja';
          btnDeact.addEventListener('click', () => handleDeactivateUser(u));
          tdActions.appendChild(btnDeact);
        }

        tr.append(tdId, tdUser, tdRole, tdLink, tdActive, tdLock, tdActions);
        tbody.appendChild(tr);
      });
    } catch (err) {
      statusEl.textContent = '';
      showToast(err.message || 'Error al cargar los usuarios.', 'error');
    }
  }

  document.getElementById('btn-new-user').addEventListener('click', openCreateForm);
  document.getElementById('btn-cancel-user').addEventListener('click', () => {
    form.classList.add('hidden');
    form.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.userId.value;
    const username = form.username.value.trim();
    const role = form.role.value;

    if (hasHtmlTags(username)) {
      showToast("El nombre de usuario no puede contener '<' o '>'.", 'error');
      return;
    }

    const btnSave = document.getElementById('btn-save-user');
    btnSave.disabled = true;

    try {
      if (id) {
        await apiFetch(`/api/usuarios/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            username,
            role,
            isActive: form.isActive.checked
          })
        });
        showToast('Usuario actualizado correctamente.', 'success');
      } else {
        const password = form.password.value;
        await apiFetch('/api/usuarios', {
          method: 'POST',
          body: JSON.stringify({ username, password, role })
        });
        showToast('Usuario creado correctamente.', 'success');
      }

      form.classList.add('hidden');
      form.reset();
      await loadUsers();
    } catch (err) {
      showToast(err.message || 'Error al guardar el usuario.', 'error');
    } finally {
      btnSave.disabled = false;
    }
  });

  await loadUsers();
}