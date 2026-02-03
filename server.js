import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pLimit from "p-limit";
import { api } from "./api.js";
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;
const LIMITE_REQUISICOES_SIMULTANEAS = 2; // Mantido em 2 para não travar no Render
const JWT_SECRET = process.env.JWT_SECRET;

app.timeout = 300000; // 5 minutos de timeout global

app.use(cors());
app.use(express.json());

// --- CONEXÃO COM POSTGRESQL ---
const connectionString = process.env.DATABASE_URL;
const usarSSL = connectionString && connectionString.includes('render.com');

const pool = new Pool({
    connectionString: connectionString,
    ssl: usarSSL ? { rejectUnauthorized: false } : false
});

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
        console.log(`⏳ Buscando relatórios da obra: ${obra.nome}...`);
        
        const response = await api.get(`/obras/${obra._id}/relatorios`, {
            params: { dataInicio: dataAlvo, dataFim: dataAlvo },
            timeout: 30000 
        });

        const lista = Array.isArray(response.data) ? response.data : [];
        
        if (lista.length > 0) {
            console.log(`✅ ACHOU! Obra ${obra.nome} tem ${lista.length} relatórios.`);
        } else {
            console.log(`⚠️ Obra ${obra.nome}: Nenhum relatório encontrado.`);
        }

        return lista.map(relatorioResumido => ({
            obraId: obra._id,
            obraNome: obra.nome,
            relatorioId: relatorioResumido._id,
            data: dataAlvo,
            // Importante: Passamos o modelo/nome do relatório aqui para verificar depois
            modeloNome: relatorioResumido.modelo ? relatorioResumido.modelo.nome : "" 
        }));

    } catch (error) {
        const msgErro = error.response ? `Status ${error.response.status}` : error.message;
        console.error(`❌ ERRO na Obra ${obra.nome}: ${msgErro}`);
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

        // --- AQUI ESTÁ A LÓGICA NOVA (MÃO DE OBRA + EQUIPAMENTOS) ---
        const todosColaboradores = sucessos.flatMap(r => {
            const relatorio = r.conteudoCompleto;
            
            // Tenta pegar o nome de vários lugares possíveis para garantir
            const nomeModelo = relatorio.modeloDeRelatorio.descricao;

            // --- ESPIÃO LIGADO (Vai aparecer no Log do Render) ---
            console.log(`🔎 Relatório ID ${r.meta.relatorioId} - Nome: "${nomeModelo}"`);

            // Normaliza para minúsculas para facilitar a comparação
            const nomeParaBusca = nomeModelo.toLowerCase();
            
            // Verifica variações comuns de nome
            const ehParteDiaria = nomeParaBusca.includes("parte diária") || 
                                  nomeParaBusca.includes("parte diaria") ||
                                  nomeParaBusca.includes("diario");

            let recursosDesteRelatorio = [];

            // 1. Busca Mão de Obra (Igual antes)
            const listaPessoas = relatorio.maoDeObra?.personalizada || [];
            const pessoasFormatadas = listaPessoas.map(pessoa => ({
                funcionario: pessoa.nome,
                matricula: pessoa.nome.replace(/.*?\(([^)]*)\).*/, "$1"),
                funcao: pessoa.funcao,
                origemObra: r.meta.obraNome,
                idRelatorio: relatorio.numero,
                data: data,
                tipo: 'Pessoa'
            }));
            recursosDesteRelatorio.push(...pessoasFormatadas);

            // 2. Busca Equipamentos
            if (ehParteDiaria) {
                // Tenta achar a lista com nomes diferentes
                const listaEquipamentos = relatorio.equipamentos || [];
                
                if (listaEquipamentos.length > 0) {
                    console.log(`🚜 ACHEI EQUIPAMENTOS na obra ${r.meta.obraNome}! Quantidade: ${listaEquipamentos.length}`);
                } else {
                    // Se entrou no IF mas não achou equipamentos, avisa pra gente saber se o campo tem outro nome
                    console.log(`⚠️ É Parte Diária ("${nomeModelo}"), mas a lista de 'equipamentos' veio vazia. Campos do JSON:`, Object.keys(relatorio));
                }

                const equipamentosFormatados = listaEquipamentos.map(equip => ({
                    funcionario: equip.descricao || "Equipamento Sem Nome",
                    matricula: equip.descricao.substring(equip.descricao.indexOf('-') + 1),
                    funcao: relatorio.maoDeObra.personalizada.length >= 1 ? relatorio.maoDeObra.personalizada[0].nome : 'Banheiro',
                    origemObra: r.meta.obraNome,
                    idRelatorio: relatorio.numero,
                    data: data,
                    tipo: 'Equipamento'
                }));

                recursosDesteRelatorio.push(...equipamentosFormatados);
            }

            return recursosDesteRelatorio;
        });
        // -------------------------------------------------------------

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

// --- ROTAS DE FUNCIONÁRIOS (EFETIVO) ---

// 1. Salvar ou Atualizar Lista (Recebe um Array de nomes)
app.post('/api/funcionarios/importar', autenticarToken, async (req, res) => {
    const { listaNomes } = req.body; // Espera: { "listaNomes": ["João", "Maria"] }

    if (!listaNomes || !Array.isArray(listaNomes)) {
        return res.status(400).json({ erro: "Lista inválida" });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Opcional: Limpar lista antiga antes de por a nova? 
        // Vamos apenas INSERIR e ignorar se já existir (ON CONFLICT DO NOTHING)
        for (const nome of listaNomes) {
            await client.query(`
                INSERT INTO funcionarios (nome, ativo) VALUES ($1, true)
                ON CONFLICT (nome) DO NOTHING
            `, [nome]);
        }

        await client.query('COMMIT');
        res.json({ mensagem: "Lista importada com sucesso!" });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ erro: "Erro ao importar lista" });
    } finally {
        client.release();
    }
});

// 2. Buscar Lista de Funcionários Ativos
app.get('/api/funcionarios', autenticarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT nome FROM funcionarios WHERE ativo = true ORDER BY nome ASC');
        // Retorna só um array de strings: ["Ana", "Carlos", ...]
        const lista = result.rows.map(row => row.nome);
        res.json(lista);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar funcionários" });
    }
});

// 3. Rota para Excluir Funcionário
app.delete('/api/funcionarios', autenticarToken, async (req, res) => {
    const { nome } = req.body; // Espera: { "nome": "João da Silva" }

    if (!nome) return res.status(400).json({ erro: "Nome obrigatório" });

    try {
        await pool.query('DELETE FROM funcionarios WHERE nome = $1', [nome]);
        res.json({ mensagem: "Funcionário removido com sucesso!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: "Erro ao excluir" });
    }
});

app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
});