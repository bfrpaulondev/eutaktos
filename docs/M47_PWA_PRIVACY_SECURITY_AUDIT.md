# M47 — Auditoria de privacidade e segurança da PWA

**Autor:** Manus AI
**Escopo:** `apps/web-pwa/**` e comportamento PWA estático local.
**Fora de escopo:** API, autenticação, controlo de acesso do servidor, configuração de cabeçalhos do deployment e alojamento.

Esta auditoria verifica somente o que pode ser demonstrado no frontend. O resultado não afirma que o servidor aplica autorização, isolamento de tenant ou cabeçalhos HTTP: essas garantias pertencem ao runtime/API integrado e requerem validação posterior nesse ambiente.

| Área | Estado | Evidência reproduzível | Resultado observado |
|---|---|---|---|
| Armazenamento do browser | PASS | `npm run test:pwa-privacy --workspace @eutaktos/web-pwa` | `App.tsx` é o único consumidor de armazenamento no código de produção e persiste apenas preferências locais sob `eutaktos.preferences.v4`. |
| Contactos, perfis, auditoria e Hourglass | PASS | Auditoria estática M47 e `npm run test:hourglass-inspector --workspace @eutaktos/web-pwa` | Não há armazenamento local, sessão ou IndexedDB para esses dados na PWA; o inspector Hourglass é analisado localmente sem persistência automática. |
| Cache de API e autenticação | PASS | `npm run test:production-mount --workspace @eutaktos/web-pwa` | O service worker exclui `/api/`, `/auth/`, pedidos com `Authorization` e documentos da cache estática. |
| Cache de URLs com query e respostas privadas | PASS | `npm run test:pwa-privacy --workspace @eutaktos/web-pwa` | Recursos com query são excluídos; a cache só aceita resposta same-origin básica sem `private` ou `no-store`. |
| Ecrã offline | PASS | `npm run test:production-mount --workspace @eutaktos/web-pwa` | O documento offline é gerado com `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Content-Type-Options: nosniff`; não contém dados do utilizador. |
| Limpeza de versões antigas da cache | PASS | Revisão de `public/sw.js` e montagem de produção | Na activação, o worker remove caches que não correspondam à versão estática actual. |
| Autorização, tenant isolation e revogação no servidor | BLOCKED | Requer runtime/API integrado e credenciais autorizadas | A PWA não pode provar nem substituir decisões de autorização do servidor. |
| Cabeçalhos CSP, HSTS, frame-ancestors e cookies do deployment | BLOCKED | Requer inspecção e controlo de hosting | Não foram alterados ficheiros de alojamento, DNS, secrets, Vercel/Netlify nem configuração de servidor. |
| Instalação e inspeção de cache em aplicação instalada num dispositivo físico | NOT TESTED | Requer Android/iOS ou desktop instalado | O comportamento do build local e do service worker foi testado; não se afirma equivalência a cada plataforma física. |

## Comandos de validação

```text
npm run typecheck --workspace @eutaktos/web-pwa
npm run test:pwa-privacy --workspace @eutaktos/web-pwa
npm run test:production-mount --workspace @eutaktos/web-pwa
npm test --workspace @eutaktos/web-pwa
npm run test:ux-runtime --workspace @eutaktos/web-pwa
```

Todos os comandos acima passaram na branch M47. O build pode ainda emitir o aviso preexistente de tamanho de bundle nesta base independente; a melhoria de code splitting pertence à PR M46 e não é assumida por esta auditoria.

> A PWA armazena preferências de apresentação no browser. Não deve ser interpretada como uma promessa de armazenamento offline de dados de congregação, de contactos ou de auditoria.
