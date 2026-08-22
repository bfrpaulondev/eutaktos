# M35 — Matriz de responsividade V1

Esta matriz documenta a validação visual não destrutiva da PWA local na branch M35. As capturas foram feitas sem dados de produção e sem operações de escrita. O conteúdo demonstrativo ainda existente nesta base não foi avaliado como funcionalidade; a verificação limita-se a estrutura, legibilidade, navegação e risco de overflow.

| Viewport | Orientação | Resultado | Evidência e observação |
|---|---|---|---|
| 320 × 800 | Retrato | PASS | Navegação inferior com quatro destinos legíveis; CTA em largura confortável; nenhum recorte horizontal visível no primeiro ecrã. |
| 375 × 812 | Retrato | PASS | Hierarquia, CTAs e cartões de uma coluna mantêm legibilidade; a barra inferior não encobre o primeiro cartão. |
| 390 × 844 | Retrato | PASS | Rótulos da navegação inferior completos; cartões e CTAs sem sobreposição visível. |
| 768 × 1024 | Retrato | PASS | Transição tablet preserva CTAs em linha e cartões sem colisão observável. |
| 1024 × 768 | Paisagem | PASS | Navegação lateral, conteúdo principal e grelha mantêm proporção confortável. |
| 1440 × 900 | Desktop | PASS | Largura do conteúdo, navegação lateral e grelha permanecem legíveis. |
| 320/375/390 com teclado virtual | Retrato | NOT TESTED | Requer emulação ou dispositivo móvel real. A PWA usa `100dvh`, diálogos limitados à altura dinâmica e `overscroll-behavior: contain` como mitigação. |
| Diálogos em 320 px | Retrato | NOT TESTED | Requer fluxo de API operacional para abrir todos os formulários. M35 garante largura/margens e acções com quebra de linha no CSS. |
| Android e iPhone/iPad | Retrato e paisagem | NOT TESTED | Requer dispositivos físicos ou emulação dedicada. |
| Texto longo em todas as línguas | Retrato e paisagem | PARTIAL | Os estilos permitem quebra de palavras em texto e chips; a validação manual completa pertence a M37. |

## Alterações implementadas

No máximo de 599 px, botões passam a ter altura mínima de 44 px. Os diálogos recebem altura máxima baseada em `100dvh`, margem reduzida, contenção de overscroll e acções que podem quebrar linha. Abaixo de 360 px, as acções de diálogo passam a ocupar uma linha inteira. Texto de componentes MUI e rótulos de chips pode quebrar palavras longas para evitar overflow horizontal.

> Esta matriz não declara conformidade de acessibilidade, compatibilidade universal de dispositivo ou sucesso de fluxos de dados. Os itens sem evidência suficiente permanecem explicitamente como `NOT TESTED`.
