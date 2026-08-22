# M49 — Suite de regressão de browser revisada

**Base:** integração revisada M41–M49.

A suite reúne os verificadores reais da PWA e para no primeiro erro. Ela não inventa respostas de backend nem substitui os E2E que dependem de dados reais.

Execute:

```text
npm run test:browser-regression --workspace @eutaktos/web-pwa
```

A integração revisada executa, em ordem:

1. typecheck;
2. testes unitários;
3. budget de bundle e presença do chunk lazy de `SectionWorkspace`;
4. auditoria de privacidade PWA/service worker;
5. build e montagem de produção;
6. runtime de browser, deep links, foco, pt-PT/en/es, organização e 320 px;
7. inspector Hourglass com fixtures sanitizadas.

A versão original M49 não chamava automaticamente os novos gates M46 e M47 porque as tarefas foram desenvolvidas em branches independentes. A integração principal adiciona esses dois gates para impedir regressões de performance e privacidade.

Leituras/escritas reais, scheduling integrado, PWA instalada em hardware e dados Hourglass reais permanecem fora desta suite e devem ser classificados como `BLOCKED` ou `NOT TESTED` até a auditoria M50.
