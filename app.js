// app.js

const app = {
    state: {
        rol: null,
        carrito: [],
        mesaActiva: null // Nueva propiedad para la mesa activa
    },

    ventasDia: 0, // Para cierre de caja

    init: () => {
        // Cargar carrito persistente si existe
        const carritoGuardado = localStorage.getItem('carrito_temp');
        if (carritoGuardado) {
            app.state.carrito = JSON.parse(carritoGuardado);
            app.actualizarContadorCarrito();
        }

        // Cargar Ventas del Día (Persistencia)
        const ventasGuardadas = localStorage.getItem('ventas_dia');
        if (ventasGuardadas) {
            app.ventasDia = parseFloat(ventasGuardadas);
        }

        // --- SISTEMA DE SINCRONIZACIÓN REALTIME (Mesas y Pedidos) ---
        window.addEventListener('storage', (event) => {
            // Sincronizar Pedidos (Cocina)
            if (event.key === 'ultimo_pedido' && event.newValue) {
                const pedido = JSON.parse(event.newValue);
                if (app.state.rol === 'cocina') {
                    app.renderizarPedidoEnCocina(pedido);
                }
            }

            // Sincronizar Estado de Mesas (Todos)
            if (event.key === 'estado_mesas' && event.newValue) {
                const mesasActualizadas = JSON.parse(event.newValue);
                // Actualizar DB local
                DB_RESTAURANTE.mesas = mesasActualizadas;
                // Si soy mesero y estoy viendo el grid, refrescar
                if (app.state.rol === 'mesero' && document.getElementById('tables-grid').style.display !== 'none') {
                    app.cargarMesas();
                }
            }
        });

        // Inicializar reloj si es cocina
        setInterval(() => {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            const clockEl = document.getElementById('clock');
            if (clockEl) clockEl.textContent = timeString;
        }, 1000);
    },

    seleccionarRol: (rol) => {
        app.state.rol = rol;
        document.getElementById('role-selector').style.display = 'none';

        if (rol === 'mesero') {
            document.getElementById('view-mesero').style.display = 'block';
            document.title = "📱 Mesero - GastroSync";
            app.cargarMesas(); // Ahora carga mesas primero
        } else {
            document.getElementById('view-cocina').style.display = 'block';
            document.title = "👨‍🍳 Cocina - GastroSync";
            app.iniciarEscuchaCocina();
        }
    },

    cerrarSesion: () => {
        location.reload();
    },

    // --- Funciones de Mesero (Gestión de Mesas) ---

    cargarMesas: () => {
        const grid = document.getElementById('tables-grid');
        grid.innerHTML = '';

        DB_RESTAURANTE.mesas.forEach(mesa => {
            const card = document.createElement('div');
            card.className = `table-card ${mesa.estado}`;
            card.onclick = () => app.seleccionarMesa(mesa);

            // Icono según estado
            let icono = "🟩"; // Libre
            if (mesa.estado === 'ocupada') icono = "🔴";
            if (mesa.estado === 'pagando') icono = "🟡";

            card.innerHTML = `
                <div class="table-icon">${icono}</div>
                <h3>${mesa.nombre}</h3>
                <div class="table-status">${mesa.estado}</div>
            `;
            grid.appendChild(card);
        });
    },

    seleccionarMesa: (mesa) => {
        app.state.mesaActiva = mesa;
        document.getElementById('mesa-activa-nombre').innerText = mesa.nombre;

        // Transición visual
        document.getElementById('tables-grid').style.display = 'none';
        document.getElementById('menu-section').style.display = 'block';

        app.cargarMenu();
    },

    volverMesas: () => {
        document.getElementById('menu-section').style.display = 'none';
        document.getElementById('tables-grid').style.display = 'grid';

        // Limpiar carrito al cambiar de mesa (o mantenerlo si es feature deseado, aqui lo limpiamos por logica de mesa)
        app.state.carrito = [];
        localStorage.removeItem('carrito_temp'); // Limpiar persistencia
        app.actualizarContadorCarrito();
    },

    // --- Utilidades de Impresión (Estrategia Staging Area) ---
    // Clona el ticket a un div limpio en el root del body e imprime.
    imprimirElemento: (el) => {
        const stagingArea = document.getElementById('print-area');

        // 1. Limpiar y Clonar
        stagingArea.innerHTML = '';
        stagingArea.appendChild(el.cloneNode(true)); // cloneNode(true) copia hijos

        // 2. Imprimir
        // No necesitamos timeouts raros porque el DOM es síncrono y el CSS maneja la visibilidad
        setTimeout(() => {
            window.print();
        }, 100);

        // 3. Limpiar después (Opcional, pero bueno para mantener el DOM limpio)
        // stagingArea.innerHTML = ''; // Comentado para evitar que se limpie antes de tiempo
    },

    // --- Funciones de Pedido ---

    cargarMenu: () => {
        const grid = document.getElementById('menu-grid');
        if (grid.children.length > 0) return;

        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Cargando...</div>';

        // Usamos ApiService externo
        ApiService.getMenu().then(productos => {
            grid.innerHTML = '';
            productos.forEach(prod => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <div class="product-icon">${prod.icono}</div>
                    <div class="product-info">
                        <h3>${prod.nombre}</h3>
                        <div class="product-price">$${prod.precio.toFixed(2)}</div>
                        <button class="add-btn" onclick="app.agregarCarrito(${prod.id}, this)">
                            + Agregar
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        });
    },

    agregarCarrito: (idProducto, btnElement) => {
        const producto = DB_RESTAURANTE.productos.find(p => p.id === idProducto);
        if (producto) {
            app.state.carrito.push(producto);
            app.actualizarContadorCarrito();

            // Persistencia (Evita pérdida de datos)
            localStorage.setItem('carrito_temp', JSON.stringify(app.state.carrito));

            // Feedback Visual "Neon" (UX Móvil)
            const btn = btnElement || event.target;
            const originalText = btn.innerText;

            btn.innerText = "¡Agregado!";
            btn.style.transition = "0.2s";
            btn.style.background = "#39ff14"; // Verde Neón
            btn.style.color = "#000"; // Contraste
            btn.style.boxShadow = "0 0 15px #39ff14"; // Glow
            btn.style.transform = "scale(1.05)";

            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = "";
                btn.style.color = "";
                btn.style.boxShadow = "";
                btn.style.transform = "scale(1)";
            }, 800);
        }
    },

    actualizarContadorCarrito: () => {
        document.getElementById('cart-count').innerText = app.state.carrito.length;
    },

    verCarrito: () => {
        if (app.state.carrito.length === 0) return alert("Carrito vacío");

        if (confirm(`¿Enviar pedido para ${app.state.mesaActiva.nombre}?`)) {
            const nuevoPedido = {
                id: Math.floor(Math.random() * 10000),
                mesa: app.state.mesaActiva.nombre,
                items: [...app.state.carrito],
                total: app.state.carrito.reduce((sum, item) => sum + item.precio, 0)
            };

            // Usamos ApiService externo
            ApiService.enviarPedido(nuevoPedido).then(res => {
                alert(res.message);

                // Actualizar Estado Local
                app.state.mesaActiva.estado = 'ocupada';

                // --- SINCRONIZACIÓN REALTIME DE MESAS ---
                // Guardamos el array completo de mesas en localStorage para que otros lo lean
                localStorage.setItem('estado_mesas', JSON.stringify(DB_RESTAURANTE.mesas));

                app.volverMesas();
                app.cargarMesas();
            }).catch(alert);
        }
    },

    // --- Funciones de Cocina ---

    iniciarEscuchaCocina: () => {
        console.log("Iniciando escucha de eventos de almacenamiento...");

        // Cargar pedidos pendientes (Persistencia ante recargas)
        const pendientes = JSON.parse(localStorage.getItem('pedidos_pendientes') || '[]');
        pendientes.forEach(p => app.renderizarPedidoEnCocina(p, false)); // false = no sumar ventas de nuevo

        window.addEventListener('storage', (event) => {
            console.log("Evento storage recibido:", event.key);
            if (event.key === 'ultimo_pedido' && event.newValue) {
                const pedido = JSON.parse(event.newValue);
                app.renderizarPedidoEnCocina(pedido, true);
            }
        });

        // TICKET DE PRIORIDAD
        setInterval(() => {
            document.querySelectorAll('.order-ticket').forEach(ticket => {
                const timestamp = parseInt(ticket.dataset.timestamp);
                const minutosPasados = (Date.now() - timestamp) / 60000;
                if (minutosPasados > 0.1) {
                    ticket.style.borderLeft = "5px solid #dc3545";
                    ticket.style.background = "#fff5f5";
                    ticket.querySelector('.status-badge').innerText = "URGENTE";
                    ticket.querySelector('.status-badge').style.background = "#dc3545";
                }
            });
        }, 5000);
    },

    renderizarPedidoEnCocina: (pedido, esNuevo = true) => {
        // Solo sumar a ventas si es nuevo (evita dobles conteos al recargar)
        if (esNuevo) {
            app.ventasDia += pedido.total;
            localStorage.setItem('ventas_dia', app.ventasDia.toFixed(2));

            // Persistir en lista de pendientes
            const pendientes = JSON.parse(localStorage.getItem('pedidos_pendientes') || '[]');
            pendientes.push(pedido);
            localStorage.setItem('pedidos_pendientes', JSON.stringify(pendientes));

            // Actualizar BI solo si es nuevo
            let conteo = JSON.parse(localStorage.getItem('conteo_platos') || '{}');
            pedido.items.forEach(item => {
                conteo[item.nombre] = (conteo[item.nombre] || 0) + 1;
            });
            localStorage.setItem('conteo_platos', JSON.stringify(conteo));
        }

        // BI Display Logic (Siempre actualizar visual)
        let conteo = JSON.parse(localStorage.getItem('conteo_platos') || '{}');
        const topPlato = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
        document.getElementById('top-plato').innerText = topPlato ? `${topPlato[0]} (${topPlato[1]})` : '-';

        const container = document.getElementById('kitchen-orders');
        if (container.querySelector('p')) container.innerHTML = '';

        const ticket = document.createElement('div');
        ticket.className = 'order-ticket';
        if (esNuevo) ticket.classList.add('flash-effect');
        ticket.dataset.timestamp = pedido.timestamp;
        ticket.dataset.id = pedido.id; // ID para eliminar

        const itemsList = pedido.items.map(item => `
            <li><span>${item.nombre}</span><span>$${item.precio.toFixed(2)}</span></li>
        `).join('');

        ticket.innerHTML = `
            <div class="order-header">
                <strong>${pedido.mesa}</strong>
                <span class="status-badge" style="background: var(--accent); color: white; padding: 2px 5px; border-radius: 4px; font-size: 0.7rem;">${esNuevo ? 'NUEVO' : 'PENDIENTE'}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem">
                Orden #${pedido.id} - ${new Date(pedido.timestamp).toLocaleTimeString()}
            </div>
            <ul class="order-items-list">${itemsList}</ul>
            <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--glass-border); text-align: right; font-weight: bold; color: var(--success)">
                Total: $${pedido.total.toFixed(2)}
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button onclick="app.imprimirElemento(this.closest('.order-ticket'))" style="flex: 1; padding: 0.5rem; background: var(--primary); border: none; border-radius: 0.5rem; cursor: pointer; color: #fff;">🖨️ Imprimir</button>
                <button onclick="app.completarPedido(${pedido.id}, this)" style="flex: 1; padding: 0.5rem; background: var(--text-muted); border: none; border-radius: 0.5rem; cursor: pointer; color: #fff;">✅ Completar</button>
            </div>
        `;

        container.insertBefore(ticket, container.firstChild);
        if (esNuevo) setTimeout(() => ticket.classList.remove('flash-effect'), 4000);
    },

    completarPedido: (id, btn) => {
        // Remover visualmente
        btn.closest('.order-ticket').remove();

        // Remover de persistencia
        let pendientes = JSON.parse(localStorage.getItem('pedidos_pendientes') || '[]');
        pendientes = pendientes.filter(p => p.id !== id);
        localStorage.setItem('pedidos_pendientes', JSON.stringify(pendientes));
    },

    cerrarCaja: () => {
        const total = app.ventasDia.toFixed(2);

        // Actualizar datos del modal
        document.getElementById('modal-total').innerText = total;

        // Mostrar modal con flex (para centrar)
        const modal = document.getElementById('modal-cierre');
        modal.style.display = 'flex';
    }
};

// Iniciar
app.init();
