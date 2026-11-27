# Northwind Ventas — Frontend SPA

Aplicación web Single Page Application (SPA) desarrollada con HTML5, CSS3 y JavaScript modular (ES Modules) para consumir la API REST de **Northwind Ventas** (ASP.NET Core + MySQL).

## Módulos y Control de Acceso por Rol
- **Catálogo (`#/catalogo`):** Público (`Visitante`, `Cliente`, `Empleado`, `Admin`). Búsqueda, paginación y vista completa de productos activos/descontinuados según rol.
- **Gestión de Catálogo (`#/catalogo/gestion`):** `Empleado` y `Admin`. Alta, edición y descontinuado de productos y categorías.
- **Ventas / Órdenes (`#/ventas`):** `Cliente`, `Empleado` y `Admin`. Creación de pedidos, consulta de detalles y gestión de órdenes.
- **Clientes (`#/clientes`) y Mi Perfil (`#/perfil`):** Administración de clientes (`Empleado` / `Admin`) y actualización de datos propios (`Cliente`).
- **Gestión de Empleados (`#/empleados`):** Exclusivo `Admin`. Alta con cuenta vinculada, edición y baja lógica.
- **Administración de Usuarios (`#/usuarios`):** Exclusivo `Admin`. Creación de cuentas, cambio de roles, restablecimiento de contraseñas y desbloqueo por intentos fallidos.

## Ejecución Local
1. Inicia la API backend en ASP.NET Core (`https://localhost:7214` o el puerto configurado en `js/api.js`).
2. Abre esta carpeta en Visual Studio Code y ejecuta **Live Server** sobre `index.html` en `http://127.0.0.1:5500`.