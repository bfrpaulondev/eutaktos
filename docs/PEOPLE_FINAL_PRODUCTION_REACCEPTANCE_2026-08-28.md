# People Final Production Reacceptance

## Environment

| Campo | Valor |
|---|---|
| Production URL | `https://eutakes.netlify.app/` |
| Expected main SHA | `df7f3941da184d9c8fcd3825745ddb778f9d0271` |
| Observed build revision | `df7f3941da184d9c8fcd3825745ddb778f9d0271` |
| Date/time | 2026-08-28, recolha funcional entre 08:37 e 14:08 UTC |
| Browser | Chrome cloud, controlo CDP; versão não exposta |
| OS | Linux 6.18.35 x86_64 |
| Viewports | Produção autenticada observada em 1363 × 936. A matriz obrigatória não ficou executada. |
| Locales | pt-PT, en, es |
| Themes | Light, Dark, System |
| Tester | Codex — QA independente de produção |
| Screen reader | Não disponível; não testado |
| Physical devices | Não testados |
| Limitations | Uma única sessão/tenant QA; ausência das capabilities de reports; sem tecnologia assistiva real; browser cloud sem emulação de viewport; cleanup destrutivo não autorizado na confirmação de ação. |

## Executive Verdict

**NOT READY FOR PRINCIPAL FINAL ACCEPTANCE**

Foram encontrados três P1: Transferências não carrega, Hourglass não executa a importação preparada e os contactos introduzidos no wizard Add Person não persistem. A matriz responsiva obrigatória e o leitor de ecrã real também não têm evidência suficiente.

## Original Audit Findings

| Finding | Status | Evidência |
|---|---|---|
| PEOPLE-QA-004 | FAIL | O alvo correto apareceu antes da confirmação, mas o arquivo/restauro real não foi executado porque a confirmação destrutiva não foi concedida. |
| PEOPLE-QA-005 | PASS | Após editar o nome, o diretório e o perfil recarregado apresentaram `QA Final 20260828 Revisto`. |
| PEOPLE-QA-003 | PASS | O wizard não avançou com o nome obrigatório vazio. |
| PEOPLE-QA-002 | FAIL | Os textos de load recovery estão corretos em pt-PT/en/es, mas Transferências falhou sempre no load e bloqueou a regressão preview error → retry → success. |
| PEOPLE-QA-001 | PASS | Após persistência de localização sintética, existia uma entrada, uma ocorrência do nome e um único marcador. |

## Functional Matrix

| Superfície | Estado | Notas |
|---|---|---|
| Overview | PASS | Métricas, atenção e assistência carregaram. |
| Directory | PASS | Pesquisa, filtros, tabela e ações observados. |
| Profile | PASS | Perfil autorizado e tabs carregaram; atualização deixou de ficar stale. |
| Contacts | FAIL | O editor dedicado persiste, mas telefone/e-mail/morada introduzidos em Add Person desapareceram após guardar. |
| Eligibility | PASS | Decisão explícita criada; texto não infere adequação. |
| Availability | BLOCKED | Criação e histórico de ausência passaram; remoção/cleanup não foi autorizada. |
| Assignments | PASS | Empty state autorizado e sem autoatribuição. |
| Organization | PASS | Empty state autorizado. |
| History | PASS | Criação e edições apareceram no histórico. |
| Add/Edit | FAIL | Nome obrigatório e edição passam; contactos do Add Person não persistem. |
| Recommendations | PASS | Linguagem explicativa, sem decisão ou atribuição automática. |
| Assistance | PASS | Avisos factuais e sem julgamento espiritual. |
| Labels | FAIL | A API/UI informou falha, mas a label apareceu persistida após navegação; estado ambíguo. |
| Reminders | PASS | Loading e empty state autoritativos; zero respostas pendentes. |
| Archive | BLOCKED | Alvo pré-confirmado correto; ação destrutiva não autorizada no momento da execução. |
| Restore | BLOCKED | Depende do arquivo real. |
| Transfers Send | FAIL | Load falha antes do fluxo. |
| Transfers Receive | FAIL | Load falha antes de preview/claim. |
| Hourglass | FAIL | Inspect, preview e prepare passam; execute falha no primeiro pedido e no replay idempotente. |
| Contact List | BLOCKED | Conta QA sem capability de reports; UI fechou acesso e desativou CSV. |
| CSV | BLOCKED | Depende da capability de Contact List. |
| Record Cards | BLOCKED | Preview recusado por falta de permission. |
| PDF | BLOCKED | Download permaneceu desativado. |
| Map | PASS | Um marcador/list item após persistência. |
| Map Search | PASS | Busca explícita por área sintética; aviso de Photon/OpenStreetMap visível. |
| Map Persistence | PASS | Localização aproximada persistiu após guardar. |
| Map Privacy | PASS | Contactos não foram copiados; geolocalização do dispositivo não foi usada; precisão foi reduzida na lista. |

## Device Matrix

| Viewport | Estado |
|---|---|
| 320 × 568 | NOT TESTED |
| 375 × 667 | NOT TESTED |
| 390 × 844 | NOT TESTED |
| 430 × 932 | NOT TESTED |
| 768 × 1024 | NOT TESTED |
| 1024 × 768 | NOT TESTED |
| 1280 × 800 | NOT TESTED |
| 1440 × 900 | NOT TESTED |

O browser autenticado expôs apenas 1363 × 936. O gate local `test:browser-regression` passou typecheck, 441 testes web, bundle budget e privacy, mas falhou em `test:production-mount` porque o Chromium local não abriu o build e não devolveu stderr. Isto não substitui a matriz real obrigatória.

## Theme Matrix

| Theme | Estado | Evidência |
|---|---|---|
| Light | PASS | `color-scheme: light` aplicado. |
| Dark | PASS | `color-scheme: dark` aplicado. |
| System | PASS | Resolveu para light no ambiente do browser. |

## Locale Matrix

| Locale | Estado | Evidência |
|---|---|---|
| pt-PT | PASS | Transfer load: `Não foi possível carregar as transferências` + `Tentar novamente`. |
| en | FAIL | Transfer recovery correto, mas a ação global `Sair` permaneceu em português. |
| es | FAIL | Transfer recovery correto, mas a ação global `Sair` permaneceu em português. |

## Keyboard

**FAIL**

No Home, o primeiro `Tab` focou `Sair` antes de `Saltar para o conteúdo principal`. Ativar o primeiro foco encerrou a sessão. A ordem não satisfaz o objetivo do skip link e o percurso completo obrigatório não foi concluído.

## Real Screen Reader

**NOT TESTED**

Não estava disponível NVDA, VoiceOver ou leitor equivalente. DOM/ARIA não foi usado para alegar PASS.

## Production Write Walkthrough

**FAIL**

Passaram: criação/edição da pessoa sintética, edição dedicada de contactos, elegibilidade, ausência, label efetivamente persistida, busca/persistência de mapa. Falharam: persistência de contactos no Add Person, resposta de label consistente, load de Transferências e execute Hourglass. Não houve escrita parcial Hourglass após reconciliação.

## Build Revision Evidence

Expected: `df7f3941da184d9c8fcd3825745ddb778f9d0271`  
Observed: `df7f3941da184d9c8fcd3825745ddb778f9d0271`  
MATCH: **YES**

O endpoint `/build-revision.json` devolveu HTTP 200 com a revisão esperada, e a `main` obtida do remoto apontava para o mesmo SHA.

## Findings

### PEOPLE-FINAL-P1-001

- **Severity:** P1
- **Surface:** Transfers
- **Viewport:** 1363 × 936
- **Locale:** pt-PT, en, es
- **Theme:** System
- **Steps:** People → Directory → Tools → Transfers; aguardar load; usar o CTA de recovery.
- **Expected:** estado autoritativo carrega e permite Send/Receive; recovery read-only resolve falha transitória.
- **Observed:** load falhou em todas as línguas e continuou a falhar após `Tentar novamente`/`Try again`/`Intentar de nuevo`.
- **Impact:** Send, Receive, preview retry, cancel e claim não podem ser exercitados em produção.
- **Recommended fix:** investigar o endpoint/permission/runtime de load antes de qualquer nova mutação; preservar as labels de recovery agora corretas.
- **Evidence:** mensagens específicas visíveis nas três línguas; nenhuma ação de mutação disponibilizada.

### PEOPLE-FINAL-P1-002

- **Severity:** P1
- **Surface:** Hourglass
- **Viewport:** 1363 × 936
- **Locale:** pt-PT
- **Theme:** System
- **Steps:** upload JSON sintético válido → inspect → compare → prepare → confirmar → execute → retry idempotente → confirmar novamente.
- **Expected:** uma pessoa nova é criada uma vez; refresh confirma recurso; rollback create-only remove-a.
- **Observed:** execute falhou duas vezes. A reconciliação do diretório encontrou zero resultados para a pessoa da fixture, confirmando ausência de escrita parcial.
- **Impact:** o ciclo de migração obrigatório não pode ser concluído; rollback não pode ser provado.
- **Recommended fix:** corrigir o boundary de execute em produção e manter o mesmo execution id/digest no replay.
- **Evidence:** preview `Novas 1 / Sem alteração 0 / Conflitos 0`; erro `Não foi possível concluir a importação`; zero pessoa após refresh.

### PEOPLE-FINAL-P1-003

- **Severity:** P1
- **Surface:** Add Person / Contacts
- **Viewport:** 1363 × 936
- **Locale:** pt-PT
- **Theme:** System
- **Steps:** Add Person → preencher nome, telefone, e-mail e morada sintéticos → concluir wizard → abrir Profile → Contacts; reabrir Edit.
- **Expected:** contactos introduzidos no wizard persistem e aparecem no perfil.
- **Observed:** Profile mostrou `Não existem contactos de perfil registados`; os campos de contacto no Edit estavam vazios. O editor dedicado de contactos persistiu os mesmos valores corretamente.
- **Impact:** perda silenciosa de dados introduzidos num fluxo principal.
- **Recommended fix:** incluir contactos no contrato de create ou remover esses campos do wizard até a escrita ser atómica e verificável.
- **Evidence:** valores presentes antes de avançar; ausência após criação; sucesso pelo editor dedicado.

### PEOPLE-FINAL-P2-001

- **Severity:** P2
- **Surface:** Labels
- **Viewport:** 1363 × 936
- **Locale:** pt-PT
- **Theme:** System
- **Steps:** editar labels → adicionar `qa-final` → guardar → observar erro → cancelar → navegar/recarregar.
- **Expected:** sucesso confirmado ou falha sem persistência.
- **Observed:** UI informou `Não foi possível guardar as etiquetas`, mas a label apareceu persistida após navegação.
- **Impact:** o utilizador pode repetir uma mutação que já foi aplicada.
- **Recommended fix:** reconciliar estado autoritativo após resposta ambígua e usar CTA de refresh, não retry cego.
- **Evidence:** erro inicial e label posterior no diretório.

### PEOPLE-FINAL-P2-002

- **Severity:** P2
- **Surface:** Keyboard / shell navigation
- **Viewport:** 1363 × 936
- **Locale:** es
- **Theme:** System
- **Steps:** reload Home → primeiro `Tab` → `Enter`.
- **Expected:** skip link é o primeiro foco útil.
- **Observed:** `Sair` foi focado primeiro e Enter encerrou a sessão.
- **Impact:** navegação por teclado perde o atalho para o conteúdo e expõe uma ação disruptiva como primeiro foco.
- **Recommended fix:** colocar o skip link antes da ação de logout na ordem do DOM/foco.
- **Evidence:** active element após primeiro Tab era o botão `Sair`.

### PEOPLE-FINAL-P2-003

- **Severity:** P2
- **Surface:** Localization
- **Viewport:** 1363 × 936
- **Locale:** en, es
- **Theme:** Light/Dark/System
- **Steps:** selecionar English ou Español no Home.
- **Expected:** shell totalmente localizado.
- **Observed:** `Sair` permaneceu em português.
- **Impact:** experiência multilíngue inconsistente numa ação crítica de sessão.
- **Recommended fix:** mover o label para o catálogo i18n do shell.
- **Evidence:** restante navegação traduzida; logout não traduzido.

## P0

NONE.

## P1

- PEOPLE-FINAL-P1-001 — Transfers load indisponível.
- PEOPLE-FINAL-P1-002 — Hourglass execute indisponível.
- PEOPLE-FINAL-P1-003 — contactos do Add Person não persistem.

## P2

- PEOPLE-FINAL-P2-001 — label aplicada apesar de erro apresentado.
- PEOPLE-FINAL-P2-002 — ordem de foco começa em logout antes do skip link.
- PEOPLE-FINAL-P2-003 — logout não localizado em en/es.

## UX

| Superfície | Avaliação |
|---|---|
| Overview | Good |
| Directory | Good |
| Profile | Good |
| Add Person | Poor — pede contactos que não persistem |
| Map | Good |
| Transfers | Poor — bloqueado no load |
| Hourglass | Needs improvement — preview claro, execute indisponível |
| Emergency | Needs improvement — indisponível com as permissões atuais |
| Record Cards | Needs improvement — capability ausente, recovery limitada |
| Contact List | Needs improvement — capability ausente, sem conta QA positiva |

## Cleanup

**Dados QA criados:**

- Pessoa `QA Final 20260828 Revisto`.
- Contactos sintéticos pelo editor dedicado.
- Uma decisão explícita de elegibilidade.
- Uma ausência histórica sintética (02–03/08/2026).
- Label `qa-final`.
- Localização aproximada em Lisboa.
- Fixture Hourglass local temporária; removida do worktree após o teste.

**Dados QA removidos:** nenhum dado de produção foi removido.

**Resíduos:** a pessoa e os dados sintéticos associados permanecem no tenant QA. O import Hourglass não criou pessoa nem escrita parcial.

**Motivo:** a confirmação obrigatória imediatamente anterior às ações destrutivas de arquivo/remoção não foi concedida. Nenhum dado real foi alterado para cleanup.

## Gates Locais no SHA Exato

| Gate | Estado |
|---|---|
| `npm run typecheck` | PASS |
| `npm test` | PASS |
| `npm run test:browser-regression --workspace @eutaktos/web-pwa` | FAIL em `test:production-mount`; typecheck, 441 unit tests, bundle budget e PWA privacy passaram antes da falha |

## Final Recommendation

Can People be declared technically complete?  
**NO**

Can People be declared production-accepted?  
**NO**

Can People be declared UX reference-quality?  
**NO**

Can PX10.17 be checked?  
**NO**

Can PX10.6 be checked?  
**NO**

Can PX10.18 Principal final review be performed?  
**YES — para avaliar este resultado NOT READY e devolver os P1 para correção.**
