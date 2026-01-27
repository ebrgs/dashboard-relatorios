# 🗺️ Roadmap de Evolução do Sistema

## 🐛 Correções e Integridade (Prioridade Alta)
- [ ] **Eliminar duplicatas:** Implementar verificação para impedir que o mesmo colaborador seja contado duas vezes no mesmo dia/relatório.
- [ ] **Filtro de Obras:** Permitir que o usuário selecione apenas uma obra específica para gerar o relatório, em vez de buscar todas.

## ⚙️ Funcionalidades de Negócio (Prioridade Média)
- [ ] **Lógica de Equipamentos:** - Verificar o `tipo` do relatório.
    - Se for **"Parte Diária"**, buscar e listar também os equipamentos alocados, além da mão de obra.
- [ ] **Status do Relatório:** Exibir visualmente no Dashboard se o relatório está:
    - 🟡 Em preenchimento
    - 🟠 Revisar
    - 🟢 Aprovado

## ⚡ Performance e Arquitetura (Prioridade Técnica)
- [ ] **Sistema de Cache:** Implementar cache (Redis ou em memória) para armazenar requisições recentes.
    - *Objetivo:* Se buscar o dia "20/01" duas vezes, a segunda deve ser instantânea.
- [ ] **Otimização de Performance:** Refatorar as chamadas da API para reduzir ainda mais o tempo de resposta e consumo de memória.