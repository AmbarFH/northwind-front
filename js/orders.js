import { apiFetch } from './api.js';

function formatCurrency(value) {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function formatDate(isoDate) {
  if (!isoDate) return '-';
  return new Date(isoDate).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
}

function hasHtmlTags(value) {
  return typeof value === 'string' && /[<>]/.test(value);
}

export async function renderOrdersView(container, role, showToast) {
  container.replaceChildren();

  const isStaff = role === 'Empleado' || role === 'Admin';

  const wrapper = document.createElement('section');
  wrapper.className = 'card';
  wrapper.innerHTML = `
    <div class="section-header">
      <h2>Ventas y Órdenes</h2>
      <button type="button" id="btn-toggle-new-order">+ Nueva Orden</button>
    </div>

    <form id="new-order-form" class="crud-form hidden">
      <h3>Registrar Nueva Orden</h3>
      <div class="form-grid">
        ${isStaff ? `
          <label>Cliente *
            <select name="customerId" id="order-customer" required>
              <option value="">-- Selecciona un cliente --</option>
            </select>
          </label>
        ` : ''}
        <label>Paquetería (ShipVia)
          <select name="shipVia" id="order-shipper">
            <option value="">-- Sin paquetería --</option>
          </select>
        </label>
        <label>Dirección de envío (máx. 60)
          <input type="text" name="shipAddress" maxlength="60" placeholder="Calle y número" />
        </label>
        <label>Ciudad de envío (máx. 15)
          <input type="text" name="shipCity" maxlength="15" />
        </label>
        <label>País de envío (máx. 15)
          <input type="text" name="shipCountry" maxlength="15" />
        </label>
      </div>

      <div class="order-items-box">
        <div class="section-header">
          <h4>Productos de la orden</h4>
          <button type="button" id="btn-add-order-item" class="btn-small btn-secondary">+ Agregar producto</button>
        </div>
        <div id="order-items-list"></div>
        <p class="order-estimated-total" id="order-estimated-total">Subtotal estimado: $0.00</p>
      </div>

      <div class="form-actions">
        <button type="submit" id="btn-submit-order">Confirmar Orden</button>
        <button type="button" id="btn-cancel-order" class="btn-secondary">Cancelar</button>
      </div>
    </form>

    <form id="orders-filter-form" class="toolbar-form">
      ${isStaff ? `<input type="text" id="filter-customer-id" placeholder="ID Cliente (ej. ALFKI)" maxlength="5" />` : ''}
      <label class="inline-date">Desde: <input type="date" id="filter-from" /></label>
      <label class="inline-date">Hasta: <input type="date" id="filter-to" /></label>
      <button type="submit">Filtrar</button>
      <button type="button" id="btn-clear-orders-filter" class="btn-secondary">Limpiar</button>
    </form>

    <p class="hint" id="orders-status"></p>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Orden #</th>
            ${isStaff ? '<th>Cliente</th>' : ''}
            <th>Fecha</th>
            <th>Subtotal</th>
            <th>Envío</th>
            <th>Total</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody id="orders-tbody"></tbody>
      </table>
    </div>

    <div class="pagination-bar" id="orders-pagination"></div>

    <div id="order-detail-panel" class="crud-form hidden" style="margin-top: 1.5rem;"></div>
  `;

  container.appendChild(wrapper);

  const newOrderForm = document.getElementById('new-order-form');
  const itemsList = document.getElementById('order-items-list');
  const estimatedTotalEl = document.getElementById('order-estimated-total');
  const ordersTbody = document.getElementById('orders-tbody');
  const ordersStatus = document.getElementById('orders-status');
  const ordersPagination = document.getElementById('orders-pagination');
  const detailPanel = document.getElementById('order-detail-panel');

  let availableProducts = [];
  let currentOffset = 0;
  const pageSize = 15;

  function recalculateTotal() {
    let sum = 0;
    itemsList.querySelectorAll('.order-item-row').forEach((row) => {
      const select = row.querySelector('select');
      const qtyInput = row.querySelector('input[type="number"]');
      const prodId = Number(select.value);
      const qty = Number(qtyInput.value) || 0;
      const prod = availableProducts.find((p) => p.productId === prodId);
      if (prod && prod.unitPrice) {
        sum += Number(prod.unitPrice) * qty;
      }
    });
    estimatedTotalEl.textContent = `Subtotal estimado: ${formatCurrency(sum)}`;
  }

  function addOrderItemRow() {
    const row = document.createElement('div');
    row.className = 'order-item-row';

    const select = document.createElement('select');
    select.required = true;
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Selecciona producto --';
    select.appendChild(defaultOpt);

    availableProducts.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.productId;
      opt.textContent = `${p.productName} (${formatCurrency(p.unitPrice)} | Stock: ${p.unitsInStock ?? 0})`;
      select.appendChild(opt);
    });

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.max = '32767';
    qtyInput.value = '1';
    qtyInput.required = true;
    qtyInput.placeholder = 'Cant.';

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-small btn-danger';
    btnRemove.textContent = 'Quitar';
    btnRemove.addEventListener('click', () => {
      if (itemsList.children.length > 1) {
        row.remove();
        recalculateTotal();
      } else {
        showToast('La orden debe tener al menos un producto.', 'error');
      }
    });

    select.addEventListener('change', recalculateTotal);
    qtyInput.addEventListener('input', recalculateTotal);

    row.append(select, qtyInput, btnRemove);
    itemsList.appendChild(row);
  }

  async function loadFormCatalogs() {
    try {
      const requests = [
        apiFetch('/api/productos?limit=100&offset=0'),
        apiFetch('/api/shippers')
      ];
      if (isStaff) {
        requests.push(apiFetch('/api/clientes?limit=100&offset=0'));
      }

      const [products, shippers, customers] = await Promise.all(requests);

      availableProducts = products.filter((p) => !p.discontinued && (p.unitsInStock ?? 0) > 0);

      const shipperSelect = document.getElementById('order-shipper');
      shipperSelect.replaceChildren();
      const emptyShipOpt = document.createElement('option');
      emptyShipOpt.value = '';
      emptyShipOpt.textContent = '-- Sin paquetería --';
      shipperSelect.appendChild(emptyShipOpt);

      shippers.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.shipperId;
        opt.textContent = s.companyName;
        shipperSelect.appendChild(opt);
      });

      const customerItems = customers?.items || customers;
      if (isStaff && Array.isArray(customerItems)) {
        const custSelect = document.getElementById('order-customer');
        custSelect.replaceChildren();
        const emptyCustOpt = document.createElement('option');
        emptyCustOpt.value = '';
        emptyCustOpt.textContent = '-- Selecciona un cliente --';
        custSelect.appendChild(emptyCustOpt);

        customerItems.forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c.customerId;
          opt.textContent = `${c.customerId} - ${c.companyName}`;
          custSelect.appendChild(opt);
        });
      }

      itemsList.replaceChildren();
      addOrderItemRow();
    } catch (err) {
      showToast('No se pudieron cargar los catálogos para crear órdenes.', 'error');
    }
  }

  async function showOrderDetail(orderId) {
    try {
      const detail = await apiFetch(`/api/ventas/${orderId}`);
      detailPanel.replaceChildren();

      const header = document.createElement('div');
      header.className = 'section-header';
      const h3 = document.createElement('h3');
      h3.textContent = `Detalle de Orden #${detail.summary.orderId}`;
      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'btn-small btn-secondary';
      btnClose.textContent = 'Cerrar detalle';
      btnClose.addEventListener('click', () => detailPanel.classList.add('hidden'));
      header.append(h3, btnClose);

      const shippingInfo = document.createElement('p');
      shippingInfo.className = 'hint';
      shippingInfo.textContent = `Envío: ${detail.shipAddress || 'Sin dirección'}, ${detail.shipCity || '-'}, ${detail.shipCountry || '-'}`;

      const table = document.createElement('table');
      table.className = 'data-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio Unit.</th>
            <th>Cantidad</th>
            <th>Descuento</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector('tbody');

      detail.details.forEach((item) => {
        const tr = document.createElement('tr');
        const tdProd = document.createElement('td');
        tdProd.textContent = item.productName;
        const tdPrice = document.createElement('td');
        tdPrice.textContent = formatCurrency(item.unitPrice);
        const tdQty = document.createElement('td');
        tdQty.textContent = item.quantity;
        const tdDisc = document.createElement('td');
        tdDisc.textContent = `${Math.round((item.discount || 0) * 100)}%`;
        const tdSub = document.createElement('td');
        tdSub.textContent = formatCurrency(item.subtotal);
        tr.append(tdProd, tdPrice, tdQty, tdDisc, tdSub);
        tbody.appendChild(tr);
      });

      const totals = document.createElement('p');
      totals.style.marginTop = '0.75rem';
      totals.style.fontWeight = '600';
      totals.textContent = `Subtotal: ${formatCurrency(detail.summary.subtotal)} | Envío: ${formatCurrency(detail.summary.freight)} | Total: ${formatCurrency(detail.summary.total)}`;

      detailPanel.append(header, shippingInfo, table, totals);
      detailPanel.classList.remove('hidden');
      detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showToast(err.message || 'No se pudo cargar el detalle de la orden.', 'error');
    }
  }

  async function loadOrders(offset = 0) {
    currentOffset = offset;
    ordersStatus.textContent = 'Cargando órdenes...';
    ordersTbody.replaceChildren();
    ordersPagination.replaceChildren();

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(currentOffset)
      });

      const fromVal = document.getElementById('filter-from').value;
      const toVal = document.getElementById('filter-to').value;
      if (fromVal) params.set('from', fromVal);
      if (toVal) params.set('to', toVal);

      if (isStaff) {
        const custVal = document.getElementById('filter-customer-id').value.trim().toUpperCase();
        if (custVal) params.set('customerId', custVal);
      }

      const data = await apiFetch(`/api/ventas?${params.toString()}`);

      if (!data.items || data.items.length === 0) {
        ordersStatus.textContent = 'No se encontraron órdenes registradas con estos criterios.';
        return;
      }

      const currentPage = Math.floor(data.offset / data.limit) + 1;
      const totalPages = Math.max(1, Math.ceil(data.totalCount / data.limit));
      ordersStatus.textContent = `Mostrando ${data.items.length} de ${data.totalCount} órdenes.`;

      data.items.forEach((ord) => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = `#${ord.orderId}`;
        tr.appendChild(tdId);

        if (isStaff) {
          const tdCust = document.createElement('td');
          tdCust.textContent = ord.customerId || '-';
          tr.appendChild(tdCust);
        }

        const tdDate = document.createElement('td');
        tdDate.textContent = formatDate(ord.orderDate);

        const tdSub = document.createElement('td');
        tdSub.textContent = formatCurrency(ord.subtotal);

        const tdFreight = document.createElement('td');
        tdFreight.textContent = formatCurrency(ord.freight);

        const tdTotal = document.createElement('td');
        tdTotal.style.fontWeight = '600';
        tdTotal.textContent = formatCurrency(ord.total);

        const tdAction = document.createElement('td');
        const btnDetail = document.createElement('button');
        btnDetail.type = 'button';
        btnDetail.className = 'btn-small';
        btnDetail.textContent = 'Ver detalle';
        btnDetail.addEventListener('click', () => showOrderDetail(ord.orderId));
        tdAction.appendChild(btnDetail);

        tr.append(tdDate, tdSub, tdFreight, tdTotal, tdAction);
        ordersTbody.appendChild(tr);
      });

      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.textContent = '← Anterior';
      btnPrev.disabled = currentOffset <= 0;
      btnPrev.addEventListener('click', () => loadOrders(Math.max(0, currentOffset - pageSize)));

      const pageSpan = document.createElement('span');
      pageSpan.textContent = `Página ${currentPage} de ${totalPages}`;

      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.textContent = 'Siguiente →';
      btnNext.disabled = currentOffset + data.items.length >= data.totalCount;
      btnNext.addEventListener('click', () => loadOrders(currentOffset + pageSize));

      ordersPagination.append(btnPrev, pageSpan, btnNext);
    } catch (err) {
      ordersStatus.textContent = '';
      showToast(err.message || 'Error al cargar las órdenes.', 'error');
    }
  }

  document.getElementById('btn-toggle-new-order').addEventListener('click', () => {
    newOrderForm.classList.toggle('hidden');
  });

  document.getElementById('btn-cancel-order').addEventListener('click', () => {
    newOrderForm.classList.add('hidden');
  });

  document.getElementById('btn-add-order-item').addEventListener('click', addOrderItemRow);

  document.getElementById('orders-filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadOrders(0);
  });

  document.getElementById('btn-clear-orders-filter').addEventListener('click', () => {
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    if (isStaff) document.getElementById('filter-customer-id').value = '';
    loadOrders(0);
  });

  newOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(newOrderForm);
    const shipAddress = (formData.get('shipAddress') || '').toString().trim();
    const shipCity = (formData.get('shipCity') || '').toString().trim();
    const shipCountry = (formData.get('shipCountry') || '').toString().trim();

    if (hasHtmlTags(shipAddress) || hasHtmlTags(shipCity) || hasHtmlTags(shipCountry)) {
      showToast("Los campos de envío no pueden contener '<' o '>'.", 'error');
      return;
    }

    const itemsMap = new Map();
    itemsList.querySelectorAll('.order-item-row').forEach((row) => {
      const prodId = Number(row.querySelector('select').value);
      const qty = Number(row.querySelector('input[type="number"]').value);
      if (prodId > 0 && qty > 0) {
        itemsMap.set(prodId, (itemsMap.get(prodId) || 0) + qty);
      }
    });

    if (itemsMap.size === 0) {
      showToast('Selecciona al menos un producto válido con cantidad mayor a 0.', 'error');
      return;
    }

    const payload = {
      customerId: isStaff ? (formData.get('customerId') || '').toString().trim() || null : null,
      shipVia: formData.get('shipVia') ? Number(formData.get('shipVia')) : null,
      shipAddress: shipAddress || null,
      shipCity: shipCity || null,
      shipCountry: shipCountry || null,
      items: Array.from(itemsMap.entries()).map(([productId, quantity]) => ({
        productId,
        quantity
      }))
    };

    const btnSubmit = document.getElementById('btn-submit-order');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando...';

    try {
      const created = await apiFetch('/api/ventas', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`Orden #${created.summary.orderId} registrada correctamente.`, 'success');
      newOrderForm.reset();
      itemsList.replaceChildren();
      addOrderItemRow();
      recalculateTotal();
      newOrderForm.classList.add('hidden');
      await Promise.all([loadOrders(0), loadFormCatalogs()]);
    } catch (err) {
      showToast(err.message || 'No se pudo registrar la orden.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Confirmar Orden';
    }
  });

  await Promise.all([loadFormCatalogs(), loadOrders(0)]);
}