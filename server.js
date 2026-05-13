require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '')));

let db;

// --- CONFIGURACIÓN DE LA BASE DE DATOS MYSQL ---
async function initDB() {
    try {
        // Conexión inicial sin base de datos para asegurarnos de que existe
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        await connection.end();

        // Conexión real a la base de datos del proyecto
        db = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log(`✅ Conectado exitosamente a la base de datos MySQL (${process.env.DB_NAME}).`);

        // 1. Crear Tabla de Usuarios
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL
            )
        `);

        // 2. Crear Tabla de Productos
        await db.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                price DOUBLE NOT NULL,
                category VARCHAR(100) NOT NULL,
                img VARCHAR(255) NOT NULL,
                stock INT DEFAULT 10,
                discount VARCHAR(50),
                oldPrice DOUBLE
            )
        `);

        // Insertar usuarios de prueba
        const [userCount] = await db.query("SELECT COUNT(*) AS count FROM users");
        if (userCount[0].count === 0) {
            await db.query("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", ["usuario@vidafit.com", "user123", "customer"]);
            await db.query("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", ["admin@vidafit.com", "admin123", "admin"]);
            console.log("👥 Usuarios de prueba creados.");
        }

        // Insertar productos de prueba
        const [productCount] = await db.query("SELECT COUNT(*) AS count FROM products");
        if (productCount[0].count === 0) {
            const products = [
                ["Balón de Fútbol Profesional Liga Elite", 89.99, "Balones", "IMG/balon-de-futbol-molten-.webp", 24, "-31% OFF", 129.99],
                ["Raqueta de Tenis Fibra de Carbono", 54.99, "Raquetas", "IMG/raqueta3.webp", 18, "-27% OFF", 74.99],
                ["Set de Pesas Mancuernas 10kg", 39.99, "Accesorios", "IMG/mancuernas de 10kg2.webp", 12, null, null],
                ["Guantes de Boxeo Entrenamiento Pro", 79.99, "Accesorios", "IMG/guantes.jpg", 35, "-20% OFF", 99.99],
                ["Bicicleta Estática de Spinning", 264.99, "Máquinas", "IMG/estatica.webp", 0, null, null],
                ["Bolsa Deportiva Impermeable", 119.99, "Accesorios", "IMG/bolsa deportiva.webp", 42, "-25% OFF", 159.99],
                ["Kit de Bloques de Yoga Corcho", 29.99, "Accesorios", "IMG/bloques de corcho.webp", 15, null, null],
                ["Cuerda de Saltar Velocidad Aluminio", 94.99, "Accesorios", "IMG/cuerda.webp", 15, "-27% OFF", 129.99]
            ];

            const insertQuery = "INSERT INTO products (title, price, category, img, stock, discount, oldPrice) VALUES ?";
            await db.query(insertQuery, [products]);
            console.log("📦 Productos iniciales cargados en la BD.");
        }

    } catch (err) {
        console.error('❌ Error al inicializar MySQL:', err);
        process.exit(1);
    }
}

// --- RUTAS DE LA API (Endpoints) ---

// 1. Obtener todos los productos
app.get('/api/products', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM products");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Crear Producto
app.post('/api/products', async (req, res) => {
    const { title, price, category, img, stock, discount, oldPrice } = req.body;
    
    if (!title || !price || !category) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const defaultImg = img || "IMG/balon-de-futbol-molten-.webp";
    const actualStock = stock || 10;

    try {
        const [result] = await db.query(
            "INSERT INTO products (title, price, category, img, stock, discount, oldPrice) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [title, price, category, defaultImg, actualStock, discount || null, oldPrice || null]
        );
        res.status(201).json({ id: result.insertId, title, price, category, img: defaultImg, stock: actualStock, discount, oldPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Iniciar Sesión
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [rows] = await db.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password]);
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ success: true, user: { email: user.email, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "Correo o contraseña incorrectos" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar el servidor e inicializar la DB
app.listen(PORT, async () => {
    await initDB();
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
    console.log(`Accede a la tienda desde: http://localhost:${PORT}/index.html`);
});
