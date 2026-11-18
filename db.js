import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

// Render o Neon proveen la URL en process.env.DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Requerido para conexiones seguras en la nube
    }
});

// Inicializar tablas en PostgreSQL
async function inicializarBD() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol VARCHAR(50) DEFAULT 'comprador',
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS perfumes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                marca VARCHAR(100) NOT NULL,
                precio DECIMAL(10, 2) NOT NULL,
                stock INT NOT NULL DEFAULT 0,
                imagen_url TEXT,
                descripcion TEXT
            );

            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                usuario_id INT NOT NULL,
                total DECIMAL(10, 2) NOT NULL,
                realizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
            );
        `);
        console.log('Tablas de PostgreSQL inicializadas correctamente.');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    }
}

inicializarBD();

export default {
    query: (text, params) => pool.query(text, params)
};