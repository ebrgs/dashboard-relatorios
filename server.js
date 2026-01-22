import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pLimit from "p-limit";
import { api } from "./api.js";
import pg from 'pg'; // Usando pacote 'pg' em vez de sqlite
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000; // Render define a porta automaticamente
const LIMITE_REQUISICOES_SIMULTANEAS = 5;
const JWT_SECRET = process.env.JWT_SECRET;

// --- CONEXÃO COM POSTGRESQL ---
const connectionString = process.env.DATABASE_URL;

app.use(cors());
app.use(express.json());

// --- CONEXÃO COM POSTGRESQL ---
// O Render fornece a DATABASE_URL automaticamente nas variáveis de ambiente
const usarSSL = connectionString && connectionString.includes('render.com');

const pool = new Pool({
    connectionString: connectionString,
    ssl: usarSSL ? { rejectUnauthorized: false } : false
});

// Teste de conexão ao iniciar
pool.connect()
    .then(() => console.log('🐘 PostgreSQL conectado com sucesso!'))
    .catch(err => console.error('Erro ao conectar no PostgreSQL:', err));


// --- FUNÇÕES DA API EXTERNA ---
async function buscarTodasObras() {
    console.log('📡 Buscando obras...');
    const response = await api.get('/obras');
    return response.data;
}

async function buscarListaRelatoriosDaObra(obra, dataAlvo) {
    try {
        const response = await api.get(`/obras/${obra._id}/relatorios`, {
            params: { dataInicio: dataAlvo, dataFim: dataAlvo }
        });
        const lista = Array.isArray(response.data) ? response.data : [];
        return lista.map(relatorioResumido => ({
            obraId: obra._id,
            obraNome: obra.nome,
            relatorioId: relatorioResumido._id,
            data: dataAlvo
        }));
    } catch (error) {
        return [];
    }
}

async function buscarDetalhesDoRelatorio(itemParaBuscar) {
    try {
        const url = `/obras/${itemParaBuscar.obraId}/relatorios/${itemParaBuscar.relatorioId}`;
        const response = await api.get(url);
        return {
            status: 'sucesso',
            meta: itemParaBuscar,
            conteudoCompleto: response.data
        };
    } catch (error) {
        return { status: 'erro', meta: itemParaBuscar, erro: error.message };
    }
}

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ erro: 'Acesso negado. Faça login.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ erro: 'Token inválido ou expirado' });
        req.user = user;
        next();
    });
}

// --- ROTAS ---

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // MUDANÇA: Sintaxe $1 em vez de ?
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ erro: 'Usuário ou senha incorretos' });

        const senhaValida = await bcrypt.compare(password, user.password);
        if (!senhaValida) return res.status(401).json({ erro: 'Usuário ou senha incorretos' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '8h' });

        res.json({ token, username: user.username });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ erro: "Erro interno no servidor" });
    }
});

app.get('/api/colaboradores', autenticarToken, async (req, res) => {
    try {
        const { data } = req.query;
        if (!data) return res.status(400).json({ erro: 'Data obrigatória' });

        console.log(`🚀 Usuário ${req.user.username} pediu dados de: ${data}`);

        const obras = await buscarTodasObras();
        const limit = pLimit(LIMITE_REQUISICOES_SIMULTANEAS);
        
        const promessasListagem = obras.map(obra => limit(() => buscarListaRelatoriosDaObra(obra, data)));
        const resultadosListagem = await Promise.all(promessasListagem);
        const todosRelatoriosEncontrados = resultadosListagem.flat();

        const promessasDetalhamento = todosRelatoriosEncontrados.map(item => limit(() => buscarDetalhesDoRelatorio(item)));
        const resultadosDetalhados = await Promise.all(promessasDetalhamento);
        const sucessos = resultadosDetalhados.filter(r => r.status === 'sucesso');
        const falhas = resultadosDetalhados.filter(r => r.status === 'erro');

        const todosColaboradores = sucessos.flatMap(r => {
            const listaPessoas = r.conteudoCompleto.maoDeObra?.personalizada || [];
            return listaPessoas.map(pessoa => ({
                funcionario: pessoa.nome,
                funcao: pessoa.funcao,
                origemObra: r.meta.obraNome,
                idRelatorio: r.meta.relatorioId,
                data: data
            }));
        });

        res.json({
            resumo: {
                obras: obras.length,
                relatorios: todosRelatoriosEncontrados.length,
                colaboradores: todosColaboradores.length,
                falhas: falhas.length
            },
            listaColaboradores: todosColaboradores
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro interno no servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});