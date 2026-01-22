import 'dotenv/config'; // Precisamos ler o .env para pegar a URL do banco
import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

// Verifica se temos a URL do banco configurada (no .env ou direto no comando)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ Erro: DATABASE_URL não definida no arquivo .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function criarUsuario(usuario, senha) {
    try {
        // 1. Cria tabela se não existir (Sintaxe Postgres: SERIAL em vez de AUTOINCREMENT)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
        `);

        // 2. Criptografa
        const senhaCriptografada = await bcrypt.hash(senha, 10);

        // 3. Insere (Sintaxe Postgres: $1, $2)
        await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [usuario, senhaCriptografada]
        );

        console.log(`✅ Usuário "${usuario}" criado com sucesso no PostgreSQL!`);
    } catch (error) {
        if (error.code === '23505') { // Código de erro do Postgres para registro duplicado
            console.error(`❌ Erro: O usuário "${usuario}" já existe.`);
        } else {
            console.error('❌ Erro ao criar usuário:', error);
        }
    } finally {
        await pool.end(); // Fecha conexão
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Use: node admin.js <usuario> <senha>");
} else {
    criarUsuario(args[0], args[1]);
}