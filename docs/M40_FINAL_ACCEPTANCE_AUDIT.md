# M40 — Auditoria final de aceitação V1

**Autor:** Manus AI

**Data da execução:** 22 de agosto de 2026

**Base auditada:** `origin/main` em `25e59aa019abbb025c9f24b46a0628031fb55f16` e [deployment publicado](https://eutaktos.vercel.app/).

**Escopo:** PWA e interface. Esta auditoria não altera API, backend, domínio, alojamento, CI ou dados de utilizadores.

> **Regra de interpretação.** O repositório descreve um produto faseado: a shell PWA, a localização e os componentes de organização estão presentes, enquanto scheduling completo, importação confirmada, operações de campo e vários fluxos de dados permanecem em fases posteriores. [1] [2] [3] [4] Por isso, apenas comportamentos que o código e a interface já expõem como actuais são avaliados como capacidades activas. Ausência de uma capacidade pertencente ao roadmap não é registada como **FAIL**.

## Método e vocabulário de estado

Foram corridos typecheck, 106 testes Vitest, build Vite, montagem do build de produção e a verificação runtime de PWA. A observação no deployment limitou-se a navegação e leitura; não foram criados perfis, grupos, permissões, designações, imports ou dados pessoais. O browser usado foi Chromium no ambiente sandbox, com viewport de 870 × 768 px na produção. A verificação local de reflow usada pelo runtime foi 320 px.

| Estado | Significado aplicado nesta auditoria |
|---|---|
| **PASS** | A capacidade foi demonstrada por teste automatizado aprovado ou observação directa do deployment. |
| **FAIL** | A capacidade actual não cumpre o comportamento esperado e existe uma reprodução directa atribuível à PWA. |
| **BLOCKED** | A interface chegou ao fluxo correcto, mas a confirmação depende de serviço, dados autorizados, permissões ou deployment indisponível. |
| **NOT TESTED** | Não existia ambiente, contrato ou dispositivo adequado para provar a capacidade sem fazer uma alegação não sustentada. |

Nenhum resultado recebeu **FAIL**. As leituras de organização que falham em produção são classificadas **BLOCKED**, pois a PWA expõe um estado seguro, localizado e repetível, enquanto a obtenção de dados depende do runtime/API publicado. O bloqueio não é uma alegação de êxito funcional: significa que o percurso real de dados não pôde ser aceite.

## Matriz de capacidades esperadas agora

| Funcionalidade que já deveria funcionar hoje | Estado | Evidência | Problema associado |
|---|---|---|---|
| Carregamento da PWA e shell principal | **PASS** | `npm run build` e `npm run test:production-mount --workspace @eutaktos/web-pwa` aprovaram; a produção renderizou a shell Eutaktos. | Nenhum observado. O Vite mantém o aviso preexistente de bundle acima de 500 kB; não é falha de aceitação. |
| Navegação principal de desktop e rota Pessoas | **PASS** | A produção apresentou Início, Agenda, Designações, Pessoas e Preferências; a navegação para `/pessoas` abriu o contexto de organização. `test:ux-runtime` aprovou navegação mobile e reflow de 320 px. | Nenhum observado na navegação de shell. |
| Localização pt-PT, English e Español | **PASS** | `npm run test:ux-runtime --workspace @eutaktos/web-pwa` aprovou explicitamente pt-PT/en/es. A produção apresentou strings espanholas consistentes no contexto observado. | Nenhum observado nos caminhos verificados. |
| Preferências de modo escuro e contraste elevado | **PASS** | `test:ux-runtime` aprovou os estados dark/high contrast; `src/lib/preferences.test.ts` e `src/theme.test.ts` fazem parte dos 106 testes aprovados. | Nenhum observado nos estados automatizados. |
| Seis paletas, três tamanhos, densidade, reduced motion e reduced transparency por interacção de utilizador | **NOT TESTED** | Os controlos estão expostos pela UI e têm testes de preferências/tema, mas não foi executada uma matriz manual exaustiva de cada combinação nesta aceitação. | Exige execução interactiva por combinação e, para reduced motion/transparency, verificação visual e de media queries. |
| Pessoas: apresentação de loading/erro/retry seguro | **PASS** | Na produção, `/pessoas` apresentou o erro localizado “No se pudieron cargar las personas. Inténtalo de nuevo.” e botão de repetição, sem stack trace, token, ID interno ou PII. | Nenhum problema de apresentação de erro. |
| Leitura de Pessoas em produção | **BLOCKED** | Reproduzir: abrir `https://eutaktos.vercel.app/pessoas`, aguardar a lista e premir “Intentar de nuevo”. O erro seguro permanece. Reproduzido na sessão de 22-08-2026. | A PWA não recebe os dados de pessoas no deployment actual; requer diagnóstico/correcção de backend, permissões ou configuração de deployment fora deste escopo. |
| Leitura de Grupos familiares e Grupos de serviço em produção | **BLOCKED** | Reproduzir: em `/pessoas`, abrir “Grupos familiares” e “Grupos de servicio”. Ambos mostram “No se pudieron cargar los grupos. Inténtalo de nuevo.” com retry. | A leitura depende de dados/API autorizados indisponíveis no deployment; a UI não inventa grupos nem disfarça o erro. |
| Leitura de Responsabilidades em produção | **BLOCKED** | Reproduzir: em `/pessoas`, abrir “Responsabilidades”. A região de dados mostra “No se pudieron cargar las responsabilidades. Inténtalo de nuevo.” | A leitura de responsabilidades não está disponível no runtime publicado. |
| Histórico de auditoria em produção | **BLOCKED** | Reproduzir: em `/pessoas`, abrir “Historial de auditoría”. O diálogo, filtros, retry e fechar aparecem; a carga mostra “No se pudo cargar el historial. Inténtalo de nuevo.” | A leitura de auditoria não está disponível no runtime publicado. O diálogo não revela eventos, actores ou detalhes internos quando falha. |
| Gestão de acessos em produção | **BLOCKED** | Reproduzir: em `/pessoas`, abrir “Gestionar accesos”. O diálogo explica a separação entre `people.read` e `access.manage` e mostra “No se pudo cargar la gestión de accesos. Inténtalo de nuevo.” | A leitura de acessos não está disponível no runtime publicado. Não foram realizadas concessões ou revogações durante a auditoria. |
| Criação de pessoa, contacto de emergência, ausências e elegibilidade | **BLOCKED** | Os pontos de entrada estão acessíveis no contexto Pessoas, mas não foi feita qualquer escrita porque a leitura inicial do perfil/lista está bloqueada em produção e a auditoria não deve submeter dados pessoais. | Requer backend disponível e um ambiente de teste autorizado com dados sanitizados. |
| Agenda e Designações com dados reais | **BLOCKED** | O deployment actual identifica explicitamente o conteúdo como pré-visualização/dados de exemplo. Não foi encontrado contrato de leitura de agenda/designações consumível pela PWA na base auditada. | Scheduling real pertence a um contrato backend ainda indisponível para a PWA; não se deve tratar conteúdo demonstrativo como produção. As PRs V1 M31 e M32 submetem estados factuais para esta dependência. |
| Dashboard com métricas reais | **BLOCKED** | A produção apresenta “Datos de ejemplo” e “Esta vista es una previsualización”. | Métricas e cobertura reais exigem leituras de scheduling/publicador ainda ausentes. A PR V1 M33 remove esse conteúdo demonstrativo na branch própria, mas não estava integrada na base auditada. |
| Inspector Hourglass: pré-visualização sanitizada local, erros e ausência de persistência | **NOT TESTED** | A entrada do inspector é acessível em produção, mas a base auditada não contém ainda o teste browser sanitizado de M38. O fluxo de confirmação/importação backend não existe na UI. | A PR V1 M38 contém prova local isolada com fixture sanitizada; ela deve ser integrada antes de ser aceite como cobertura da main. Não é aceitável usar exports reais nesta auditoria. |
| Metadados de instalação PWA, ícones e política de worker | **PASS** | O build e a montagem de produção local aprovaram. A suite inclui cinco testes de `pwaUpdate`. | A verificação reforçada de manifesto/ícones/worker pertence à PR V1 M39 e ainda não estava na main auditada. |
| Instalação Android, iPhone/iPad e PWA standalone persistente | **NOT TESTED** | Não havia Android, Safari iOS/iPadOS nem contexto instalado persistente disponível. | Requer matriz em dispositivos reais, incluindo “Adicionar ao ecrã principal”, áreas seguras, regressar à app e remoção. |
| Documento offline em browser controlado e recuperação após rede | **NOT TESTED** | O worker e a lógica de atualização têm testes locais, mas o ambiente headless não permitiu provar um cliente controlado durante a emulação de rede sem produzir uma evidência instável. | Requer execução em browser/dispositivo onde o worker esteja controlando uma PWA instalada ou uma sessão HTTPS persistente. A matriz M39 descreve o procedimento. |
| Atualização/recovery do service worker | **PASS** | `src/lib/pwaUpdate.test.ts` integra os 106 testes aprovados e cobre registo, atualização, activação e recuperação de erro. | A confirmação de UX numa PWA instalada continua **NOT TESTED** na linha de instalação física. |
| Reflow 320 px e navegação móvel | **PASS** | `test:ux-runtime` aprovou explicitamente “mobile navigation and 320px reflow”. | A matriz 375/390/768/1024/1440 e rotação física pertence à PR V1 M35, ainda não integrada nesta base. |
| Teclado, landmark principal e linguagem sem dados sensíveis nos erros observados | **PASS** | A shell expôs skip link e navegação; o runtime aprovou navegação/localização. Em todos os bloqueios de produção observados, as mensagens foram localizadas e seguras. | A auditoria manual completa com leitor de ecrã e contraste forçado permanece **NOT TESTED** sem tecnologia assistiva/ambiente de sistema apropriado. |

## Evidência de validação local

| Comando | Resultado |
|---|---|
| `npm run typecheck --workspace @eutaktos/web-pwa` | **PASS** |
| `npm test --workspace @eutaktos/web-pwa` | **PASS** — 25 ficheiros e 106 testes. |
| `npm run build --workspace @eutaktos/web-pwa` | **PASS** — com aviso preexistente do Vite sobre chunk acima de 500 kB. |
| `npm run test:production-mount --workspace @eutaktos/web-pwa` | **PASS** — build local de produção montado no Chromium. |
| `npm run test:ux-runtime --workspace @eutaktos/web-pwa` | **PASS** — pt-PT/en/es, dark/high contrast, navegação mobile e reflow 320 px. |

## Evidência de produção e reprodução dos bloqueios

A produção foi observada em `https://eutaktos.vercel.app/` a 22 de agosto de 2026. A shell montou e os módulos de organização foram alcançáveis através da UI. Ao tentar apenas leituras, Pessoas, Grupos familiares, Grupos de serviço, Responsabilidades, Histórico de auditoria e Gestão de acessos apresentaram erros localizados, com retry. A repetição em Pessoas foi tentada e conservou o mesmo estado. Não foram produzidas capturas adicionadas ao repositório, porque não são necessárias para reproduzir os erros e esta política evita qualquer risco de PII.

Os bloqueios são reproduzíveis seguindo os passos das linhas **BLOCKED** da matriz. O resultado esperado, depois de o runtime/API ser disponibilizado, é apresentar os dados autorizados ou um estado vazio adequado; o resultado actual é a mensagem de erro segura e a acção de repetir. A PWA já evita atribuir à pessoa utilizadora uma falsa confirmação de sucesso ou conteúdo inventado.

## Capacidades planeadas que não são falhas desta aceitação

O roadmap coloca scheduling completo, importação confirmada, PWA em dispositivos alvo, auditoria de acessibilidade completa, cache offline de classes de dados aprovadas e a preparação geral de produção em fases e gates posteriores. [1] [3] [4] A ausência destes resultados no deployment actual não é registada como **FAIL**, mas os seus pré-requisitos aparecem como **BLOCKED** ou **NOT TESTED** quando a UI já expõe uma dependência ou quando a prova exigiria ambiente externo.

## Referências

[1]: ../README.md "README — estado e fases do produto"
[2]: FEATURES.md "Feature Registry"
[3]: ROADMAP.md "Roadmap"
[4]: BACKLOG.md "Product Backlog — Epics"
