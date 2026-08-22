# M39 — Verificação PWA e dispositivos

**Data da execução:** 22 de agosto de 2026. Este registo cobre a PWA tal como é construída e servida localmente a partir da `main` de origem da tarefa. Não são usados perfis de congregação, exports ou capturas que contenham dados pessoais.

> **Política de classificação.** Um resultado só é marcado como **PASS** quando foi reproduzido no build de produção local ou numa suite automatizada existente. Cenários que exigem um sistema operativo móvel, uma PWA instalada, rotação física ou um contexto de browser que o ambiente não expõe são marcados **NOT TESTED**, e não inferidos como aprovados.

| Área | Estado | Evidência repetível | Observação |
|---|---|---|---|
| Montagem do build de produção | PASS | `npm run test:production-mount --workspace @eutaktos/web-pwa` | O Chromium headless abriu o preview de `vite build` e encontrou o ponto de montagem da aplicação e o nome Eutaktos. |
| Metadados de instalação | PASS | Mesmo comando; `verify-production-mount.mjs` lê e valida `manifest.webmanifest` | Confirma `display: standalone`, `start_url: ./`, dois ícones publicados e os recursos devolvem HTTP de sucesso no preview. |
| Salvaguardas do service worker | PASS | Mesmo comando; valida o worker publicado | Confirma a exclusão de `/api/` e `/auth/`, o documento offline com `Cache-Control: no-store` e o cache restrito a recursos estáticos. Isto evita concluir que dados de congregação são guardados pelo cache geral. |
| Lógica de atualização e recuperação | PASS | `npm test --workspace @eutaktos/web-pwa` | A suite inclui `src/lib/pwaUpdate.test.ts`, que cobre registo, disponibilização de atualização, ativação e recuperação de erro do controlador. |
| Comportamento offline no browser headless | NOT TESTED | Ensaio CDP local tentado em Chromium headless | O worker tornou-se activo, mas o Chromium headless não expôs controlo do cliente após reload com rede emulada; portanto não foi possível afirmar que o documento offline foi apresentado como um utilizador o veria. Não foi alterado o worker para mascarar esta limitação. |
| Instalação Android | NOT TESTED | Sem dispositivo Android, Chrome Android ou modo instalado disponível | Requer abrir o manifesto e concluir a instalação num dispositivo/navegador compatível. |
| Instalação iPhone/iPad | NOT TESTED | Sem Safari iOS/iPadOS ou dispositivo físico disponível | Requer validação de “Adicionar ao ecrã principal”, modo standalone, área segura e regressar à aplicação. |
| Rotação e teclado virtual em dispositivo | NOT TESTED | Sem emulação de teclado real ou orientação física disponível | As verificações de layout por viewport pertencem à matriz M35; esta tarefa não afirma cobertura de hardware. |
| Atualização em PWA já instalada | NOT TESTED | Sem contexto standalone persistente | A lógica de atualização é exercida por testes unitários, mas o prompt e a substituição do worker em aplicação instalada devem ser confirmados manualmente. |

## Procedimento reprodutível

Execute os comandos abaixo a partir da raiz do repositório. O primeiro constrói a aplicação e abre o preview de produção numa porta local efémera usada pelo verificador. Além da montagem visual automatizada, o verificador lê os ficheiros efectivamente publicados pelo preview, impedindo que a validação se limite aos ficheiros-fonte.

```bash
npm run test:production-mount --workspace @eutaktos/web-pwa
npm run typecheck --workspace @eutaktos/web-pwa
npm test --workspace @eutaktos/web-pwa
npm run build --workspace @eutaktos/web-pwa
```

Para completar os itens **NOT TESTED**, instale a PWA num Android e em Safari iOS/iPadOS, faça um primeiro carregamento com rede, desligue a rede e carregue uma rota de documento. O resultado esperado é a página “Sem ligação”, sem informação de congregação. Depois de voltar a ligar, recarregue a aplicação e confirme que a interface principal regressa. Num contexto instalado, publique uma nova versão do worker e confirme a mensagem localizada de atualização, a acção “Atualizar agora” e o reload após `controllerchange`.

## Limites conhecidos

A validação M39 não reivindica compatibilidade de dispositivos que não foram disponibilizados. Também não afirma cache offline de dados ou de endpoints: o worker exclui deliberadamente API e autenticação, e o fallback documenta que páginas com dados sensíveis não são persistidas no cache geral. Esta é uma decisão de privacidade verificável no artefacto servido, não uma simulação de backend.
