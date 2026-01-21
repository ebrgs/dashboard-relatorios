import pLimit from "p-limit";
import { api } from "./api.js";

const LIMITE_REQUISICOES_SIMULTANEAS = 5
async function buscarTodasObras() {
    try {
        console.log('Bucando obras...');
        const response = await api.get('/obras');

        return response.data
    } catch (error) {
        console.error('Erro ao buscar lista de obras: ', error.message);
        throw error;
    }
}

// 2. Busca apenas a LISTA de relatórios (Metadados: ID, Data, Status)
async function buscarListaRelatoriosDaObra(obra, dataAlvo) {
    try {
        // Ajuste a rota conforme sua API
        const response = await api.get(`/obras/${obra._id}/relatorios`, {
            params: { dataInicio: dataAlvo, dataFim: dataAlvo }
        });

        // Retornamos um array de objetos simplificados para sabermos o que buscar depois
        // Supondo que response.data seja um array de relatórios "resumidos"
        const lista = Array.isArray(response.data) ? response.data : [];
        
        return lista.map(relatorioResumido => ({
            obraId: obra._id,
            obraNome: obra.nome,
            relatorioId: relatorioResumido._id, // Ou .id, verifique sua API
            data: dataAlvo
        }));

    } catch (error) {
        console.warn(`⚠️ Falha ao listar relatórios da obra ${obra.nome}: ${error.message}`);
        return []; // Retorna lista vazia para não quebrar o fluxo
    }
}

// 3. Busca o DETALHE de um relatório específico (Onde estão os colaboradores)
async function buscarDetalhesDoRelatorio(itemParaBuscar) {
    try {
        // Rota hipotética: /obras/{obraId}/relatorios/{relatorioId}
        const url = `/obras/${itemParaBuscar.obraId}/relatorios/${itemParaBuscar.relatorioId}`;
        
        const response = await api.get(url);

        return {
            status: 'sucesso',
            meta: itemParaBuscar, // Mantemos os dados de origem (nome da obra, etc)
            conteudoCompleto: response.data
        };
    } catch (error) {
        return {
            status: 'erro',
            meta: itemParaBuscar,
            erro: error.message
        };
    }
}

// --- ORQUESTRADOR PRINCIPAL ---
async function consolidarRelatoriosDoDia(dataAlvo) {
    console.time('Tempo Total');
    const limit = pLimit(LIMITE_REQUISICOES_SIMULTANEAS);

    // --- FASE 1: DESCOBERTA (Obras -> Listas de Relatórios) ---
    const obras = await buscarTodasObras();
    console.log(`📋 Passo 1: Varrendo ${obras.length} obras em busca de relatórios...`);

    const promessasListagem = obras.map(obra => {
        return limit(() => buscarListaRelatoriosDaObra(obra, dataAlvo));
    });

    const resultadosListagem = await Promise.all(promessasListagem);
    
    // "Achatamos" (flat) os resultados. 
    // Ex: [[rel1, rel2], [], [rel3]] vira [rel1, rel2, rel3]
    const todosRelatoriosEncontrados = resultadosListagem.flat();
    
    console.log(`🔎 Passo 2: Encontrados ${todosRelatoriosEncontrados.length} relatórios. Baixando detalhes...`);

    // --- FASE 2: DETALHAMENTO (Lista de IDs -> JSON Completo) ---
    // Agora criamos uma nova fila de requisições apenas para os relatórios encontrados
    const promessasDetalhamento = todosRelatoriosEncontrados.map(item => {
        return limit(() => buscarDetalhesDoRelatorio(item));
    });

    const resultadosDetalhados = await Promise.all(promessasDetalhamento);

    const sucessos = resultadosDetalhados.filter(r => r.status === 'sucesso');
    const falhas = resultadosDetalhados.filter(r => r.status === 'erro');

    // --- FASE 3: EXTRAÇÃO DE COLABORADORES ---
    // Agora que temos o JSON completo, extraímos as pessoas
    const todosColaboradores = sucessos.flatMap(r => {
        // AJUSTE AQUI: Onde fica a lista de pessoas no JSON detalhado?
        const listaPessoas = r.conteudoCompleto.maoDeObra.personalizada || [];
        
        return listaPessoas.map(pessoa => ({
            funcionario: pessoa.nome,
            funcao: pessoa.funcao,
            origemObra: r.meta.obraNome,
            idRelatorio: r.meta.relatorioId
        }));
    });

    console.timeEnd('Tempo Total');

    return {
        data: dataAlvo,
        resumo: {
            obrasEscaneadas: obras.length,
            relatoriosEncontrados: todosRelatoriosEncontrados.length,
            detalhesBaixados: sucessos.length,
            falhasNoDownload: falhas.length,
            totalColaboradores: todosColaboradores.length
        },
        colaboradores: todosColaboradores
    };
}

// Execução
(async () => {
    const dados = await consolidarRelatoriosDoDia('2026-01-16');
    console.log('--- Resumo Final ---');
    console.log(dados.resumo);
    
    if (dados.colaboradores.length > 0) {
        console.log(dados.colaboradores);
    }
})();