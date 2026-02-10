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

// ... imports do pg e dotenv ...

// async function criarTabelaSetores() {
//     try {
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS obras_config (
//                 id_externo_obra VARCHAR(255) PRIMARY KEY,
//                 nome_obra VARCHAR(255), -- Só pra você saber qual é no banco
//                 setor VARCHAR(50) NOT NULL -- Ex: 'Civil', 'Industrial', 'Parada'
//             );
//         `);
//         console.log("✅ Tabela 'obras_config' criada!");
        
//         // --- EXEMPLO DE COMO INSERIR (Descomente e edite com seus IDs reais) ---
        
//         await pool.query(`
//             INSERT INTO obras_config (id_externo_obra, nome_obra, setor) VALUES 
//             ('67f6bc38dacb02d8e305b556', '998 - CEP (Centro de Empresas Parceiras)', 'CT-251 Carajas'),
//             ('68e92251d0422ee03206b5d2', 'Equipamentos Indisponível', 'CT-251 Carajas'),
//             ('68af14c0b7f00f95ae05d093', 'Manutenção / Indisponibilidade', 'CT-251 Carajas'),
//             ('6984d7ca49ab471a4a039a02', 'OF 206 - PLATAFORMA DE ACESSO ÀS BOMBAS' , 'Fabrica Omega'),
//             ('6984d8946662484a790b7d23', 'OF 209 - FABRICAÇÃO DE SOBREBASE 12', 'Fabrica Omega'),
//             ('6824b1e7bab3c330350db012', 'PARTE DIÁRIA (PIPA)', 'CT-251 Carajas'),
//             ('6824b2c26aa231e808023cb2', 'PARTES DIÁRIA (CAMINHÃO 3/4)', 'CT-251 Carajas'),
//             ('680f691266cd2e6c9b00ae1c', 'Parte Diária (ONIBUS)', 'CT-251 Carajas'),
//             ('6960f49933575d49870811f2', 'SS001/26 - Instalações de Talha Elétrica na captação do Gelado.', 'CT-251 Carajas'),
//             ('69874f4c3d4fc438e309ac44', 'SS003/26 - Montagem de tubulação revestida', 'CT-251 Carajas'),
//             ('6989d594ef69aeccf1010b62', 'SS004/26 - Tubulação de PEAD (Gelado)', 'CT-251 Carajas'),
//             ('67ed43b19b5b2dba6200e6b2', 'SS008/25 - Rede de Saneamento Adutora', 'CT-251 Carajas'),
//             ('67eea315ec50428eb8035fd2', 'SS013/25 - Montagem de Infraestrutura Elétrica - Filtragem a Disco (Saúde das Usinas)', 'CT-251 Carajas'),
//             ('68dd1266eed5fb727f032c93', 'SS033/25 - Serviços de Intertravamento dos Exaustores - Larox', 'CT-251 Carajas'),
//             ('6899c9a0c3dc3cc883072857', 'SS037/25 - Instalação de Chapéu Chinês - Enclausuramento de TRs', 'CT-251 Carajas'),
//             ('6960fbf426086df9970256f5', 'SS038/25 - Instalação de Ponte', 'CT-251 Carajas'),
//             ('6908f38a80590fb1af04e274', 'SS044/25 - Instalação de canhões de ar em chutes de descarga', 'CT-251 Carajas'),
//             ('68375ab568c0a172f705a602', 'SS059/24 - SONDAGEM', 'CT-251 Carajas'),
//             ('697b335078a066b5be01d696', 'SS071/25 - REP06', 'CT-251 Carajas'),
//             ('67efda0eb26638588706d0d2', 'SS085/24 -Túnel da Britagem Primária - Usina I', 'CT-251 Carajas'),
//             ('69668e81a3e135f6ce0383c2', 'SS102/24 - Corte de Tubulações e outros materiais - CMP', 'CT-251 Carajas'),
//             ('6808d507b079943d910fa3a3', 'SS113/24 - Repotenciamento das Plantas de Britagem / Serra Leste' , 'CT-251 Carajas'),
//             ('688136362d4eb1db6a0d6d72', 'SS117/24 - Hangar', 'CT-251 Carajas'),
//             ('69789e072d0ba00eb105c106', 'SS108/24 - Execução do serviço montagem de tanque tulipa de 50 m³.', 'CT-251 Carajas'),
//             ('687fe1db8f660a6f9a00eb42', 'SS104/24 - Planta de residuos RCC', 'CT-251 Carajas'),
//             ('67ed537375a504d954029eb2', 'SS088/24 - Britador SANDVIK CS660', 'CT-251 Carajas'),
//             ('689392a8bb01aa5766021ff2', 'SS079/24 - Plataforma 26 ton - Larox', 'CT-251 Carajas'),
//             ('66e03dd2385688016d0aa803', 'SS064/2024 - Tanque 1880KN-601-Booster N5', 'CT-251 Carajas'),
//             ('682db3acd0a21f84f1075618', 'SS063/24 - Retirada de Interferências, Silo', 'CT-251 Carajas'),
//             ('693874b886d077fa380fd696', 'SS058/23 - Instalação de SPCI na Oficina N5', 'CT-251 Carajas'),
//             ('68b87a438105df32a4081843', 'SS055/24 - LABORATÓRIO', 'CT-251 Carajas'),
//             ('68b5f1951dcebd61cb01ce05', 'SS052/24 - ÁGUA DE SERVIÇO', 'CT-251 Carajas'),
//             ('6859b07217b1415193087d22', 'SS049/24 - IHM dos Compressores / Larox', 'CT-251 Carajas'),
//             ('6882420b205e1c06760d60c5', 'SS047/24 - Floculante de lama', 'CT-251 Carajas'),
//             ('67f01fc867bf1c3ee10bf684', 'SS045/24 Substituição Climatização Subestações', 'CT-251 Carajas'),
//             ('68aaf6cc990aabc2b907f419', 'SS042/25 - OFICINA DE PERFURATRIZ', 'CT-251 Carajas'),
//             ('690340c087b51ed0e00952e3', 'SS041/25 - Sistema de Elevação de Báscula N5 (KIMBO)', 'CT-251 Carajas'),
//             ('68812bc925f1b039580c6aa5', 'SS036/25 - SPCI CMD', 'CT-251 Carajas'),
//             ('682cd4d93cac80b97303ed54', 'SS030/25 - MONTAGEM DO MOTOR E REDUTOR DO ESPESSADOR DO FLOCULANTE DE LAMA', 'CT-251 Carajas'),
//             ('6899ccb006674b0625024815', 'SS028/25 - Barragem Estéril Sul', 'CT-251 Carajas'),
//             ('681bad25810c27791e050f92', 'SS027/25 - Adequação das gaiolas-Bioparque', 'CT-251 Carajas'),
//             ('685a94921a5dff8bba0ceb73', 'SS024/25 - ADEQUAÇÃO DA TUBULAÇÃO PARA INCLUSÃO DE NOVO ACESSO AO ASMECK', 'CT-251 Carajas'),
//             ('683f2ffc93b9708022058d76', 'SS023/25 - Galpão de Testemunho', 'CT-251 Carajas'),
//             ('685005bd20046ae8c804ae74', 'SS021/25 - Montagem de Infraestrutura e Lançamento de Cabos - Gelado', 'CT-251 Carajas'),
//             ('68794fbb80ef665e2a0462d2', 'SS019/25 - Alimentação de patio de montagem - Serra Leste', 'CT-251 Carajas'),
//             ('686e40e5889005af260d8653', 'SS017/25 - Pátio de Montagem Sul 04', 'CT-251 Carajas'),
//             ('6825be3413c0e26e4b05c792', 'SS014/25 - Projeto CDAI Corpo de Bombeiros', 'CT-251 Carajas'),
//             ('6807a5bc9762cddb0e0ec3e2', 'SS003/25 - Instalação de SPDA Galpão de Componentes - Mina N4WN', 'CT-251 Carajas'),
//             ('6899cffa26164e246a017777', 'SS002/25 - Mobilização de canteiro simples, pátio de montagem', 'CT-251 Carajas'),
//             ('681bb18252e636c18902ee22', 'Parte Diária (Retroescavadeira)', 'CT-251 Carajas'),
//             ('681baf78ba86c0bfeb025405', 'Parte Diária (PTA)', 'CT-251 Carajas'),
//             ('681ba9d10dfd568e4f0ff3d4', 'Parte Diária (Munck)', 'CT-251 Carajas'),
//             ('67efe48af82f643e39012794', 'Parte Diária (LEVE)', 'CT-251 Carajas')
//             ON CONFLICT (id_externo_obra) DO UPDATE SET setor = EXCLUDED.setor;
//         `);
        
       
//     } catch (error) { console.error(error); } 
//     finally { pool.end(); }
// }

// criarTabelaSetores();

// async function criarUsuario(usuario, senha) {
//     try {
//         // 1. Cria tabela se não existir (Sintaxe Postgres: SERIAL em vez de AUTOINCREMENT)
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS users (
//                 id SERIAL PRIMARY KEY,
//                 username TEXT UNIQUE NOT NULL,
//                 password TEXT NOT NULL
//             );
//         `);

//         // 2. Criptografa
//         const senhaCriptografada = await bcrypt.hash(senha, 10);

//         // 3. Insere (Sintaxe Postgres: $1, $2)
//         await pool.query(
//             'INSERT INTO users (username, password) VALUES ($1, $2)',
//             [usuario, senhaCriptografada]
//         );

//         console.log(`✅ Usuário "${usuario}" criado com sucesso no PostgreSQL!`);
//     } catch (error) {
//         if (error.code === '23505') { // Código de erro do Postgres para registro duplicado
//             console.error(`❌ Erro: O usuário "${usuario}" já existe.`);
//         } else {
//             console.error('❌ Erro ao criar usuário:', error);
//         }
//     } finally {
//         await pool.end(); // Fecha conexão
//     }
// }

// const args = process.argv.slice(2);
// if (args.length < 2) {
//     console.log("Use: node admin.js <usuario> <senha>");
// } else {
//     criarUsuario(args[0], args[1]);
// }

// // Script temporário para criar tabela de funcionários
// import pg from 'pg';
// import 'dotenv/config';

// const { Pool } = pg;
// const connectionString = process.env.DATABASE_URL;
// const pool = new Pool({
//     connectionString,
//     ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
// });

// async function criarTabelaFuncionarios() {
//     try {
//         await pool.query(`
//             CREATE TABLE IF NOT EXISTS funcionarios (
//                 id SERIAL PRIMARY KEY,
//                 nome VARCHAR(255) UNIQUE NOT NULL,
//                 cargo VARCHAR(100),
//                 ativo BOOLEAN DEFAULT TRUE
//             );
//         `);
//         console.log("✅ Tabela 'funcionarios' criada com sucesso!");
//     } catch (error) {
//         console.error("❌ Erro:", error);
//     } finally {
//         pool.end();
//     }
// }

// criarTabelaFuncionarios();