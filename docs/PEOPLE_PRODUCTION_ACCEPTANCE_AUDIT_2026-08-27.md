# Auditoria independente de aceitação em produção — Pessoas

| Campo | Valor |
| --- | --- |
| Data da auditoria | 27 de agosto de 2026, aproximadamente 22:09–22:58 GMT+1 |
| Produto e área | Eutaktos — módulo **Pessoas** |
| Produção canónica | `https://eutakes.netlify.app/` |
| Referência do repositório | `main` em `d34e76bba151a813444d1ad2fe64577b080f4e84` |
| Evidência de SHA do deploy | **Não verificável** pela interface/ambiente observado; não é afirmada equivalência entre `main` e o deploy |
| Sessão e contexto | Sessão autenticada, com dados de produção ligados e permissões parciais observadas |
| Ambiente visual | Navegador Chromium; viewport de ambiente desktop; pt-PT, en e es; tema Sistema e Dark observados |
| Dados de teste | Uma pessoa **integralmente sintética** identificada como QA; sem PII real; ficou **inativa/arquivada** no fecho |
| Alterações de código | **Nenhuma.** Esta ramificação contém apenas este relatório de auditoria |

## Veredito executivo

> **Veredito: FAIL — não aprovar a aceitação de produção completa de Pessoas nesta ronda.**

O módulo demonstrou uma base funcional sólida em navegação, estados vazios, localização, persistência de preferências, criação controlada de uma Pessoa QA, localização aproximada, edição de Contactos sintéticos e ciclo de arquivo/restauro. A aplicação também falhou de forma fechada nas superfícies de relatório e lista de contactos quando a capability necessária não estava disponível. Estes resultados são positivos, mas não são suficientes para declarar a aceitação total.

Há um **bloqueador P1** no arquivo: abrir Arquivo/A não publicar a partir do perfil de uma pessoa não preseleciona essa pessoa; em vez disso, o seletor inicia noutra pessoa ativa. Numa ação destrutiva, este comportamento cria um risco objetivo de arquivamento do registo errado. Além disso, o SHA de produção não foi exposto e não foi possível provar alinhamento exato do deploy, requisito expresso para a aceitação real em produção. Os cenários de importação Hourglass/rollback, permissões reduzidas, exportações autorizadas, transferências E2E, responsividade e acessibilidade completa ficaram bloqueados ou não testados, e são reportados como tal em vez de inferidos a partir de código ou CI. [1]

| Severidade | Quantidade | Efeito no veredito |
| --- | ---: | --- |
| P0 | 0 | Não observado |
| P1 | 1 | **Bloqueia aprovação** |
| P2 | 3 | Deve ser corrigido antes da próxima ronda de aceitação |
| P3 | 1 | Melhoria de usabilidade recomendada |
| Bloqueado / não testado | 16 áreas ou subcenários | Impede cobertura completa; não deve ser contado como PASS |

## Âmbito, método e proteção de dados

A auditoria foi conduzida pela interface de produção canónica, com uma sessão autenticada. Começou por percursos de leitura, estados de carregamento, recuperação, permissões, idioma, tema e inspeção limitada de armazenamento. Quando foi explicitamente autorizado o uso de dados descartáveis, foi criado um único registo QA inteiramente sintético. O registo serviu para testar criação, elegibilidade, ausência futura, edição de Contactos, criação/persistência/remoção de uma localização aproximada e arquivo/restauro. No fim, a localização foi removida e a pessoa QA foi arquivada/inativada.

Não foram usados nem reproduzidos no relatório nomes, contactos, identificadores internos, moradas, tokens, tenant, actor, capacidades, payloads ou screenshots que pudessem expor dados de produção. A única referência a dados de teste é genérica. A auditoria respeitou o princípio de que alterações destrutivas exigem fixture descartável e plano de limpeza. [1]

A cobertura foi deliberadamente independente da análise de código. Documentação e repositório foram usados apenas para definir os contratos, limites e critérios de aceitação; uma observação em produção foi marcada PASS somente quando o comportamento foi observado no ambiente autenticado. A ausência de evidência foi registada como **BLOCKED** ou **NOT TESTED**, não como êxito.

## Estado da produção e evidência operacional

A sessão autenticada mostrou o Início com dados de produção ligados, três pessoas ativas antes da criação QA, e a navegação para Pessoas. A produção apresentou os estados de carregamento “A verificar sessão…” e “A carregar área…”, recuperando depois para os conteúdos autorizados; a recuperação após refresh funcionou, embora com espera transitória. A consola consultada no final da auditoria não devolveu mensagens recentes. Esta observação não substitui monitorização de produção nem uma recolha de telemetria de rede.

O SHA atual de `main` foi registado para reprodutibilidade, mas a página de produção não expôs revisão, build ID ou metadados de deployment que permitissem provar a correspondência exata. Como a checklist de aceitação exige evidência do SHA/asset de produção antes de alegar aceitação, esta lacuna é um **gate de aceitação falhado**, não uma suposição de que a produção corresponde ao repositório. [1]

| Controlo | Resultado | Evidência sanitizada | Limite |
| --- | --- | --- | --- |
| Sessão autenticada | PASS | Início e superfícies Pessoas acessíveis | Não prova todas as capabilities |
| Recuperação após refresh | PASS | Sessão, rota e Diretório recuperaram após estado transitório | Não foi medida latência nem testada rede degradada |
| SHA de deploy | BLOCKED | SHA do repositório registado; deploy não o expõe | Não alegar alinhamento de produção |
| Consola do browser | PASS parcial | Sem output recente no momento final | Não substitui logs de servidor/RUM |
| Dados QA | PASS | Um único registo sintético, usado e arquivado | Permanece arquivado até eliminação administrativa futura |

## Matriz de cobertura funcional

A matriz distingue **PASS** de evidência suficiente para o cenário observado, **PARTIAL** de evidência incompleta, **BLOCKED** de cenário impedido por permissões/ambiente/automação e **NOT TESTED** de cenário não exercitado.

| Área e cenário | Estado | Resultado observado | Lacuna ou condição |
| --- | --- | --- | --- |
| Navegação Início → Pessoas | PASS | Rota, item ativo e Visão geral confirmados | Sem cobertura mobile/tablet |
| Visão geral e estados vazios | PASS | Métricas agregadas e mensagens de ausência claras | Sem condição de atenção real/controlada |
| Diretório — carregamento e tabela | PASS | Esqueleto recuperou para tabela e ações | Conteúdo real não foi copiado para evidência |
| Diretório — pesquisa sem resultados e limpar | PASS | Estado vazio claro e recuperação; consulta não apareceu na URL | Sem combinações completas de filtros |
| Diretório — filtros avançados | PARTIAL | Etiqueta, elegibilidade e responsabilidade são descobríveis | Sem aplicação/URL/reset de cada combinação |
| Perfil unificado | PARTIAL | Sete separadores e informação capability-aware observados | Conteúdo rico e permissões negativas não cobertos |
| Contactos de emergência | PASS parcial | Indisponibilidade por permissão foi clara | Criação/edição/exportação autorizada não testadas |
| Participação/elegibilidade — leitura | PASS | Decisão explícita, factual e não inferida | Nem todos os tipos/estados cobertos |
| Participação/elegibilidade — escrita QA | PASS parcial | Uma decisão QA configurada e apresentada no Diretório | Não houve edição/correção/remoção subsequente |
| Disponibilidade — leitura | PASS | Estado vazio e ausência futura QA claros | Não foram testadas correção e remoção canónicas |
| Designações | PARTIAL | Estado vazio e explicação foram claros | Sem dados para filtros, conflitos, alternativas e histórico |
| Organização | PARTIAL | Estado vazio claro para dados autorizados | Sem agregados, grupos ou responsabilidades configurados |
| Assistente Adicionar pessoa — vazio/cancelar | PASS | Nome vazio foi bloqueado; Cancelar não criou recurso | Ver PEOPLE-QA-003 sobre rotulagem |
| Assistente Adicionar pessoa — criação QA | PASS | Criação única, sucesso e persistência no Diretório | Sem teste de rede interrompida/controlada |
| Contactos gerais QA — editar/guardar | PASS parcial | Guardar retornou ao modo leitura sem dupla submissão | Valor exato não foi revalidado por refresh independente |
| Mapa — estado vazio e seleção explícita | PASS | Não houve pessoa/morada pré-preenchida; dados de Contactos não foram reutilizados | Só uma capability/session observada |
| Mapa — pesquisa explícita | PASS | Pedido apenas depois de Pesquisar; URL sem consulta | Corpo de pedido externo não foi inspecionado |
| Mapa — criar, refresh e remover ponto QA | PASS | Ponto aproximado persistiu após refresh e foi removido | Não foram testadas falhas de fornecedor/rede |
| Mapa — privacidade de armazenamento | PASS parcial | Chave de preferências sem campos People/Contact; sessionStorage vazio observado antes | Não é prova completa de todos os corpos/cache/SW |
| Arquivo QA — confirmação e persistência | PASS com ressalvas | Confirmação dupla, transição para Inativo e histórico | Ver PEOPLE-QA-004 e PEOPLE-QA-005 |
| Restauro QA — explícito e persistente | PASS com ressalvas | Confirmação dupla, histórico e estado Ativo após reidratação | Perfil ficou localmente desatualizado antes de navegar |
| Limpeza QA | PASS parcial | Localização removida; único perfil QA ficou Inativo | Não há eliminação definitiva na superfície testada |
| Lembretes — estado vazio | PASS | Zero pendências e fecho seguro | Envio, falha e repetição não testados |
| Cartões/relatórios sem permissão | PASS | Negação explícita; sem PDF/impressão/dados parciais | Geração autorizada não testada |
| Lista de contactos sem permissão | PASS | Negação explícita; sem contactos ou CSV | Fluxo autorizado não testado |
| Transferências — abertura/erro/retry | PARTIAL | Separadores Send/Receive e retry observados | Fluxo não carregou; sem outra sessão/tenant QA |
| Hourglass — inspetor | PASS parcial | Aviso de privacidade e passo de origem observados | Upload bloqueado por automação do campo oculto |
| Hourglass — preview/prepare/execute/rollback | BLOCKED | Nenhuma importação foi executada | Fixture QA não pôde ser anexada; sem validar rollback |
| Idiomas pt-PT, en e es | PASS parcial | Início, Visão geral e Diretório principais traduzidos | Nem todos os diálogos/erros/fluxos em cada idioma |
| Tema Dark e restauro Sistema | PASS parcial | Legibilidade observada em Início e Visão geral Pessoas | Sem teste de mudança do tema do SO ou todos os componentes |
| Navegação por teclado/leitor de ecrã | NOT TESTED | Papéis ARIA visíveis em menus/tabs/botões | Escape não foi validado por falta de foco verificável |
| Responsividade | NOT TESTED | — | Apenas viewport desktop disponível nesta ronda |
| Permissões reduzidas | BLOCKED | Superfícies com capability ausente falharam fechadas | Não existia segunda conta reduzida controlada |

## Achados de produto e UX

### PEOPLE-QA-004 — Arquivo preseleciona uma pessoa diferente da que está aberta

| Campo | Conteúdo |
| --- | --- |
| Severidade | **P1 — bloqueador** |
| Área | Pessoas → Perfil → Ferramentas → Arquivo/A não publicar |
| Observado em | Pessoa QA ativa e novamente durante a limpeza final |
| Resultado atual | O diálogo abre com outra pessoa ativa preselecionada, embora tenha sido iniciado no perfil QA |
| Impacto | O utilizador pode arquivar o registo errado numa ação com efeito de ciclo de vida |
| Recomendação | Pré-selecionar pelo `personId` do perfil de origem; se isso não for possível, iniciar sem seleção. Na confirmação, repetir nome e identificador minimamente mascarado do alvo e bloquear a ação se o contexto mudar. |

O fluxo tem confirmação dupla, uma boa salvaguarda, mas a proteção é enfraquecida porque o alvo inicial já está errado. A confirmação deve reduzir enganos, não compensar uma seleção inadequada. Este achado bloqueia a aceitação enquanto persistir.

### PEOPLE-QA-005 — Estado do perfil permanece desatualizado após restauro

| Campo | Conteúdo |
| --- | --- |
| Severidade | **P2** |
| Área | Restauro de Arquivo/A não publicar |
| Resultado atual | Após “Estado de arquivo atualizado”, o diálogo indicou estado ativo e histórico atualizado; ao fechá-lo, o perfil subjacente ainda mostrava Inativo |
| Recuperação observada | Navegar ao Diretório e reabrir o perfil reidratou o estado correto |
| Impacto | Incentiva repetição desnecessária ou confiança num estado visivelmente incorreto |
| Recomendação | Invalidar/refrescar a query do perfil no sucesso de restauro e manter feedback de atualização até à reidratação. |

### PEOPLE-QA-003 — Campo obrigatório Nome está rotulado como opcional

| Campo | Conteúdo |
| --- | --- |
| Severidade | **P2** |
| Área | Assistente Adicionar pessoa — Identidade |
| Resultado atual | O texto diz que o nome é o único campo obrigatório, mas a etiqueta mostra “Nome (opcional)” |
| Contraprova | Avançar vazio apresenta corretamente erro “O nome é exigido pelo contrato de pessoa.” |
| Impacto | Contradição entre instrução, rótulo e validação; reduz confiança e pode causar tentativa desnecessária |
| Recomendação | Remover “(opcional)”, indicar obrigatório de modo consistente e expor essa regra à tecnologia assistiva. |

### PEOPLE-QA-002 — Erro de Transferências não corresponde ao contexto

| Campo | Conteúdo |
| --- | --- |
| Severidade | **P2** |
| Área | Ferramentas → Transferências |
| Resultado atual | Ao apenas carregar a superfície, a mensagem diz que a transferência não pôde ser “loaded or completed” |
| Impacto | Funde falha de leitura com falha de conclusão de uma operação que não foi iniciada |
| Recomendação | Diferenciar mensagens por operação, por exemplo “Não foi possível carregar transferências”; manter Try again e, quando apropriado, um código de correlação seguro. |

### PEOPLE-QA-001 — Resultados de geocodificação duplicados e indistinguíveis

| Campo | Conteúdo |
| --- | --- |
| Severidade | **P3** |
| Área | Mapa → pesquisa de localização |
| Resultado atual | A pesquisa por localidade mostrou entradas visualmente repetidas para o mesmo rótulo |
| Impacto | Introduz ruído numa decisão que deve ser deliberada e aproximada |
| Recomendação | Deduplicar por etiqueta/proximidade ou acrescentar desambiguador humano, como freguesia, mantendo dados do fornecedor fora de armazenamento persistente. |

## UX: prioridades de melhoria

A UI já separa com eficácia o resumo operacional, o Diretório, o perfil por separadores e o Mapa. A melhoria com maior retorno é tornar as ações de impacto **contextuais, confirmáveis e autoexplicativas**. Em Arquivo/A não publicar, o alvo deve nascer do contexto e aparecer de forma proeminente; uma confirmação não deve ser a primeira ocasião em que o utilizador percebe a quem a ação será aplicada.

No assistente de criação, os requisitos devem ser verdadeiros em todos os pontos: texto introdutório, etiqueta, semântica e erro. Isto reduz fricção e torna o percurso mais fácil de aprender sem acrescentar campos ou densidade. No Mapa, resultados únicos e uma indicação clara da precisão aproximada reforçariam a promessa de controlo, privacidade e decisão manual.

Por fim, mensagens de erro devem ser específicas da operação em curso e mostrar sempre uma recuperação proporcionada. A implementação atual de Transferências já oferece Retry; falta-lhe a precisão de linguagem para o utilizador saber se deve tentar novamente, verificar permissões ou procurar o estado de uma operação anterior.

## Privacidade, segurança e autoridade

A auditoria observou vários sinais positivos: consultas de pesquisa não apareceram nas URLs; o Mapa requereu seleção explícita da pessoa e pesquisa explícita da localidade; o editor declarou não copiar automaticamente a morada de Contactos nem usar geolocalização do dispositivo; e a visualização do ponto guardado era arredondada. A chave de preferências observada continha apenas configurações de apresentação, sem campos associados a Pessoas, Contactos, email, telefone, morada, Mapa ou localização. Estes controlos estão alinhados com o contrato de privacidade do Mapa. [3]

Contudo, esta é evidência **parcial**, não uma certificação completa. A auditoria não inspecionou todos os corpos de pedido/resposta, conteúdo de Cache Storage, service worker, logs de servidor ou tráfego de fornecedores. Também não foi possível usar uma conta reduzida para provar as negativas 401/403 das APIs com autoridade derivada do servidor. As negações observadas na UI de relatórios e lista de contactos são favoráveis, mas não substituem esses testes.

A superfície Hourglass apresentou o aviso correto de não publicar ficheiros sensíveis em tickets, screenshots ou commits e comunicou que o payload fica apenas na sessão até confirmação. O seu contrato exige preview, preparação no servidor, confirmação explícita e rollback create-only; nenhuma destas etapas de escrita foi afirmada como testada porque a fixture QA não pôde ser anexada ao campo de ficheiro oculto pela automação. [2]

## Cenários bloqueados e não testados: como fechar

| Prioridade | Cenário pendente | Pré-condição mínima | Evidência esperada para fechar |
| --- | --- | --- | --- |
| P1 | Prova de SHA de produção | Expor build SHA/ID no ambiente ou registo de deploy verificável | SHA/asset de produção coincide com a base auditada |
| P1 | Correção PEOPLE-QA-004 | Build com alvo contextual ou seleção vazia | Arquivo de perfil QA pré-seleciona o QA; confirmação repete o alvo |
| P2 | Hourglass completo | Campo de upload automatizável ou sessão humana; fixture sanitizada aprovada | Preview → prepare → confirm → execute → refresh → rollback, sem duplicação nem PII |
| P2 | Permissões reduzidas | Segunda conta QA com capabilities inferiores | UI e APIs falham fechadas com 401/403 quando aplicável |
| P2 | Transferências E2E | Segundo tenant/sessão e dados QA descartáveis | Send/Receive, expiração, repetição segura e histórico, sem dados reais |
| P2 | Relatórios/lista de contactos autorizados | Capability de relatório controlada e apenas Contactos QA | Preview, impressão/PDF/CSV, autorização e proteção de PII |
| P2 | Criar/editar disponibilidade completa | Pessoa QA ativa descartável | Corrigir/remover ausência, back/forward/cancelar e proteção de alterações não guardadas |
| P2 | Contactos QA após refresh | Pessoa QA ativa descartável | Valor editado confirmado depois de refresh independente |
| P3 | Responsividade | Viewports telefone/tablet/desktop definidos | Sem scroll horizontal indevido; ações/contexto preservados |
| P3 | Acessibilidade completa | Percurso manual por teclado e leitor de ecrã | Foco, Escape, modais, diálogo, tabela, erro e anúncio de estados verificados |

## Plano de correção e reaceitação

A ordem recomendada é corrigir primeiro o alvo predefinido de Arquivo, porque é o único achado P1 e envolve uma mutação de ciclo de vida. A correção deve receber um teste de browser que abre Arquivo a partir do perfil A e prova que o seletor contém A, seguido de teste que o diálogo sem contexto obriga a seleção explícita. Depois deve ser corrigida a invalidação/refetch pós-restauro e a rotulagem obrigatória do assistente.

Em paralelo, o ambiente de produção deve passar a expor uma referência de build verificável para a conta de auditoria, sem revelar segredos. Para a ronda seguinte, criar duas contas QA com capabilities distintas e manter uma fixture Hourglass sanitizada disponível através de um controlo de upload que possa ser operado pela ferramenta de auditoria ou por uma sessão humana. A checklist real de produção deve ser reexecutada de ponta a ponta; CI, previews e inspeção de fonte não substituem essa aceitação. [1]

> **Condição para alterar o veredito para PASS:** eliminar o P1, provar o SHA do deploy, repetir o ciclo de arquivo/restauro sobre QA, e fechar os cenários críticos de importação/rollback e permissões com evidência de produção. Os restantes cenários podem ser mantidos como exceções explicitamente aprovadas apenas se existir uma decisão humana documentada.

## Referências

[1]: PEOPLE_REAL_USER_PRODUCTION_E2E_PENDING.md "Checklist de aceitação real em produção para Pessoas"
[2]: HOURGLASS_IMPORT_RECOVERY_BOUNDARY.md "Limites, autoridade e rollback da importação Hourglass"
[3]: PEOPLE_MAP_CONTRACT.md "Contrato de privacidade e autoridade do Mapa"
[4]: PEOPLE_PRODUCT_EXPERIENCE_CURRENT_STATUS.md "Estado atual do produto Pessoas"

---

**Autoria:** Manus AI  
**Âmbito da alteração:** documentação de auditoria; sem alterações de produto; sem screenshots, logs com PII, fixtures ou segredos incluídos.
