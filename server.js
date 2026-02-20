const http = require('http');
const fs = require('fs');
const path = require('path');

// CONFIGURACIÓN
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'pedidos.json'); // Archivo plano como BD

// --- DATABASE "FILE SYSTEM" (Persistencia Real sin Dependencias) ---
const initDB = () => {
    if (!fs.existsSync(DB_PATH)) {
        const initialData = [];
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
        console.log("📂 Base de datos 'pedidos.json' creada.");
    }
};
initDB();

// --- MOCK PRODUCTOS (Estáticos) ---
const PRODUCTOS = [
    { id: 1, nombre: "Hamburguesa Clásica", precio: 5.50, icono: "🍔" },
    { id: 2, nombre: "Papas Fritas", precio: 2.00, icono: "🍟" },
    { id: 3, nombre: "Coca-Cola", precio: 1.50, icono: "🥤" },
    { id: 4, nombre: "Tacos al Pastor", precio: 4.00, icono: "🌮" },
    { id: 5, nombre: "Pizza Margarita", precio: 8.00, icono: "🍕" },
    { id: 6, nombre: "Helado de Chocolate", precio: 2.50, icono: "🍦" }
];

// --- SERVER ---
const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // GET /api/productos
    if (req.url === '/api/productos' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(PRODUCTOS));
    }

    // POST /api/pedidos
    else if (req.url === '/api/pedidos' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const pedido = JSON.parse(body);
                pedido.id = Date.now();

                // PERSISTENCIA EN ARCHIVO (Esquema de Guerrilla)
                // Leemos con validación anti-corrupción
                let pedidos = [];
                if (fs.existsSync(DB_PATH)) {
                    try {
                        const data = fs.readFileSync(DB_PATH);
                        // FIXED: Asegurar que siempre leemos un Array, no un Objeto con propiedad .pedidos
                        const jsonData = JSON.parse(data || "[]");
                        pedidos = Array.isArray(jsonData) ? jsonData : [];
                    } catch (e) {
                        console.error("⚠️ Error leyendo BD, iniciando limpia:", e.message);
                        pedidos = [];
                    }
                }

                pedidos.push(pedido);

                // FIXED: Guardamos SIEMPRE como array plano para evitar errores de lectura cruzada
                fs.writeFileSync(DB_PATH, JSON.stringify(pedidos, null, 2));

                console.log('💾 Pedido persistido en DISCO:', pedido.mesa);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "Guardado en Filesystem", id: pedido.id }));
            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not Found" }));
    }
});

// Manejo de error de puerto ocupado (Robustez)
server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`⚠️ Puerto ${PORT} ocupado. Intenta cambiar 'const PORT = 3001' en el código.`);
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Server "Guerrilla" corriendo en http://localhost:${PORT}`);
    console.log(`📂 Persistencia Segura en: ${DB_PATH}`);
});
