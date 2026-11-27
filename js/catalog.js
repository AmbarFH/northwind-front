import { apiFetch } from './api.js';

function formatCurrency(value) {
  if (value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function hasHtmlTags(value) {
  return typeof value === 'string' && /[<>]/.test(value);
}

/**
 * Vista 1: Catálogo paginado y buscador (#/catalogo)
 */
export async function renderCatalogView(container, role, showToast) {
  container.replaceChildren();

  const wrapper = document.createElement('section');
  wrapper.className = 'card';

  const header = document.createElement('div');
  header.className = 'section-header';

  const title = document.createElement('h2');
  title.textContent = 'Catálogo de Productos';
  header.appendChild(title);

  if (role === 'Empleado' || role === 'Admin') {
    const manageLink = document.createElement('a');
    manageLink.href = '#/catalogo/gestion';
    manageLink.className = 'btn-primary-link';
    manageLink.textContent = 'Administrar Catálogo';
    header.appendChild(manageLink);
  }

  wrapper.appendChild(header);

  if (role === 'Visitante') {
    const notice = document.createElement('div');
    notice.className = 'info-banner';
    notice.innerHTML = `
      <p>Inicia sesión con tu cuenta de cliente o empleado para consultar los precios, existencias y productos disponibles.</p>
      <div class="banner-actions">
        <a href="#/login" class="btn-primary-link">Iniciar sesión</a>
        <a href="#/registro" class="btn-secondary-link">Crear cuenta</a>
      </div>
    `;
    wrapper.appendChild(notice);
    container.appendChild(wrapper);
    return;
  }

  const searchBar = document.createElement('form');
  searchBar.className = 'toolbar-form';
  searchBar.innerHTML = `
    <input type="search" id="catalog-search" placeholder="Buscar por nombre o presentación..." maxlength="40" />
    <button type="submit">Buscar</button>
    <button type="button" id="catalog-clear" class="btn-secondary">Limpiar</button>
  `;
  wrapper.appendChild(searchBar);

  const statusText = document.createElement('p');
  statusText.className = 'hint';
  wrapper.appendChild(statusText);

  const grid = document.createElement('div');
  grid.className = 'products-grid';
  wrapper.appendChild(grid);

  const pagination = document.createElement('div');
  pagination.className = 'pagination-bar';
  wrapper.appendChild(pagination);

  container.appendChild(wrapper);

  let currentPage = 1;
  const pageSize = 12;
  let currentSearch = '';

  async function loadPage(page = 1) {
    currentPage = page;
    statusText.textContent = 'Cargando productos...';
    grid.replaceChildren();
    pagination.replaceChildren();

    try {
      const params = new URLSearchParams({
        p: String(currentPage),
        pageSize: String(pageSize)
      });
      if (currentSearch) params.set('search', currentSearch);

      const data = await apiFetch(`/api/productos/paginados?${params.toString()}`);

      if (!data.items || data.items.length === 0) {
        statusText.textContent = 'No se encontraron productos que coincidan con tu búsqueda.';
        return;
      }

      statusText.textContent = `Mostrando ${data.items.length} de ${data.totalCount} productos (Página ${data.page}).`;

      data.items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'product-card';

        const badge = document.createElement('span');
        badge.className = 'badge-category';
        badge.textContent = item.categoryName || 'Sin categoría';

        const name = document.createElement('h3');
        name.textContent = item.productName;

        const qty = document.createElement('p');
        qty.className = 'product-meta';
        qty.textContent = item.quantityPerUnit || 'Presentación estándar';

        const footer = document.createElement('div');
        footer.className = 'product-footer';

        const price = document.createElement('strong');
        price.className = 'product-price';
        price.textContent = formatCurrency(item.unitPrice);

        const stock = document.createElement('span');
        const units = item.unitsInStock ?? 0;
        stock.className = units > 0 ? 'stock-ok' : 'stock-out';
        stock.textContent = units > 0 ? `Disponibles: ${units}` : 'Agotado';

        footer.append(price, stock);
        card.append(badge, name, qty, footer);
        grid.appendChild(card);
      });

      const btnPrev = document.createElement('button');
      btnPrev.type = 'button';
      btnPrev.textContent = '← Anterior';
      btnPrev.disabled = data.page <= 1;
      btnPrev.addEventListener('click', () => loadPage(data.page - 1));

      const pageLabel = document.createElement('span');
      const totalPages = Math.max(1, Math.ceil(data.totalCount / data.pageSize));
      pageLabel.textContent = `Página ${data.page} de ${totalPages}`;

      const btnNext = document.createElement('button');
      btnNext.type = 'button';
      btnNext.textContent = 'Siguiente →';
      btnNext.disabled = !data.hasMore;
      btnNext.addEventListener('click', () => loadPage(data.page + 1));

      pagination.append(btnPrev, pageLabel, btnNext);
    } catch (err) {
      statusText.textContent = '';
      showToast(err.message || 'Error al cargar el catálogo.', 'error');
    }
  }

  const searchInput = document.getElementById('catalog-search');
  searchBar.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = searchInput.value.trim();
    if (hasHtmlTags(val)) {
      showToast("La búsqueda no puede contener '<' o '>'.", 'error');
      return;
    }
    currentSearch = val;
    loadPage(1);
  });

  document.getElementById('catalog-clear').addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    loadPage(1);
  });

  await loadPage(1);
}

/**
 * Vista 2: Gestión CRUD de Productos para Empleado / Admin (#/catalogo/gestion)
 */
export async function renderCatalogManageView(container, showToast) {
  container.replaceChildren();

  const wrapper = document.createElement('section');
  wrapper.className = 'card';
  wrapper.innerHTML = `
    <div class="section-header">
      <h2>Gestión de Catálogo</h2>
      <button type="button" id="btn-new-product">+ Nuevo Producto</button>
    </div>

    <form id="product-form" class="crud-form hidden">
      <h3 id="product-form-title">Nuevo Producto</h3>
      <input type="hidden" name="productId" />
      <div class="form-grid">
        <label>Nombre del Producto (máx. 40) *
          <input type="text" name="productName" required maxlength="40" />
        </label>
        <label>Categoría
          <select name="categoryId" id="select-category">
            <option value="">-- Sin categoría --</option>
          </select>
        </label>
        <label>Proveedor
          <select name="supplierId" id="select-supplier">
            <option value="">-- Sin proveedor --</option>
          </select>
        </label>
        <label>Cantidad por unidad (máx. 20)
          <input type="text" name="quantityPerUnit" maxlength="20" placeholder="Ej. 10 cajas x 20 bolsas" />
        </label>
        <label>Precio Unitario
          <input type="number" name="unitPrice" step="0.01" min="0" max="999999999" />
        </label>
        <label>Unidades en Stock
          <input type="number" name="unitsInStock" min="0" max="32767" value="0" />
        </label>
        <label>Unidades en Orden
          <input type="number" name="unitsOnOrder" min="0" max="32767" value="0" />
        </label>
        <label>Nivel de Reorden
          <input type="number" name="reorderLevel" min="0" max="32767" value="0" />
        </label>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" name="discontinued" /> Producto descontinuado (baja lógica)
      </label>
      <div class="form-actions">
        <button type="submit" id="btn-save-product">Guardar Producto</button>
        <button type="button" id="btn-cancel-product" class="btn-secondary">Cancelar</button>
      </div>
    </form>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Presentación</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="manage-products-body"></tbody>
      </table>
    </div>
  `;

  container.appendChild(wrapper);

  const form = document.getElementById('product-form');
  const formTitle = document.getElementById('product-form-title');
  const tbody = document.getElementById('manage-products-body');
  const selectCategory = document.getElementById('select-category');
  const selectSupplier = document.getElementById('select-supplier');

  async function loadCatalogReferences() {
    try {
      const [categories, suppliers] = await Promise.all([
        apiFetch('/api/categorias?limit=100&offset=0'),
        apiFetch('/api/proveedores?limit=100&offset=0')
      ]);

      categories.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.categoryId;
        opt.textContent = c.categoryName;
        selectCategory.appendChild(opt);
      });

      suppliers.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.supplierId;
        opt.textContent = s.companyName;
        selectSupplier.appendChild(opt);
      });
    } catch (err) {
      showToast('No se pudieron cargar categorías o proveedores.', 'error');
    }
  }

  async function loadProductsTable() {
    tbody.replaceChildren();
    try {
      const products = await apiFetch('/api/productos?limit=100&offset=0');
      products.forEach((p) => {
        const tr = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = p.productId;

        const tdName = document.createElement('td');
        tdName.textContent = p.productName;

        const tdQty = document.createElement('td');
        tdQty.textContent = p.quantityPerUnit || '-';

        const tdPrice = document.createElement('td');
        tdPrice.textContent = formatCurrency(p.unitPrice);

        const tdStock = document.createElement('td');
        tdStock.textContent = p.unitsInStock ?? 0;

        const tdStatus = document.createElement('td');
        tdStatus.textContent = p.discontinued ? 'Descontinuado' : 'Activo';
        tdStatus.className = p.discontinued ? 'stock-out' : 'stock-ok';

        const tdActions = document.createElement('td');
        tdActions.className = 'table-actions';

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'btn-small';
        btnEdit.textContent = 'Editar';
        btnEdit.addEventListener('click', () => openEditForm(p));

        tdActions.appendChild(btnEdit);

        if (!p.discontinued) {
          const btnDel = document.createElement('button');
          btnDel.type = 'button';
          btnDel.className = 'btn-small btn-danger';
          btnDel.textContent = 'Descontinuar';
          btnDel.addEventListener('click', () => handleDiscontinue(p));
          tdActions.appendChild(btnDel);
        }

        tr.append(tdId, tdName, tdQty, tdPrice, tdStock, tdStatus, tdActions);
        tbody.appendChild(tr);
      });
    } catch (err) {
      showToast(err.message || 'Error al listar productos.', 'error');
    }
  }

  function openCreateForm() {
    form.reset();
    form.productId.value = '';
    formTitle.textContent = 'Nuevo Producto';
    form.classList.remove('hidden');
  }

  function openEditForm(p) {
    form.productId.value = p.productId;
    form.productName.value = p.productName || '';
    form.categoryId.value = p.categoryId ?? '';
    form.supplierId.value = p.supplierId ?? '';
    form.quantityPerUnit.value = p.quantityPerUnit || '';
    form.unitPrice.value = p.unitPrice ?? '';
    form.unitsInStock.value = p.unitsInStock ?? 0;
    form.unitsOnOrder.value = p.unitsOnOrder ?? 0;
    form.reorderLevel.value = p.reorderLevel ?? 0;
    form.discontinued.checked = Boolean(p.discontinued);
    formTitle.textContent = `Editar Producto #${p.productId}`;
    form.classList.remove('hidden');
  }

  async function handleDiscontinue(product) {
    if (!confirm(`¿Marcar "${product.productName}" como descontinuado?`)) return;
    try {
      await apiFetch(`/api/productos/${product.productId}`, { method: 'DELETE' });
      showToast('Producto descontinuado correctamente.', 'success');
      await loadProductsTable();
    } catch (err) {
      showToast(err.message || 'No se pudo descontinuar el producto.', 'error');
    }
  }

  document.getElementById('btn-new-product').addEventListener('click', openCreateForm);
  document.getElementById('btn-cancel-product').addEventListener('click', () => {
    form.classList.add('hidden');
    form.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const productName = form.productName.value.trim();
    const quantityPerUnit = form.quantityPerUnit.value.trim();

    if (hasHtmlTags(productName) || hasHtmlTags(quantityPerUnit)) {
      showToast("Los campos de texto no pueden contener '<' o '>'.", 'error');
      return;
    }

    const payload = {
      productName,
      categoryId: form.categoryId.value ? Number(form.categoryId.value) : null,
      supplierId: form.supplierId.value ? Number(form.supplierId.value) : null,
      quantityPerUnit: quantityPerUnit || null,
      unitPrice: form.unitPrice.value !== '' ? Number(form.unitPrice.value) : null,
      unitsInStock: form.unitsInStock.value !== '' ? Number(form.unitsInStock.value) : null,
      unitsOnOrder: form.unitsOnOrder.value !== '' ? Number(form.unitsOnOrder.value) : null,
      reorderLevel: form.reorderLevel.value !== '' ? Number(form.reorderLevel.value) : null,
      discontinued: form.discontinued.checked
    };

    const btnSave = document.getElementById('btn-save-product');
    btnSave.disabled = true;

    try {
      const id = form.productId.value;
      if (id) {
        await apiFetch(`/api/productos/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Producto actualizado correctamente.', 'success');
      } else {
        await apiFetch('/api/productos', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Producto creado correctamente.', 'success');
      }
      form.classList.add('hidden');
      form.reset();
      await loadProductsTable();
    } catch (err) {
      showToast(err.message || 'Error al guardar el producto.', 'error');
    } finally {
      btnSave.disabled = false;
    }
  });

  await Promise.all([loadCatalogReferences(), loadProductsTable()]);
}