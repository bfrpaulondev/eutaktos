# M50 Final V1 Acceptance — Reviewed

## Baseline

| Campo | Valor |
|---|---|
| Main revisada | `df839a3c5a918d84d7ad628b99850adf73275652` |
| Integrações confirmadas | PRs #167, #180, #181, #182 e #185 integradas na `main`. |
| Deployment canónico | `https://eutakes.netlify.app/` |
| Deployment não canónico | `https://eutaktos.vercel.app/` não é usado como gate de aceitação V1 nesta revisão. |
| CI principal | GitHub Actions run `32598760302` / CI #346. |
| Preview validado | Netlify deploy preview #185 em `eutakes` e `rainbow-zuccutto-00d981`, ambos com status de deploy `success`. |
| Browser CI | Chromium-compatible browser no runner Ubuntu 24.04, via `test:browser-regression`. |
| Supabase | Projeto dedicado Eutaktos, migrations V1 aplicadas e tenant piloto existente. |

## Executive result

**V1 implementation ACCEPTED at source/CI/Netlify-preview level. Production pilot acceptance remains BLOCKED pending direct verification of the canonical Netlify production deployment and authenticated end-to-end pilot flows.**

| Estado | Resultado desta revisão |
|---|---|
| PASS | Nenhuma regressão confirmada nos gates de código, browser, privacidade, bundle, PWA, routing ou persistence probe. |
| FAIL | **0 falhas confirmadas** após correção/reexecução. |
| BLOCKED | Verificação direta do deployment canónico e fluxos autenticados reais em browser. |
| NOT TESTED | Dispositivos físicos, zoom 200% e provider externo real. |

Esta revisão não converte ausência de evidência em PASS. Onde o ambiente não permitiu observar produção diretamente, o estado permanece `BLOCKED`.

## Correções ao M50 original

### 1. Vercel não é o deployment canónico

O M50 original auditou `https://eutaktos.vercel.app/` e classificou o build demo/stale e `/api/* -> index.html` como defeitos críticos do V1. Esse host não é o deployment canónico usado pelo projeto nesta fase. O alvo canónico é Netlify (`https://eutakes.netlify.app/`).

Os checks Vercel continuam a falhar por limite de builds da conta e podem ser limpos/desativados posteriormente, mas não são usados para rejeitar a release Netlify.

Consequentemente, os antigos CF-01, CF-02, CF-03 e a parte de CF-06 baseada no Vercel são **retirados como FAIL de V1**. Eles descrevem um deployment não canónico, não a release auditada.

### 2. A falha `/pessoas` era do teste, não da UI

O M50 original reportou timeout de `test:ux-runtime` em `/pessoas` pt-PT. A revisão principal promoveu `test:browser-regression` a job obrigatório de CI e tornou o diagnóstico do deep link explícito.

O runner observou durante a falha:

- location: `/pessoas`;
- lang: `pt-PT`;
- document title: `Eutaktos — Pessoas`;
- conteúdo real: `Pessoas e organização` e os controlos localizados esperados;
- document readyState: `complete`.

O defeito estava na segunda verificação de organização: ela usava o heading interno `Pessoas e organização` para construir incorretamente o título esperado `Eutaktos — Pessoas e organização`. O produto usa corretamente o título de secção `Eutaktos — Pessoas`.

PR #185 corrigiu a expectativa e manteve as asserções de conteúdo, locale, rota e título. Após a correção, o job `browser-regression` passou no CI #346. Os antigos CF-04 e CF-05 são, portanto, **resolvidos e não representam regressão de produto**.

### 3. Foi encontrado e corrigido um problema Netlify real

A revisão principal encontrou um problema que o M50 original não podia observar por estar no host errado: `netlify.toml` tinha rewrites de `/api` para a Netlify Function, mas não tinha fallback SPA para refresh/deep link.

PR #185 adicionou o fallback `/* -> /index.html` **depois** de `/api` e `/api/*`. Assim:

- `/api` e `/api/*` continuam destinados ao runtime serverless;
- `/agenda`, `/designacoes`, `/pessoas`, `/preferencias` e aliases podem carregar a SPA por navegação direta/refresh;
- o fallback SPA não engole a API.

Os dois deploy previews Netlify do PR #185 ficaram verdes.

## Gates automatizados

| Gate | Estado | Evidência |
|---|---|---|
| Typecheck raiz | PASS | CI #346 `quality`. |
| Unit tests raiz | PASS | CI #346 `quality`. |
| Production build | PASS | CI #346 `quality`. |
| Runtime dependency audit | PASS | CI #346 `quality`. |
| PWA unit tests | PASS | Browser regression executou 28 ficheiros / 122 testes. |
| Bundle budget | PASS | chunk inicial `475700` bytes; abaixo do orçamento de 500 kB. |
| PWA privacy | PASS | storage limitado a preferências; cache exclui API/auth/authorization/query/private/no-store. |
| Production mount | PASS | manifesto, ícones e salvaguardas do service worker verificados. |
| UX runtime | PASS | pt-PT/en/es, deep links reais, títulos, organização/diálogos, foco, contraste e reflow 320px. |
| Hourglass inspector | PASS | incluído no `test:browser-regression`. |
| Browser regression | PASS | CI #346, Chromium-compatible browser no runner. |
| Netlify deploy previews | PASS | dois contexts de preview do PR #185 com `success`. |

O browser regression passa a ser gate permanente de CI; uma futura regressão desse conjunto não depende mais de auditoria manual para ser detectada.

## Functional matrix

| Área | Cenário | Estado | Observação |
|---|---|---|---|
| Baseline | M41–M49, K41–K50, A06 e K47 hardening integrados | PASS | PRs #167/#180/#181/#182/#185 na `main`. |
| People UI | Deep link, locale, loading/error/empty, privacy e retry | PASS | Browser regression + testes unitários. |
| People produção | list/create/edit/persistência/refresh com sessão real | BLOCKED | Requer sessão piloto autorizada no deployment canónico. |
| Organização UI | Households, grupos e responsabilidades | PASS | Cobertura frontend integrada. |
| Organização produção | CRUD real após refresh | BLOCKED | Requer sessão/API de produção observável. |
| Acessos/auditoria UI | confirmação, foco, erros seguros | PASS | Cobertura frontend integrada. |
| Acessos/auditoria produção | grant/revoke/audit real | BLOCKED | Requer sessão autorizada e produção observável. |
| Agenda/Designações UI | estados loading/error/empty/real, sem fallback demo | PASS | A06 + browser/unit gates. |
| Scheduling persistence | entity + audit + outbox atómicos; stale version rejeitada | PASS | Probe controlado no Supabase Eutaktos, revertido sem resíduos. |
| Scheduling browser E2E | criar, alterar, atribuir, substituir, publicar e persistir após refresh | BLOCKED | Requer sessão piloto no Netlify canónico. |
| Eligibility/availability/conflict | regras de domínio/application adversariais | PASS | Suites K41–K50 e A06. |
| Eligibility/availability/conflict produção | rejeições observadas no browser real | BLOCKED | Requer dados piloto e sessão autorizada. |
| Tenant isolation | testes locais/adversariais | PASS | Cobertura de serviços/runtime. |
| Tenant isolation produção | prova cross-tenant em deployment | BLOCKED | Deve usar tenants de teste isolados; não usar dados reais de terceiros. |
| Assignment responses | domínio/application idempotente e actor-bound | PASS | K46 revisto. |
| Assignment responses UI produção | confirmar/recusar em sessão real | BLOCKED | Boundary/browser E2E ainda não observado. |
| Notification intent | consent-aware, pending, idempotente, sem falso delivery | PASS | K47 + PR #182. |
| Provider externo | entrega observada | BLOCKED | Sem provider externo comprovado; não tratar intent como delivery. |
| Hourglass inspector | parsing/preview sanitizado | PASS | Browser regression. |

## Security / privacy

| Área | Estado | Evidência |
|---|---|---|
| Browser storage | PASS | somente preferências de apresentação. |
| Service-worker cache | PASS | API/auth/authorization/query/private/no-store excluídos. |
| Session/capabilities boundary | PASS em código/testes | tenant/actor/capabilities são derivados no servidor e não aceites do frontend. |
| CSRF/origin | PASS em código/testes | mutations exigem origem HTTPS configurada e `Sec-Fetch-Site: same-origin`. |
| Atomic persistence | PASS | entity/audit/outbox na mesma transação; optimistic versioning. |
| K47 delivery safety | PASS | intent incompleto não é reclamado pelo worker; provider não pode ser marcado como sucesso sem envelope completo/resposta real. |
| Produção autenticada | BLOCKED | requer sessão piloto autorizada no host canónico. |

## Responsive / accessibility / i18n

| Cenário | Estado | Evidência |
|---|---|---|
| Reflow 320px e navegação móvel | PASS | browser regression. |
| pt-PT / English / Español | PASS | browser regression com rotas/títulos/diálogos localizados. |
| Skip link, main, nav, aria-current, focus restore | PASS | browser regression. |
| Dark/high-contrast | PASS | browser regression. |
| Viewports 375/390/768/1024/1440 | PASS histórico | matriz M35 integrada; não substitui dispositivos físicos. |
| Android/iPhone/iPad físicos | NOT TESTED | sem hardware físico nesta auditoria. |
| Zoom 200% | NOT TESTED | não executado. |
| WCAG 2.2 AA completa | NOT TESTED | os gates cobrem requisitos importantes, mas não constituem certificação completa. |

## Production/runtime

| Endpoint/fluxo canónico | Estado | Evidência atual |
|---|---|---|
| `https://eutakes.netlify.app/` current production root | BLOCKED | O ambiente desta revisão não conseguiu obter resposta direta confiável do URL de produção. |
| `/api/health` em produção | BLOCKED | Handler e Netlify adapter têm testes; preview build é verde, mas resposta do URL de produção não foi observada diretamente. |
| `/api/ready` em produção | BLOCKED | Requer observar deployment com env server-only e Supabase dedicado configurados. |
| Deep-link refresh em produção | BLOCKED | Regra Netlify corrigida e preview verde; falta observação direta do deployment canónico após merge. |
| Netlify deploy preview | PASS | PR #185 teve dois deploy previews verdes. |
| Vercel | NOT A RELEASE GATE | Continua sujeito ao build-rate-limit e pode servir build antigo; não é o alvo V1 atual. |

## Remaining production acceptance blockers

1. Confirmar que a `main` `df839a3c5a918d84d7ad628b99850adf73275652` está efetivamente publicada em `https://eutakes.netlify.app/`.
2. Confirmar no host canónico que `/api/health` devolve JSON do runtime e que `/api/ready` devolve sucesso apenas com Supabase/configuração correta.
3. Usar uma sessão piloto autorizada e isolada para executar E2E de People, Organization, Access/Audit e Midweek Scheduling, incluindo refresh/persistência, conflitos e rejeições.
4. Manter provider externo de notificações `BLOCKED` até existir configuração real e prova de entrega; não é permitido converter intent pending em sucesso simulado.
5. Executar dispositivos físicos/zoom caso sejam exigidos como gate comercial final.

## Final verdict

**No confirmed source/CI/browser/preview failures remain after review. V1 is code-complete for the reviewed scope, but production pilot acceptance remains BLOCKED until the canonical Netlify production runtime and authenticated pilot flows are observed end-to-end.**

O M50 original foi corrigido porque usava um deployment Vercel não canónico como critério de rejeição e porque a falha `/pessoas` era uma expectativa incorreta do teste. A revisão preserva como `BLOCKED` tudo o que ainda não foi provado em produção, em vez de declarar PASS sem evidência.
