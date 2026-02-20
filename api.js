const CONFIG = {
    MODO: 'LOCAL', // Cambia a 'REMOTO' si te dan una IP/Link
    baseUrl: 'http://localhost:3000/api'
};

const ApiService = {
    getMenu: async () => {
        if (CONFIG.MODO === 'LOCAL') {
            return new Promise(resolve => {
                setTimeout(() => resolve(DB_RESTAURANTE.productos), 300);
            });
        }

        // Modo REMOTO
        try {
            const response = await fetch(`${CONFIG.baseUrl}/productos`);
            if (!response.ok) throw new Error('Error al cargar menú');
            return await response.json();
        } catch (error) {
            console.warn("⚠️ API Falló (Modo Remoto). Usando respaldo local.");
            return DB_RESTAURANTE.productos;
        }
    },

    enviarPedido: async (pedido) => {
        const guardarLocal = () => {
            // Guardar en Array Local
            DB_RESTAURANTE.pedidos.push(pedido);
            // "Socket" casero con LocalStorage
            const pedidoConMeta = { ...pedido, timestamp: Date.now() };
            localStorage.setItem('ultimo_pedido', JSON.stringify(pedidoConMeta));
            return { message: "¡Pedido enviado a cocina (Local)!" };
        };

        if (CONFIG.MODO === 'LOCAL') {
            return new Promise(resolve => {
                setTimeout(() => resolve(guardarLocal()), 200);
            });
        }

        // Modo REMOTO
        try {
            const response = await fetch(`${CONFIG.baseUrl}/pedidos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pedido)
            });
            if (!response.ok) throw new Error('Error servidor');

            // Éxito: También notificamos localmente para la demo realtime
            const pedidoConMeta = { ...pedido, timestamp: Date.now() };
            localStorage.setItem('ultimo_pedido', JSON.stringify(pedidoConMeta));

            return await response.json();
        } catch (error) {
            console.warn("⚠️ Servidor no responde. Activando Protocolo de Contingencia.");
            return guardarLocal();
        }
    }
};
