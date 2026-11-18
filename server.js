import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import db from './db.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage, 
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Solo se permiten imágenes'), false);
    } 
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function eliminarArchivoLocal(imagenUrl) {
    if (imagenUrl && imagenUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, 'public', imagenUrl);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

// --- RUTAS DE AUTENTICACIÓN ---

app.post('/api/registro', async (req, res) => {
    const { nombre, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRol = 'comprador';
        
        await db.query(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
            [nombre, email, hashedPassword, userRol]
        );
        res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    } catch (error) {
        res.status(400).json({ error: 'El correo ya está registrado o datos inválidos' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const resultado = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (resultado.rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });

        const usuario = resultado.rows[0];
        const passwordValida = await bcrypt.compare(password, usuario.password);
        if (!passwordValida) return res.status(401).json({ error: 'Credenciales incorrectas' });

        res.json({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// --- RUTAS DEL CATÁLOGO ---

app.get('/api/perfumes', async (req, res) => {
    try {
        const resultado = await db.query('SELECT * FROM perfumes WHERE stock > 0 ORDER BY id DESC');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el catálogo' });
    }
});

app.get('/api/perfumes/todos', async (req, res) => {
    try {
        const resultado = await db.query('SELECT * FROM perfumes ORDER BY id DESC');
        res.json(resultado.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

app.post('/api/perfumes', upload.single('imagen'), async (req, res) => {
    const { nombre, marca, precio, stock, descripcion, rol } = req.body;
    if (rol !== 'comerciante') return res.status(403).json({ error: 'Acceso denegado' });

    const imagen_url = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/400x400?text=Oudmelo';

    try {
        await db.query(
            'INSERT INTO perfumes (nombre, marca, precio, stock, imagen_url, descripcion) VALUES ($1, $2, $3, $4, $5, $6)',
            [nombre, marca, Number(precio), Number(stock), imagen_url, descripcion]
        );
        res.status(201).json({ mensaje: 'Perfume agregado al catálogo' });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar el producto' });
    }
});

app.put('/api/perfumes/:id', upload.single('imagen'), async (req, res) => {
    const { id } = req.params;
    const { nombre, marca, precio, stock, descripcion, rol } = req.body;
    if (rol !== 'comerciante') return res.status(403).json({ error: 'Acceso denegado' });

    try {
        const perfumeActual = await db.query('SELECT imagen_url FROM perfumes WHERE id = $1', [id]);
        if (perfumeActual.rows.length === 0) return res.status(404).json({ error: 'Perfume no encontrado' });

        let imagen_url = perfumeActual.rows[0].imagen_url;
        if (req.file) {
            eliminarArchivoLocal(imagen_url);
            imagen_url = `/uploads/${req.file.filename}`;
        }

        await db.query(
            'UPDATE perfumes SET nombre = $1, marca = $2, precio = $3, stock = $4, imagen_url = $5, descripcion = $6 WHERE id = $7',
            [nombre, marca, Number(precio), Number(stock), imagen_url, descripcion, id]
        );
        res.json({ mensaje: 'Producto actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el producto' });
    }
});

app.delete('/api/perfumes/:id', async (req, res) => {
    const { id } = req.params;
    const { rol } = req.body;
    if (rol !== 'comerciante') return res.status(403).json({ error: 'Acceso denegado' });

    try {
        const perfume = await db.query('SELECT imagen_url FROM perfumes WHERE id = $1', [id]);
        if (perfume.rows.length === 0) return res.status(404).json({ error: 'Perfume no encontrado' });

        eliminarArchivoLocal(perfume.rows[0].imagen_url);
        await db.query('DELETE FROM perfumes WHERE id = $1', [id]);
        res.json({ mensaje: 'Producto eliminado del catálogo' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo eliminar el producto' });
    }
});

app.post('/api/comprar', async (req, res) => {
    const { usuario_id, carrito, total } = req.body;
    if (!usuario_id) return res.status(401).json({ error: 'Debes iniciar sesión' });

    try {
        await db.query('INSERT INTO pedidos (usuario_id, total) VALUES ($1, $2)', [usuario_id, total]);
        for (const item of carrito) {
            await db.query('UPDATE perfumes SET stock = stock - $1 WHERE id = $2', [item.cantidad, item.id]);
        }
        res.json({ mensaje: '¡Compra realizada con éxito!' });
    } catch (error) {
        res.status(500).json({ error: 'Error procesando la compra' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));