// admin.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

async function criarUsuario(usuario, senha) {
    // 1. Abre (ou cria) o banco de dados
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    // 2. Cria a tabela se não existir
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `);

    try {
        // 3. Criptografa a senha (gera um hash)
        const senhaCriptografada = await bcrypt.hash(senha, 10);

        // 4. Insere no banco
        await db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            usuario,
            senhaCriptografada
        );

        console.log(`✅ Usuário "${usuario}" criado com sucesso!`);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            console.error(`❌ Erro: O usuário "${usuario}" já existe.`);
        } else {
            console.error('❌ Erro ao criar usuário:', error);
        }
    }
}

// --- COMO USAR ---
// Pegamos os argumentos do terminal: node admin.js usuario senha
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Use: node admin.js <nome_usuario> <senha>");
} else {
    criarUsuario(args[0], args[1]);
}