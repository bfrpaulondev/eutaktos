# M60 — Gate final de hardening frontend/PWA

| Campo | Valor |
|---|---|
| Task ID | M60 |
| Branch | `manus/v1-m60-frontend-hardening-gate` |
| Base | `origin/main` actualizado em 22-08-2026 |
| Escopo | Frontend/PWA e documentação; sem alterações a API, backend, deploy ou segredos |

## Resultados comprovados nesta branch

| Gate | Estado | Evidência |
|---|---|---|
| Typecheck do monorepo | PASS | `npm run typecheck` terminou com sucesso. |
| Regressão browser M49 | PASS | `npm run test:browser-regression --workspace @eutaktos/web-pwa`: typecheck, 28 ficheiros/122 testes, bundle budget, privacidade PWA, production mount, UX runtime e Hourglass. |
| Build PWA | PASS | `npm run build --workspace @eutaktos/web-pwa` terminou com sucesso; bundle inicial 475 700 bytes (148,70 kB gzip). |
| UX/a11y local | PASS | O runtime confirma pt-PT/en/es, títulos/deep links, foco de Mais, 320px, skip link, landmarks, `aria-current`, dark/high contrast. |
| Privacidade PWA M49 | PASS | Cache estático exclui API, auth, Authorization, query e respostas private/no-store; storage é limitado às preferências. |
| M55 offline/install/update | NOT TESTED | A implementação está na PR independente #195, ainda não integrada na main deste gate. Comportamento físico iOS/Android permanece não testado. |
| M56 orçamento apertado | NOT TESTED | O limite 480 kB está na PR #196, ainda não integrada; a main actual passa o limite histórico de 500 kB. |
| M57 guardas de Cache Storage | NOT TESTED | O guarda adicional está na PR #197, ainda não integrada. Cabeçalhos do provider/deploy são BLOCKED por estarem fora do frontend. |
| M58 matriz expandida | NOT TESTED | A matriz está na PR #198, ainda não integrada; o UX runtime existente PASSA. |
| M59 baseline visual sanitizada | NOT TESTED | O script está na PR #199, ainda não integrada. Não há screenshots persistentes ou com dados pessoais. |
| E2E autenticado/pilot, CRUD, tenant isolation, delivery provider | BLOCKED | Produção Netlify tinha readiness `503 {"status":"not-ready","database":"unconfigured"}` no M50 pós-lote; não se inferiu PASS. |
| PWA físico/installação iOS/Android/teclado virtual | NOT TESTED | Não foram utilizados dispositivos físicos. |

## Limitações

A PR M60 não faz merge nem incorpora mudanças das PRs M55–M59, respeitando a regra de uma tarefa por branch. Após integração dessas PRs, este gate deve ser reexecutado contra uma main que as contenha. Nenhum estado BLOCKED ou NOT TESTED foi convertido em PASS.

## Comandos

```text
npm run typecheck
npm run test:browser-regression --workspace @eutaktos/web-pwa
npm run build --workspace @eutaktos/web-pwa
```
