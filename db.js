import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Abrir conexión con SQLite (crea el archivo database.sqlite automáticamente)
const dbPromise = open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

// Inicializar las tablas si no existen
async function inicializarBD() {
    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT DEFAULT 'comprador',
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS perfumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            marca TEXT NOT NULL,
            precio REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            imagen_url TEXT,
            descripcion TEXT
        );

        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            realizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        );
    `);
    console.log('Base de datos SQLite inicializada correctamente.');
}

inicializarBD();

export default dbPromise;