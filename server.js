import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import dbPromise from './db.js';
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
    const { nombre, email, password, rol } = req.body;
    try {
        const db = await dbPromise;
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRol = rol === 'comerciante' ? 'comerciante' : 'comprador';
        
        await db.run(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
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
        const db = await dbPromise;
        const usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' });

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
        const db = await dbPromise;
        const perfumes = await db.all('SELECT * FROM perfumes WHERE stock > 0 ORDER BY id DESC');
        res.json(perfumes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el catálogo' });
    }
});

app.get('/api/perfumes/todos', async (req, res) => {
    try {
        const db = await dbPromise;
        const perfumes = await db.all('SELECT * FROM perfumes ORDER BY id DESC');
        res.json(perfumes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener inventario' });
    }
});

app.post('/api/perfumes', upload.single('imagen'), async (req, res) => {
    const { nombre, marca, precio, stock, descripcion, rol } = req.body;
    if (rol !== 'comerciante') return res.status(403).json({ error: 'Acceso denegado' });

    const imagen_url = req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/400x400?text=Oudmelo';

    try {
        const db = await dbPromise;
        await db.run(
            'INSERT INTO perfumes (nombre, marca, precio, stock, imagen_url, descripcion) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, marca, precio, stock, imagen_url, descripcion]
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
        const db = await dbPromise;
        const perfumeActual = await db.get('SELECT imagen_url FROM perfumes WHERE id = ?', [id]);
        if (!perfumeActual) return res.status(404).json({ error: 'Perfume no encontrado' });

        let imagen_url = perfumeActual.imagen_url;
        if (req.file) {
            eliminarArchivoLocal(imagen_url);
            imagen_url = `/uploads/${req.file.filename}`;
        }

        await db.run(
            'UPDATE perfumes SET nombre = ?, marca = ?, precio = ?, stock = ?, imagen_url = ?, descripcion = ? WHERE id = ?',
            [nombre, marca, precio, stock, imagen_url, descripcion, id]
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
        const db = await dbPromise;
        const perfume = await db.get('SELECT imagen_url FROM perfumes WHERE id = ?', [id]);
        if (!perfume) return res.status(404).json({ error: 'Perfume no encontrado' });

        eliminarArchivoLocal(perfume.imagen_url);
        await db.run('DELETE FROM perfumes WHERE id = ?', [id]);
        res.json({ mensaje: 'Producto eliminado del catálogo' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo eliminar el producto' });
    }
});

app.post('/api/comprar', async (req, res) => {
    const { usuario_id, carrito } = req.body;
    if (!usuario_id) return res.status(401).json({ error: 'Debes iniciar sesión' });

    try {
        const db = await dbPromise;
        await db.run('INSERT INTO pedidos (usuario_id) VALUES (?)', [usuario_id]);
        for (const item of carrito) {
            await db.run('UPDATE perfumes SET stock = stock - ? WHERE id = ?', [item.cantidad, item.id]);
        }
        res.json({ mensaje: '¡Compra realizada con éxito!' });
    } catch (error) {
        res.status(500).json({ error: 'Error procesando la compra' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));