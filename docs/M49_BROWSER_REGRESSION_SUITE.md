# M49 — Suite de regressão de browser

**Autor:** Manus AI
**Base de execução:** PWA local construída e servida no sandbox.

A suite M49 reúne verificações já existentes numa ordem determinística. Ela não cria dados de organização, não abre o deployment público e não substitui testes E2E que precisem de API integrada. O primeiro comando que falhar interrompe a execução e apresenta a forma de o reproduzir.

| Verificação | Cobertura | Comando executado pela suite |
|---|---|---|
| Tipagem | Contratos TypeScript do frontend | `npm run typecheck` |
| Testes unitários | Funções de apresentação, validação e APIs frontend | `npm test` |
| Montagem de produção | Build, manifesto, ícones e salvaguardas do service worker | `npm run test:production-mount` |
| Browser UX | Navegação, três idiomas, 320px, skip link, landmarks, contraste e estado activo | `npm run test:ux-runtime` |
| Inspector Hourglass | Fixture sanitizada, erros seguros, limite, CSV e ausência de persistência | `npm run test:hourglass-inspector` |

## Execução

```text
npm run test:browser-regression --workspace @eutaktos/web-pwa
```

| Cenário externo | Estado | Motivo |
|---|---|---|
| Leituras e escritas reais de organização | BLOCKED | Requer runtime/API integrado; a suite valida os estados frontend e não inventa respostas. |
| Android, iPhone, iPad e PWA instalada | NOT TESTED | Requer dispositivo ou aplicação instalada física; consultar a matriz M39 para o limite detalhado. |
| Dados Hourglass reais | NOT TESTED | A política da PWA exige fixtures sanitizadas; a suite não manipula exportações de utilizadores. |

> Um resultado aprovado significa que os verificadores locais concluíram os seus critérios. Não deve ser interpretado como prova de disponibilidade do backend ou de comportamento idêntico em todos os dispositivos físicos.
