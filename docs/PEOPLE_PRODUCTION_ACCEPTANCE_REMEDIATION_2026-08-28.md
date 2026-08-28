# People Production Acceptance Remediation

> **Estado desta branch:** correções técnicas e regressões automatizadas concluídas localmente; não constitui aprovação em produção nem altera checkboxes de produto.
>
> **Âmbito:** remediação dos achados da auditoria independente [#395](https://github.com/bfrpaulondev/eutaktos/pull/395), sem dados de produção, sem segredos, sem alterações de autoridade de servidor e sem implementação de DOCX.

## Base

| Campo | Valor |
| --- | --- |
| Repositório | `bfrpaulondev/eutaktos` |
| Produção canónica de reaceitação | `https://eutakes.netlify.app/` |
| SHA inicial de `main` | `d34e76bba151a813444d1ad2fe64577b080f4e84` |
| Branch de remediação | `manus/people-production-acceptance-fixes` |
| Base de trabalho | `principal/people-qa-fixes` em `392216d0a8c5409b252dde244ea364ed1bae8a7d` |
| Estado da PR Principal #396 ao iniciar | Aberta; usada como **dependência**, não alterada nem revertida |
| Auditoria de origem | [PR #395](https://github.com/bfrpaulondev/eutaktos/pull/395) |

A base principal #396 já continha as primeiras correções para a seleção contextual de Arquivo, a atualização do perfil, o campo Nome obrigatório, a distinção inicial de erros de Transferências, a deduplicação do Mapa e a geração do artefacto de revisão. Esta branch foi criada sobre essa base, sem uma implementação concorrente, e acrescenta as salvaguardas, a cobertura browser e a testabilidade que ainda faltavam.

## Achados da auditoria

| ID | Severidade | Estado nesta branch | Causa raiz | Correção aplicada | Evidência de teste |
| --- | --- | --- | --- | --- | --- |
| `PEOPLE-QA-004` | P1 | **FIXED** | O diálogo de Arquivo podia cair no primeiro elemento do Diretório; o contexto do perfil não era garantido através de carregamentos assíncronos. | Mantém o `personId` do perfil, não usa fallback implícito, mostra nome e consequência na confirmação, bloqueia alvos divergentes e relê o estado autoritativo antes de mutar. | `PeopleQaCorrections.test.tsx` e `verify-people-archive-runtime.mjs` provam perfil → Arquivo, conclusão assíncrona, estado vazio fora de perfil, confirmação e foco. |
| `PEOPLE-QA-005` | P2 | **FIXED** | O perfil subjacente não era renovado depois de uma mutação de arquivo/restauro confirmada pelo servidor. | A composição do espaço Pessoas reabre perfil e insight sob uma chave de atualização após confirmação autoritativa; a restauração de foco ocorre somente depois do fecho efetivo do modal. | `verify-people-archive-runtime.mjs` arquiva, fecha, confirma `Inativo`, restaura, fecha e confirma `Ativo` sem navegação adicional. |
| `PEOPLE-QA-003` | P2 | **FIXED** | O formulário usava `requiredMark="optional"` sem marcar semanticamente o Nome obrigatório. | Nome recebe `required`, `aria-required` e atributo HTML `required`, preservando a marcação opcional apenas nos campos que o são. | `PeopleQaCorrections.test.tsx` verifica semântica e marcação requerida. |
| `PEOPLE-QA-002` | P2 | **FIXED** | Falhas de carga e de operações de Transferências partilhavam texto genérico. | A interface agora distingue `load`, `send`, `cancel`, `preview` e `claim`, com recuperação de prévia por repetição segura e recuperação de mutação por atualização de estado antes de nova tentativa. | `PeopleQaCorrections.test.tsx` exige cinco mensagens distintas em pt-PT, en e es; os contratos de Transferências permanecem cobertos na suíte de API. |
| `PEOPLE-QA-001` | P3/UX | **FIXED** | Resultados de geocodificador com o mesmo rótulo normalizado chegavam como escolhas visualmente repetidas. | A projeção do servidor deduplica por rótulo normalizado antes de limitar resultados, sem adicionar metadados de fornecedor ao DTO. | `api/people/map-search.test.ts` cobre rótulos visualmente idênticos. |

## P0, P1, P2 e P3/UX

| Classe | Quantidade conhecida sem correção nesta branch | Interpretação |
| --- | ---: | --- |
| P0 | 0 | Nenhum achado P0 foi identificado pela auditoria de origem. |
| P1 | 0 | `PEOPLE-QA-004` está corrigido e tem regressão; continua sujeito a revisão e reaceitação independente após integração. |
| P2 | 0 | `PEOPLE-QA-005`, `-003` e `-002` estão corrigidos e cobertos tecnicamente. |
| P3/UX | 0 | `PEOPLE-QA-001` está corrigido e coberto no contrato de pesquisa do Mapa. |

Estes números representam o estado do código desta branch e **não** são um novo veredito de produção. A auditoria independente precisa ainda de verificar o head integrado no deployment canónico.

## Hardening adicional de aceitação

### Evidência pública de revisão de build

O build do PWA cria `/build-revision.json` com um único campo `revision`, validado como SHA hexadecimal de 40 caracteres. O cabeçalho estático associado usa `Cache-Control: no-store`, evitando que o service worker ou a CDN apresentem uma revisão antiga de forma persistente. O gate de montagem de produção valida a presença do artefacto, o formato estrito e a regra de cache no `dist` gerado.

O artefacto não contém nome de branch, ambiente, token, tenant, actor, capabilities, caminhos ou PII. A comparação real entre esse ficheiro e o SHA integrado continua a exigir deployment canónico e uma nova auditoria.

### Testabilidade e acessibilidade de Hourglass

O inspetor Hourglass mantém um `input[type=file]` real, semanticamente ligado a um `label`, descrito por ajuda localizada e controlado por botão acessível. O ficheiro, o nome sanitizado e o payload continuam estritamente em memória da sessão do diálogo; a remoção de seleção limpa esse estado. Não foi introduzido campo de texto, armazenamento do browser ou qualquer atalho de autoridade.

A regressão browser foi convertida para selecionar fixtures sintéticas temporárias pelo protocolo de seletor de ficheiro do navegador. Ela cobre inspeção local sem escrita, preview explícito, preparação, confirmação, execução controlada, rollback create-only, erro de formato, erro de tamanho, ausência de reconciliação para CSV e ausência de persistência em `localStorage`.

### Arquivo, estado autoritativo e foco

A mutação de Arquivo passa a exigir que o alvo selecionado, a pessoa cuja leitura de estado foi concluída e o alvo da confirmação sejam o mesmo ID presente no Diretório atual. Antes de qualquer escrita, o cliente relê o estado do alvo sob a autoridade do servidor e falha fechado se a pessoa tiver desaparecido, tiver mudado de estado ou já não tiver capacidade de escrita. O servidor continua a ser a autoridade final da mutação e das capabilities.

O retorno de foco é agora acionado após o fecho efetivo do modal, evitando que uma confirmação aninhada substitua o foco. Isto preserva a operação por teclado, sem pretender equivaler a uma sessão real de leitor de ecrã.

### Cobertura existente preservada

A suíte agregada continua a executar regressões para capacidades negativas, 401/403, contactos com refetch, seleção de Pessoa, Mapa, privacidade PWA, zoom/reflow, tema Sistema, navegação e exportação. A cobertura de Transferências e Hourglass no servidor continua a provar sessão derivada do servidor, tenant isolation, idempotência, replay, mínimo de dados e fronteiras de rollback. [1] [2]

| Área | Evidência técnica mantida ou ampliada | Limite explícito |
| --- | --- | --- |
| Transferências | Contratos API, adversarial gate e mensagens específicas de `load/send/cancel/preview/claim`. | Não usa dois tenants de clientes; a reaceitação humana ainda requer ambiente QA controlado. |
| Contactos e disponibilidade | Regressão PX5 para validação, PUT único, refetch, 403 e limites privados; testes de ciclo de datas. | O ciclo real de produção com dados QA continua pendente após merge. |
| Record Cards/PDF e Contact List/CSV | Projeções mínimas e testes de contrato/exportação permanecem no gate. | A geração autorizada em produção requer capability QA e observação independente. |
| Mapa | Runtime cobre `map.read/map.write`, pesquisa explícita, privacidade, lista equivalente, reflow 320–1440 e zoom equivalente. | Não substitui a reaceitação no deployment canónico. |
| Responsividade e tema | Visual sanitizado em 320, 375, 390, 430, 768, 1024, 1280 e 1440 px, Light/Dark e pt-PT/en/es; System tem regressão própria. | Não constitui teste em dispositivos físicos. |

## Revisão de segurança e privacidade

Nenhuma correção introduz tenant, actor ou capabilities vindos do browser. Nenhum DTO de Mapa, Directório, Contact List, Transferências ou relatórios foi ampliado. A deduplicação do geocodificador continua no servidor e conserva somente `id`, `label`, `latitude` e `longitude` transitórios previstos pelo contrato; não persiste pesquisa, metadados do fornecedor ou precisão adicional. [3]

A alteração Hourglass preserva os passos inspeção local → preview → prepare → confirmação explícita → execute → rollback create-only e não permite escrita durante o preview. As fixtures do harness são sintéticas, temporárias e removidas pelo próprio teste; não são incluídas no repositório. [2]

Não houve alteração de dados reais, contas de produção, grants de capability, Supabase, DNS, segredos, configuração global de hosting ou documentação de estado partilhada. A regra de cabeçalhos aplica-se apenas ao artefacto público e mínimo de revisão do build.

## Testes executados

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — suites de workspaces, API, PWA e adversarial regression |
| `npm audit --omit=dev --audit-level=high` | **PASS** — 0 vulnerabilidades |
| `npm run test:production-mount --workspace @eutaktos/web-pwa` | **PASS** — build, artefacto SHA-40, regra `no-store`, deep link e montagem |
| `npm run test:hourglass-inspector --workspace @eutaktos/web-pwa` | **PASS** — chooser real, ciclo controlado de importação e privacidade |
| `npm run test:people-archive-runtime --workspace @eutaktos/web-pwa` | **PASS** — alvo de perfil, arquivo/restauro, refetch, foco e estado sem contexto |
| `npm run test:browser-regression --workspace @eutaktos/web-pwa` | **PASS** — gate agregado de 21 verificações, incluindo Mapa, tema, reflow, visual sanitizado, Hourglass e Arquivo |

O build emite o aviso pré-existente de chunk superior a 500 kB do Vite. O respetivo orçamento de bundle passou dentro do gate agregado; este aviso não foi ocultado nem reclassificado como aprovação visual.

## Cenários bloqueados eliminados

| Bloqueio anterior | Estado técnico após esta branch | Condição para encerrar em produção |
| --- | --- | --- |
| SHA do deployment não observável | **Eliminado tecnicamente** com `/build-revision.json` e teste do artefacto. | Deployment canónico deve publicar o head integrado; auditoria deve fazer `GET /build-revision.json` e comparar com o SHA esperado. |
| Input Hourglass oculto e inacessível para QA legítima | **Eliminado tecnicamente** com input real semanticamente associado, botão operável e harness de chooser. | Reaceitação deve anexar fixture QA autorizada no browser de produção. |
| P1 de alvo de Arquivo sem regressão | **Eliminado tecnicamente** com seleção contextual, bloqueio de divergência e regressão runtime. | Reaceitação deve reproduzir Perfil A → Arquivo contra o build canónico integrado. |

## Evidência humana ainda obrigatória

A seguinte lista não foi marcada como concluída por esta branch. São evidências que dependem de uma pessoa, de produção canónica ou de acesso QA distinto e não podem ser substituídas por mocks, CI ou preview local. [1]

| Item | Motivo | Estado |
| --- | --- | --- |
| Comparação de `/build-revision.json` com o head integrado | Exige deploy canónico do head revisto. | **HUMAN REACCEPTANCE REQUIRED** |
| Percurso real de Arquivo/restauro sobre Pessoa QA descartável | Exige conta autenticada e dados QA aprovados em produção. | **HUMAN REACCEPTANCE REQUIRED** |
| Importação Hourglass real e rollback create-only | Exige fixture QA aprovada e confirmação destrutiva em produção. | **HUMAN REACCEPTANCE REQUIRED** |
| Transferências reais A→B | Exige dois tenants/sessões QA isolados, nunca tenants de clientes. | **HUMAN REACCEPTANCE REQUIRED** |
| Exportação autorizada CSV/PDF e verificação do conteúdo | Exige capabilities QA de report/contact/export. | **HUMAN REACCEPTANCE REQUIRED** |
| Leitor de ecrã real | Requer tecnologia assistiva e percurso humano efetivo. | **HUMAN REACCEPTANCE REQUIRED** |
| Dispositivos físicos, se exigidos pelo Principal | Reflow automatizado não é evidência de dispositivo físico. | **HUMAN REACCEPTANCE REQUIRED** |

## Checklist objetiva de reaceitação em produção

1. A Principal Review deve aprovar esta PR dependente e a PR #396, assegurar CI verde e integrar sem alterar os contratos de autoridade.
2. O deployment canónico deve concluir sobre o SHA de `main` resultante. A pessoa auditora deve obter `/build-revision.json` sem autenticação e confirmar a equivalência exata do SHA-40.
3. Um agente independente deve reexecutar `PEOPLE-QA-004` a partir de um perfil QA: o seletor deve abrir nesse perfil, manter o alvo após carregamento, mostrar nome/ação/consequência na confirmação e nunca usar fallback implícito.
4. O mesmo agente deve arquivar e restaurar uma Pessoa QA, fechar o diálogo e confirmar o estado correto no perfil sem navegação adicional; deve também confirmar persistência após refresh.
5. O agente deve validar Nome obrigatório e erros de Transferências em pt-PT, en e es no deployment canónico.
6. Com fixture Hourglass totalmente sintética, o agente deve operar o chooser acessível e executar preview → prepare → confirm → execute → refresh → rollback, aplicando o plano de limpeza aprovado.
7. Com contas QA reduzidas e tenants QA isolados, o agente deve comprovar 401/403 e os percursos positivos autorizados de Transferências, Relatórios, PDF e Contact List/CSV.
8. O agente deve executar teclado e leitor de ecrã real, mantendo `PX10.6` pendente até essa evidência existir.
9. A Principal Review, e apenas ela, decide qualquer atualização de checkbox PX, `PX10.17` ou `PX10.18` após a evidência integrada e independente.

## Referências

[1]: PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md "Checklist de aceitação real em produção de Pessoas"
[2]: HOURGLASS_IMPORT_RECOVERY_BOUNDARY.md "Contrato de preview, execute e rollback Hourglass"
[3]: PEOPLE_MAP_CONTRACT.md "Contrato de autoridade, privacidade e precisão do Mapa"
[4]: PEOPLE_PRODUCTION_ACCEPTANCE_AUDIT_2026-08-27.md "Auditoria independente de aceitação em produção"

---

**Autoria:** Manus AI
**Alterações de escopo:** correções de produto, testes e este relatório; sem merge, sem dados de produção e sem alegação de nova aceitação em produção.
