# M50 Final V1 Acceptance

## Baseline

| Campo | Valor |
|---|---|
| Main auditada | `3365a45158924242391addf916732d54d2477522` |
| Integrações confirmadas | PR [#167](https://github.com/bfrpaulondev/eutaktos/pull/167), PR [#180](https://github.com/bfrpaulondev/eutaktos/pull/180) e PR [#181](https://github.com/bfrpaulondev/eutaktos/pull/181) estão merged e são ancestrais de `origin/main`. |
| Deployment testado | `https://eutaktos.vercel.app/` |
| Data/hora da observação | 2026-08-22, aproximadamente 19:18–19:19 GMT+1 |
| Browser | Chromium headless e Chromium Sandbox |
| Viewports | Evidência integrada: 320×800, 375×812, 390×844, 768×1024, 1024×768 e 1440×900; dispositivos físicos não foram usados. |
| Dados | Apenas leitura. Não foram criadas, editadas, eliminadas ou submetidas pessoas, grants, reuniões, designações ou ficheiros reais. |

> Esta auditoria valida a `main` integrada localmente e o deployment público tal como observado. Build verde não foi usado como evidência de fluxo E2E.

## Executive result

**V1 NOT ACCEPTED**.

| Estado | Quantidade |
|---|---:|
| PASS | 8 |
| FAIL | 6 |
| BLOCKED | 15 |
| NOT TESTED | 7 |

O veredicto resulta de dois defeitos críticos observáveis sem autenticação: o deployment público não corresponde à baseline integrada e expõe conteúdo demonstrativo, e tanto `/api/health` como `/api/ready` devolvem `index.html` com `200 text/html` em vez de respostas de runtime. Consequentemente, a cadeia real de dados necessária à operação piloto não é verificável nesse deployment.

## Critical failures

| ID | Estado | Defeito | Evidência reproduzível | Impacto |
|---|---|---|---|---|
| CF-01 | FAIL | Deployment não corresponde à main A06 auditada. | Abrir `https://eutaktos.vercel.app/`; o conteúdo é de preview/demo. A `main` auditada contém A06 no commit `87bf63c`, ancestral de `3365a45`. | Impede aceitar o deployment como V1 integrado. |
| CF-02 | FAIL | Dados demonstrativos estão expostos como produto. | A página pública mostra `Datos de ejemplo`/`Sample data`, contagens `2/1/3`, nomes `Carlos`, `André`, `Bruno`, e métricas `92%`/`75%`. | Viola a exigência de não apresentar dados fictícios como reais. |
| CF-03 | FAIL | Endpoints públicos de saúde/readiness não são atendidos pela API. | `curl -i https://eutaktos.vercel.app/api/health` e `/api/ready`: ambos `HTTP/2 200`, `content-type: text/html`, `content-disposition: inline; filename="index.html"`, corpo HTML da SPA. | Runtime/API não pode ser aceite nem monitorizado no deployment testado. |
| CF-04 | FAIL | Gate automatizado de UX runtime falha na baseline integrada. | `npm run test:ux-runtime --workspace @eutaktos/web-pwa` termina com timeout em `/pessoas` pt-PT. | Regressão automatizada bloqueia confiança integral em deep links/i18n. |
| CF-05 | FAIL | Gate de regressão browser falha porque depende do UX runtime. | `npm run test:browser-regression --workspace @eutaktos/web-pwa` falha ao propagar o erro de `test:ux-runtime`. | A suite final de browser não está verde. |
| CF-06 | FAIL | Agenda e Designações públicas não podem provar dados reais da API integrada. | O deployment observado apresenta preview/demo; os endpoints de runtime devolvem HTML, não JSON. | Fluxo mínimo de scheduling não pode ser aceite E2E. |

## Functional matrix

| Área | Cenário | Estado | Evidência | Observação |
|---|---|---|---|---|
| Baseline | PRs #167/#180/#181 integrados | PASS | `git merge-base --is-ancestor` confirmou os três commits em `3365a45`. | Baseline local correcta. |
| Aplicação local | Typecheck e suite integrada | PASS | `npm run typecheck` e `npm test` passaram durante M50. | Evidência local, não E2E. |
| PWA local | Build de produção | PASS | Vite gerou `index` de 475 700 bytes e chunk lazy `SectionWorkspace` de 186 249 bytes. | Sem warning de threshold ocultado. |
| PWA local | Montagem de produção | PASS | `test:production-mount` passou com manifesto, ícones e salvaguardas do worker. | Ambiente local. |
| People local | Deep link e erro seguro | PASS | Observação read-only em `/pessoas`: título `Eutaktos — Pessoas`, `Pessoas e organização`, erro localizado com retry, sem dados pessoais. | Não prova leitura/escrita real. |
| People | List/create/edit/persistência/dupla submissão | BLOCKED | Não foi disponibilizada sessão/tenant piloto de teste e o deployment não fornece API runtime. | Não foram feitas mutações. |
| Organização | Households, grupos e responsabilidades E2E | BLOCKED | Mesma ausência de API funcional/tenant piloto no deployment. | Frontend local mostra estados seguros, não prova persistência. |
| Acessos e auditoria | Grants reais, concessão/revogação e audit | BLOCKED | Não há API pública observável nem sessão autorizada de teste. | Não se tentou contornar autorização. |
| Agenda/Designações | Dados reais após refresh | FAIL | Deployment exibe preview/demo; health/ready devolvem fallback HTML. | Não há prova de dados reais da API. |
| Scheduling | Fluxo Midweek completo | BLOCKED | Requer tenant piloto e runtime/API funcional; deployment não o expõe. | Sem criação de reunião ou designações. |
| Scheduling | Eligibility, indisponibilidade e conflitos | BLOCKED | Requer dados de teste reais e API operacional. | Não foi inventado endpoint nem mock. |
| Scheduling | Timezone Europe/Lisbon E2E | BLOCKED | Depende de criação/persistência de reunião no runtime ausente. | Não se inferiu resultado por testes unitários. |
| Tenant | Isolamento entre tenants E2E | BLOCKED | Nenhum tenant de teste autorizado foi fornecido; não se acederam dados de terceiros. | Testes adversariais locais não são E2E. |
| Publisher response | UI de confirmação/recusa | BLOCKED | Não foi observada UI autenticada consumível no deployment. | Boundary ausente na evidência M50. |
| Notificações | Entrega externa | BLOCKED | Não há provider externo comprovado no deployment. | Intenção `pending` não foi tratada como entrega. |
| Importação | Hourglass sanitizado | PASS | `test:hourglass-inspector` passou com fixture sanitizada. | Sem importação/persistência automática. |

## Security / privacy

| Área | Cenário | Estado | Evidência | Observação |
|---|---|---|---|---|
| PWA | Storage do browser | PASS | `test:pwa-privacy` passou: armazenamento limitado a preferências. | Não foram encontrados contactos/perfis/auditoria/ficheiros Hourglass no contrato verificado. |
| PWA | Cache de API/autorização | PASS | `test:pwa-privacy` passou: worker exclui API, auth, autorização, query e respostas privadas/no-store. | Evidência local estática e de build. |
| Runtime | Sessão/capabilities/CSRF reais | BLOCKED | Endpoints públicos devolvem HTML; não há runtime API para testar recusa sem sessão ou mutação sem capability. | Nenhum secret foi procurado/exposto. |
| Runtime | Erros seguros de Pessoas | PASS | Em local, erro de leitura foi localizado, com retry e sem stack/token/ID interno. | Não prova todos os endpoints. |
| Produção | Ausência de demo/PII | FAIL | Demo observável no deployment; não foram observados PII reais. | Falha é conteúdo demonstrativo, não exposição de pessoa real. |

## Responsive / accessibility

| Área | Cenário | Estado | Evidência | Observação |
|---|---|---|---|---|
| Reflow | 320, 375, 390, 768, 1024 e 1440 | PASS | Matriz integrada M35 documenta PASS visual não destrutivo nesses seis viewports. | Não prova fluxos com dados da API. |
| Mobile físico | Android, iPhone e iPad | NOT TESTED | Não havia dispositivos físicos/emulação dedicada. | Inclui rotação e teclado virtual. |
| Diálogos reais em 320px | Formulários completos com API | NOT TESTED | Requer fluxo runtime operacional. | CSS foi previamente verificado, não os dados reais. |
| Acessibilidade | Skip link, main, nav, `aria-current`, foco inicial e reflow 320 | PASS | O verificador UX executou essas asserções antes da falha tardia de deep link. | Não declara WCAG 2.2 AA. |
| Acessibilidade | Percurso completo de diálogos e i18n | FAIL | `test:ux-runtime` falhou no deep link pt-PT de Pessoas. | O erro automático precisa de correcção/revalidação antes de aceitar o gate. |
| Zoom 200% | Reflow e leitura | NOT TESTED | Não executado nesta sessão. | — |

## i18n

| Cenário | Estado | Evidência | Observação |
|---|---|---|---|
| Chrome de produção em espanhol e inglês | PASS | Preferência local mostrou strings traduzidas nos dois idiomas. | A mesma página permanece demo/stale. |
| Fluxos principais pt-PT/en/es na baseline local | FAIL | Gate `test:ux-runtime` falhou em Pessoas pt-PT. | Não se afirma cobertura completa. |
| Expansão textual e todos os diálogos | NOT TESTED | O gate completo não terminou e faltam dados/runtime para diálogos de operação. | — |
| Datas/horas reais por locale/timezone | BLOCKED | Scheduling E2E não foi possível no deployment. | — |

## Performance

| Gate | Estado | Métrica/evidência |
|---|---|---|
| Production build | PASS | `index`: 475 700 bytes (gzip 148 700); `SectionWorkspace` lazy: 186 249 bytes (gzip 44 360). |
| Bundle budget | PASS | `test:bundle-budget` passou; chunk inicial abaixo do orçamento de 500 kB. |
| PWA privacy | PASS | `test:pwa-privacy` passou. |
| Production mount | PASS | `test:production-mount` passou. |
| UX runtime | FAIL | Timeout no deep link `/pessoas` pt-PT. |
| Browser regression | FAIL | Falha herdada de UX runtime. |

## Production/runtime

| Endpoint/fluxo | Estado | Resultado observado |
|---|---|---|
| `/` | FAIL | SPA antiga de preview/demo, não baseline A06. |
| `/agenda`, `/designacoes`, `/pessoas`, `/preferencias` após refresh | FAIL | Não foram aceites como rotas da baseline porque o deployment servido é build antigo/demo. |
| `/api/health` | FAIL | 200 HTML `index.html`; não resposta de health API. |
| `/api/ready` | FAIL | 200 HTML `index.html`; não resposta de readiness API. |
| Erros sem detalhes internos | PASS | Erro local de Pessoas é seguro/localizado; endpoints públicos não expuseram stack no corpo observado. |

## Scheduling E2E

| Passo | Estado | Resultado real |
|---|---|---|
| Criar/alterar reunião, slots e designações | BLOCKED | Não executado: deployment não expõe API runtime e não foi fornecido tenant piloto. |
| Ajudante, substituição e cancelamento | BLOCKED | Não executado pelos mesmos limites. |
| Rejeitar eligibility, indisponibilidade e conflitos | BLOCKED | Não executado pelos mesmos limites. |
| Publicar, cancelar/arquivar e persistir após refresh | BLOCKED | Não executado pelos mesmos limites. |
| Agenda/Designações com dados reais | FAIL | Deployment mostra preview/demo em vez de prova de dados da API. |

## Remaining blockers

| Bloqueio comprovado | Consequência necessária para reauditoria |
|---|---|
| Deployment público stale e com demo | Publicar a baseline que contém A06 e remover qualquer build demo do destino público. |
| `/api/health` e `/api/ready` devolvem fallback SPA | Configurar/verificar o adapter runtime/API no host público e reexecutar health/ready. |
| Não existe tenant piloto/sessão de testes autorizada nesta auditoria | Fornecer ambiente/conta de teste isolado para E2E não destrutivo de pessoas, organização, grants e scheduling. |
| Gate UX runtime falha | Corrigir ou actualizar a asserção somente com evidência de comportamento desejado e reexecutar a suite browser. |
| Provider de notificações não comprovado | Manter entrega externa BLOCKED até existir provider configurado e observável. |

## Final verdict

**V1 NOT ACCEPTED**.

A aceitação deve ser repetida após o deployment público ser alinhado à main A06, os endpoints de runtime devolverem respostas API reais, o gate de UX browser ficar verde e existir um tenant piloto isolado para confirmar a cadeia funcional de scheduling e organização sem dados fictícios.
