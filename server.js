require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Desactivar caché en desarrollo para evitar cargar scripts obsoletos
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Configuración de middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

let db;

// --- CONFIGURACIÓN DE LA BASE DE DATOS MYSQL ---
async function initDB() {
    try {
        // Conexión inicial sin base de datos para asegurarnos de que existe
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASS
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        await connection.end();

        // Conexión real a la base de datos del proyecto
        db = await mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
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
                description TEXT,
                price DOUBLE NOT NULL,
                category VARCHAR(100) NOT NULL,
                img LONGTEXT NOT NULL,
                stock INT DEFAULT 10,
                discount VARCHAR(50),
                oldPrice DOUBLE
            )
        `);

        // Actualizar esquema si la tabla ya existía (ignorando errores si ya existen)
        try {
            await db.query(`ALTER TABLE products MODIFY img LONGTEXT NOT NULL`);
            await db.query(`ALTER TABLE products ADD COLUMN description TEXT AFTER title`);
        } catch (e) { }


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

        // 3. Crear Tabla de Tickets de Soporte
        await db.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_name VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                priority VARCHAR(50) DEFAULT 'Normal',
                status VARCHAR(50) DEFAULT 'En curso',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [ticketCount] = await db.query("SELECT COUNT(*) AS count FROM tickets");
        if (ticketCount[0].count === 0) {
            await db.query("INSERT INTO tickets (user_name, subject, priority, status) VALUES (?, ?, ?, ?)", ["Juan Pérez", "Duda sobre talla de zapatos", "Normal", "En curso"]);
            await db.query("INSERT INTO tickets (user_name, subject, priority, status) VALUES (?, ?, ?, ?)", ["María Gómez", "Problema al procesar mi pago", "Alta", "En curso"]);
            await db.query("INSERT INTO tickets (user_name, subject, priority, status) VALUES (?, ?, ?, ?)", ["Carlos Ruiz", "Envío retrasado por 3 días", "Urgente", "Resuelto"]);
            console.log("🎧 Tickets de prueba creados.");
        }

        // 4. Crear Tabla de Órdenes (Pedidos)
        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id VARCHAR(50) UNIQUE NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                total DOUBLE NOT NULL,
                status VARCHAR(50) DEFAULT 'Procesando',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [orderCount] = await db.query("SELECT COUNT(*) AS count FROM orders");
        if (orderCount[0].count === 0) {
            await db.query("INSERT INTO orders (order_id, customer_name, total, status) VALUES (?, ?, ?, ?)", ["#ORD-1092", "Ana López", 145.98, "Completado"]);
            await db.query("INSERT INTO orders (order_id, customer_name, total, status) VALUES (?, ?, ?, ?)", ["#ORD-1091", "Carlos G.", 89.99, "Enviado"]);
            await db.query("INSERT INTO orders (order_id, customer_name, total, status) VALUES (?, ?, ?, ?)", ["#ORD-1090", "Lucía M.", 39.99, "Procesando"]);
            console.log("🛍️ Órdenes de prueba creadas.");
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
    const { title, description, price, category, img, stock, discount, oldPrice } = req.body;
    
    if (!title || !price || !category) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const defaultImg = img || "IMG/balon-de-futbol-molten-.webp";
    const actualStock = stock || 10;

    try {
        const [result] = await db.query(
            "INSERT INTO products (title, description, price, category, img, stock, discount, oldPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [title, description || null, price, category, defaultImg, actualStock, discount || null, oldPrice || null]
        );
        res.status(201).json({ id: result.insertId, title, description, price, category, img: defaultImg, stock: actualStock, discount, oldPrice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2.1 Actualizar Producto
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, price, category, img, stock, discount, oldPrice } = req.body;
    
    try {
        if (img) {
            await db.query(
                "UPDATE products SET title=?, description=?, price=?, category=?, img=?, stock=?, discount=?, oldPrice=? WHERE id=?",
                [title, description || null, price, category, img, stock, discount || null, oldPrice || null, id]
            );
        } else {
            await db.query(
                "UPDATE products SET title=?, description=?, price=?, category=?, stock=?, discount=?, oldPrice=? WHERE id=?",
                [title, description || null, price, category, stock, discount || null, oldPrice || null, id]
            );
        }
        res.json({ success: true, message: "Producto actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2.2 Eliminar Producto
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM products WHERE id=?", [id]);
        res.json({ success: true, message: "Producto eliminado" });
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

// 4. Registrar Usuario
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Todos los campos son obligatorios" });
    }

    try {
        const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "El correo ya está registrado" });
        }

        await db.query("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", [email, password, 'customer']);
        res.status(201).json({ success: true, user: { email, role: 'customer' } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4.1 Obtener Usuarios
app.get('/api/users', async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, email, role FROM users");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Reportes del Dashboard
app.get('/api/reports', async (req, res) => {
    try {
        const [users] = await db.query("SELECT COUNT(*) AS total_users FROM users WHERE role = 'customer'");
        const [products] = await db.query("SELECT COUNT(*) AS total_products, SUM(stock) AS total_stock FROM products");
        const [outOfStock] = await db.query("SELECT COUNT(*) AS out_of_stock FROM products WHERE stock = 0");
        
        // Datos para los gráficos
        const [categoryBreakdown] = await db.query("SELECT category, COUNT(*) as count, SUM(stock) as stock_count FROM products GROUP BY category");

        res.json({
            totalUsers: users[0].total_users,
            totalProducts: products[0].total_products,
            totalStock: products[0].total_stock || 0,
            outOfStock: outOfStock[0].out_of_stock,
            categoryData: categoryBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Archivos (Archivos subidos)
app.get('/api/files', (req, res) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    fs.readdir(uploadsDir, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });

        let totalSize = 0;
        const fileList = files.map(file => {
            const stats = fs.statSync(path.join(uploadsDir, file));
            totalSize += stats.size;
            return {
                name: file,
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                uploadedAt: stats.birthtime,
                type: path.extname(file).substring(1).toUpperCase() || 'FILE'
            };
        });

        res.json({
            files: fileList,
            totalFiles: fileList.length,
            totalSpaceMB: (totalSize / (1024 * 1024)).toFixed(2)
        });
    });
});

app.post('/api/files', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            console.error('❌ Error de Multer al subir archivo:', err);
            return res.status(400).json({ error: err.message });
        }
        if (!req.file) {
            console.error('❌ No se recibió req.file en el servidor');
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }
        console.log('📂 Archivo subido exitosamente:', req.file.filename);
        res.json({ success: true, file: req.file.filename });
    });
});

app.delete('/api/files/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Archivo eliminado' });
    });
});

// 7. Soporte (Tickets)
app.get('/api/tickets', async (req, res) => {
    try {
        const [tickets] = await db.query("SELECT * FROM tickets ORDER BY created_at DESC");
        const [openCount] = await db.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'En curso'");
        const [resolvedToday] = await db.query("SELECT COUNT(*) as count FROM tickets WHERE status = 'Resuelto' AND DATE(created_at) = CURDATE()");
        
        res.json({
            tickets,
            openTickets: openCount[0].count,
            resolvedToday: resolvedToday[0].count
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tickets', async (req, res) => {
    const { user_name, subject, priority } = req.body;
    if (!user_name || !subject) return res.status(400).json({ error: 'Faltan campos' });

    try {
        await db.query("INSERT INTO tickets (user_name, subject, priority, status) VALUES (?, ?, ?, 'En curso')", [user_name, subject, priority || 'Normal']);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tickets/:id/resolve', async (req, res) => {
    try {
        await db.query("UPDATE tickets SET status = 'Resuelto' WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tickets/:id', async (req, res) => {
    try {
        await db.query("DELETE FROM tickets WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Dashboard Principal (Resumen y Órdenes)
app.get('/api/dashboard-summary', async (req, res) => {
    try {
        const [sales] = await db.query("SELECT SUM(total) as total_sales FROM orders WHERE status != 'Cancelado'");
        const [productsSold] = await db.query("SELECT COUNT(*) as count FROM orders"); // Aproximación
        const [activeCustomers] = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'customer'");
        
        res.json({
            totalSales: sales[0].total_sales || 0,
            productsSold: productsSold[0].count * 3, // Simulación de items por orden
            activeCustomers: activeCustomers[0].count,
            conversionRate: "3.4%"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const [orders] = await db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5");
        res.json(orders);
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
