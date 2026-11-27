import { apiFetch } from './api.js';

function hasHtmlTags(value) {
  return typeof value === 'string' && /[<>]/.test(value);
}

/**
 * Vista 1: Mi Perfil del Cliente (#/perfil)
 * Consulta GET /api/clientes/{customerId} y actualiza mediante PUT /api/clientes/{customerId}
 */
export async function renderCustomerProfileView(container, user, showToast) {
  container.replaceChildren();

  const wrapper = document.createElement('section');
  wrapper.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Mi Perfil de Cliente';
  wrapper.appendChild(h2);

  const customerId = user?.customerId;
  if (!customerId) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Esta cuenta no tiene un perfil de cliente vinculado.';
    wrapper.appendChild(p);
    container.appendChild(wrapper);
    return;
  }

  const statusP = document.createElement('p');
  statusP.className = 'hint';
  statusP.textContent = 'Cargando datos del perfil...';
  wrapper.appendChild(statusP);
  container.appendChild(wrapper);

  try {
    const profile = await apiFetch(`/api/clientes/${encodeURIComponent(customerId)}`);
    statusP.remove();

    const form = document.createElement('form');
    form.id = 'profile-form';
    form.innerHTML = `
      <div class="form-grid">
        <label>ID Cliente
          <input type="text" value="${profile.customerId}" disabled />
        </label>
        <label>Empresa (solo lectura)
          <input type="text" id="prof-company" disabled />
        </label>
        <label>Nombre de Contacto (máx. 30)
          <input type="text" name="contactName" maxlength="30" />
        </label>
        <label>Cargo / Título (máx. 30)
          <input type="text" name="contactTitle" maxlength="30" />
        </label>
        <label>Dirección (máx. 60)
          <input type="text" name="address" maxlength="60" />
        </label>
        <label>Ciudad (máx. 15)
          <input type="text" name="city" maxlength="15" />
        </label>
        <label>Región / Estado (máx. 15)
          <input type="text" name="region" maxlength="15" />
        </label>
        <label>Código Postal (máx. 10)
          <input type="text" name="postalCode" maxlength="10" />
        </label>
        <label>País (máx. 15)
          <input type="text" name="country" maxlength="15" />
        </label>
        <label>Teléfono (máx. 24)
          <input type="text" name="phone" maxlength="24" />
        </label>
        <label>Fax (máx. 24)
          <input type="text" name="fax" maxlength="24" />
        </label>
      </div>
      <div class="form-actions" style="margin-top: 1rem;">
        <button type="submit" id="btn-save-profile">Guardar Cambios</button>
      </div>
    `;

    wrapper.appendChild(form);

    document.getElementById('prof-company').value = profile.companyName || '';
    form.contactName.value = profile.contactName || '';
    form.contactTitle.value = profile.contactTitle || '';
    form.address.value = profile.address || '';
    form.city.value = profile.city || '';
    form.region.value = profile.region || '';
    form.postalCode.value = profile.postalCode || '';
    form.country.value = profile.country || '';
    form.phone.value = profile.phone || '';
    form.fax.value = profile.fax || '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = {};

      for (const [key, rawVal] of formData.entries()) {
        const val = rawVal.toString().trim();
        if (hasHtmlTags(val)) {
          showToast(`El campo ${key} no puede contener '<' o '>'.`, 'error');
          return;
        }
        payload[key] = val || null;
      }

      const btnSave = document.getElementById('btn-save-profile');
      btnSave.disabled = true;
      btnSave.textContent = 'Guardando...';

      try {
        await apiFetch(`/api/clientes/${encodeURIComponent(customerId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Perfil actualizado correctamente.', 'success');
      } catch (err) {
        showToast(err.message || 'No se pudo actualizar el perfil.', 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Cambios';
      }
    });
  } catch (err) {
    statusP.textContent = '';
    showToast(err.message || 'No se pudo cargar tu perfil.', 'error');
  }
}

/**
 * Vista 2: Gestión de Clientes para Empleado / Admin (#/clientes)
 */
export async function renderCustomersManageView(container, role, showToast) {
  container.replaceChildren();

  const isAdmin = role === 'Admin';

  const wrapper = document.createElement('section');
  wrapper.className = 'card';
  wrapper.innerHTML = `
    <div class="section-header">
      <h2>Gestión de Clientes</h2>
      <button type="button" id="btn-new-customer">+ Nuevo Cliente</button>
    </div>

    <form id="customer-form" class="crud-form hidden">
      <h3 id="customer-form-title">Nuevo Cliente</h3>
      <input type="hidden" name="isEdit" value="false" />
      <div class="form-grid">
        <label id="wrap-customer-id">ID Cliente (5 caracteres, opcional)
          <input type="text" name="customerId" maxlength="5" minlength="5" placeholder="Autogenerado si se omite" />
        </label>
        <label>Empresa (máx. 40) *
          <input type="text" name="companyName" required maxlength="40" />
        </label>
        <label>Contacto (máx. 30)
          <input type="text" name="contactName" maxlength="30" />
        </label>
        <label>Cargo / Título (máx. 30)
          <input type="text" name="contactTitle" maxlength="30" />
        </label>
        <label>Dirección (máx. 60)
          <input type="text" name="address" maxlength="60" />
        </label>
        <label>Ciudad (máx. 15)
          <input type="text" name="city" maxlength="15" />
        </label>
        <label>Región / Estado (máx. 15)
          <input type="text" name="region" maxlength="15" />
        </label>
        <label>Código Postal (máx. 10)
          <input type="text" name="postalCode" maxlength="10" />
        </label>
        <label>País (máx. 15)
          <input type="text" name="country" maxlength="15" />
        </label>
        <label>Teléfono (máx. 24)
          <input type="text" name="phone" maxlength="24" />
        </label>
        <label>Fax (máx. 24)
          <input type="text" name="fax" maxlength="24" />
        </label>
      </div>
      <div class="form-actions" style="margin-top: 1rem;">
        <button type="submit" id="btn-save-customer">Guardar Cliente</button>
        <button type="button" id="btn-cancel-customer" class="btn-secondary">Cancelar</button>
      </div>
    </form>

    <form id="customers-search-form" class="toolbar-form">
      <input type="search" id="customers-search-input" placeholder="Buscar por empresa, contacto o ciudad..." maxlength="40" />
      <label class="checkbox-inline" style="margin: 0;">
        <input type="checkbox" id="customers-include-inactive" /> Incluir inactivos
      </label>
      <button type="submit">Buscar</button>
      <button type="button" id="btn-clear-customers" class="btn-secondary">Limpiar</button>
    </form>

    <p class="hint" id="customers-status"></p>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Empresa</th>
            <th>Contacto</th>
            <th>Ciudad</th>
            <th>País</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="customers-tbody"></tbody>
      </table>
    </div>

    <div class="pagination-bar" id="customers-pagination"></div>
  `;

  container.appendChild(wrapper);

  const form = document.getElementById('customer-form');
  const formTitle = document.getElementById('customer-form-title');
  const tbody = document.getElementById('customers-tbody');
  const statusEl = document.getElementById('customers-status');
  const paginationEl = document.getElementById('customers-pagination');

  let currentOffset = 0;
  const pageSize = 15;

  function openCreateForm() {
    form.reset();
    form.isEdit.value = 'false';
    form.customerId.disabled = false;
    form.companyName.disabled = false;
    formTitle.textContent = 'Nuevo Cliente';
    form.classList.remove('hidden');
  }

  async function openEditForm(customerId) {
    try {
      const detail = await apiFetch(`/api/clientes/${encodeURIComponent(customerId)}`);
      form.isEdit.value = 'true';
      form.customerId.value = detail.customerId;
      form.customerId.disabled = true;
      form.companyName.value = detail.companyName || '';
      form.companyName.disabled = true; // UpdateCustomerRequest no modifica CompanyName
      form.contactName.value = detail.contactName || '';
      form.contactTitle.value = detail.contactTitle || '';
      form.address.value = detail.address || '';
      form.city.value = detail.city || '';
      form.region.value = detail.region || '';
      form.postalCode.value = detail.postalCode || '';
      form.country.value = detail.country || '';
      form.phone.value = detail.phone || '';
      form.fax.value = detail.fax || '';
      formTitle.textContent = `Editar Cliente (${detail.customerId})`;
      form.classList.remove('hidden');
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showToast(err.message || 'No se pudo cargar el cliente.', 'error');
    }
  }

  async function handleDeactivate(c) {
    if (!confirm(`¿Dar de baja lógica al cliente "${c.companyName}" (${c.customerId})? También desactivará su cuenta de usuario vinculada.`)) {
      return;
    }
    try {
      await apiFetch(`/api/clientes/${encodeURIComponent(c.customerId)}`, { method: 'DELETE' });
      showToast('Cliente desactivado correctamente.', 'success');
      await loadCustomers(currentOffset);
    } catch (err) {
      showToast(err.message || 'No se pudo desactivar el cliente.', 'error');
    }
  }

  async function handleReactivate(c) {
    try {
      await apiFetch(`/api/clientes/${encodeURIComponent(c.customerId)}/reactivar`, { method: 'PUT' });
      showToast('Cliente reactivado correctamente.', 'success');
      await loadCustomers(currentOffset);
    } catch (err) {
      showToast(err.message || 'No se pudo reactivar el cliente.', 'error');
    }
  }

  async function loadCustomers(offset = 0) {
    currentOffset = offset;
    statusEl.textContent = 'Cargando clientes...';
    tbody.replaceChildren();
    paginationEl.replaceChildren();

    try {
      const searchVal = document.getElementById('customers-search-input').value.trim();
      const includeInactive = document.getElementById('customers-include-inactive').checked;

      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(currentOffset),
        includeInactive: String(includeInactive)
      });
      if (searchVal) params.set('search', searchVal);

      const data = await apiFetch(`/api/clientes?${params.toString()}`);

      if (!data.items || data.items.length === 0) {
        statusEl.textContent = 'No se encontraron clientes con estos criterios.';
        return;
      }

      const currentPage = Math.floor(data.offset / data.limit) + 1;
      const totalPages = Math.max(1, Math.ceil(data.totalCount / data.limit));
      statusEl.textContent = `Mostrando ${data.items.length} de ${data.totalCount} clientes.`;

      data.items.forEach((c) => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = c.customerId;

        const tdComp = document.createElement('td');
        tdComp.textContent = c.companyName;

        const tdCont = document.createElement('td');
        tdCont.textContent = c.contactName || '-';

        const tdCity = document.createElement('td');
        tdCity.textContent = c.city || '-';

        const tdCountry = document.createElement('td');
        tdCountry.textContent = c.country || '-';

        const tdStatus = document.createElement('td');
        tdStatus.textContent = c.isActive ? 'Activo' : 'Inactivo';
        tdStatus.className = c.isActive ? 'stock-ok' : 'stock-out';

        const tdActions = document.createElement('td');
        tdActions.className = 'table-actions';

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn-small';
        btnEdit.textContent = 'Editar';
        btnEdit.addEventListener('click', () => openEditForm(c.customerId));
        tdActions.appendChild(btnEdit);

        if (c.isActive) {
          const btnDeact = document.createElement('button');
          btnDeact.type = 'button';
          btnDeact.className = 'btn-small btn-danger';
          btnDeact.textContent = 'Desactivar';
          btnDeact.addEventListener('click', () => handleDeactivate(c));
          tdActions.appendChild(btnDeact);
        } else if (isAdmin) {
          const btnReact = document.createElement('button');
          btnReact.type = 'button';
          btnReact.className = 'btn-small';
          btnReact.textContent = 'Reactivar';
          btnReact.addEventListener('click', () => handleReactivate(c));
          tdActions.appendChild(btnReact);
        }

        tr.append(tdId, tdComp, tdCont, tdCity, tdCountry, tdStatus, tdActions);
        tbody.appendChild(tr);
      });

      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.textContent = '← Anterior';
      btnPrev.disabled = currentOffset <= 0;
      btnPrev.addEventListener('click', () => loadCustomers(Math.max(0, currentOffset - pageSize)));

      const pageSpan = document.createElement('span');
      pageSpan.textContent = `Página ${currentPage} de ${totalPages}`;

      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.textContent = 'Siguiente →';
      btnNext.disabled = currentOffset + data.items.length >= data.totalCount;
      btnNext.addEventListener('click', () => loadCustomers(currentOffset + pageSize));

      paginationEl.append(btnPrev, pageSpan, btnNext);
    } catch (err) {
      statusEl.textContent = '';
      showToast(err.message || 'Error al cargar la lista de clientes.', 'error');
    }
  }

  document.getElementById('btn-new-customer').addEventListener('click', openCreateForm);
  document.getElementById('btn-cancel-customer').addEventListener('click', () => {
    form.classList.add('hidden');
    form.reset();
  });

  document.getElementById('customers-search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('customers-search-input').value.trim();
    if (hasHtmlTags(q)) {
      showToast("La búsqueda no puede contener '<' o '>'.", 'error');
      return;
    }
    loadCustomers(0);
  });

  document.getElementById('btn-clear-customers').addEventListener('click', () => {
    document.getElementById('customers-search-input').value = '';
    document.getElementById('customers-include-inactive').checked = false;
    loadCustomers(0);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = form.isEdit.value === 'true';

    const fields = ['contactName', 'contactTitle', 'address', 'city', 'region', 'postalCode', 'country', 'phone', 'fax'];
    const payload = {};

    for (const f of fields) {
      const val = form[f].value.trim();
      if (hasHtmlTags(val)) {
        showToast(`El campo ${f} no puede contener '<' o '>'.`, 'error');
        return;
      }
      payload[f] = val || null;
    }

    const btnSave = document.getElementById('btn-save-customer');
    btnSave.disabled = true;

    try {
      if (isEdit) {
        const id = form.customerId.value;
        await apiFetch(`/api/clientes/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Cliente actualizado correctamente.', 'success');
      } else {
        const companyName = form.companyName.value.trim();
        const customId = form.customerId.value.trim().toUpperCase();
        if (hasHtmlTags(companyName) || hasHtmlTags(customId)) {
          showToast("Los campos no pueden contener '<' o '>'.", 'error');
          btnSave.disabled = false;
          return;
        }
        payload.companyName = companyName;
        payload.customerId = customId || null;

        await apiFetch('/api/clientes', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Cliente creado correctamente.', 'success');
      }

      form.classList.add('hidden');
      form.reset();
      await loadCustomers(0);
    } catch (err) {
      showToast(err.message || 'Error al guardar el cliente.', 'error');
    } finally {
      btnSave.disabled = false;
    }
  });

  await loadCustomers(0);
}