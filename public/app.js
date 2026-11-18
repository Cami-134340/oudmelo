let usuario = JSON.parse(localStorage.getItem('usuario')) || null;
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let catalogoGlobal = []; // Guarda los perfumes cargados para abrir el modal rápido

// Variables globales para el carrusel
let indiceCarrusel = 0;
let intervaloCarrusel = null;
let perfumesCarrusel = [];

// --- GESTIÓN DE TEMA (CLARO / OSCURO) ---
function inicializarTema() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
    }

    const btnToggle = document.getElementById('btn-toggle-theme');
    if (btnToggle) {
        btnToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }
}

// --- ALERTAS RÁPIDAS Y SOBRIAS ---
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: false,
    showClass: { popup: '' },
    hideClass: { popup: '' },
    background: '#152134',
    color: '#F3F4F4'
});

function mostrarAlerta(titulo, texto, icono = 'info') {
    const isDark = document.documentElement.classList.contains('dark');
    return Swal.fire({
        title: titulo,
        text: texto,
        icon: icono,
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#152134',
        background: isDark ? '#1b2a42' : '#ffffff',
        color: isDark ? '#F3F4F4' : '#152134',
        showClass: { popup: '' },
        hideClass: { popup: '' },
        customClass: {
            popup: 'rounded-xl shadow-lg border border-slate-700 text-sm',
            confirmButton: 'px-5 py-2 rounded-lg font-bold text-xs uppercase'
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarTema();
    actualizarNavbar();
    actualizarBadgeCarrito();

    // 1. Homepage
    if (document.getElementById('catalogo')) {
        cargarCatalogo();
        
        // Cerrar modal de producto al hacer clic fuera del cuadro o presionar Escape
        const modal = document.getElementById('modal-producto');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cerrarModalProducto();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrarModalProducto();
            });
        }
    }

    // 2. Carrito
    if (document.getElementById('lista-carrito')) {
        renderizarCarritoPagina();
        document.getElementById('btn-finalizar-compra').addEventListener('click', procesarCompra);
    }

    // 3. Login y Registro
    if (document.getElementById('form-login')) document.getElementById('form-login').addEventListener('submit', iniciarSesion);
    if (document.getElementById('form-registro')) document.getElementById('form-registro').addEventListener('submit', registrarUsuario);

    // 4. Panel Admin Comerciante
    if (document.getElementById('form-nuevo-perfume')) {
        if (!usuario || usuario.rol !== 'comerciante') {
            mostrarAlerta('Acceso denegado', 'Sección exclusiva para comerciantes.', 'error')
                .then(() => window.location.href = 'login.html');
            return;
        }
        document.getElementById('form-nuevo-perfume').addEventListener('submit', guardarPerfume);
        cargarInventarioAdmin();
    }

    // Logout global
    document.querySelectorAll('#btn-logout').forEach(btn => {
        btn.addEventListener('click', () => {
            const isDark = document.documentElement.classList.contains('dark');
            Swal.fire({
                title: '¿Cerrar sesión?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#e11d48',
                cancelButtonColor: '#5A5D62',
                confirmButtonText: 'Sí',
                cancelButtonText: 'No',
                showClass: { popup: '' },
                hideClass: { popup: '' },
                background: isDark ? '#1b2a42' : '#ffffff',
                color: isDark ? '#F3F4F4' : '#152134',
                customClass: { popup: 'rounded-xl text-sm' }
            }).then((result) => {
                if (result.isConfirmed) {
                    localStorage.removeItem('usuario');
                    window.location.href = 'index.html';
                }
            });
        });
    });
});

function actualizarNavbar() {
    const authLinks = document.getElementById('auth-links');
    const userMenu = document.getElementById('user-menu');
    const userNombre = document.getElementById('user-nombre');
    const linkAdmin = document.getElementById('link-admin');

    if (usuario) {
        if (authLinks) authLinks.style.display = 'none';
        if (userMenu) {
            userMenu.classList.remove('hidden');
            userMenu.classList.add('flex');
        }
        if (userNombre) userNombre.textContent = usuario.nombre;
        if (usuario.rol === 'comerciante' && linkAdmin) {
            linkAdmin.classList.remove('hidden');
        }
    }
}

function actualizarBadgeCarrito() {
    const badge = document.getElementById('badge-carrito');
    if (badge) {
        const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
        badge.textContent = totalItems;
    }
}

// --- CATÁLOGO Y VISTA AMPLIADA (MODAL) ---

async function cargarCatalogo() {
    try {
        const res = await fetch('/api/perfumes');
        catalogoGlobal = await res.json();
        const contenedor = document.getElementById('catalogo');
        
        if (catalogoGlobal.length > 0 && document.getElementById('carrusel-container')) {
            perfumesCarrusel = catalogoGlobal.slice(0, 5);
            inicializarCarrusel();
        }

        contenedor.innerHTML = catalogoGlobal.map(p => `
            <div onclick="abrirModalProducto(${p.id})" 
                class="bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-md hover:border-slate-400 dark:hover:border-slate-500 transition duration-300 cursor-pointer group">
                
                <div class="relative overflow-hidden h-52 bg-slate-100 dark:bg-slate-950">
                    <img src="${p.imagen_url}" alt="${p.nombre}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                    <span class="absolute top-3 right-3 bg-[#152134]/75 text-[#F3F4F4] backdrop-blur-md text-[10px] px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition">
                        <i class="fa-solid fa-expand mr-1"></i> Ver detalle
                    </span>
                </div>

                <div class="p-5 flex flex-col flex-grow">
                    <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#5A5D62] dark:text-slate-400 mb-1">${p.marca}</span>
                    <h3 class="font-bold text-base mb-1">${p.nombre}</h3>
                    <p class="text-[#5A5D62] dark:text-slate-500 text-xs mb-4 line-clamp-2">${p.descripcion || 'Sin descripción disponible.'}</p>
                    
                    <div class="mt-auto flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span class="text-lg font-black">$${parseFloat(p.precio).toFixed(2)}</span>
                        <span class="text-[11px] text-[#5A5D62]">Stock: ${p.stock}</span>
                    </div>

                    <!-- event.stopPropagation() evita que al pulsar el botón se abra el modal -->
                    <button onclick="event.stopPropagation(); agregarAlCarrito(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio})" 
                        class="mt-4 w-full bg-[#152134] text-[#F3F4F4] dark:bg-[#F3F4F4] dark:text-[#152134] py-2.5 rounded-xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2 text-xs shadow-sm uppercase tracking-wider">
                        <i class="fa-solid fa-cart-plus"></i> Añadir
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error cargando catálogo", error);
    }
}

function abrirModalProducto(id) {
    const producto = catalogoGlobal.find(p => p.id === id);
    if (!producto) return;

    document.getElementById('modal-img').src = producto.imagen_url;
    document.getElementById('modal-img').alt = producto.nombre;
    document.getElementById('modal-marca').textContent = producto.marca;
    document.getElementById('modal-nombre').textContent = producto.nombre;
    document.getElementById('modal-desc').textContent = producto.descripcion || 'Fragancia exclusiva de nuestra colección.';
    document.getElementById('modal-precio').textContent = `$${parseFloat(producto.precio).toFixed(2)}`;
    document.getElementById('modal-stock').textContent = `Disponibles: ${producto.stock}`;

    const btnAgregar = document.getElementById('modal-btn-agregar');
    btnAgregar.onclick = () => {
        agregarAlCarrito(producto.id, producto.nombre, producto.precio);
        cerrarModalProducto();
    };

    const modal = document.getElementById('modal-producto');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarModalProducto() {
    const modal = document.getElementById('modal-producto');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// --- CARRUSEL ---
function inicializarCarrusel() {
    const container = document.getElementById('carrusel-container');
    const slidesDiv = document.getElementById('carrusel-slides');
    const indicadoresDiv = document.getElementById('carrusel-indicadores');

    container.classList.remove('hidden');

    slidesDiv.innerHTML = perfumesCarrusel.map((p, index) => `
        <div onclick="siguienteSlide()" title="Click para ver siguiente fragancia"
            class="carrusel-slide absolute inset-0 w-full h-full transition-opacity duration-700 cursor-pointer ${index === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}">
            <img src="${p.imagen_url}" alt="${p.nombre}" class="w-full h-full object-cover object-center bg-slate-950">
            <div class="absolute inset-0 bg-gradient-to-t from-[#152134]/95 via-[#152134]/30 to-transparent"></div>
            <div class="absolute bottom-5 left-5 sm:bottom-8 sm:left-8 max-w-md bg-[#152134]/65 backdrop-blur-md border border-slate-400/25 px-6 py-4 rounded-2xl shadow-lg">
                <span class="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.25em] text-slate-300 block mb-1">${p.marca}</span>
                <h3 class="text-xl sm:text-3xl font-black text-[#F3F4F4] tracking-wide leading-tight">${p.nombre}</h3>
            </div>
        </div>
    `).join('');

    indicadoresDiv.innerHTML = perfumesCarrusel.map((_, index) => `
        <button onclick="irASlide(${index})" 
            class="carrusel-dot h-2 rounded-full transition-all duration-300 ${index === 0 ? 'w-6 bg-[#F3F4F4]' : 'w-2 bg-[#F3F4F4]/40 hover:bg-[#F3F4F4]/75'}">
        </button>
    `).join('');

    document.getElementById('btn-prev').addEventListener('click', (e) => { e.stopPropagation(); anteriorSlide(); });
    document.getElementById('btn-next').addEventListener('click', (e) => { e.stopPropagation(); siguienteSlide(); });
    reiniciarAutoplay();
}

function mostrarSlide(nuevoIndice) {
    const slides = document.querySelectorAll('.carrusel-slide');
    const dots = document.querySelectorAll('.carrusel-dot');
    if (!slides.length) return;

    indiceCarrusel = (nuevoIndice + perfumesCarrusel.length) % perfumesCarrusel.length;

    slides.forEach((slide, i) => {
        slide.classList.toggle('opacity-100', i === indiceCarrusel);
        slide.classList.toggle('z-10', i === indiceCarrusel);
        slide.classList.toggle('opacity-0', i !== indiceCarrusel);
        slide.classList.toggle('z-0', i !== indiceCarrusel);
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle('w-6', i === indiceCarrusel);
        dot.classList.toggle('bg-[#F3F4F4]', i === indiceCarrusel);
        dot.classList.toggle('w-2', i !== indiceCarrusel);
        dot.classList.toggle('bg-[#F3F4F4]/40', i !== indiceCarrusel);
    });

    reiniciarAutoplay();
}

function siguienteSlide() { mostrarSlide(indiceCarrusel + 1); }
function anteriorSlide() { mostrarSlide(indiceCarrusel - 1); }
function irASlide(index) { mostrarSlide(index); }
function reiniciarAutoplay() {
    clearInterval(intervaloCarrusel);
    intervaloCarrusel = setInterval(siguienteSlide, 4500);
}

// --- CARRITO ---
function agregarAlCarrito(id, nombre, precio) {
    const existe = carrito.find(item => item.id === id);
    if (existe) existe.cantidad++;
    else carrito.push({ id, nombre, precio, cantidad: 1 });
    
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarBadgeCarrito();
    Toast.fire({ icon: 'success', title: 'Añadido al carrito' });
}

function renderizarCarritoPagina() {
    const lista = document.getElementById('lista-carrito');
    const totalSpan = document.getElementById('total-carrito');
    let total = 0;

    if (carrito.length === 0) {
        lista.innerHTML = `<p class="text-center text-[#5A5D62] py-8 text-sm"><i class="fa-solid fa-cart-shopping text-2xl mb-2 block"></i>Tu carrito está vacío.</p>`;
        totalSpan.textContent = '0.00';
        return;
    }

    lista.innerHTML = carrito.map(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        return `
            <div class="py-3 flex justify-between items-center text-sm">
                <div>
                    <h4 class="font-bold">${item.nombre}</h4>
                    <p class="text-xs text-[#5A5D62]">Cant: ${item.cantidad} x $${parseFloat(item.precio).toFixed(2)}</p>
                </div>
                <div class="flex items-center gap-4">
                    <span class="font-bold">$${subtotal.toFixed(2)}</span>
                    <button onclick="eliminarDelCarrito(${item.id})" class="text-rose-500 hover:text-rose-700 p-1"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }).join('');

    totalSpan.textContent = total.toFixed(2);
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(item => item.id !== id);
    localStorage.setItem('carrito', JSON.stringify(carrito));
    renderizarCarritoPagina();
    actualizarBadgeCarrito();
    Toast.fire({ icon: 'info', title: 'Eliminado' });
}

async function procesarCompra() {
    if (!usuario) {
        mostrarAlerta('Inicia sesión', 'Debes ingresar para comprar.', 'warning').then(() => window.location.href = 'login.html');
        return;
    }
    if (carrito.length === 0) return mostrarAlerta('Vacío', 'Agrega productos.', 'info');

    const total = parseFloat(document.getElementById('total-carrito').textContent);
    try {
        const res = await fetch('/api/comprar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuario.id, carrito, total })
        });
        const data = await res.json();
        if (res.ok) {
            await mostrarAlerta('Éxito', data.mensaje, 'success');
            carrito = [];
            localStorage.removeItem('carrito');
            window.location.href = 'index.html';
        } else {
            mostrarAlerta('Error', data.error, 'error');
        }
    } catch (error) {
        mostrarAlerta('Error', 'Falla de conexión.', 'error');
    }
}

// --- AUTENTICACIÓN ---
async function iniciarSesion(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('usuario', JSON.stringify(data));
            await Toast.fire({ icon: 'success', title: `Bienvenido, ${data.nombre}` });
            window.location.href = data.rol === 'comerciante' ? 'admin.html' : 'index.html';
        } else {
            mostrarAlerta('Error', data.error, 'error');
        }
    } catch (err) {
        mostrarAlerta('Error', 'No se pudo iniciar sesión.', 'error');
    }
}

async function registrarUsuario(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const rol = document.getElementById('reg-rol').value;

    try {
        const res = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, rol })
        });
        const data = await res.json();
        if (res.ok) {
            await mostrarAlerta('Registrado', data.mensaje, 'success');
            window.location.href = 'login.html';
        } else {
            mostrarAlerta('Error', data.error, 'error');
        }
    } catch (err) {
        mostrarAlerta('Error', 'Error al registrar.', 'error');
    }
}

// --- PANEL COMERCIANTE: CREAR, EDITAR Y ELIMINAR ---

let inventarioAdmin = [];

async function cargarInventarioAdmin() {
    const lista = document.getElementById('lista-admin-perfumes');
    try {
        const res = await fetch('/api/perfumes/todos');
        inventarioAdmin = await res.json();

        if (inventarioAdmin.length === 0) {
            lista.innerHTML = `<p class="text-center text-sm text-[#5A5D62] py-8">Aún no hay productos publicados.</p>`;
            return;
        }

        lista.innerHTML = inventarioAdmin.map(p => `
            <div class="py-4 flex items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <img src="${p.imagen_url}" alt="${p.nombre}" class="w-14 h-14 rounded-xl object-cover bg-slate-950 border border-slate-300 dark:border-slate-700">
                    <div>
                        <span class="text-[10px] font-bold uppercase tracking-wider text-[#5A5D62] dark:text-slate-400">${p.marca}</span>
                        <h4 class="font-bold text-sm leading-tight">${p.nombre}</h4>
                        <p class="text-xs text-[#5A5D62] mt-0.5">$${parseFloat(p.precio).toFixed(2)} • Stock: <strong class="${p.stock === 0 ? 'text-rose-500' : ''}">${p.stock}</strong></p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="prepararEdicion(${p.id})" title="Editar" class="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition text-xs">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onclick="eliminarPerfumeAdmin(${p.id}, '${p.nombre.replace(/'/g, "\\'")}')" title="Eliminar" class="p-2.5 rounded-xl bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white transition text-xs">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        lista.innerHTML = `<p class="text-rose-500 text-sm">Error al cargar productos.</p>`;
    }
}

function prepararEdicion(id) {
    const p = inventarioAdmin.find(item => item.id === id);
    if (!p) return;

    document.getElementById('perf-id').value = p.id;
    document.getElementById('perf-nombre').value = p.nombre;
    document.getElementById('perf-marca').value = p.marca;
    document.getElementById('perf-precio').value = p.precio;
    document.getElementById('perf-stock').value = p.stock;
    document.getElementById('perf-desc').value = p.descripcion || '';

    document.getElementById('titulo-form-admin').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editando Perfume`;
    document.getElementById('btn-submit-perfume').textContent = 'Guardar Cambios';
    document.getElementById('btn-cancelar-edicion').classList.remove('hidden');
    document.getElementById('nota-foto-opcional').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
    document.getElementById('form-nuevo-perfume').reset();
    document.getElementById('perf-id').value = '';
    document.getElementById('titulo-form-admin').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Añadir Perfume`;
    document.getElementById('btn-submit-perfume').textContent = 'Publicar Producto';
    document.getElementById('btn-cancelar-edicion').classList.add('hidden');
    document.getElementById('nota-foto-opcional').classList.add('hidden');
}

async function guardarPerfume(e) {
    e.preventDefault();
    const idEdicion = document.getElementById('perf-id').value;

    const formData = new FormData();
    formData.append('nombre', document.getElementById('perf-nombre').value);
    formData.append('marca', document.getElementById('perf-marca').value);
    formData.append('precio', document.getElementById('perf-precio').value);
    formData.append('stock', document.getElementById('perf-stock').value);
    formData.append('descripcion', document.getElementById('perf-desc').value);
    formData.append('rol', usuario.rol);

    const fileInput = document.getElementById('perf-img');
    if (fileInput.files.length > 0) formData.append('imagen', fileInput.files[0]);

    const url = idEdicion ? `/api/perfumes/${idEdicion}` : '/api/perfumes';
    const method = idEdicion ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, { method, body: formData });
        const data = await res.json();
        if (res.ok) {
            Toast.fire({ icon: 'success', title: data.mensaje });
            cancelarEdicion();
            cargarInventarioAdmin();
        } else {
            mostrarAlerta('Error', data.error, 'error');
        }
    } catch (err) {
        mostrarAlerta('Error', 'No se pudo guardar el producto.', 'error');
    }
}

function eliminarPerfumeAdmin(id, nombre) {
    const isDark = document.documentElement.classList.contains('dark');
    Swal.fire({
        title: `¿Eliminar "${nombre}"?`,
        text: 'Esta acción quitará el producto del catálogo permanentemente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e11d48',
        cancelButtonColor: '#5A5D62',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        showClass: { popup: '' },
        hideClass: { popup: '' },
        background: isDark ? '#1b2a42' : '#ffffff',
        color: isDark ? '#F3F4F4' : '#152134',
        customClass: { popup: 'rounded-xl text-sm' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/perfumes/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rol: usuario.rol })
                });
                const data = await res.json();
                if (res.ok) {
                    Toast.fire({ icon: 'success', title: data.mensaje });
                    if (document.getElementById('perf-id').value == id) cancelarEdicion();
                    cargarInventarioAdmin();
                } else {
                    mostrarAlerta('Error', data.error, 'error');
                }
            } catch (error) {
                mostrarAlerta('Error', 'No se pudo eliminar.', 'error');
            }
        }
    });
}